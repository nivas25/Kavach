# Technology & Tools Plan — Kavach v2.0

> **The definitive reference for every technology, tool, and integration in Kavach.**

This document covers the complete recommended stack, LLM strategy, API key management, tool integrations, and Mastra's role in the system.

*Last updated: July 2026*

---

## Technology Stack Summary

| Layer | Component | Technology | Purpose |
|-------|-----------|-----------|---------|
| **Frontend** | UI | Next.js 15 (TypeScript), Tailwind CSS, shadcn/ui | Web interface |
| **Orchestration** | Workflow Engine | **Mastra** | Agent workflows, tool calling, memory |
| **Agent Runtime** | LLM (Precision) | **Gemini 2.5 Pro** | India Legal Expert, Neutral Judge, Extraction |
| **Agent Runtime** | LLM (Speed) | **Groq (Llama 3.3 70B)** | User Advocate, Company Defender |
| **Document Parsing** | Parser | **LlamaParse** (LlamaIndex) | PDF/DOCX → Markdown |
| **Vector DB** | RAG | **Qdrant** | Indian laws + industry standards retrieval |
| **Safety** | Guardrails | **Enkrypt AI** | Hallucination, bias, output validation |
| **Database** | Permanent Storage | **Supabase** (PostgreSQL) | Analyses, debate history, reports |
| **Cache/Memory** | Temporary Storage | **Redis** | Mastra Memory, session state, caching |

---

## 1. Document Parsing — LlamaParse

### What It Does

LlamaParse is the first stage of document preprocessing. It converts uploaded PDF and DOCX files into high-fidelity Markdown.

### Why LlamaParse (Not pdf-parse/mammoth)

| Feature | LlamaParse | pdf-parse + mammoth |
|---------|-----------|-------------------|
| Table extraction | ✅ Preserves structure | ❌ Tables become garbled text |
| Multi-column layouts | ✅ Handles correctly | ❌ Columns get merged |
| Header/footer detection | ✅ Filters automatically | ❌ Mixed into body text |
| Legal document formatting | ✅ Preserves numbered clauses | ⚠️ Partial support |
| Nested structures | ✅ Maintains hierarchy | ❌ Flattened |
| Output quality | High-fidelity Markdown | Raw text with artifacts |

### Integration Point

```
Step 1 of pipeline:
  User uploads PDF/DOCX
      → LlamaParse API
      → Clean, structured Markdown
      → Stored in Redis (doc:{session_id}.markdown)
      → Passed to Gemini 2.5 Pro for structured extraction
```

### API Integration

```typescript
// src/mastra/tools/documentProcessor.ts
import { LlamaParseReader } from 'llamaindex';

const llamaParse = new LlamaParseReader({
  apiKey: process.env.LLAMAPARSE_API_KEY,
  resultType: 'markdown',
  parsingInstructions: `
    This is an Indian legal contract document.
    Preserve all numbered sections, sub-clauses, and defined terms.
    Maintain table structures for compensation and payment schedules.
    Do not merge multi-column layouts.
  `,
});

async function parseDocument(fileBuffer: Buffer, fileName: string): Promise<string> {
  const documents = await llamaParse.loadData(fileBuffer, fileName);
  return documents.map(doc => doc.text).join('\n\n');
}
```

### When LlamaParse is Called

- **Once per analysis** — during Phase 1 (Preprocessing)
- Output is cached in Redis for the duration of the analysis
- The Markdown is also permanently stored in Supabase after completion

---

## 2. LLM Strategy — Which Model for Which Agent and Why

### The Dual-Model Strategy

Kavach uses two LLM providers with **dedicated API keys per agent**:

