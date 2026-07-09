# System Architecture — Kavach v2.0

> **The definitive architecture document for Kavach — from document upload to final report.**

This document describes the complete end-to-end system architecture, including all layers, components, data flows, and integration points. It is the single source of truth for how Kavach works.

*Last updated: July 2026*

---

## Architecture Overview

Kavach is a 7-layer system that transforms an uploaded contract into a comprehensive risk report through multi-agent adversarial debate, grounded in Indian law.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 1 — PRESENTATION                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Kavach UI (Next.js 15 + TypeScript)                                 │  │
│  │  • Contract upload (PDF / DOCX / plain text)                         │  │
│  │  • User onboarding & role selection                                  │  │
│  │  • Interactive risk report viewer                                    │  │
│  │  • Clause negotiation simulator                                      │  │
│  │  • Technologies: Next.js 15, Tailwind CSS, shadcn/ui                 │  │
│  └────────────────────────────┬──────────────────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────────────────┘
                                │ Upload Contract / API Requests
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   LAYER 2 — DOCUMENT PREPROCESSING                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Stage 2A: LlamaParse                                                │  │
│  │  • Converts PDF/DOCX to clean, structured Markdown                   │  │
│  │  • Handles tables, headers, nested clauses, multi-column layouts     │  │
│  │  • Output: High-fidelity Markdown representation                     │  │
│  └────────────────────────────┬──────────────────────────────────────────┘  │
│                               ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Stage 2B: Gemini 2.5 Pro — Structured Extraction                    │  │
│  │  • Extracts metadata (parties, dates, contract type, jurisdiction)   │  │
│  │  • Identifies & categorizes substantive clauses into JSON            │  │
│  │  • Filters boilerplate (headers, signatures, ToC, definitions)       │  │
│  │  • Output: Structured JSON with extracted clauses                    │  │
│  └────────────────────────────┬──────────────────────────────────────────┘  │
│                               │                                             │
│  Both Markdown + JSON are stored in Redis (temporary, TTL: 2 hours)         │
└───────────────────────────────┼──────────────────────────────────────────────┘
                                │ session_id + clause data
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   LAYER 3 — ORCHESTRATION (Mastra)                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Mastra Workflow Engine                                              │  │
│  │  • Manages the full analysis pipeline via declarative workflows      │  │
│  │  • Dispatches agents per clause, per round                           │  │
│  │  • Handles parallel/sequential execution, retries, error recovery    │  │
│  │  • Coordinates tool calls (Qdrant, Enkrypt AI, doc processing)       │  │
│  └────────────────────────────┬──────────────────────────────────────────┘  │
│                               │                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Mastra Memory (Redis-backed)                                        │  │
│  │  • Inter-agent message passing during 5-round debates                │  │
│  │  • Debate conversation history with round/phase metadata             │  │
│  │  • Session state tracking (pipeline progress)                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────────────────┘
                                │ Dispatch agents
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LAYER 4 — AGENT LAYER                                 │
│                                                                             │
│  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────────────┐ │
│  │ User Advocate 🛡️  │ │ Company Defender⚖️│ │ India Legal Expert 📜     │ │
│  │ (Groq Llama 3.3)  │ │ (Groq Llama 3.3) │ │ (Gemini 2.5 Pro)          │ │
│  │                    │ │                   │ │                           │ │
│  │ Dedicated API Key  │ │ Dedicated API Key │ │ Dedicated API Key         │ │
│  │ GROQ_ADVOCATE_KEY  │ │ GROQ_DEFENDER_KEY │ │ GEMINI_LEGAL_KEY          │ │
│  │                    │ │                   │ │                           │ │
│  │ Identifies risks   │ │ Justifies clauses │ │ Retrieves Indian laws     │ │
│  │ to the user        │ │ from company view │ │ from Qdrant, cites sects  │ │
│  └────────┬───────────┘ └────────┬──────────┘ └─────────────┬─────────────┘ │
│           │                      │                           │               │
│           └──────────┬───────────┴───────────────────────────┘               │
│                      │                                                       │
│                      │ 5-Round Debate (all messages in Mastra Memory/Redis)  │
│                      ▼                                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │  Neutral Judge 🏛️ (Gemini 2.5 Pro)                                  │   │
│  │  Dedicated API Key: GEMINI_JUDGE_KEY                                 │   │
│  │  • Reads full 5-round debate transcript from Mastra Memory           │   │
│  │  • Applies 3-Factor Weighted Scoring Formula                         │   │
│  │  • Generates final verdict, explanation, and recommendation          │   │
│  └────────────────────────────┬──────────────────────────────────────────┘   │
└───────────────────────────────┼──────────────────────────────────────────────┘
                                │ Agent outputs
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LAYER 5 — SAFETY LAYER                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Enkrypt AI Safety Layer                                             │  │
│  │                                                                       │  │
│  │  Checkpoint 1: Legal Citation Hallucination Detection                 │  │
│  │    → After India Legal Expert (Rounds 1 & 4)                          │  │
│  │    → Validates act names, section numbers, case references            │  │
│  │                                                                       │  │
│  │  Checkpoint 2: Agent Bias Detection                                   │  │
│  │    → After Neutral Judge verdict                                      │  │
│  │    → Detects systematic scoring bias toward any agent                 │  │
│  │                                                                       │  │
│  │  Checkpoint 3: Output Validation                                      │  │
│  │    → Before final report delivery                                     │  │
│  │    → Score arithmetic, alternative safety, legal advice boundary      │  │
│  └────────────────────────────┬──────────────────────────────────────────┘  │
└───────────────────────────────┼──────────────────────────────────────────────┘
                                │ Validated output
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LAYER 6 — DATA LAYER                                  │
│                                                                             │
│  ┌──────────────────────┐ ┌──────────────────────┐ ┌────────────────────┐  │
│  │ Redis (Temporary)    │ │ Supabase (Permanent) │ │ Qdrant (Knowledge) │  │
│  │                      │ │                      │ │                    │  │
│  │ • Extracted Markdown  │ │ • analyses table     │ │ • indian_laws      │  │
│  │   + JSON (TTL: 2h)   │ │ • debate_messages    │ │ • industry_stds    │  │
│  │ • Mastra Memory       │ │ • tool_usage_history │ │ • Hybrid search    │  │
│  │   (debate messages)   │ │ • Final reports      │ │   (dense + sparse) │  │
│  │ • Session state       │ │ • Full history       │ │                    │  │
│  │ • Qdrant query cache  │ │                      │ │                    │  │
│  └──────────────────────┘ └──────────────────────┘ └────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      LAYER 7 — LLM PROVIDERS                               │
│                                                                             │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │ Gemini 2.5 Pro               │  │ Groq (Llama 3.3 70B Versatile)     │ │
│  │ • Document structured         │  │ • User Advocate Agent               │ │
│  │   extraction (Stage 2B)       │  │ • Company Defender Agent            │ │
│  │ • India Legal Expert Agent    │  │ • Fast inference for debate rounds  │ │
│  │ • Neutral Judge Agent         │  │                                     │ │
│  │ • Safer alternative           │  │ Dedicated API keys per agent:       │ │
│  │   generation                  │  │ • GROQ_USER_ADVOCATE_KEY            │ │
│  │                               │  │ • GROQ_COMPANY_DEFENDER_KEY         │ │
│  │ Dedicated API keys per agent: │  │                                     │ │
│  │ • GEMINI_LEGAL_EXPERT_KEY     │  │                                     │ │
│  │ • GEMINI_JUDGE_KEY            │  │                                     │ │
│  │ • GEMINI_EXTRACTION_KEY       │  │                                     │ │
│  └──────────────────────────────┘  └──────────────────────────────────────┘ │
│                                                                             │
│  ┌──────────────────────────────┐                                           │
│  │ LlamaParse (LlamaIndex)      │                                           │
│  │ • Stage 2A: PDF/DOCX → MD    │                                           │
│  │ • LLAMAPARSE_API_KEY          │                                           │
│  └──────────────────────────────┘                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Descriptions

