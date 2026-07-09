# Complete Data Flow — Kavach v2.0

> **The definitive guide to data movement through Kavach — from document upload to final report.**

This document traces every piece of data through the system, explains when and where it is stored, how sessions are managed, and how the system guarantees zero data loss.

*Last updated: July 2026*

---

## End-to-End Flow Summary

```
User Uploads Document
        │
        ▼
┌─ Phase 1: Preprocessing ─────────────────────────────────────────┐
│  Step 1.1: User onboarding (role, industry, concerns)            │
│  Step 1.2: LlamaParse → Convert PDF/DOCX to Markdown             │
│  Step 1.3: Gemini 2.5 Pro → Extract clauses into JSON            │
│  Step 1.4: Generate session_id                                    │
│  Step 1.5: Store Markdown + JSON → Redis (TTL: 2h)               │
└──────────────────────────────────┬────────────────────────────────┘
                                   │
                                   ▼
┌─ Phase 2: Multi-Agent Debate ────────────────────────────────────┐
│  Step 2.1: Mastra Workflow starts with session_id                │
│  Step 2.2: For each clause → 5-round debate:                     │
│            Round 1: Opening Statements (3 agents, parallel)      │
│            Round 2: Rebuttal 1 (3 agents, sequential)            │
│            Round 3: Rebuttal 2 (3 agents, sequential)            │
│            Round 4: Cross Examination (3 agents, sequential)     │
│            Round 5: Closing Arguments (3 agents, sequential)     │
│  Step 2.3: All messages stored → Redis (Mastra Memory)           │
│  Step 2.4: Agents query → Qdrant (laws + industry standards)     │
│  Step 2.5: Tool calls logged → Redis (then Supabase)             │
└──────────────────────────────────┬────────────────────────────────┘
                                   │
                                   ▼
┌─ Phase 3: Scoring & Verdict ─────────────────────────────────────┐
│  Step 3.1: Neutral Judge reads full debate from Mastra Memory    │
│  Step 3.2: Judge applies 3-Factor Scoring Formula                │
│  Step 3.3: Judge output → Redis (Mastra Memory)                  │
│  Step 3.4: Benchmarking (Qdrant queries)                         │
│  Step 3.5: Safer alternatives generated (Gemini 2.5 Pro)         │
└──────────────────────────────────┬────────────────────────────────┘
                                   │
                                   ▼
┌─ Phase 4: Safety Validation ─────────────────────────────────────┐
│  Step 4.1: Enkrypt AI Checkpoint 1 → Legal citation check        │
│  Step 4.2: Enkrypt AI Checkpoint 2 → Bias detection              │
│  Step 4.3: Enkrypt AI Checkpoint 3 → Output validation           │
└──────────────────────────────────┬────────────────────────────────┘
                                   │
                                   ▼
┌─ Phase 5: Persistence & Delivery ────────────────────────────────┐
│  Step 5.1: Transfer ALL data from Redis → Supabase               │
│            → analyses table (full results)                        │
│            → debate_messages table (every message)                │
│            → tool_usage_log table (every tool call)               │
│  Step 5.2: Clean up Redis keys                                    │
│  Step 5.3: Return report to frontend                              │
└──────────────────────────────────────────────────────────────────-┘
```

---

## Detailed Step-by-Step Data Flow

### Phase 1: Document Upload & Preprocessing

#### Step 1.1 — User Onboarding & Context Setting

```
Frontend (Next.js)
│
├─ User selects role: Job Seeker | Freelancer | Consumer | Custom
├─ User answers context questions (optional):
│   • Experience level (Fresher / Mid / Senior)
│   • Industry (IT / Consulting / Healthcare / etc.)
│   • Specific concerns (Non-compete / IP / Salary / etc.)
└─ Context object created
```

**Data created:**
```typescript
interface UserContext {
  role: 'job_seeker' | 'freelancer' | 'consumer' | 'custom';
  experience?: 'fresher' | 'mid' | 'senior';
  industry?: string;
  concerns?: string[];
  customContext?: string;
}
```

**Stored in:** Passed to API route (not stored yet)