```
┌─────────────────────────────────────────────────────────┐
│                    Gemini 2.5 Pro                        │
│                 (Precision-Critical)                      │
│                                                          │
│  ┌──────────────────┐  ┌───────────────────────────────┐│
│  │ India Legal Expert│  │ Neutral Judge                 ││
│  │                   │  │                               ││
│  │ Why Gemini 2.5:   │  │ Why Gemini 2.5:              ││
│  │ • Best reasoning  │  │ • Judicial reasoning quality  ││
│  │   for legal text  │  │ • Accurate score calibration  ││
│  │ • Precise citation│  │ • Balanced evaluation         ││
│  │   extraction      │  │ • Structured JSON output      ││
│  │ • Low hallucin.   │  │                               ││
│  └──────────────────┘  └───────────────────────────────┘│
│                                                          │
│  ┌──────────────────┐  ┌───────────────────────────────┐│
│  │ Structured        │  │ Safer Alternatives           ││
│  │ Extraction        │  │ Generation                    ││
│  │ (Stage 2B)        │  │                               ││
│  └──────────────────┘  └───────────────────────────────┘│
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              Groq (Llama 3.3 70B Versatile)              │
│                   (Speed-Critical)                        │
│                                                          │
│  ┌──────────────────┐  ┌───────────────────────────────┐│
│  │ User Advocate     │  │ Company Defender              ││
│  │                   │  │                               ││
│  │ Why Groq:         │  │ Why Groq:                    ││
│  │ • Sub-second      │  │ • Sub-second inference       ││
│  │   inference       │  │ • Good argumentation         ││
│  │ • Strong argument │  │ • Cost-effective for          ││
│  │   construction    │  │   5 rounds × many clauses    ││
│  │ • Cost-effective   │  │                               ││
│  └──────────────────┘  └───────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Detailed Model Assignment

| Agent / Task | Model | Provider | Dedicated API Key | Why This Model |
|-------------|-------|----------|-------------------|----------------|
| **India Legal Expert** | `gemini-2.5-pro` | Google | `GEMINI_LEGAL_EXPERT_KEY` | Highest reasoning quality. Legal analysis requires precise citation extraction, multi-step legal reasoning, and low hallucination rate. Gemini 2.5 Pro's extended context window handles full legal texts. |
| **Neutral Judge** | `gemini-2.5-pro` | Google | `GEMINI_JUDGE_KEY` | Needs to read and synthesize a 15-message debate transcript. Requires calibrated scoring (not over/under-weighting arguments). Structured JSON output reliability. |
| **User Advocate** | `llama-3.3-70b-versatile` | Groq | `GROQ_USER_ADVOCATE_KEY` | Debate agents need speed more than maximum precision. Groq provides sub-second inference. Llama 3.3 70B is strong at argumentative reasoning while being cost-effective for 5 rounds × 8+ clauses. |
| **Company Defender** | `llama-3.3-70b-versatile` | Groq | `GROQ_COMPANY_DEFENDER_KEY` | Same reasoning as User Advocate. Speed and cost matter more than peak precision for debate agents. |
| **Document Extraction** | `gemini-2.5-pro` | Google | `GEMINI_EXTRACTION_KEY` | Structured extraction from complex legal documents requires high comprehension. Must reliably output valid JSON with categorized clauses. |
| **Safer Alternatives** | `gemini-2.5-pro` | Google | `GEMINI_EXTRACTION_KEY` (shared) | Alternative clause writing requires understanding of Indian law enforceability + commercial reasonableness. |

### Cost Estimation Per Analysis (8 clauses)

| Task | Calls | Model | Est. Tokens | Est. Cost |
|------|-------|-------|-------------|-----------|
| Document extraction | 1 | Gemini 2.5 Pro | ~5,000 | ~$0.05 |
| Legal Expert (5 rounds × 8 clauses) | 40 | Gemini 2.5 Pro | ~80,000 | ~$0.80 |
| User Advocate (5 rounds × 8 clauses) | 40 | Groq Llama 3.3 | ~60,000 | ~$0.02 |
| Company Defender (5 rounds × 8 clauses) | 40 | Groq Llama 3.3 | ~60,000 | ~$0.02 |
| Neutral Judge (8 clauses) | 8 | Gemini 2.5 Pro | ~40,000 | ~$0.40 |
| Safer alternatives (~5 clauses) | 5 | Gemini 2.5 Pro | ~10,000 | ~$0.10 |
| **Total per analysis** | **~134** | — | **~255,000** | **~$1.39** |

---

## 3. API Key Management

### Architecture: One Key Per Agent

```env
# backend/.env

# ═══ Gemini 2.5 Pro Keys (separate Google accounts) ═══
GEMINI_LEGAL_EXPERT_KEY=AIza...    # Account 1 — India Legal Expert
GEMINI_JUDGE_KEY=AIza...           # Account 2 — Neutral Judge
GEMINI_EXTRACTION_KEY=AIza...      # Account 3 — Document Extraction + Alternatives

# ═══ Groq Keys (separate Groq accounts) ═══
GROQ_USER_ADVOCATE_KEY=gsk_...     # Account 1 — User Advocate
GROQ_COMPANY_DEFENDER_KEY=gsk_...  # Account 2 — Company Defender

# ═══ Single-Key Services ═══
LLAMAPARSE_API_KEY=llx-...         # LlamaIndex (LlamaParse)
ENKRYPT_API_KEY=ek_...             # Enkrypt AI (Safety)
QDRANT_API_KEY=...                 # Qdrant (Vector DB)
QDRANT_URL=http://localhost:6333

