// ─────────────────────────────────────────────
// Kavach — Redis Service Layer
// ─────────────────────────────────────────────
// All Redis operations grouped by domain.
// This is the ONLY module that should import redis + keys + types.
// Every other module imports from here.
//
// Domains:
//   1. Document operations   — save/get extracted documents
//   2. Session operations    — pipeline status tracking
//   3. Debate operations     — message append/read
//   4. Verdict operations    — judge verdict save/get
//   5. Cache operations      — Qdrant result caching
//   6. Lock operations       — agent coordination
//   7. Cleanup operations    — session teardown + active index

import { redis, REDIS_TTL } from './redis';
import { keys, buildQdrantCacheHash } from './redisKeys';
import type {
  RedisDocumentData,
  RedisDocumentMetadata,
  RedisSessionStatus,
  RedisDebateMessage,
  RedisVerdict,
  RedisQdrantCache,
  SaveDocumentInput,
  UpdateSessionStatusInput,
  AppendDebateMessageInput,
  SessionPhase,
} from '../types/redis';

// ╔══════════════════════════════════════════════════════════════╗
// ║  1. DOCUMENT OPERATIONS                                      ║
// ║  Key: doc:{session_id} (Hash, TTL: 2h)                       ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Saves the extracted document (Markdown + structured JSON + metadata) to Redis.
 *
 * Called after Phase 1 (LlamaParse + Gemini extraction) completes.
 * Uses a pipeline to set all hash fields + TTL in a single HTTP request.
 *
 * @param sessionId - The universal session identifier
 * @param input - Document data to store
 */
export async function saveDocument(
  sessionId: string,
  input: SaveDocumentInput
): Promise<void> {
  const key = keys.document(sessionId);

  // Pipeline: batch the HSET + EXPIRE into one HTTP round-trip
  const pipeline = redis.pipeline();

  pipeline.hset(key, {
    markdown: input.markdown,
    json: input.json,
    metadata: JSON.stringify(input.metadata),
    status: 'ready',
  });

  pipeline.expire(key, REDIS_TTL.DOCUMENT);

  await pipeline.exec();
}

/**
 * Retrieves the full document data from Redis.
 *
 * Returns null if the session doesn't exist or has expired.
 * Called by the Mastra workflow at the start of Phase 2.
 */
export async function getDocument(
  sessionId: string
): Promise<RedisDocumentData | null> {
  const key = keys.document(sessionId);
  const data = await redis.hgetall<Record<string, string>>(key);

  // hgetall returns {} for non-existent keys in Upstash
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return {
    markdown: data.markdown ?? '',
    json: data.json ?? '',
    metadata: data.metadata ? JSON.parse(data.metadata) : null,
    status: (data.status as RedisDocumentData['status']) ?? 'processing',
  };
}

/**
 * Retrieves a single field from the document hash.
 *
 * More efficient than getDocument() when you only need one field.
 * Example: agents only need the JSON clauses, not the full markdown.
 *
 * @param sessionId - The session identifier
 * @param field - Which field to retrieve ('markdown' | 'json' | 'metadata' | 'status')
 */
export async function getDocumentField(
  sessionId: string,
  field: keyof RedisDocumentData
): Promise<string | null> {
  const key = keys.document(sessionId);
  const value = await redis.hget<string>(key, field);
  return value ?? null;
}

/**
 * Updates the document status field (e.g., from 'processing' to 'ready').
 */