---

#### Step 1.2 — LlamaParse: Document → Markdown

```
API Route receives file
│
├─ Validate file (type, size ≤ 10MB)
├─ Send to LlamaParse API
│   ├─ PDF: Full structural parsing (tables, headers, columns)
│   ├─ DOCX: Full structural parsing
│   └─ Text: Pass through (already text)
└─ Output: Clean, structured Markdown
```

**Data created:** `string` — Full Markdown representation of the document

**Stored in:** Held in memory, passed to Step 1.3

---

#### Step 1.3 — Gemini 2.5 Pro: Markdown → Structured JSON

```
Markdown from Step 1.2
│
├─ Send to Gemini 2.5 Pro with extraction prompt
├─ Extract:
│   ├─ Document metadata (parties, dates, contract type, jurisdiction)
│   ├─ Substantive clauses with categories
│   └─ Filter out boilerplate (headers, signatures, ToC)
└─ Output: Structured JSON
```

**Data created:**
```typescript
interface ExtractionResult {
  metadata: {
    parties: string[];
    contractType: string;
    effectiveDate?: string;
    jurisdiction?: string;
    governingLaw?: string;
  };
  clauses: Array<{
    id: string;
    category: ClauseCategory;
    originalText: string;
    summary: string;
    position: number;
  }>;
}
```

**Stored in:** Held in memory, passed to Step 1.5

---

#### Step 1.4 — Generate Session ID

```typescript
const sessionId = crypto.randomUUID(); // e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

**The `session_id` is the universal key** that links all data across Redis, Supabase, and Mastra Memory.

---

#### Step 1.5 — Store in Redis

```
Redis
│
├─ doc:{session_id}  (Hash, TTL: 2h)
│   ├─ markdown: Full LlamaParse output
│   ├─ json: Structured extraction from Gemini 2.5 Pro
│   ├─ metadata: { file_name, file_type, file_size, clause_count, upload_time }
│   └─ status: 'ready'
│
└─ session:{session_id}:status  (String/JSON, TTL: 1h)
    └─ { status: 'extracting', totalClauses: N, ... }
```

**Why Redis (not Supabase) at this stage?**
- Speed: Redis read/write is sub-millisecond
- The debate pipeline will read this data many times during the next 5–10 minutes
- No need for durability yet — the analysis hasn't completed
- If the process crashes, the user simply re-uploads (no stale data in Supabase)

---

### Phase 2: Multi-Agent Debate (Core Intelligence)

#### Step 2.1 — Start Mastra Workflow

```
Mastra Workflow Engine
│
├─ Input: { session_id, clauses[], userContext }
├─ Read extracted data from Redis: doc:{session_id}
├─ Update session status: 'debating'
└─ Begin clause-by-clause debate loop
```

---

#### Step 2.2 — 5-Round Debate Per Clause

For **each extracted clause**, the following sequence executes:

```
┌─── Round 1: Opening Statements ────────────────────────────────┐
│  Execution: PARALLEL (3 agents run simultaneously)              │
│                                                                  │
│  User Advocate (Groq Llama 3.3)                                 │
│  ├─ Input: clause text + user context                            │
│  ├─ Identifies risks, worst-case scenarios, power imbalances    │
│  └─ Output → Mastra Memory (Redis)                               │
│                                                                  │
│  Company Defender (Groq Llama 3.3)                               │
│  ├─ Input: clause text + industry standards (from Qdrant)        │
│  ├─ Explains business rationale, identifies standard aspects    │
│  └─ Output → Mastra Memory (Redis)                               │
│                                                                  │
│  India Legal Expert (Gemini 2.5 Pro)                             │
│  ├─ Input: clause text                                           │
│  ├─ Queries Qdrant for Indian laws, assesses enforceability     │
│  ├─ → Enkrypt AI Checkpoint 1 (hallucination check)             │
│  └─ Output → Mastra Memory (Redis)                               │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─── Round 2: Rebuttal 1 ────────────────────────────────────────┐
│  Execution: SEQUENTIAL (agents read Round 1 from Memory first)  │
│                                                                  │
│  Each agent reads the other two agents' Round 1 arguments       │
│  from Mastra Memory, then produces a rebuttal.                   │
│                                                                  │
│  All 3 rebuttals → Mastra Memory (Redis)                         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─── Round 3: Rebuttal 2 ────────────────────────────────────────┐
│  Same pattern: read Rounds 1-2, produce deeper arguments        │
│  All 3 messages → Mastra Memory (Redis)                          │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─── Round 4: Cross Examination ─────────────────────────────────┐
│  Agents directly challenge each other's specific claims         │
│  User Advocate vs. Company Defender (primary conflict)           │
│  Legal Expert verifies/corrects claims from both sides          │
│  → Enkrypt AI Checkpoint 1 (re-check legal citations)           │
│  All 3 messages → Mastra Memory (Redis)                          │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─── Round 5: Closing Arguments ─────────────────────────────────┐
│  Each agent gives final stance after hearing everything          │
│  All 3 messages → Mastra Memory (Redis)                          │
└──────────────────────────────────────────────────────────────────┘
```

**Data flow per round:**
```
Clause Text + Previous Rounds (from Redis)
    → Agent
    → LLM (Groq or Gemini)
    → Response
    → Mastra Memory (Redis): debate:{session_id}:{clause_id}