# ═══ Data Layer ═══
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
REDIS_URL=redis://localhost:6379
```

### How Keys Are Loaded Per Agent

```typescript
// src/mastra/agents/indiaLegalExpert.ts
import { Agent } from '@mastra/core';
import { google } from '@ai-sdk/google';

export const indiaLegalExpertAgent = new Agent({
  name: 'india-legal-expert',
  instructions: LEGAL_EXPERT_SYSTEM_PROMPT,
  model: google('gemini-2.5-pro', {
    apiKey: process.env.GEMINI_LEGAL_EXPERT_KEY,  // Dedicated key
  }),
  tools: { qdrantSearchLaws },
});

// src/mastra/agents/userAdvocate.ts
import { groq } from '@ai-sdk/groq';

export const userAdvocateAgent = new Agent({
  name: 'user-advocate',
  instructions: USER_ADVOCATE_SYSTEM_PROMPT,
  model: groq('llama-3.3-70b-versatile', {
    apiKey: process.env.GROQ_USER_ADVOCATE_KEY,   // Dedicated key
  }),
});
```

### Benefits of Dedicated Keys

| Benefit | Description |
|---------|-------------|
| **No rate limit contention** | Each agent has its own quota — one hitting limits doesn't block others |
| **Independent failure isolation** | If one key expires or is revoked, only one agent is affected |
| **Per-agent cost tracking** | Monitor usage and costs per agent in provider dashboards |
| **Scalable quota management** | Upgrade keys independently as usage grows |
| **Parallel execution safety** | Round 1 runs 3 agents in parallel; shared keys would triple rate limit pressure |

---

## 4. Enkrypt AI — Safety Layer Integration

### What Enkrypt AI Does

Enkrypt AI is a guardrail service that validates LLM outputs for:
- **Hallucination** — Fabricated legal citations, non-existent statutes
- **Bias** — Systematic favoritism in the Judge's scoring
- **Safety** — Ensuring outputs stay advisory, not prescriptive

### Where Enkrypt AI is Called in the Flow

```
Phase 2: Multi-Agent Debate
│
├─ After India Legal Expert — Round 1
│   └─ Checkpoint 1: Legal Citation Verification
│      ├─ Validates: act names, section numbers, case references
│      ├─ If hallucination detected → re-run agent with stricter prompt
│      └─ Max 2 retries before adding disclaimer
│
├─ After India Legal Expert — Round 4 (Cross Examination)
│   └─ Checkpoint 1: Re-verify new citations from cross-examination
│
Phase 3: Scoring & Verdict
│
├─ After Neutral Judge verdict
│   └─ Checkpoint 2: Agent Bias Detection
│      ├─ Checks: scoring balance, systematic bias, reasoning quality
│      ├─ If bias detected → re-run Judge with anti-bias prompt
│      └─ Max 1 retry before including both verdicts
│
Phase 4: Before Final Report
│
└─ Checkpoint 3: Output Validation
    ├─ Score arithmetic: factor scores × weights = final score?
    ├─ Alternative safety: do rewritten clauses introduce new risks?
    ├─ Explanation accuracy: do plain-language explanations match analysis?
    └─ Legal advice boundary: does output stay informational?
```

### Enkrypt AI Call Points (Precise Timing)

| Checkpoint | Pipeline Phase | Trigger | Input | Action on Failure |
|-----------|---------------|---------|-------|-------------------|
| **CP-1a** | Phase 2, Round 1 | Legal Expert completes Round 1 | Legal Expert output + cited laws | Re-run with stricter Qdrant-only prompt (max 2 retries) |
| **CP-1b** | Phase 2, Round 4 | Legal Expert completes Cross Examination | Legal Expert Round 4 output | Same as CP-1a |
| **CP-2** | Phase 3 | Judge completes verdict | Judge verdict + debate transcript | Re-run Judge with anti-bias warning (max 1 retry) |
| **CP-3** | Phase 4 | Report compilation complete | Full compiled report | Fix arithmetic programmatically; regenerate flagged content |

### Enkrypt AI Service Configuration

```typescript
// src/services/enkryptService.ts
import { EnkryptAI } from 'enkrypt-ai';

export const enkryptAI = new EnkryptAI({
  apiKey: process.env.ENKRYPT_API_KEY,
});

