# Product Requirements Document (PRD): Kavach – AI Legal Contract Analysis Agent

## 1. Executive Summary
**Kavach** is a production-grade AI legal agent system designed to analyze contracts through a multi-agent adversarial debate framework. Built specifically for the Indian legal landscape, Kavach identifies high-risk clauses, benchmarks them against Indian statutes and industry standards, and generates safer alternatives. The system leverages **Mastra** for orchestration, **Qdrant** for legal grounding, and **Enkrypt AI** for rigorous safety and hallucination detection.

## 2. Problem Statement
Legal contracts are often intentionally complex and biased toward the drafting party. Users (individuals or small businesses) frequently lack the resources to identify "trap" clauses. Existing AI solutions often suffer from:
*   **Hallucinations:** Fabricating non-existent legal citations.
*   **Lack of Context:** Ignoring specific Indian laws (e.g., IT Act, Companies Act).
*   **Bias:** Providing one-sided analysis without considering adversarial perspectives.

## 3. Goals & Objectives
*   **Adversarial Analysis:** Use a 2-round debate to surface hidden risks from both user and corporate perspectives.
*   **Legal Grounding:** Ensure every claim is backed by real Indian statutes and industry benchmarks.
*   **Zero-Trust Safety:** Implement a mandatory safety layer to eliminate hallucinations and detect agent bias.
*   **Actionable Output:** Provide a quantified risk score and concrete "safer" clause alternatives.

## 4. Target Users / Stakeholders
*   **Individual Professionals:** Reviewing employment or freelance contracts.
*   **SME Owners:** Analyzing vendor or partnership agreements.
*   **Legal Tech Hackathon Judges:** Evaluating the technical robustness and safety of the agentic workflow.

## 5. Functional Requirements

### 5.1 Contract Ingestion
*   The system must support PDF and text-based contract uploads via a Next.js interface.
*   The system must parse and segment the contract for agent analysis.

### 5.2 Multi-Agent Debate Swarm
The system must implement four specialized agents:
*   **User Advocate Agent:** Identifies clauses detrimental to the individual/user.
*   **Company Defender Agent:** Justifies clauses from a corporate risk-mitigation perspective.
*   **India Legal Expert Agent:** Performs RAG-based lookups to verify legality under Indian law.
*   **Neutral Judge Agent:** Synthesizes arguments and provides the final verdict.

### 5.3 2-Round Structured Debate
*   **Round 1 (Conflict):** User Advocate and Company Defender exchange arguments to highlight conflicting interests.
*   **Round 2 (Verification):** The India Legal Expert reviews the Round 1 transcript and queries Qdrant for legal grounding.
*   **Final Synthesis:** The Neutral Judge reviews the full history to produce the final report.

### 5.4 Risk Scoring & Benchmarking
*   **3-Factor Model:** Calculate a score (0-100) based on:
    *   **Harm Potential (40%):** Financial/legal damage potential.
    *   **Legal Strength (40%):** Enforceability under Indian Law.
    *   **Practical Likelihood (20%):** Probability of the clause being triggered.
*   **Benchmarking:** Compare clauses against standard "Market" benchmarks for specific industries (SaaS, Fintech, etc.).

### 5.5 Safer Clause Generation
*   The system must generate alternative phrasing for high-risk clauses that balance protection for both parties.

## 6. Non-Functional Requirements
*   **Performance:** Use Server-Sent Events (SSE) to stream debate progress to the UI in real-time.
*   **Reliability:** Enkrypt AI must act as a blocking gate for any output containing hallucinated citations.
*   **Scalability:** Mastra Workflow Engine must manage state transitions to allow for complex, multi-step agent handoffs.
*   **Traceability:** All agent interactions must be stored in Redis for session-based memory and PostgreSQL for long-term auditability.

## 7. System Architecture Overview
The system follows a 5-layer architecture:
1.  **Frontend Layer:** Next.js UI for interaction and visualization.
2.  **Orchestration Layer:** Mastra Workflow Engine managing the state machine.
3.  **Agent Layer:** The 4-agent swarm (Advocate, Defender, Expert, Judge).
4.  **Safety Layer:** Enkrypt AI for hallucination and bias detection.
5.  **Data & Memory Layer:** Qdrant (Vector), PostgreSQL (Relational), and Redis (Cache/Memory).