```

---

#### Step 2.3 — Agent Tool Calls to Qdrant

During the debate, agents make tool calls to Qdrant:

| Agent | Qdrant Collection | Query Type | Rounds |
|-------|-------------------|------------|--------|
| India Legal Expert | `indian_laws` | Indian statutes + precedents | 1, 4 |
| Company Defender | `industry_standards` | Industry norms + benchmarks | 1 |

All Qdrant queries pass through the Redis cache (`cache:qdrant:*`, TTL: 30min) to avoid redundant searches.

---

### Phase 3: Scoring & Verdict

#### Step 3.1–3.3 — Neutral Judge

```
Neutral Judge (Gemini 2.5 Pro)
│
├─ Input: Full debate transcript (15 messages from Mastra Memory)
│         + Clause text + User context
├─ Evaluates argument strength from all 5 rounds
├─ Identifies consensus points and disagreements
├─ Applies 3-Factor Weighted Scoring:
│   Risk Score = (Harm × 0.40) + (Legal × 0.35) + (Likelihood × 0.25)
├─ Classifies: Low (0–25) / Medium (26–50) / High (51–75) / Critical (76–100)
└─ Output: Verdict JSON → Mastra Memory (Redis)
```

#### Step 3.4 — Benchmarking

```
Qdrant Retrieval
│
├─ Indian Law Benchmark:
│   ├─ Query: clause category → indian_laws collection
│   └─ Compliance: 'compliant' | 'ambiguous' | 'non_compliant'
│
└─ Industry Standard Benchmark:
    ├─ Query: clause category + user industry → industry_standards collection
    └─ Deviation: 'within_norm' | 'slightly_stricter' | 'significantly_stricter'
```

#### Step 3.5 — Safer Alternatives

```
Gemini 2.5 Pro
│
├─ For clauses with risk >= 'medium':
│   ├─ 1 alternative for medium risk
│   └─ 2 alternatives for high/critical risk
├─ Maintains legitimate business purpose
├─ Aligns with Indian law requirements
└─ Generates ready-to-send negotiation messages
```

---

### Phase 4: Safety Validation (Enkrypt AI)

```
Enkrypt AI Safety Layer
│
├─ Checkpoint 1 (already ran after Legal Expert in Rounds 1 & 4)
│   └─ Legal citation hallucination detection
│
├─ Checkpoint 2 (after Judge verdict)
│   ├─ Bias detection: does Judge favor one agent?
│   └─ If bias detected → re-run Judge with anti-bias prompt
│
└─ Checkpoint 3 (before final report)
    ├─ Score arithmetic consistency
    ├─ Alternative clause safety
    ├─ Plain-language accuracy
    └─ Legal advice boundary check
