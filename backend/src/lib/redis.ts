// ─────────────────────────────────────────────
// Kavach — Upstash Redis Client
// ─────────────────────────────────────────────
// Singleton Redis client using @upstash/redis (HTTP-based).
// Mirrors the qdrant.ts singleton pattern for consistency.
//
// IMPORTANT: Upstash Redis uses REST over HTTPS — there is no
// persistent TCP connection. Each command is an independent HTTP
// request. This means:
//   • No connection pooling or reconnection logic needed
//   • Slightly higher latency per command (~5-15ms vs ~0.5ms for TCP)
//   • Perfectly fine for our use case (Redis is not in the hot path)
//   • Pipeline support batches multiple commands into one HTTP request

import { Redis } from '@upstash/redis';

// ═══ Environment Validation ══════════════════

function validateRedisEnv(): { url: string; token: string } {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      '[Kavach Redis] Missing environment variables. ' +
        'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env. ' +
        'Get these from: https://console.upstash.com/redis'
    );
  }

  return { url, token };
}

// ═══ Singleton Client ════════════════════════
// Uses globalThis caching to survive ts-node-dev hot reloads in development.
// In production, the module is loaded once so this is a simple singleton.

const globalForRedis = globalThis as unknown as {
  kavachRedis: Redis | undefined;
};

function createRedisClient(): Redis {
  const { url, token } = validateRedisEnv();

  return new Redis({
    url,
    token,
    // Automatically retry on transient network errors
    retry: {
      retries: 3,
      backoff: (retryCount) => Math.min(1000 * 2 ** retryCount, 5000),
    },
  });
}

/**
 * The global Upstash Redis client for Kavach.
 *
 * Usage:
 * ```ts
 * import { redis } from '@/lib/redis';
 * await redis.set('key', 'value');
 * ```
 */
export const redis: Redis =
  globalForRedis.kavachRedis ?? createRedisClient();

// Preserve across hot reloads in development
if (process.env.NODE_ENV !== 'production') {
  globalForRedis.kavachRedis = redis;
}

// ═══ TTL Constants (seconds) ═════════════════
// Single source of truth for all expiration times.
// Referenced by redisService.ts — never hardcode TTLs elsewhere.

export const REDIS_TTL = {
  /** Extracted document hash — generous buffer over the 5-8min pipeline */
  DOCUMENT: 2 * 60 * 60, // 2 hours

  /** Pipeline status — only useful during active processing */
  SESSION_STATUS: 1 * 60 * 60, // 1 hour

  /** Debate message lists — must survive until Supabase transfer */
  DEBATE: 2 * 60 * 60, // 2 hours

  /** Judge verdict — same lifecycle as debate messages */
  VERDICT: 2 * 60 * 60, // 2 hours

  /** Qdrant search cache — short enough to stay fresh */
  QDRANT_CACHE: 30 * 60, // 30 minutes

  /** Coordination lock — auto-release safety net */
  LOCK: 5 * 60, // 5 minutes
} as const;

// ═══ Health Check ════════════════════════════

/**
 * Pings the Upstash Redis instance.
 * Returns true if the connection is healthy, false otherwise.
 *
 * Used by the Fastify /health endpoint.
 */
export async function pingRedis(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('[Kavach Redis] Health check failed:', error);
    return false;
  }
}

/**
 * Returns detailed Redis connection info for diagnostics.
 */
export async function getRedisInfo(): Promise<{
  connected: boolean;
  latencyMs: number;
}> {
  const start = Date.now();
  try {
    await redis.ping();
    return {
      connected: true,
      latencyMs: Date.now() - start,
    };
  } catch {
    return {
      connected: false,
      latencyMs: Date.now() - start,
    };
  }
}
