// ─────────────────────────────────────────────
// Kavach — Fastify Authentication Middleware
// ─────────────────────────────────────────────
// Verifies Supabase JWTs from the Authorization header.
// Attaches the authenticated user to the request for
// downstream handlers to use.
//
// Usage:
//   // Protect a single route:
//   server.get('/api/analyses', { preHandler: [authenticate] }, handler)
//
//   // Protect all routes under a prefix:
//   server.register(async (instance) => {
//     instance.addHook('preHandler', authenticate)
//     instance.get('/analyses', handler)
//   }, { prefix: '/api' })

import { FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';

// ═══ Type Augmentation ═══════════════════════
// Extend Fastify's request type to include our user property.

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email?: string;
      role?: string;
    };
    accessToken?: string;
  }
}

// ═══ Token Extraction ════════════════════════

/**
 * Extracts the Bearer token from the Authorization header.
 * Returns null if the header is missing or malformed.
 */
function extractBearerToken(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

// ═══ Authentication Hook ═════════════════════

/**
 * Fastify preHandler hook that verifies the Supabase JWT.
 *
 * Extracts the Bearer token from the Authorization header,
 * verifies it with Supabase Auth, and attaches the user
 * to `request.user`.
 *
 * Returns 401 if:
 * - No Authorization header
 * - Invalid/expired token
 * - Supabase auth verification fails
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request);

  if (!token) {
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing Authorization header. Expected: Bearer <token>',
    });
    return;
  }

  try {
    // Create a temporary Supabase client to verify the token.
    // We use the anon key here — the token itself carries the user's identity.
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // getUser() verifies the JWT with the Supabase auth server.
    // This is MORE secure than just decoding the JWT locally.
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: error?.message || 'Invalid or expired token',
      });
      return;
    }

    // Attach user info and token to request for downstream handlers
    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    request.accessToken = token;
  } catch (err) {
    request.log.error(err, 'Auth middleware error');
    reply.code(401).send({
      error: 'Unauthorized',
      message: 'Authentication failed',
    });
  }
}

// ═══ Optional Auth Hook ══════════════════════

/**
 * Like `authenticate`, but does NOT reject unauthenticated requests.
 * If a valid token is present, attaches the user.
 * If not, continues without user (request.user = undefined).
 *
 * Useful for routes that work for both authenticated and anonymous users
 * (e.g., public report viewing with extra features for logged-in users).
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request);
  if (!token) return; // No token = anonymous, continue

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      request.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
      request.accessToken = token;
    }
  } catch {
    // Silent fail — treat as anonymous
  }
}