```

---

### Phase 5: Persistence & Delivery — Redis → Supabase Transfer

This is the **critical data transfer** phase. ALL useful data moves from Redis to permanent Supabase storage.

#### Step 5.1 — Transfer to Supabase

```typescript
async function persistToSupabase(sessionId: string, analysisResult: AnalysisResult) {
  // ═══ 1. Insert into analyses table ═══
  const { data: analysis } = await supabase
    .from('analyses')
    .insert({
      session_id: sessionId,
      user_role: analysisResult.userContext.role,
      user_experience: analysisResult.userContext.experience,
      user_industry: analysisResult.userContext.industry,
      user_concerns: analysisResult.userContext.concerns,
      original_file_name: analysisResult.document.fileName,
      file_type: analysisResult.document.fileType,
      file_size_bytes: analysisResult.document.fileSize,
      extracted_markdown: analysisResult.document.markdown,       // From Redis doc:{session_id}
      extracted_json: analysisResult.document.extractedJson,      // From Redis doc:{session_id}
      overall_risk_score: analysisResult.overallScore,
      overall_risk_level: analysisResult.overallLevel,
      total_clauses_analyzed: analysisResult.clauses.length,
      clause_results: analysisResult.clauses,                     // Full clause analysis JSONB
      key_findings: analysisResult.keyFindings,
      recommended_actions: analysisResult.recommendedActions,
      enkrypt_hallucination_passed: analysisResult.enkrypt.hallucinationPassed,
      enkrypt_bias_passed: analysisResult.enkrypt.biasPassed,
      enkrypt_output_validation_passed: analysisResult.enkrypt.outputPassed,
      status: 'completed',
      completed_at: new Date().toISOString(),
      processing_time_ms: Date.now() - analysisResult.startTime,
    })
    .select('id')
    .single();

  // ═══ 2. Insert ALL debate messages ═══
  const debateMessages = [];
  for (const clause of analysisResult.clauses) {
    // Read all messages from Mastra Memory (Redis)
    const threadMessages = await memory.get({
      threadId: `debate:${sessionId}:${clause.clauseId}`,
    });

    for (const msg of threadMessages) {
      debateMessages.push({
        analysis_id: analysis.id,
        clause_id: clause.clauseId,
        clause_category: clause.category,
        agent_role: msg.metadata.agentName,
        round_number: msg.metadata.round,
        phase: msg.metadata.phase,
        content: msg.content,
        content_length: msg.content.length,
        llm_provider: msg.metadata.model.includes('gemini') ? 'google' : 'groq',
        llm_model: msg.metadata.model,
        tokens_used: msg.metadata.tokensUsed,
        latency_ms: msg.metadata.latencyMs,
      });
    }
  }

  await supabase.from('debate_messages').insert(debateMessages);

  // ═══ 3. Insert tool usage logs ═══
  await supabase.from('tool_usage_log').insert(analysisResult.toolUsageLogs);

  return analysis.id;
}
```

#### Step 5.2 — Redis Cleanup

```typescript
async function cleanupRedis(sessionId: string, clauseIds: string[]) {
  await redis.del([
    `doc:${sessionId}`,
    `session:${sessionId}:status`,
    ...clauseIds.map(id => `debate:${sessionId}:${id}`),
  ]);
}
```

#### Step 5.3 — Return Report to Frontend

```typescript
// GET /api/report/{session_id}
// Reads from Supabase (permanent storage)
const report = await supabase
  .from('analyses')
  .select('*')
  .eq('session_id', sessionId)
  .single();
