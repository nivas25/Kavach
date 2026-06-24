# Redis & Mastra Memory Configuration

This document defines how Redis is used via Mastra Memory for inter-agent message passing, session state, and caching.

---

## Overview

Redis serves three purposes in Kavach:

| Purpose | Description |
|---------|-------------|
| **Mastra Memory** | Inter-agent message passing during debates |
| **Session State** | Tracking analysis pipeline progress |
| **Response Cache** | Caching repeated Qdrant queries |

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
    lastMessages: 20,          // Keep enough for full debate (7 messages)
    semanticRecall: false,     // We use explicit thread IDs
  },
});
```

---

## Memory Thread Structure

### Debate Threads

Each clause analysis creates a dedicated memory thread:

```
Thread ID Pattern: debate:{sessionId}:{clauseId}
```

**Messages in a debate thread (in order):**

| # | Agent | Round | Purpose |
|---|-------|-------|---------|
| 1 | `user-advocate` | 1 | Opening argument |
| 2 | `company-defender` | 1 | Opening argument |
| 3 | `india-legal-expert` | 1 | Opening argument (with Qdrant citations) |
| 4 | `user-advocate` | 2 | Rebuttal |
| 5 | `company-defender` | 2 | Rebuttal |
| 6 | `india-legal-expert` | 2 | Rebuttal |
| 7 | `neutral-judge` | verdict | Final verdict + scores |

### Message Format

```typescript
interface DebateMemoryMessage {
  role: string;           // Agent role identifier
  content: string;        // Agent's argument/verdict
  metadata: {
    agentName: string;    // 'user-advocate' | 'company-defender' | ...
    round: number;        // 1 | 2 | 3 (verdict)
    clauseId: string;
    sessionId: string;
    model: string;        // LLM used
    timestamp: string;    // ISO 8601
  };
}
```

### Writing Messages

```typescript
// After an agent completes Round 1
await memory.add({
  threadId: `debate:${sessionId}:${clauseId}`,
  messages: [{
    role: 'user-advocate',
    content: advocateResponse,
    metadata: {
      agentName: 'user-advocate',
      round: 1,
      clauseId,
      sessionId,
      model: 'llama-3.1-70b-versatile',
      timestamp: new Date().toISOString(),
    },
  }],
});
```

### Reading Messages (for Round 2 / Judge)

```typescript
// Read all Round 1 messages for rebuttals
const round1Messages = await memory.get({
  threadId: `debate:${sessionId}:${clauseId}`,
  filter: { round: 1 },
});

// Read full debate for Judge
const fullDebate = await memory.get({
  threadId: `debate:${sessionId}:${clauseId}`,
});
```

---

## Session State Management

### Session Keys

```
Pattern: session:{sessionId}:status
Value:   JSON { status, currentClause, completedClauses, totalClauses, startedAt }
TTL:     3600 seconds (1 hour)
```

### Session Status Tracking

```typescript
interface SessionState {
  sessionId: string;
  status: 'uploading' | 'processing' | 'extracting' | 'debating' | 'scoring' | 'validating' | 'completed' | 'failed';
  currentClause: number;       // Which clause is being debated (1-indexed)
  totalClauses: number;        // Total clauses extracted
  completedClauses: number;    // How many are done
  currentStep: string;         // Human-readable status message
  startedAt: string;
  estimatedCompletion: string;
  error?: string;
}

// Update session status
async function updateSessionStatus(sessionId: string, update: Partial<SessionState>) {
  const key = `session:${sessionId}:status`;
  const current = JSON.parse(await redisClient.get(key) || '{}');
  const updated = { ...current, ...update };
  await redisClient.setEx(key, 3600, JSON.stringify(updated));
}

// Read session status (for frontend polling)
async function getSessionStatus(sessionId: string): Promise<SessionState | null> {
  const key = `session:${sessionId}:status`;
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
}
```

---

## Response Caching

### Qdrant Query Cache

Cache Qdrant search results to avoid redundant queries for similar clauses:

```
Pattern: cache:qdrant:{collectionName}:{queryHash}
Value:   JSON search results
TTL:     1800 seconds (30 minutes)
```

```typescript
async function cachedQdrantSearch(
  collection: string,
  query: string,
  filters?: Record<string, any>
) {
  const queryHash = hashString(query + JSON.stringify(filters));
  const cacheKey = `cache:qdrant:${collection}:${queryHash}`;
  
  // Check cache
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Query Qdrant
  const results = await hybridSearch(collection, query, filters);
  
  // Cache results
  await redisClient.setEx(cacheKey, 1800, JSON.stringify(results));
  
  return results;
}
```

---

## TTL (Time-to-Live) Strategy

| Key Pattern | TTL | Reason |
|------------|-----|--------|
| `debate:*` | 7200s (2 hours) | Debates should persist during analysis |
| `session:*:status` | 3600s (1 hour) | Session state is ephemeral |
| `cache:qdrant:*` | 1800s (30 minutes) | Legal data doesn't change frequently |

---

## Redis Connection

```typescript
// src/lib/redis.ts
import { createClient } from 'redis';

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (err) => console.error('Redis error:', err));
redisClient.on('connect', () => console.log('Redis connected'));

// Ensure connection on import
if (!redisClient.isOpen) {
  await redisClient.connect();
}

export default redisClient;
```

---

## Cleanup

After a report is completed and saved to PostgreSQL, debate messages in Redis can be cleaned up:

```typescript
async function cleanupDebateMemory(sessionId: string, clauseIds: string[]) {
  for (const clauseId of clauseIds) {
    await redisClient.del(`debate:${sessionId}:${clauseId}`);
  }
  await redisClient.del(`session:${sessionId}:status`);
}
```