export async function updateDocumentStatus(
  sessionId: string,
  status: RedisDocumentData['status']
): Promise<void> {
  const key = keys.document(sessionId);
  await redis.hset(key, { status });
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  2. SESSION STATUS OPERATIONS                                ║
// ║  Key: session:{session_id}:status (JSON, TTL: 1h)            ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Updates the pipeline status for a session.
 *
 * Called at each phase transition. The frontend can poll this
 * to show real-time progress (e.g., "Debating clause 3 of 8, Round 2").
 *
 * Merges the update with the existing status to preserve fields
 * not included in the update (e.g., startedAt, totalClauses).
 */
export async function updateSessionStatus(
  sessionId: string,
  update: UpdateSessionStatusInput
): Promise<void> {
  const key = keys.sessionStatus(sessionId);
  const now = new Date().toISOString();

  // Read existing status to merge (preserves startedAt, totalClauses, etc.)
  const existing = await redis.get<RedisSessionStatus>(key);

  const status: RedisSessionStatus = {
    status: update.status,
    message: update.message,
    currentClause: update.currentClause ?? existing?.currentClause ?? 0,
    totalClauses: update.totalClauses ?? existing?.totalClauses ?? 0,
    completedClauses: update.completedClauses ?? existing?.completedClauses ?? 0,
    currentRound: update.currentRound ?? existing?.currentRound,
    startedAt: existing?.startedAt ?? now,
    updatedAt: now,
    error: update.error,
  };

  // Pipeline: SET + EXPIRE in one round-trip
  const pipeline = redis.pipeline();
  pipeline.set(key, JSON.stringify(status));
  pipeline.expire(key, REDIS_TTL.SESSION_STATUS);
  await pipeline.exec();
}

/**
 * Creates the initial session status when a new analysis begins.
 *
 * Called immediately after session_id generation in Phase 1.
 */
export async function initializeSessionStatus(
  sessionId: string,
  totalClauses: number
): Promise<void> {
  await updateSessionStatus(sessionId, {
    status: 'parsing',
    message: 'Parsing uploaded document...',
    currentClause: 0,
    totalClauses,
    completedClauses: 0,
  });
}

/**
 * Retrieves the current pipeline status for a session.
 *
 * Returns null if the session doesn't exist or has expired.
 * Called by the frontend polling endpoint.
 */
export async function getSessionStatus(
  sessionId: string
): Promise<RedisSessionStatus | null> {
  const key = keys.sessionStatus(sessionId);
  const data = await redis.get<string>(key);

  if (!data) return null;

  // Handle both string and pre-parsed object from Upstash
  return typeof data === 'string' ? JSON.parse(data) : data;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  3. DEBATE OPERATIONS                                        ║
// ║  Key: debate:{session_id}:{clause_id} (List, TTL: 2h)        ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Appends a single debate message to the clause's debate history.
 *
 * Called immediately after each LLM response — "write-ahead" pattern
 * ensures no messages are lost even if the pipeline crashes after.
 *
 * Uses RPUSH for O(1) append to the end of the list.
 *
 * @param sessionId - The session identifier
 * @param clauseId - The clause being debated (e.g., 'clause-001')
 * @param input - The debate message to append
 */
export async function appendDebateMessage(
  sessionId: string,
  clauseId: string,
  input: AppendDebateMessageInput
): Promise<void> {
  const key = keys.debate(sessionId, clauseId);

  const message: RedisDebateMessage = {
    ...input,
    createdAt: new Date().toISOString(),
  };

  // Pipeline: RPUSH + EXPIRE in one round-trip
  // Re-setting EXPIRE on each message ensures the TTL is refreshed
  // from the latest write, not the first.
  const pipeline = redis.pipeline();
  pipeline.rpush(key, JSON.stringify(message));
  pipeline.expire(key, REDIS_TTL.DEBATE);
  await pipeline.exec();
}

/**
 * Retrieves the full debate history for a clause.
 *
 * Returns all messages in chronological order (oldest first).
 * Called by:
 *   - Agents reading previous rounds before producing rebuttals
 *   - The Neutral Judge reading the complete debate before scoring
 *   - Phase 5 when transferring to Supabase
 */
export async function getDebateHistory(
  sessionId: string,
  clauseId: string
): Promise<RedisDebateMessage[]> {
  const key = keys.debate(sessionId, clauseId);

  // LRANGE 0 -1 = get entire list
  const rawMessages = await redis.lrange<string>(key, 0, -1);

  if (!rawMessages || rawMessages.length === 0) {
    return [];
  }

  return rawMessages.map((msg) =>
    typeof msg === 'string' ? JSON.parse(msg) : msg
  );
}

/**
 * Retrieves debate messages filtered by round number.
 *
 * More targeted than getDebateHistory() — used when an agent
 * only needs to read a specific round's arguments.
 *
 * Note: This fetches the full list and filters client-side.
 * For our data sizes (max 18 messages per clause), this is efficient.
 */
export async function getDebateRound(
  sessionId: string,
  clauseId: string,
  round: number
): Promise<RedisDebateMessage[]> {
  const allMessages = await getDebateHistory(sessionId, clauseId);
  return allMessages.filter((msg) => msg.round === round);
}

/**
 * Returns the count of messages in a debate thread.
 *
 * Useful for progress tracking without loading all message content.
 * Expected: 3 messages per round × 5 rounds + 1 verdict = 16 messages max.
 */
export async function getDebateMessageCount(
  sessionId: string,
  clauseId: string
): Promise<number> {
  const key = keys.debate(sessionId, clauseId);
  return await redis.llen(key);
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  4. VERDICT OPERATIONS                                       ║
// ║  Key: verdict:{session_id}:{clause_id} (JSON, TTL: 2h)       ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Saves the Neutral Judge's verdict for a clause.
 *
 * Called after the judge processes the full 5-round debate.
 * The verdict is stored separately from debate messages because
 * it has a different structure and is accessed independently
 * during benchmarking and report generation.
 */
export async function saveVerdict(
  sessionId: string,
  clauseId: string,
  verdict: RedisVerdict
): Promise<void> {
  const key = keys.verdict(sessionId, clauseId);

  const pipeline = redis.pipeline();
  pipeline.set(key, JSON.stringify(verdict));
  pipeline.expire(key, REDIS_TTL.VERDICT);
  await pipeline.exec();
}

/**
 * Retrieves the judge's verdict for a clause.
 *
 * Returns null if the verdict hasn't been produced yet.
 */
export async function getVerdict(
  sessionId: string,
  clauseId: string
): Promise<RedisVerdict | null> {
  const key = keys.verdict(sessionId, clauseId);
  const data = await redis.get<string>(key);

  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

/**
 * Retrieves all verdicts for a session (all clauses).
 *
 * Used during report generation to compile the final risk analysis.
 * Uses a pipeline to fetch all verdicts in one HTTP round-trip.
 */
export async function getAllVerdicts(
  sessionId: string,
  clauseIds: string[]
): Promise<Map<string, RedisVerdict>> {
  if (clauseIds.length === 0) return new Map();

  const pipeline = redis.pipeline();
  for (const clauseId of clauseIds) {
    pipeline.get(keys.verdict(sessionId, clauseId));
  }

  const results = await pipeline.exec<(string | null)[]>();
  const verdicts = new Map<string, RedisVerdict>();

  for (let i = 0; i < clauseIds.length; i++) {
    const data = results[i];
    if (data) {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      verdicts.set(clauseIds[i], parsed);
    }
  }

  return verdicts;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  5. CACHE OPERATIONS                                         ║
// ║  Key: cache:qdrant:{sha256} (JSON, TTL: 30min)                ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Checks the cache for existing Qdrant search results.
 *
 * Call this BEFORE hitting Qdrant to avoid redundant vector searches.
 * Returns null on cache miss.
 *
 * @param collection - Qdrant collection name
 * @param query - The search query text
 * @param filters - Optional filter parameters
 */
export async function getCachedQdrantResult<T = unknown>(
  collection: string,
  query: string,
  filters?: Record<string, unknown>
): Promise<T[] | null> {
  const hash = buildQdrantCacheHash(collection, query, filters);
  const key = keys.qdrantCache(hash);

  const cached = await redis.get<string>(key);
  if (!cached) return null;

  const parsed: RedisQdrantCache<T> =
    typeof cached === 'string' ? JSON.parse(cached) : cached;
  return parsed.results;
}

/**
 * Caches Qdrant search results for future lookups.
 *
 * Call this AFTER a successful Qdrant search.
 * The 30-minute TTL balances freshness with API efficiency.
 *
 * @param collection - Qdrant collection name
 * @param query - The search query text
 * @param results - The search results to cache
 * @param filters - Optional filter parameters (must match getCachedQdrantResult call)
 */
export async function cacheQdrantResult<T = unknown>(
  collection: string,
  query: string,
  results: T[],
  filters?: Record<string, unknown>
): Promise<void> {
  const hash = buildQdrantCacheHash(collection, query, filters);
  const key = keys.qdrantCache(hash);

  const cacheEntry: RedisQdrantCache<T> = {
    collection,
    query,
    results,
    cachedAt: new Date().toISOString(),
  };

  const pipeline = redis.pipeline();
  pipeline.set(key, JSON.stringify(cacheEntry));
  pipeline.expire(key, REDIS_TTL.QDRANT_CACHE);
  await pipeline.exec();
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  6. LOCK OPERATIONS                                          ║
// ║  Key: lock:{session_id}:{clause_id}:{round} (String, TTL: 5m)║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Attempts to acquire a coordination lock for a debate round.
 *
 * Uses Redis SET NX (set-if-not-exists) with a 5-minute auto-expiry.
 * This prevents race conditions when parallel agents try to write
 * to the same round simultaneously (e.g., Round 1 opening statements).
 *
 * @param sessionId - The session identifier
 * @param clauseId - The clause being debated
 * @param round - The debate round number (1-6)
 * @param agent - The agent attempting to acquire the lock
 * @returns true if the lock was acquired, false if another agent holds it
 */
export async function acquireLock(
  sessionId: string,
  clauseId: string,
  round: number,
  agent: string
): Promise<boolean> {
  const key = keys.lock(sessionId, clauseId, round);

  // SET NX EX = set if not exists, with expiry
  const result = await redis.set(key, agent, {
    nx: true,
    ex: REDIS_TTL.LOCK,
  });

  return result === 'OK';
}

/**
 * Releases a coordination lock, but ONLY if the caller holds it.
 *
 * This prevents Agent A from accidentally releasing Agent B's lock.
 * Uses a GET + conditional DEL pattern.
 *
 * @param sessionId - The session identifier
 * @param clauseId - The clause being debated
 * @param round - The debate round number
 * @param agent - The agent attempting to release (must match acquirer)
 * @returns true if the lock was released, false if it wasn't held by this agent
 */
export async function releaseLock(
  sessionId: string,
  clauseId: string,
  round: number,
  agent: string
): Promise<boolean> {
  const key = keys.lock(sessionId, clauseId, round);

  // Check who holds the lock
  const holder = await redis.get<string>(key);
  if (holder !== agent) return false;

  await redis.del(key);
  return true;
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  7. CLEANUP & SESSION INDEX OPERATIONS                       ║
// ║  Key: sessions:active (Set, no TTL)                           ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Registers a session in the active sessions index.
 *
 * Called when a new analysis begins (after session_id generation).
 * The active set is used for:
 *   - Monitoring how many analyses are running
 *   - Emergency cleanup if needed
 *   - Preventing duplicate session starts
 */
export async function registerActiveSession(
  sessionId: string
): Promise<void> {
  await redis.sadd(keys.activeSessions(), sessionId);
}

/**
 * Removes a session from the active sessions index.
 *
 * Called during Phase 5 cleanup after Supabase persistence.
 */
export async function unregisterActiveSession(
  sessionId: string
): Promise<void> {
  await redis.srem(keys.activeSessions(), sessionId);
}

/**
 * Returns all currently active session IDs.
 *
 * Useful for admin/monitoring endpoints.
 */
export async function getActiveSessions(): Promise<string[]> {
  const sessions = await redis.smembers<string[]>(keys.activeSessions());
  return sessions ?? [];
}

/**
 * Checks if a session is currently active.
 */
export async function isSessionActive(sessionId: string): Promise<boolean> {
  const result = await redis.sismember(keys.activeSessions(), sessionId);
  return result === 1;
}

/**
 * Deletes ALL Redis keys associated with a completed session.
 *
 * ⚠️ CRITICAL: Only call this AFTER data has been successfully
 * persisted to Supabase (Phase 5, Step 5.1).
 *
 * Uses a pipeline to delete all keys in a single HTTP round-trip.
 * The TTL safety net ensures data expires even if this fails.
 *
 * @param sessionId - The session to clean up
 * @param clauseIds - All clause IDs that were analyzed
 */
export async function cleanupSession(
  sessionId: string,
  clauseIds: string[]
): Promise<{ deletedKeys: number }> {
  const allKeys = keys.allForSession(sessionId, clauseIds);

  if (allKeys.length === 0) {
    return { deletedKeys: 0 };
  }

  // Pipeline: delete all keys in one HTTP round-trip
  const pipeline = redis.pipeline();
  for (const key of allKeys) {
    pipeline.del(key);
  }

  // Also remove from active sessions index
  pipeline.srem(keys.activeSessions(), sessionId);

  const results = await pipeline.exec();

  // Count how many keys were actually deleted (DEL returns 1 or 0)
  const deletedKeys = (results as unknown[]).reduce<number>(
    (sum: number, result: unknown) => sum + (typeof result === 'number' ? result : 0),
    0
  );

  return { deletedKeys };
}

// ╔══════════════════════════════════════════════════════════════╗
// ║  CONVENIENCE: Full Session Data Retrieval                    ║
// ║  Used during Phase 5 transfer to Supabase                    ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Retrieves ALL data for a session — document, debates, verdicts.
 *
 * Called once during Phase 5 to transfer everything to Supabase.
 * Uses pipelines wherever possible to minimize HTTP round-trips.
 */
export async function getFullSessionData(
  sessionId: string,
  clauseIds: string[]
): Promise<{
  document: RedisDocumentData | null;
  status: RedisSessionStatus | null;
  debates: Map<string, RedisDebateMessage[]>;
  verdicts: Map<string, RedisVerdict>;
}> {
  // Fetch document and status in parallel
  const [document, status] = await Promise.all([
    getDocument(sessionId),
    getSessionStatus(sessionId),
  ]);

  // Fetch all debate histories in parallel
  const debatePromises = clauseIds.map(async (clauseId) => {
    const messages = await getDebateHistory(sessionId, clauseId);
    return [clauseId, messages] as const;
  });

  const debateEntries = await Promise.all(debatePromises);
  const debates = new Map<string, RedisDebateMessage[]>(debateEntries);

  // Fetch all verdicts via pipeline
  const verdicts = await getAllVerdicts(sessionId, clauseIds);

  return { document, status, debates, verdicts };
}