## 8. Tech Stack
*   **Framework:** Next.js, TypeScript, Node.js
*   **Orchestration:** Mastra (Workflows, Agents, Memory)
*   **AI Safety:** Enkrypt AI
*   **Vector Database:** Qdrant
*   **Database:** PostgreSQL
*   **Memory/Cache:** Redis
*   **LLM:** OpenAI (GPT-4o or equivalent)
*   **Styling:** Tailwind CSS

## 9. Data Requirements
### 9.1 Qdrant Collections
*   `indian_statutes`: Indexed sections of the Indian Contract Act, IT Act, DPDP Act, etc.
*   `industry_benchmarks`: Standardized clauses for various sectors.
*   **Retrieval Strategy:** Hybrid Search (Dense Vector + Sparse Keyword) to ensure precise citation matching.

### 9.2 Persistence
*   **PostgreSQL:** Stores `User`, `ContractMetadata`, and `RiskReport` (JSON).
*   **Redis:** Stores `Mastra Thread Memory` to maintain context across the 2-round debate.

## 10. API Specifications
*   `POST /api/analyze`: Accepts contract file/text; initializes Mastra Workflow.
*   `GET /api/stream/:workflowId`: SSE endpoint to stream agent messages and status updates.
*   `GET /api/reports/:id`: Retrieves the finalized, validated risk report.

## 11. Security Requirements
*   **Input Guardrails:** Enkrypt AI checks for PII and malicious prompt injections in uploaded contracts.
*   **Output Guardrails:** 
    *   **Hallucination Detection:** Validates every legal citation against Qdrant context.
    *   **Bias Detection:** Ensures the Neutral Judge maintains a balanced stance between the Advocate and Defender.

## 12. Deployment & Infrastructure
*   **Frontend/API:** Vercel or AWS (Next.js App Router).
*   **Orchestrator:** Mastra running on Node.js environment.
*   **Vector Store:** Qdrant Cloud or Docker-hosted instance.
*   **CI/CD:** GitHub Actions for automated testing of agent tools.

## 13. Success Metrics
*   **Citation Accuracy:** >98% accuracy in legal citations (verified by Enkrypt AI).
*   **Processing Time:** Complete 2-round debate and report generation in <45 seconds.
*   **User Clarity:** Qualitative feedback on the "Safer Alternatives" being actionable and fair.

## 14. Timeline & Milestones
*   **Phase 1:** Setup Next.js + Mastra base and Qdrant collection ingestion.
*   **Phase 2:** Implement Round 1 (Advocate vs. Defender) with Redis memory.
*   **Phase 3:** Integrate India Legal Expert with Qdrant RAG and Neutral Judge scoring logic.
*   **Phase 4:** Implement Enkrypt AI safety gates and finalize the Risk Report UI.

## 15. Open Questions & Risks
*   **LLM Latency:** Multi-agent debates can be slow; mitigation involves optimized prompts and SSE streaming.
*   **Legal Complexity:** Indian law is vast; initial version will focus on Contract and IT Acts.
*   **Enkrypt AI Retries:** Defining the logic for when Enkrypt flags a hallucination (e.g., auto-retry agent prompt vs. flagging to user).

---
**Recommended Project Structure:**
```text
/kavach
├── /src
│   ├── /app                # Next.js App Router (UI)
│   ├── /mastra
│   │   ├── /agents         # advocate.ts, defender.ts, expert.ts, judge.ts
│   │   ├── /tools          # qdrant-search.ts, risk-calc.ts
│   │   ├── /workflows      # debate-workflow.ts (Core Logic)
│   │   └── index.ts        # Mastra Entry Point
│   ├── /lib
│   │   ├── enkrypt.ts      # Enkrypt AI Client
│   │   ├── qdrant.ts       # Qdrant Client
│   │   └── db.ts           # Postgres/Prisma Client
└── mastra.config.ts        # Global Mastra Config
```