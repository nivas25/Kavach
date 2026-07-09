# Key Technical Decisions — Kavach v2.0

> **All significant technical decisions with rationale. AI agents should follow these consistently.**

*Last updated: July 2026*

---

## Decision 1: Multi-Agent Debate vs. Single-Agent Analysis

**Decision:** Use 4 specialized agents in a structured 5-round debate.
**Alternatives Considered:** Single-agent chain-of-thought, single-agent with self-critique, 2-round debate.

**Rationale:**
- A single agent produces one-dimensional analysis prone to confirmation bias
- Multi-agent debate surfaces risks that require adversarial thinking
- Agents hold each other accountable — claims are challenged and verified
- 5 rounds (Opening, Rebuttal×2, Cross Exam, Closing) provide thorough adversarial testing
- The Neutral Judge synthesizes a balanced verdict from genuine disagreement
- This architecture maps directly to Mastra's multi-agent workflow capabilities

---

## Decision 2: LLM Selection — Dual Model Strategy with Dedicated Keys

**Decision:** Use Gemini 2.5 Pro for precision-critical tasks and Groq Llama 3.3 70B for debate agents. Each agent gets a dedicated API key.

| Agent | LLM | Provider | Why |
|-------|-----|----------|-----|
| Document Extraction | Gemini 2.5 Pro | Google | Precise extraction, structured JSON output |
| User Advocate | Llama 3.3 70B | Groq | Fast inference for 5 debate rounds |
| Company Defender | Llama 3.3 70B | Groq | Fast inference for 5 debate rounds |
| India Legal Expert | Gemini 2.5 Pro | Google | Precision for legal citations, low hallucination |
| Neutral Judge | Gemini 2.5 Pro | Google | Calibrated judicial reasoning, structured scoring |

**Why Gemini 2.5 Pro (not Flash):**
- The Legal Expert and Judge require the highest reasoning quality
- 2.5 Pro provides significantly better legal analysis than Flash
- The cost difference is justified by the precision requirements

**Why dedicated API keys:**
- Eliminates rate limit contention between agents
- Each agent has independent quota and failure isolation
- Enables per-agent cost tracking

---

## Decision 3: 5-Round Debate (Not 2-Round)

**Decision:** Limit the debate to exactly 5 rounds + verdict.

| Round | Phase | Purpose |
|-------|-------|---------|
| 1 | Opening Statements | Establish positions |
| 2 | Rebuttal 1 | Challenge initial points |
| 3 | Rebuttal 2 | Deeper refinement |
| 4 | Cross Examination | Pressure-test arguments |
| 5 | Closing Arguments | Final stance |

**Alternatives Considered:** 1 round, 2 rounds, unlimited rounds.

**Rationale:**
- 2 rounds (previous design) was insufficient — no cross-examination or closing
- 5 rounds provide thorough adversarial testing without diminishing returns
- Cross examination (Round 4) is critical for catching weak arguments
- Closing arguments (Round 5) let agents synthesize after hearing everything
- 6+ rounds would increase latency significantly without proportional quality gain
- Fixed structure ensures predictable latency for user experience

---

## Decision 4: LlamaParse for Document Parsing

**Decision:** Use LlamaParse (LlamaIndex) as the primary document parser, with Gemini 2.5 Pro for structured extraction.

**Alternatives Considered:** pdf-parse + mammoth, direct Gemini Vision, custom parser.

**Rationale:**
- LlamaParse produces high-fidelity Markdown from complex PDFs (tables, columns, nested clauses)
- pdf-parse + mammoth produce raw text with lost structure — unacceptable for legal documents
- Two-stage pipeline (LlamaParse → Gemini) separates parsing from understanding
- LlamaParse handles the hard structural parsing; Gemini handles the intelligent extraction

---

## Decision 5: Mastra as Orchestration Layer

**Decision:** Use Mastra for all agent orchestration, tool calling, and inter-agent communication.