### Layer 1 — Presentation (Frontend)

| Attribute | Value |
|-----------|-------|
| **Technology** | Next.js 15 (TypeScript), Tailwind CSS, shadcn/ui |
| **Role** | Web interface for contract upload, user onboarding, and interactive report viewing |
| **Responsibilities** | File upload, role selection, progress tracking, interactive report display, clause simulator, PDF export |
| **Communicates With** | Layer 3 (Mastra) via Next.js API routes |

### Layer 2 — Document Preprocessing

This layer has **two sequential stages**:

| Stage | Tool | Input | Output | Purpose |
|-------|------|-------|--------|---------|
| **2A** | **LlamaParse** | PDF / DOCX / plain text | Clean Markdown | High-fidelity document-to-Markdown conversion |
| **2B** | **Gemini 2.5 Pro** | Markdown from Stage 2A | Structured JSON (metadata + extracted clauses) | Dynamic extraction of parties, dates, clause categorization |

**Why two stages?**
- LlamaParse excels at faithful document parsing (tables, headers, multi-column) but produces unstructured Markdown.
- Gemini 2.5 Pro excels at intelligent extraction — identifying which sections are substantive clauses vs. boilerplate.
- Together they produce both a readable Markdown and a machine-parseable JSON.

**Both outputs are stored in Redis** (key: `doc:{session_id}`) with a 2-hour TTL for use during the analysis pipeline.