// Checkpoint 1: Legal Citation Verification
export async function verifyLegalCitations(
  agentOutput: string,
  citedLaws: Array<{ actName: string; section: string; summary: string }>
) {
  const result = await enkryptAI.detectHallucination({
    text: agentOutput,
    context: 'Indian legal statutes and judicial precedents',
    claims: citedLaws.map(law => ({
      claim: `${law.actName}, ${law.section}: ${law.summary}`,
      type: 'legal_citation',
    })),
  });

  return {
    passed: result.hallucinationScore < 0.3,
    score: result.hallucinationScore,
    flaggedCitations: result.flaggedClaims,
  };
}

// Checkpoint 2: Bias Detection
export async function detectJudgeBias(
  judgeVerdict: string,
  debateTranscript: { userAdvocate: string; companyDefender: string; indiaLegalExpert: string },
  scores: { harmPotential: number; legalStrength: number; practicalLikelihood: number }
) {
  const result = await enkryptAI.detectBias({
    text: judgeVerdict,
    sources: [
      { name: 'User Advocate', content: debateTranscript.userAdvocate },
      { name: 'Company Defender', content: debateTranscript.companyDefender },
      { name: 'India Legal Expert', content: debateTranscript.indiaLegalExpert },
    ],
    scores,
  });

  return {
    passed: result.biasScore < 0.4,
    biasDirection: result.direction,
    details: result.explanation,
  };
}

// Checkpoint 3: Output Validation
export async function validateFinalReport(report: any) {
  // Arithmetic check (local, no API call needed)
  const arithmeticPassed = report.clauses.every((clause: any) => {
    const expected = Math.round(
      (clause.factors.harm_potential.score * 0.40 +
       clause.factors.legal_strength.score * 0.35 +
       clause.factors.practical_likelihood.score * 0.25) * 10
    );
    return Math.abs(clause.risk_score - expected) <= 2;
  });

  // Content check (Enkrypt AI API)
  const contentCheck = await enkryptAI.validateOutput({
    text: JSON.stringify(report),
    checks: ['hallucination', 'bias', 'safety'],
  });

  return {
    arithmeticPassed,
    alternativeSafety: contentCheck.safetyScore > 0.7,
    explanationAccuracy: contentCheck.consistencyScore > 0.7,
    legalAdviceBoundary: !contentCheck.containsLegalAdvice,
  };
}
```

---

## 5. Mastra — The Orchestration Brain

### What Mastra Is Responsible For

Mastra is the **central orchestration layer** that controls the entire analysis pipeline. Every step from receiving the document to delivering the final report is managed by Mastra.

```
Mastra's Responsibilities:
│
├── Agent Management
│   ├─ Define 4 agents with system prompts, tools, and dedicated models
│   ├─ Route clause data to the correct agent
│   └─ Manage agent lifecycle (start, wait, collect output)
│
├── Workflow Orchestration
│   ├─ contractAnalysis workflow (main pipeline)
│   ├─ debateRound sub-workflow (per clause, per round)
│   ├─ reportGeneration sub-workflow (compile and persist)
│   ├─ Handle parallel execution (Round 1: 3 agents simultaneously)
│   └─ Handle sequential execution (Rounds 2–5: agents read previous rounds)
│
├── Memory Management (Redis-backed)
│   ├─ Create debate threads: debate:{session_id}:{clause_id}
│   ├─ Store agent messages with round/phase metadata
│   ├─ Retrieve previous round messages for agent context
│   └─ Provide full transcript to Neutral Judge
│
├── Tool Calling
│   ├─ documentProcessor (LlamaParse + Gemini extraction)
│   ├─ qdrantSearch (Indian laws + industry standards)
│   ├─ enkryptValidation (3 safety checkpoints)
│   └─ alternativeGenerator (safer clause generation)
│
├── State Management
│   ├─ Track pipeline progress in Redis (session status)
│   ├─ Handle errors and retries per step
│   └─ Manage transitions between pipeline phases
│
└── Data Persistence
    ├─ Read extracted data from Redis
    ├─ Transfer completed results to Supabase
    └─ Clean up Redis after persistence
```

### Mastra Configuration

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core';
import { memory } from './memory/config';

// Import agents
import { userAdvocateAgent } from './agents/userAdvocate';
import { companyDefenderAgent } from './agents/companyDefender';
import { indiaLegalExpertAgent } from './agents/indiaLegalExpert';
import { neutralJudgeAgent } from './agents/neutralJudge';

// Import workflows
import { contractAnalysisWorkflow } from './workflows/contractAnalysis';

// Import tools
import { documentProcessor } from './tools/documentProcessor';
import { qdrantSearchLaws, qdrantSearchStandards } from './tools/qdrantSearch';
import { legalCitationCheck, biasDetection, outputValidation } from './tools/enkryptValidation';
import { alternativeGenerator } from './tools/alternativeGenerator';

export const mastra = new Mastra({
  agents: {
    'user-advocate': userAdvocateAgent,
    'company-defender': companyDefenderAgent,
    'india-legal-expert': indiaLegalExpertAgent,
    'neutral-judge': neutralJudgeAgent,
  },
  workflows: {
    'contract-analysis': contractAnalysisWorkflow,
  },
  tools: {
    documentProcessor,
    qdrantSearchLaws,
    qdrantSearchStandards,
    legalCitationCheck,
    biasDetection,
    outputValidation,
    alternativeGenerator,
  },
  memory,
});
```

