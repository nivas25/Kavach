# Redis & Mastra Memory Configuration — Kavach v2.0

> **How Redis is used for temporary storage, inter-agent memory, session state, and caching.**

This document defines all Redis usage patterns in Kavach, including Mastra Memory configuration for the 5-round debate system.

*Last updated: July 2026*

---

## Overview

Redis serves **four purposes** in Kavach:

| Purpose | Key Pattern | TTL | Description |
|---------|------------|-----|-------------|
| **Extracted Document** | `doc:{session_id}` | 2 hours | Markdown + JSON from preprocessing |
| **Mastra Memory** | `debate:{session_id}:{clause_id}` | 2 hours | Inter-agent debate messages (5 rounds × 3 agents + verdict) |
| **Session State** | `session:{session_id}:status` | 1 hour | Pipeline progress tracking |
| **Query Cache** | `cache:qdrant:{collection}:{hash}` | 30 min | Cached Qdrant search results |

**Critical rule:** Redis is **temporary storage only**. All important data is transferred to Supabase after analysis completes. See `architecture/data-flow.md` for the full transfer process.

---

## Mastra Memory Configuration

```typescript
// src/mastra/memory/config.ts
import { Memory } from '@mastra/memory';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

await redisClient.connect();

export const memory = new Memory({
  storage: redisClient,
  options: {
    lastMessages: 20,          // Must hold 16 messages (5 rounds × 3 + 1 verdict)
    semanticRecall: false,     // We use explicit thread IDs, not semantic search
  },
});
```

---

## Memory Thread Structure — 5-Round Debate

### Thread ID Pattern

```
debate:{session_id}:{clause_id}
```

Each clause analysis creates a dedicated memory thread containing up to **16 messages**:

### Messages in a Debate Thread (in order)

| # | Agent | Round | Phase | Purpose |
|---|-------|-------|-------|---------|
| 1 | `user-advocate` | 1 | `opening_statements` | Initial position on user risks |
| 2 | `company-defender` | 1 | `opening_statements` | Initial position on business rationale |
| 3 | `india-legal-expert` | 1 | `opening_statements` | Initial legal analysis with Qdrant citations |
| 4 | `user-advocate` | 2 | `rebuttal_1` | Challenges Defender & Expert arguments |
| 5 | `company-defender` | 2 | `rebuttal_1` | Challenges Advocate & Expert arguments |
| 6 | `india-legal-expert` | 2 | `rebuttal_1` | Refines legal analysis based on debate |
| 7 | `user-advocate` | 3 | `rebuttal_2` | Deepens argument after seeing rebuttals |
| 8 | `company-defender` | 3 | `rebuttal_2` | Deepens argument after seeing rebuttals |
| 9 | `india-legal-expert` | 3 | `rebuttal_2` | Further legal refinement |
| 10 | `user-advocate` | 4 | `cross_examination` | Directly challenges specific claims |
| 11 | `company-defender` | 4 | `cross_examination` | Directly challenges specific claims |
| 12 | `india-legal-expert` | 4 | `cross_examination` | Verifies/corrects legal claims from both sides |
| 13 | `user-advocate` | 5 | `closing_arguments` | Final stance after hearing everything |
| 14 | `company-defender` | 5 | `closing_arguments` | Final stance after hearing everything |
| 15 | `india-legal-expert` | 5 | `closing_arguments` | Final legal position |
| 16 | `neutral-judge` | 6 | `verdict` | Final verdict + scores (JSON) |

### Message Format

```typescript
interface DebateMemoryMessage {
  role: string;           // Agent role identifier
  content: string;        // Full agent response text
  metadata: {
    agentName: string;    // 'user-advocate' | 'company-defender' | 'india-legal-expert' | 'neutral-judge'
    round: number;        // 1–6 (6 = verdict)
    phase: string;        // 'opening_statements' | 'rebuttal_1' | 'rebuttal_2' | 'cross_examination' | 'closing_arguments' | 'verdict'
    clauseId: string;
    sessionId: string;
    model: string;        // 'llama-3.3-70b-versatile' | 'gemini-2.5-pro'
    tokensUsed?: number;
    latencyMs?: number;
    timestamp: string;    // ISO 8601
  };
}
```

### Writing Messages

```typescript
// After Round 1 completes (all 3 agents, parallel)
await memory.add({
  threadId: `debate:${sessionId}:${clauseId}`,
  messages: [
    {
      role: 'user-advocate',
      content: advocateResponse,
      metadata: {
        agentName: 'user-advocate',
        round: 1,
        phase: 'opening_statements',
        clauseId,
        sessionId,
        model: 'llama-3.3-70b-versatile',
        tokensUsed: 1200,
        latencyMs: 850,
        timestamp: new Date().toISOString(),
      },
    },
    {
      role: 'company-defender',
      content: defenderResponse,
      metadata: {
        agentName: 'company-defender',
        round: 1,
        phase: 'opening_statements',
        clauseId,
        sessionId,
        model: 'llama-3.3-70b-versatile',
        timestamp: new Date().toISOString(),
      },
    },
    {
      role: 'india-legal-expert',
      content: expertResponse,
      metadata: {
        agentName: 'india-legal-expert',
        round: 1,
        phase: 'opening_statements',
        clauseId,
        sessionId,
        model: 'gemini-2.5-pro',
        timestamp: new Date().toISOString(),
      },
    },
  ],
});
```

