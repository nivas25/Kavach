// ─────────────────────────────────────────────
// Kavach — Mastra Memory Configuration
// ─────────────────────────────────────────────
// Configures the Redis-backed memory layer for Mastra agents.
//
// Mastra Memory uses "threads" to organize conversation history.
// In Kavach, each thread corresponds to one clause's debate:
//
//   threadId = "debate:{session_id}:{clause_id}"
//
// This aligns with the Redis key pattern in redisKeys.ts,
// so Mastra Memory threads and our direct Redis debate storage
// use the same addressing scheme.
//
// NOTE: This file provides the configuration and helper utilities.
// The actual Mastra Memory instance is created when initializing the
// Mastra framework in ../index.ts — it consumes these exports.

import { redis } from '../../lib/redis';
import { keys } from '../../lib/redisKeys';
import type { AgentRole } from '../../types/redis';

// ═══ Thread ID Builders ══════════════════════
// Mastra Memory organizes messages into threads.
// We use the same key pattern as our Redis debate lists.

/**
 * Builds a Mastra Memory thread ID for a clause debate.
 *
 * This matches the Redis key pattern `debate:{session_id}:{clause_id}`
 * used in redisKeys.ts, ensuring consistent addressing.
 *
 * @example getDebateThreadId('abc-123', 'clause-001') → 'debate:abc-123:clause-001'
 */
export function getDebateThreadId(
  sessionId: string,
  clauseId: string
): string {
  return keys.debate(sessionId, clauseId);
}

/**
 * Parses a thread ID back into its components.
 *
 * @example parseDebateThreadId('debate:abc-123:clause-001')
 *         → { sessionId: 'abc-123', clauseId: 'clause-001' }
 */
export function parseDebateThreadId(
  threadId: string
): { sessionId: string; clauseId: string } | null {
  const parts = threadId.split(':');
  if (parts.length < 3 || parts[0] !== 'debate') return null;

  // Session IDs are UUIDs with dashes, so we need to handle the split carefully
  // Format: debate:{uuid}:{clause_id}
  // The clause_id is always the last segment
  const clauseId = parts[parts.length - 1];
  const sessionId = parts.slice(1, -1).join(':');

  return { sessionId, clauseId };
}

// ═══ Mastra Memory Config ════════════════════

/**
 * Redis client instance for Mastra Memory.
 *
 * Exported so the Mastra initialization in ../index.ts can pass it
 * to the Memory constructor. We reuse the same client singleton
 * to avoid creating a second Upstash connection.
 */
export const memoryRedisClient = redis;

/**
 * Standard message metadata that every agent should attach
 * when writing to Mastra Memory.
 *
 * This metadata is read during Phase 5 when transferring
 * debate messages to the Supabase `debate_messages` table.
 */
export interface DebateMessageMetadata {
  /** Which agent produced this message */
  agentName: AgentRole;
  /** Debate round number (1-5 for debate, 6 for verdict) */
  round: number;
  /** Phase name */
  phase: string;
  /** LLM model used */
  model: string;
  /** Tokens consumed */
  tokensUsed: number;
  /** Response latency in milliseconds */
  latencyMs: number;
  /** The session this message belongs to */
  sessionId: string;
  /** The clause being debated */
  clauseId: string;
}

/**
 * Helper to build the metadata object for a debate message.
 *
 * Usage in an agent:
 * ```ts
 * const metadata = buildMessageMetadata({
 *   agentName: 'user-advocate',
 *   round: 1,
 *   phase: 'opening_statements',
 *   model: 'llama-3.3-70b-versatile',
 *   tokensUsed: 1200,
 *   latencyMs: 2500,
 *   sessionId: ctx.sessionId,
 *   clauseId: ctx.clauseId,
 * });
 * ```
 */
export function buildMessageMetadata(
  params: DebateMessageMetadata
): DebateMessageMetadata {
  return { ...params };
}