```

---

## Data Lifecycle Summary

| Data Type | During Analysis (Redis) | After Analysis (Supabase) | Redis Key | Supabase Table/Column |
|-----------|------------------------|--------------------------|-----------|----------------------|
| Extracted Markdown | ✅ `doc:{sid}` hash field | ✅ `extracted_markdown` | `doc:{session_id}` | `analyses.extracted_markdown` |
| Extracted JSON | ✅ `doc:{sid}` hash field | ✅ `extracted_json` | `doc:{session_id}` | `analyses.extracted_json` |
| Debate messages (all rounds) | ✅ Mastra Memory threads | ✅ Full history | `debate:{sid}:{cid}` | `debate_messages` table |
| Session progress | ✅ `session:{sid}:status` | ❌ Not needed | `session:{sid}:status` | — |
| Qdrant cache | ✅ `cache:qdrant:*` | ❌ Not needed | `cache:qdrant:{hash}` | — |
| Final risk scores | ✅ In memory | ✅ `clause_results` JSONB | — | `analyses.clause_results` |
| Benchmarks | ✅ In memory | ✅ Inside `clause_results` | — | `analyses.clause_results` |
| Safer alternatives | ✅ In memory | ✅ Inside `clause_results` | — | `analyses.clause_results` |
| Tool call history | ✅ In memory | ✅ Full audit trail | — | `tool_usage_log` table |
| Enkrypt AI results | ✅ In memory | ✅ Validation flags | — | `analyses.enkrypt_*` columns |

---

## Session Management with `session_id`

### How `session_id` Works

The `session_id` is a UUID generated when the user uploads a document. It is the **universal correlation key** that ties everything together:

```
session_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

Redis keys using session_id:
├── doc:a1b2c3d4-...                    → Extracted document
├── debate:a1b2c3d4-...:clause-001      → Debate thread for clause 1
├── debate:a1b2c3d4-...:clause-002      → Debate thread for clause 2
├── debate:a1b2c3d4-...:clause-003      → Debate thread for clause 3
└── session:a1b2c3d4-...:status         → Pipeline progress

Supabase record:
└── analyses WHERE session_id = 'a1b2c3d4-...'
    ├── debate_messages WHERE analysis_id = ...
    └── tool_usage_log WHERE analysis_id = ...
```

### Session Lifecycle

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌──────────────┐
│  Created   │ ──► │  Active    │ ──► │ Completed  │ ──► │  Cleaned Up  │
│            │     │ (in Redis) │     │ (→ Supabase)│     │ (Redis freed)│
└────────────┘     └────────────┘     └────────────┘     └──────────────┘
  Upload time       5-10 minutes      Instant transfer    Immediate after
                                                          Supabase write
```

---

## Zero Data Loss Guarantee

The system ensures **no agent conversation data is lost** through these mechanisms:

### 1. Write-Ahead in Redis
Every agent message is written to Mastra Memory (Redis) **immediately** after the LLM responds, before any further processing. If the pipeline crashes after a message is written, it's already in Redis.

### 2. Full Transfer Before Cleanup
The Redis → Supabase transfer (Phase 5) happens **atomically** before any Redis keys are deleted. The sequence is:
1. Read ALL debate messages from Redis
2. Write to Supabase `debate_messages` table
3. Verify Supabase write succeeded
4. **Only then** delete Redis keys

### 3. Redis TTL as Safety Net
Even if the cleanup step fails, Redis data expires naturally after 2 hours. The data in Supabase is already safe.

### 4. Idempotent Transfers
The transfer uses `session_id` as a unique constraint in Supabase. If a transfer is retried (e.g., after a network blip), it won't create duplicates.

### 5. Crash Recovery
If the pipeline crashes mid-debate:
- Redis data survives (TTL: 2 hours)
- Session status shows the last completed step
- The pipeline can be restarted from the last known good state
- In practice, the user re-uploads (simpler UX for hackathon)

---

## Performance Characteristics

| Operation | Expected Latency | Store |
|-----------|------------------|-------|
| Redis write (per message) | < 1ms | Redis |
| Redis read (debate thread) | < 5ms | Redis |
| Supabase write (full analysis) | 50–200ms | Supabase |
| Supabase read (report fetch) | 20–100ms | Supabase |
| Qdrant search | 20–50ms | Qdrant |
| LlamaParse (document) | 3–8 seconds | LlamaParse API |
| Gemini 2.5 Pro (extraction) | 5–15 seconds | Google API |
| Groq Llama (debate round) | 1–3 seconds | Groq API |
| Gemini 2.5 Pro (judge verdict) | 5–10 seconds | Google API |
| **Total per clause (5 rounds)** | **~60–90 seconds** | — |
| **Total for 8 clauses (3 parallel)** | **~5–8 minutes** | — |