### Layer 3 — Orchestration (Mastra)

| Attribute | Value |
|-----------|-------|
| **Technology** | Mastra Workflow Engine + Mastra Memory (Redis-backed) |
| **Role** | Central brain that manages the entire analysis pipeline |
| **Responsibilities** | Pipeline orchestration, agent dispatching (parallel/sequential), tool calling, state management, error handling/retries |
| **Key Mastra Features** | `Agent` definitions, `Workflow` pipelines, `Memory` (Redis), `Tool` (Qdrant, Enkrypt AI, doc processing) |

**Mastra's specific responsibilities:**
1. Receive `session_id` + extracted clauses from Layer 2
2. For each clause, orchestrate the 5-round debate
3. Manage Mastra Memory (Redis) for inter-agent message passing
4. Handle parallel execution (Round 1) and sequential execution (Rounds 2–5)
5. Dispatch the Neutral Judge after all debate rounds
6. Trigger Enkrypt AI checkpoints
7. Compile and persist the final report
8. Update session status for frontend polling

### Layer 4 — Agent Layer

Four specialized agents operate through a **5-round structured debate**:

| Agent | LLM | Dedicated API Key | Role in Debate |
|-------|-----|--------------------|----------------|
| **User Advocate** 🛡️ | Groq Llama 3.3 70B | `GROQ_USER_ADVOCATE_KEY` | Zealously defends the user's interests |
| **Company Defender** ⚖️ | Groq Llama 3.3 70B | `GROQ_COMPANY_DEFENDER_KEY` | Explains company's rationale |
| **India Legal Expert** 📜 | Gemini 2.5 Pro | `GEMINI_LEGAL_EXPERT_KEY` | Provides Indian law analysis with Qdrant citations |
| **Neutral Judge** 🏛️ | Gemini 2.5 Pro | `GEMINI_JUDGE_KEY` | Evaluates full debate, renders verdict, assigns score |

#### 5-Round Debate Structure

| Round | Phase | What Happens | Who Speaks | Purpose |
|-------|-------|-------------|------------|---------|
| 1 | **Opening Statements** | Each of the 3 debating agents presents their initial position with evidence | User Advocate, Company Defender, India Legal Expert | Set their stance |
| 2 | **Rebuttal Round 1** | Agents reply to each other's opening arguments | All 3 agents | Challenge initial points |
| 3 | **Rebuttal Round 2** | Agents continue replying and strengthening their arguments | All 3 agents | Deeper back-and-forth |
| 4 | **Cross Examination** | Agents directly challenge each other (especially User Advocate vs Company Defender) | All 3 agents | Pressure testing arguments |
| 5 | **Closing Arguments** | Each agent gives their final stance after hearing everything | All 3 agents | Final position |
| — | **Verdict** | Judge reads the full 15-message transcript and scores | Neutral Judge only | Final risk assessment |

**Total messages per clause:** 15 debate messages (3 agents × 5 rounds) + 1 verdict = **16 messages**

### Layer 5 — Safety Layer (Enkrypt AI)

| Checkpoint | When | What It Validates |
|------------|------|-------------------|
| **CP-1** | After India Legal Expert (Rounds 1 & 4) | Legal citation hallucination detection |
| **CP-2** | After Neutral Judge verdict | Agent bias detection in scoring |
| **CP-3** | Before final report delivery | Score arithmetic, alternative safety, legal advice boundary |

### Layer 6 — Data Layer

| Component | Technology | Role | Lifecycle |
|-----------|-----------|------|-----------|
| **Redis** | In-memory store | Temporary storage during analysis | Data lives for 2 hours, then expires or is cleaned up |
| **Supabase** | PostgreSQL (hosted) | Permanent storage of all completed analyses | Data persists forever |
| **Qdrant** | Vector database | Legal knowledge retrieval (Indian laws + industry standards) | Static reference data, seeded at deploy time |