**Rationale:**
- Hackathon mandatory stack requirement
- Native support for multi-agent workflows with parallel/sequential execution
- Built-in Memory system (Redis-backed) for inter-agent message passing across 5 debate rounds
- Structured tool calling for document processing, Qdrant retrieval, and Enkrypt AI validation
- Workflow engine handles state transitions between debate rounds

**Key Mastra Features Used:**
- `Agent` definitions with system prompts and dedicated model configuration
- `Workflow` for orchestrating the full analysis pipeline
- `Memory` (Redis) for inter-agent debate message passing (16 messages per clause)
- `Tool` for document processing, Qdrant search, Enkrypt AI validation

---

## Decision 6: Qdrant for Legal Knowledge Retrieval

**Decision:** Store all Indian legal documents and industry standards in Qdrant with hybrid search.

**Alternatives Considered:** ChromaDB, Pinecone, plain text search.

**Rationale:**
- Hackathon mandatory stack requirement
- Hybrid search (dense + sparse vectors) ensures both semantic meaning and keyword precision
- Critical for legal retrieval where exact section numbers matter alongside conceptual similarity
- Supports payload filtering for targeted retrieval (by act name, section, industry, etc.)

---

## Decision 7: Enkrypt AI as Safety Layer

**Decision:** Integrate Enkrypt AI at 3 critical checkpoints (with 4 total calls).

**Checkpoints:**
1. After Legal Expert Round 1 (citation verification)
2. After Legal Expert Round 4 — Cross Examination (re-verify new citations)
3. After Judge verdict (bias detection)
4. Before final report (output validation)

**Rationale:**
- Hackathon mandatory stack requirement
- Legal applications have zero tolerance for hallucinated citations
- A fabricated legal reference could cause real harm to users
- Integrated as post-processing steps, not inline — keeps agent logic clean

---

## Decision 8: Supabase for Permanent Storage (Not Prisma + Raw PostgreSQL)

**Decision:** Use Supabase (hosted PostgreSQL) with the Supabase client SDK.

**Alternatives Considered:** Self-hosted PostgreSQL with Prisma ORM.

**Rationale:**
- Supabase provides hosted PostgreSQL with automatic backups
- Built-in REST API and real-time subscriptions (future use)
- Row-level security (RLS) ready for future auth integration
- No need to manage database infrastructure during hackathon
- Simpler setup than self-hosted PostgreSQL + Prisma migrations

---

## Decision 9: Redis for Temporary Storage (Not Supabase for Everything)

**Decision:** Use Redis for all data during analysis, transfer to Supabase only after completion.

**Rationale:**
- Debate messages need sub-millisecond read/write (agents read each other's messages in real-time)
- Supabase adds network latency (20–100ms per read) that compounds across 15 debate messages per clause
- Redis TTL automatically cleans up failed/abandoned sessions
- Mastra Memory natively uses Redis
- Clear separation: Redis = temporary speed layer, Supabase = permanent truth layer

---

## Decision 10: Clause-Level Analysis (Not Full Document)

**Decision:** Extract and analyze individual clauses, not the entire document at once.

**Rationale:**
- Full-document analysis dilutes agent focus and increases token cost
- Clause-level analysis produces more precise, actionable results
- Each clause becomes an independent 5-round debate topic
- Users can navigate results per-clause in the final report
- Reduces hallucination risk by keeping context windows smaller

---

## Decision 11: Weighted Scoring Formula (Not ML-Based)

**Decision:** Use a transparent 3-factor weighted formula instead of a trained classifier.

**Rationale:**
- ML-based scoring is a black box — users can't understand why a clause scored a certain way
- The formula is fully auditable: users see each factor and its weight
- Easier to calibrate and adjust during hackathon development
- No training data required
- Aligns with the principle of transparency and trust

---

## Decision 12: Proactive Alternative Generation

**Decision:** Automatically generate safer alternatives for every medium+ risk clause.

**Rationale:**
- Users know something is "bad" but rarely know what "good" looks like
- Proposing a specific alternative is more effective in negotiation than objecting
- Alternatives are grounded in what Indian courts have historically enforced
- Differentiates Kavach from all existing tools
