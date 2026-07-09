// ─────────────────────────────────────────────
// Kavach — Redis Key Builders
// ─────────────────────────────────────────────
// Single source of truth for ALL Redis key patterns.
// Import `keys` from this module — never hardcode key strings.
//
// Key Taxonomy:
//   doc:{session_id}                          → Hash  (extracted document)
//   session:{session_id}:status               → JSON  (pipeline progress)
//   debate:{session_id}:{clause_id}           → List  (debate messages)
//   verdict:{session_id}:{clause_id}          → JSON  (judge verdict)
//   cache:qdrant:{hash}                       → JSON  (search result cache)
//   lock:{session_id}:{clause_id}:{round}     → String (coordination lock)
//   sessions:active                           → Set   (active session index)

import { createHash } from 'crypto';

// ═══ Key Prefix Constants ════════════════════
// Exported for use in pattern-based operations (e.g., SCAN)

export const KEY_PREFIXES = {
  DOCUMENT: 'doc',
  SESSION: 'session',
  DEBATE: 'debate',
  VERDICT: 'verdict',
  CACHE_QDRANT: 'cache:qdrant',
  LOCK: 'lock',
  ACTIVE_SESSIONS: 'sessions:active',
} as const;

// ═══ Key Builder Functions ═══════════════════

export const keys = {
  // ─── Document Storage ──────────────────────
  // Hash containing: markdown, json, metadata, status
  // TTL: 2 hours

  /**
   * Redis key for the extracted document hash.
   * @example keys.document('a1b2c3d4-...') → 'doc:a1b2c3d4-...'
   */
  document: (sessionId: string): string =>
    `${KEY_PREFIXES.DOCUMENT}:${sessionId}`,

  // ─── Session Status ────────────────────────
  // JSON string with pipeline progress
  // TTL: 1 hour

  /**
   * Redis key for live pipeline status.
   * @example keys.sessionStatus('a1b2c3d4-...') → 'session:a1b2c3d4-...:status'
   */
  sessionStatus: (sessionId: string): string =>
    `${KEY_PREFIXES.SESSION}:${sessionId}:status`,

  // ─── Debate Messages ──────────────────────
  // List of JSON-serialized debate messages
  // TTL: 2 hours

  /**
   * Redis key for the debate thread of a specific clause.
   * @example keys.debate('a1b2c3d4-...', 'clause-001') → 'debate:a1b2c3d4-...:clause-001'
   */
  debate: (sessionId: string, clauseId: string): string =>
    `${KEY_PREFIXES.DEBATE}:${sessionId}:${clauseId}`,

  // ─── Judge Verdict ─────────────────────────
  // JSON string with scores and reasoning
  // TTL: 2 hours

  /**
   * Redis key for the judge's verdict on a specific clause.
   * @example keys.verdict('a1b2c3d4-...', 'clause-001') → 'verdict:a1b2c3d4-...:clause-001'
   */
  verdict: (sessionId: string, clauseId: string): string =>
    `${KEY_PREFIXES.VERDICT}:${sessionId}:${clauseId}`,

  // ─── Qdrant Cache ──────────────────────────
  // JSON string with cached search results
  // TTL: 30 minutes

  /**
   * Redis key for cached Qdrant search results.
   * The hash is a SHA-256 of (collection + query + filters) — see buildQdrantCacheHash().
   * @example keys.qdrantCache('a3f2...') → 'cache:qdrant:a3f2...'
   */
  qdrantCache: (hash: string): string =>
    `${KEY_PREFIXES.CACHE_QDRANT}:${hash}`,

  // ─── Coordination Lock ────────────────────
  // Simple string value (agent name holding the lock)
  // TTL: 5 minutes (auto-release safety net)

  /**
   * Redis key for a debate round coordination lock.
   * Prevents multiple agents from writing to the same round simultaneously.
   * @example keys.lock('a1b2c3d4-...', 'clause-001', 3) → 'lock:a1b2c3d4-...:clause-001:3'
   */
  lock: (sessionId: string, clauseId: string, round: number): string =>
    `${KEY_PREFIXES.LOCK}:${sessionId}:${clauseId}:${round}`,

  // ─── Active Sessions Set ──────────────────
  // Set of session IDs — operational index for monitoring/cleanup

  /**
   * Redis key for the set of all currently active sessions.
   * @example keys.activeSessions() → 'sessions:active'
   */
  activeSessions: (): string => KEY_PREFIXES.ACTIVE_SESSIONS,

  // ─── Bulk Key Collection (for cleanup) ────

  /**
   * Returns ALL Redis keys associated with a session.
   * Used during Phase 5 cleanup after Supabase persistence.
   *
   * @param sessionId - The session to clean up
   * @param clauseIds - All clause IDs that were debated
   * @returns Array of all keys to delete
   */
  allForSession: (sessionId: string, clauseIds: string[]): string[] => {
    const sessionKeys = [
      keys.document(sessionId),
      keys.sessionStatus(sessionId),
    ];

    const clauseKeys = clauseIds.flatMap((clauseId) => [
      keys.debate(sessionId, clauseId),
      keys.verdict(sessionId, clauseId),
      // Include lock keys for all 5 debate rounds + 1 verdict round
      ...Array.from({ length: 6 }, (_, i) =>
        keys.lock(sessionId, clauseId, i + 1)
      ),
    ]);

    return [...sessionKeys, ...clauseKeys];
  },
};

// ═══ Cache Hash Builder ══════════════════════

/**
 * Builds a deterministic SHA-256 hash for Qdrant cache keys.
 *
 * Produces the same hash for the same (collection, query, filters)
 * combination regardless of object key ordering.
 *
 * @param collection - Qdrant collection name
 * @param query - The search query text
 * @param filters - Optional filter parameters
 * @returns First 16 characters of the SHA-256 hex digest
 */
export function buildQdrantCacheHash(
  collection: string,
  query: string,
  filters?: Record<string, unknown>
): string {
  // Sort filter keys for deterministic hashing
  const normalizedFilters = filters
    ? JSON.stringify(filters, Object.keys(filters).sort())
    : '';

  const input = `${collection}|${query}|${normalizedFilters}`;
  const hash = createHash('sha256').update(input).digest('hex');

  // First 16 chars = 64 bits of entropy — collision-safe for cache keys
  return hash.substring(0, 16);
}