### Layer 7 — LLM Providers

| Provider | Models Used | Agents/Tasks | Why |
|----------|------------|-------------|-----|
| **Google (Gemini 2.5 Pro)** | `gemini-2.5-pro` | India Legal Expert, Neutral Judge, Structured Extraction, Safer Alternatives | Highest reasoning quality for precision-critical tasks |
| **Groq** | `llama-3.3-70b-versatile` | User Advocate, Company Defender | Ultra-fast inference for rapid debate rounds |
| **LlamaIndex** | LlamaParse API | Document preprocessing (Stage 2A) | Best-in-class PDF/DOCX → Markdown conversion |

---

## Communication Patterns

### Frontend ↔ Orchestration
- REST API calls from Next.js to Mastra Workflow Engine via API routes
- File upload via `multipart/form-data`
- Frontend polls `session:{session_id}:status` from Redis for real-time progress

### Orchestration ↔ Agents
- Mastra dispatches agents per round:
  - **Round 1:** 3 agents run in parallel (independent opening statements)
  - **Rounds 2–5:** 3 agents run sequentially (must read previous round from Memory)
  - **Verdict:** Judge runs after all 5 rounds complete

### Agents ↔ Data Layer
- India Legal Expert → Qdrant (`indian_laws` collection)
- Company Defender → Qdrant (`industry_standards` collection)
- All agents → Redis (Mastra Memory for debate messages)
- Workflow → Redis (session state, extracted document data)

### Agents ↔ Safety Layer
- India Legal Expert output → Enkrypt AI (Checkpoint 1)
- Neutral Judge output → Enkrypt AI (Checkpoint 2)
- Final compiled report → Enkrypt AI (Checkpoint 3)

### Orchestration ↔ Data Layer
- **During analysis:** Mastra Workflow ↔ Redis (fast read/write)
- **After analysis:** Mastra Workflow → Supabase (permanent persistence)
- Redis debate data → Supabase `debate_messages` table
- Redis extracted data → Supabase `analyses` table

---

## API Key Strategy — Multiple Dedicated Keys

Each agent uses a **dedicated API key** from a separate account to avoid rate limits and ensure reliability.

| Agent / Task | Provider | Environment Variable | Purpose |
|-------------|----------|---------------------|---------|
| India Legal Expert | Google | `GEMINI_LEGAL_EXPERT_KEY` | Highest quality legal analysis |
| Neutral Judge | Google | `GEMINI_JUDGE_KEY` | Accurate scoring and verdicts |
| Structured Extraction | Google | `GEMINI_EXTRACTION_KEY` | Document clause extraction |
| User Advocate | Groq | `GROQ_USER_ADVOCATE_KEY` | Fast debate inference |
| Company Defender | Groq | `GROQ_COMPANY_DEFENDER_KEY` | Fast debate inference |
| LlamaParse | LlamaIndex | `LLAMAPARSE_API_KEY` | Document parsing |
| Enkrypt AI | Enkrypt | `ENKRYPT_API_KEY` | Safety validation |
| Qdrant | Qdrant | `QDRANT_API_KEY` | Vector search |
| Supabase | Supabase | `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Database |
| Redis | Redis | `REDIS_URL` | Temporary storage + Mastra Memory |

```env
# backend/.env

# --- Gemini 2.5 Pro Keys (separate accounts) ---
GEMINI_LEGAL_EXPERT_KEY=your_gemini_key_account_1
GEMINI_JUDGE_KEY=your_gemini_key_account_2
GEMINI_EXTRACTION_KEY=your_gemini_key_account_3

# --- Groq Keys (separate accounts) ---
GROQ_USER_ADVOCATE_KEY=your_groq_key_account_1
GROQ_COMPANY_DEFENDER_KEY=your_groq_key_account_2

# --- Document Parsing ---
LLAMAPARSE_API_KEY=your_llamaparse_key

# --- Safety ---
ENKRYPT_API_KEY=your_enkrypt_key

# --- Data Layer ---
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
REDIS_URL=redis://localhost:6379
```

**Benefits of dedicated keys:**
1. **No rate limit contention** — Each agent has its own quota
2. **Independent failure isolation** — One key hitting rate limit doesn't block others
3. **Usage tracking** — Per-agent cost monitoring
4. **Scalability** — Can upgrade individual agent keys independently
