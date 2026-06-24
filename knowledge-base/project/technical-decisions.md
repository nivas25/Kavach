# Key Technical Decisions

This document records all significant technical decisions made for Kavach, along with their rationale. AI agents should follow these decisions consistently.

---

## Decision 1: Multi-Agent Debate vs. Single-Agent Analysis

**Decision:** Use 4 specialized agents in a structured 2-round debate.  
**Alternatives Considered:** Single-agent chain-of-thought, single-agent with self-critique.

**Rationale:**
- A single agent produces one-dimensional analysis prone to confirmation bias
- Multi-agent debate surfaces risks that require adversarial thinking
- Agents hold each other accountable — claims are challenged and verified
- The Neutral Judge synthesizes a balanced verdict from genuine disagreement
- This architecture maps directly to Mastra's multi-agent workflow capabilities

---

## Decision 2: LLM Selection — Dual Model Strategy

**Decision:** Use Gemini Flash for precision-critical tasks and Groq Llama for debate agents.

| Agent | LLM | Reason |
|-------|-----|--------|
| Document Processing | Gemini Flash | Precise extraction, structured output |
| User Advocate | Groq Llama | Fast inference for debate rounds |
| Company Defender | Groq Llama | Fast inference for debate rounds |
| India Legal Expert | Gemini Flash | Precision for legal citations |
| Neutral Judge | Gemini Flash | Balanced judicial reasoning |

**Rationale:**
- Debate agents (Advocate, Defender) need speed over maximum precision — Groq Llama provides sub-second inference
- Legal Expert and Judge need precision — Gemini Flash provides better structured reasoning
- Cost optimization: Groq is more economical for high-volume debate rounds

---

## Decision 3: Mastra as Orchestration Layer

**Decision:** Use Mastra for all agent orchestration, tool calling, and inter-agent communication.

**Rationale:**
- Hackathon mandatory stack requirement
- Native support for multi-agent workflows
- Built-in memory system (Redis-backed) for message passing between debate rounds
- Structured tool calling for document processing and Qdrant retrieval
- Workflow engine handles state transitions between debate rounds

**Key Mastra Features Used:**
- `Agent` definitions with system prompts
- `Workflow` for orchestrating the full pipeline
- `Memory` (Redis) for inter-agent debate message passing
- `Tool` for document processing, Qdrant search, Enkrypt AI validation

---

## Decision 4: Qdrant for Legal Knowledge Retrieval

**Decision:** Store all Indian legal documents and industry standards in Qdrant with hybrid search.

**Alternatives Considered:** ChromaDB, Pinecone, plain text search.

**Rationale:**
- Hackathon mandatory stack requirement
- Hybrid search (dense + sparse vectors) ensures both semantic meaning and keyword precision
- Critical for legal retrieval where exact section numbers matter alongside conceptual similarity
- Self-hosted option available for data sovereignty
- Supports payload filtering for targeted retrieval (by act name, section, industry, etc.)

---

## Decision 5: Enkrypt AI as Safety Layer

**Decision:** Integrate Enkrypt AI at 3 critical checkpoints in the pipeline.

**Rationale:**
- Hackathon mandatory stack requirement
- Legal applications have zero tolerance for hallucinated citations
- A fabricated legal reference could cause real harm to users
- Enkrypt AI provides hallucination detection, bias detection, and output validation
- Integrated as a post-processing step, not inline — keeps agent logic clean

---

## Decision 6: PostgreSQL for Persistent Storage

**Decision:** Use PostgreSQL for user sessions, analysis history, and report storage.

**Rationale:**
- Reports have complex relational structure (contract → clauses → debate → scores → alternatives)
- Need reliable ACID transactions for report persistence
- Mastra supports PostgreSQL as a storage backend
- Well-suited for querying historical analyses

---

## Decision 7: Redis for Inter-Agent Memory

**Decision:** Use Redis (via Mastra Memory) for debate message passing and session state.

**Rationale:**
- Debate messages need to be written by 3 agents and read by all agents + Judge in real-time
- Redis provides sub-millisecond read/write for in-memory data
- Mastra Memory natively uses Redis
- Session state and caching benefit from Redis's TTL capabilities
- Data is ephemeral (per-session) so persistence is not critical

---

## Decision 8: Next.js 15 with TypeScript for Frontend

**Decision:** Use Next.js 15 with TypeScript for the web frontend.

**Rationale:**
- Server-side rendering for fast initial page loads
- API routes can serve as the backend for the Mastra pipeline
- TypeScript ensures type safety across the full stack
- App Router provides modern routing patterns
- Rich ecosystem for PDF viewers, file uploaders, and interactive components

---

## Decision 9: Clause-Level Analysis (Not Full Document)

**Decision:** Extract and analyze individual clauses, not the entire document at once.

**Rationale:**
- Full-document analysis dilutes agent focus and increases token cost
- Clause-level analysis produces more precise, actionable results
- Each clause becomes an independent debate topic
- Users can navigate results per-clause in the final report
- Reduces hallucination risk by keeping context windows smaller

---

## Decision 10: 2-Round Debate (Not Unlimited)

**Decision:** Limit the debate to exactly 2 rounds (Opening + Rebuttal).

**Alternatives Considered:** 1 round, 3+ rounds, dynamic termination.

**Rationale:**
- 1 round is insufficient — agents can't respond to each other
- 3+ rounds increases latency significantly without proportional quality gain
- 2 rounds provide the optimal balance: Round 1 establishes positions, Round 2 challenges and refines
- Predictable latency for user experience
- Fixed structure simplifies Mastra workflow orchestration

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
