# System Architecture

This document describes the complete layered architecture of Kavach, based on the project's architecture diagram and synopsis.

---

## Architecture Diagram Reference

The architecture consists of 6 layers, each with clearly defined responsibilities and communication patterns.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 1 — PRESENTATION                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Kavach UI (Next.js 15 + TypeScript)                        │   │
│  │  • Contract upload (PDF/DOCX/text)                          │   │
│  │  • Interactive risk report viewer                           │   │
│  │  • Negotiation simulator                                    │   │
│  │  • Technologies: Next.js, Tailwind CSS, shadcn/ui           │   │
│  └──────────────────────┬───────────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────────┘
                          │ Upload Contract / API Requests
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 LAYER 2 — ORCHESTRATION (Mastra)                   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Mastra Workflow Engine                                     │   │
│  │  • Central workflow engine managing agent handoffs           │   │
│  │  • State transitions between pipeline stages                │   │
│  │  • Tool calling (document processing, Qdrant search)        │   │
│  │  • Error handling and retry logic                           │   │
│  └──────────────────────┬───────────────────────────────────────┘   │
│                         │ Round 1/2 dispatch                       │
│                         ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Mastra Memory (Redis)                                      │   │
│  │  • Inter-agent message passing during debates               │   │
│  │  • Debate conversation history                              │   │
│  │  • Session state management                                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 3 — AGENT LAYER                           │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │ User Advocate    │  │ Company Defender │  │ India Legal Expert  │ │
│  │ Agent            │  │ Agent           │  │ Agent               │ │
│  │ (Groq Llama)     │  │ (Groq Llama)    │  │ (Gemini Flash)      │ │
│  │                  │  │                 │  │                     │ │
│  │ Identifies risks │  │ Justifies       │  │ Retrieves Indian    │ │
│  │ to the user      │  │ clauses from    │  │ laws from Qdrant    │ │
│  │                  │  │ company view    │  │ and cites sections  │ │
│  └────────┬─────────┘  └────────┬────────┘  └──────────┬──────────┘ │
│           │                     │                      │            │
│           └─────────┬───────────┴──────────────────────┘            │
│                     │ Store Arguments (Mastra Memory)               │
│                     ▼                                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Neutral Judge Agent (Gemini Flash)                         │   │
│  │  • Reads full debate from Mastra Memory                     │   │
│  │  • Applies 3-Factor Scoring Formula                         │   │
│  │  • Generates final verdict and recommendations              │   │
│  └──────────────────────┬───────────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────────┘
                          │ Safety Check
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 4 — SAFETY LAYER                          │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Enkrypt AI Safety Layer                                    │   │
│  │  • Checkpoint 1: Legal citation hallucination detection      │   │
│  │  • Checkpoint 2: Agent bias detection in Judge verdict       │   │
│  │  • Checkpoint 3: Output validation (score consistency,       │   │
│  │    alternative safety, unauthorized legal advice check)      │   │
│  └──────────────────────┬───────────────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────────────┘
                          │ Validated Output
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 5 — DATA LAYER                            │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Qdrant Vector DB │  │ PostgreSQL       │  │ Redis Cache      │  │
│  │                  │  │                  │  │                  │  │
│  │ Indian statutes  │  │ User sessions    │  │ Session state    │  │
│  │ Case law         │  │ Analysis history │  │ Response caching │  │
│  │ Industry stds    │  │ Report storage   │  │ Debate memory    │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 6 — LLM PROVIDERS                         │
│                                                                     │
│  ┌──────────────────────────┐  ┌────────────────────────────────┐  │
│  │ Gemini Flash             │  │ Groq Llama                     │  │
│  │ • Document processing    │  │ • User Advocate Agent          │  │
│  │ • India Legal Expert     │  │ • Company Defender Agent       │  │
│  │ • Neutral Judge          │  │ • Fast inference for debates   │  │
│  └──────────────────────────┘  └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Layer Descriptions

### Layer 1 — Presentation (Frontend)

| Attribute | Value |
|-----------|-------|
| **Technology** | Next.js 15 (TypeScript) |
| **Role** | Web interface for contract upload and viewing the Risk Report |
| **Responsibilities** | File upload, user onboarding, role selection, interactive report display, clause simulator, PDF export |
| **Communicates With** | Layer 2 (Mastra Workflow Engine) via API routes |

### Layer 2 — Orchestration (Mastra)

| Attribute | Value |
|-----------|-------|
| **Technology** | Mastra Workflow Engine + Mastra Memory (Redis) |
| **Role** | Central workflow engine managing agent handoffs and state transitions |
| **Responsibilities** | Pipeline orchestration, agent dispatching, tool calling, state management, error handling |
| **Communicates With** | Layer 1 (receives requests), Layer 3 (dispatches to agents), Layer 5 (reads/writes data) |

### Layer 3 — Agent Layer

| Attribute | Value |
|-----------|-------|
| **Technology** | 4 Mastra Agents (Groq Llama + Gemini Flash) |
| **Role** | Core intelligence — debate, analysis, and scoring |
| **Responsibilities** | Clause-level analysis, debate argumentation, legal retrieval, risk scoring, verdict generation |
| **Communicates With** | Layer 2 (orchestrated by), Layer 5 (Qdrant for retrieval, Redis for memory) |

### Layer 4 — Safety Layer

| Attribute | Value |
|-----------|-------|
| **Technology** | Enkrypt AI |
| **Role** | Performs hallucination detection, bias detection, and output validation |
| **Responsibilities** | Validate legal citations, detect bias in Judge verdicts, ensure score consistency, block unauthorized legal advice |
| **Communicates With** | Layer 3 (receives agent outputs), Layer 2 (returns validated output) |

### Layer 5 — Data Layer

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Qdrant** | Vector database | Indian statutes, case law, industry standards (hybrid search) |
| **PostgreSQL** | Relational database | Persistent storage for reports, sessions, analysis history |
| **Redis** | In-memory cache | Mastra Memory for debate conversation history, session state |

### Layer 6 — LLM Providers

| Provider | Used By | Reason |
|----------|---------|--------|
| **Gemini Flash** | Document processing, India Legal Expert, Neutral Judge | Precision-critical tasks |
| **Groq Llama** | User Advocate, Company Defender | Fast inference for debate rounds |

---

## Communication Patterns

### Frontend ↔ Orchestration
- REST API calls from Next.js to Mastra Workflow Engine
- File upload via multipart form data
- Streaming responses for real-time progress updates (optional)

### Orchestration ↔ Agents
- Mastra dispatches agents sequentially within each round
- Round 1: 3 agents run (can be parallelized)
- Round 2: 3 agents run (sequential, reading previous round from memory)
- Judge runs after Round 2 completes

### Agents ↔ Data Layer
- India Legal Expert → Qdrant (semantic search for laws)
- Company Defender → Qdrant (industry standards retrieval)
- All agents → Redis (Mastra Memory for debate messages)
- User Advocate → Redis (reads other agents' Round 1 output in Round 2)

### Agents ↔ Safety Layer
- Judge output → Enkrypt AI for bias detection
- Legal Expert output → Enkrypt AI for hallucination detection
- Final compiled report → Enkrypt AI for output validation

### Orchestration ↔ Data Layer
- Mastra Workflow → PostgreSQL (save completed reports)
- Mastra Workflow → Redis (session management)
