// ─────────────────────────────────────────────
// Kavach — Supabase Client (Backend)
// ─────────────────────────────────────────────
// Two clients for different access patterns:
//
// 1. supabaseAdmin — Service Role key, BYPASSES RLS.
//    Use for: writing analysis results, creating records on behalf of users,
//    and any operation that needs to ignore row-level security.
//    ⚠️  NEVER expose this to the frontend.
//
// 2. createUserClient(jwt) — User-scoped, RESPECTS RLS.
//    Use for: reading/writing data as a specific authenticated user.
//    Pass the JWT from the Authorization header.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ═══ Environment Validation ══════════════════

function validateSupabaseEnv(): {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
} {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      '[Kavach Supabase] Missing SUPABASE_URL. ' +
        'Get it from: https://supabase.com/dashboard/project/_/settings/api'
    );
  }

  if (!anonKey) {
    throw new Error('[Kavach Supabase] Missing SUPABASE_ANON_KEY.');
  }

  if (!serviceRoleKey) {
    throw new Error(
      '[Kavach Supabase] Missing SUPABASE_SERVICE_ROLE_KEY. ' +
        'This is the secret key that bypasses RLS — keep it safe.'
    );
  }

  return { url, anonKey, serviceRoleKey };
}

// ═══ Singleton Admin Client ══════════════════
// Uses globalThis caching for hot-reload safety (matches redis.ts + qdrant.ts pattern).

const globalForSupabase = globalThis as unknown as {
  supabaseAdmin: SupabaseClient | undefined;
};

function createAdminClient(): SupabaseClient {
  const { url, serviceRoleKey } = validateSupabaseEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      // Service role doesn't need session persistence
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Supabase admin client — bypasses Row Level Security.
 *
 * Use this for server-side operations that need full database access:
 * - Writing analysis results (Phase 5)
 * - Creating records during the pipeline
 * - Admin/monitoring operations
 *
 * ⚠️  NEVER pass this client to route handlers that face the user directly.
 */
export const supabaseAdmin: SupabaseClient =
  globalForSupabase.supabaseAdmin ?? createAdminClient();

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabaseAdmin = supabaseAdmin;
}

// ═══ User-Scoped Client ══════════════════════

/**
 * Creates a Supabase client scoped to a specific user.
 *
 * This client respects Row Level Security — the user can only
 * read/write their own data as defined by the RLS policies.
 *
 * @param accessToken - The JWT from the request Authorization header
 * @returns A Supabase client authenticated as the user
 *
 * Usage:
 * ```ts
 * const token = request.headers.authorization?.replace('Bearer ', '')
 * const supabase = createUserClient(token)
 * const { data } = await supabase.from('analyses').select('*')
 * // → Only returns analyses belonging to the authenticated user
 * ```
 */
export function createUserClient(accessToken: string): SupabaseClient {
  const { url, anonKey } = validateSupabaseEnv();

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ═══ Health Check ════════════════════════════

/**
 * Pings the Supabase instance to verify connectivity.
 * Used by the /health endpoint.
 */
export async function pingSupabase(): Promise<boolean> {
  try {
    // Simple query to verify the connection works
    const { error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}