### Reading Messages (for subsequent rounds)

```typescript
// Read all previous rounds for the next round's context
const previousMessages = await memory.get({
  threadId: `debate:${sessionId}:${clauseId}`,
});

// Read only Round 1 messages (for Round 2 rebuttals)
const round1Messages = await memory.get({
  threadId: `debate:${sessionId}:${clauseId}`,
  filter: { round: 1 },
});

// Read full debate for Judge verdict
const fullDebate = await memory.get({
  threadId: `debate:${sessionId}:${clauseId}`,
});

// Read specific agent's messages across all rounds
const legalExpertHistory = await memory.get({
  threadId: `debate:${sessionId}:${clauseId}`,
  filter: { agentName: 'india-legal-expert' },
});
```

---

## Extracted Document Storage

### Key Pattern

```
Key:     doc:{session_id}
Type:    Redis Hash
TTL:     7200 seconds (2 hours)
Fields:
  ├─ markdown   → Full LlamaParse Markdown output
  ├─ json       → Stringified JSON from Gemini 2.5 Pro extraction
  ├─ metadata   → { file_name, file_type, file_size, clause_count, upload_time }
  └─ status     → 'parsed' | 'extracted' | 'ready'
```

```typescript
// Store extracted document
await redis.hSet(`doc:${sessionId}`, {
  markdown: llamaParseOutput,
  json: JSON.stringify(geminiExtractionResult),
  metadata: JSON.stringify({
    file_name: 'employment_agreement.pdf',
    file_type: 'pdf',
    file_size: 245000,
    clause_count: 8,
    upload_time: new Date().toISOString(),
  }),
  status: 'ready',
});
await redis.expire(`doc:${sessionId}`, 7200);

// Read extracted document
const markdown = await redis.hGet(`doc:${sessionId}`, 'markdown');
const clauses = JSON.parse(await redis.hGet(`doc:${sessionId}`, 'json'));
```

---

## Session State Management

### Key Pattern

```
Key:     session:{session_id}:status
Type:    String (JSON)
TTL:     3600 seconds (1 hour)
```

### Session State Interface

```typescript
interface SessionState {
  sessionId: string;
  status: 'uploading' | 'parsing' | 'extracting' | 'debating' | 'scoring' | 'validating' | 'completed' | 'failed';
  currentClause: number;       // Which clause is being debated (1-indexed)
  totalClauses: number;        // Total clauses extracted
  completedClauses: number;    // How many clauses are fully done
  currentRound: number;        // Which debate round (1–5)
  currentPhase: string;        // Human-readable: "Round 3: Rebuttal 2"
  startedAt: string;           // ISO 8601
  estimatedCompletion: string; // ISO 8601
  error?: string;
}

// Update session status
async function updateSessionStatus(sessionId: string, update: Partial<SessionState>) {
  const key = `session:${sessionId}:status`;
  const current = JSON.parse(await redis.get(key) || '{}');
  const updated = { ...current, ...update };
  await redis.setEx(key, 3600, JSON.stringify(updated));
}

// Read session status (frontend polling)
async function getSessionStatus(sessionId: string): Promise<SessionState | null> {
  const data = await redis.get(`session:${sessionId}:status`);
  return data ? JSON.parse(data) : null;
}
```

---

## Qdrant Query Cache

```
Key:     cache:qdrant:{collection}:{queryHash}
Type:    String (JSON)
TTL:     1800 seconds (30 minutes)
```

```typescript
async function cachedQdrantSearch(
  collection: string,
  query: string,
  filters?: Record<string, any>
) {
  const queryHash = hashString(query + JSON.stringify(filters || {}));
  const cacheKey = `cache:qdrant:${collection}:${queryHash}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const results = await hybridSearch(collection, query, filters);
  await redis.setEx(cacheKey, 1800, JSON.stringify(results));

  return results;
}
```

---

## TTL Strategy Summary

| Key Pattern | TTL | Reason |
|------------|-----|--------|
| `doc:{session_id}` | 7200s (2h) | Must persist through full analysis pipeline |
| `debate:{session_id}:{clause_id}` | 7200s (2h) | 5-round debate + judge takes ~60–90s per clause |
| `session:{session_id}:status` | 3600s (1h) | Session tracking is shorter-lived |
| `cache:qdrant:*` | 1800s (30min) | Legal data is static; cache reduces redundant queries |

---

## Cleanup After Analysis

After the analysis is persisted to Supabase, all Redis data is cleaned up:

```typescript
async function cleanupDebateMemory(sessionId: string, clauseIds: string[]) {
  const keysToDelete = [
    `doc:${sessionId}`,
    `session:${sessionId}:status`,
    ...clauseIds.map(id => `debate:${sessionId}:${id}`),
  ];

  await redis.del(keysToDelete);
  console.log(`Cleaned up ${keysToDelete.length} Redis keys for session ${sessionId}`);
}
```

---

## Redis Connection

```typescript
// src/lib/redis.ts
import { createClient } from 'redis';

export const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redis.on('error', (err) => console.error('Redis connection error:', err));
redis.on('connect', () => console.log('Redis connected'));

if (!redis.isOpen) {
  await redis.connect();
}

export default redis;
```