### Mastra Memory Configuration

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
    lastMessages: 20,          // Keep all 16 debate messages accessible
    semanticRecall: false,     // We use explicit thread IDs, not semantic search
  },
});
```

### Mastra Workflow — Contract Analysis Pipeline

```typescript
// src/mastra/workflows/contractAnalysis.ts (simplified)
import { Workflow, Step } from '@mastra/core';

export const contractAnalysisWorkflow = new Workflow({
  name: 'contract-analysis',
  triggerSchema: z.object({
    sessionId: z.string(),
    clauses: z.array(ExtractedClauseSchema),
    userContext: UserContextSchema,
  }),
});

contractAnalysisWorkflow
  .step(readExtractedDocument)      // Read from Redis doc:{session_id}
  .then(runDebatesForAllClauses)    // 5-round debate per clause
  .then(runEnkryptValidation)       // Checkpoints 2 & 3
  .then(generateAlternatives)       // Safer alternatives for risky clauses
  .then(compileReport)              // Assemble final report
  .then(persistToSupabase)          // Transfer Redis → Supabase
  .then(cleanupRedis)               // Delete temporary Redis keys
  .commit();
```

---

## 6. Qdrant — RAG Knowledge Base

### Role in the System

Qdrant stores the **legal and industry knowledge** that grounds Kavach's analysis in real data rather than LLM training data.

| Collection | Content | Used By | Search Type |
|-----------|---------|---------|------------|
| `indian_laws` | Indian statutes, sections, judicial precedents | India Legal Expert | Hybrid (semantic + keyword) |
| `industry_standards` | Standard contract practices by industry | Company Defender | Hybrid (semantic + keyword) |

### When Qdrant is Queried

| Agent | Round(s) | Collection | Query Example |
|-------|----------|-----------|---------------|
| India Legal Expert | 1, 4 | `indian_laws` | `"non-compete clause enforceability Section 27 Indian Contract Act"` |
| Company Defender | 1 | `industry_standards` | `"non-compete standard practice IT industry India"` |
| Benchmarking step | After debates | Both | `"termination clause compliance Indian employment law"` |

### Embedding Model

```typescript
const EMBEDDING_MODEL = 'text-embedding-004';  // Google
const VECTOR_DIMENSION = 768;
```

### Data Volume

| Collection | Documents | Vector Size | Payload Size |
|-----------|-----------|-------------|-------------|
| `indian_laws` | 500–1,000 sections | ~2 MB | ~10 MB |
| `industry_standards` | 200–500 entries | ~1 MB | ~5 MB |

---

## 7. Integration Timeline in Pipeline

```
Step  │ Tool/Service         │ Purpose                         │ Storage Impact
──────┼──────────────────────┼─────────────────────────────────┼──────────────────
1     │ LlamaParse           │ PDF/DOCX → Markdown             │ → Redis
2     │ Gemini 2.5 Pro       │ Markdown → Structured JSON      │ → Redis
3     │ Mastra Workflow      │ Start pipeline                  │ Redis (session)
4     │ Groq Llama × 2       │ Advocate + Defender Round 1     │ → Redis (Memory)
      │ Gemini 2.5 Pro       │ Legal Expert Round 1            │ → Redis (Memory)
      │ Qdrant               │ Law + standards search          │ Redis (cache)
5     │ Enkrypt AI           │ CP-1: Citation check            │ —
6     │ Groq/Gemini × 3      │ Rounds 2–5 (all agents)        │ → Redis (Memory)
7     │ Enkrypt AI           │ CP-1b: Re-check Round 4         │ —
8     │ Gemini 2.5 Pro       │ Judge verdict                   │ → Redis (Memory)
9     │ Enkrypt AI           │ CP-2: Bias detection            │ —
10    │ Gemini 2.5 Pro       │ Safer alternatives              │ → Redis (temp)
11    │ Enkrypt AI           │ CP-3: Output validation         │ —
12    │ Supabase             │ Persist everything              │ Redis → Supabase
13    │ Redis                │ Cleanup                         │ Keys deleted
```
