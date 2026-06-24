# Kavach Knowledge Base

> **The single source of truth for building Kavach — the AI Legal Shield.**

This knowledge base is designed to be consumed by **AI agents (built with Mastra)** and **human developers** during the development of Kavach. It contains all architectural decisions, agent definitions, workflow specifications, data models, and safety rules needed to build the system correctly.

---

## 📂 Knowledge Base Structure

```
knowledge-base/
├── README.md                              ← You are here
│
├── project/
│   ├── overview.md                        # Mission, goals, target users, core features
│   └── technical-decisions.md             # Key architectural decisions and rationale
│
├── architecture/
│   ├── system-architecture.md             # Layered architecture with component descriptions
│   ├── data-flow.md                       # End-to-end data flow (upload → report)
│   └── folder-structure.md                # Recommended Next.js + Mastra project layout
│
├── agents/
│   ├── agent-overview.md                  # Summary of all 4 agents and their relationships
│   ├── user-advocate.md                   # Full spec + system prompt for User Advocate
│   ├── company-defender.md                # Full spec + system prompt for Company Defender
│   ├── india-legal-expert.md              # Full spec + system prompt for India Legal Expert
│   └── neutral-judge.md                   # Full spec + system prompt for Neutral Judge
│
├── workflows/
│   ├── contract-processing.md             # Document upload, parsing, and section extraction
│   ├── debate-workflow.md                 # 2-round debate process with message passing
│   └── report-generation.md              # Report compilation, alternatives, and delivery
│
├── scoring/
│   ├── scoring-system.md                  # 3-Factor formula, rubrics, calculation logic
│   └── benchmarking.md                    # Indian law + industry standard benchmarking
│
├── data/
│   ├── database-schema.md                 # PostgreSQL tables and relationships
│   ├── qdrant-setup.md                    # Collections, vector schema, retrieval strategy
│   └── redis-memory.md                    # Mastra Memory configuration and usage
│
└── safety/
    └── enkrypt-ai-integration.md          # 3 safety checkpoints, integration patterns
```

---

## 🔗 Quick Reference for AI Agents

| If you need to...                              | Read this file                          |
|------------------------------------------------|-----------------------------------------|
| Understand what Kavach does                    | `project/overview.md`                   |
| Know why a technology was chosen               | `project/technical-decisions.md`        |
| Understand system layers and components        | `architecture/system-architecture.md`   |
| Trace data from upload to report               | `architecture/data-flow.md`             |
| Create or modify a file in the project         | `architecture/folder-structure.md`      |
| Implement or modify any agent                  | `agents/<agent-name>.md`                |
| Understand how agents interact                 | `agents/agent-overview.md`              |
| Build the document processing pipeline         | `workflows/contract-processing.md`      |
| Build the debate orchestration                 | `workflows/debate-workflow.md`          |
| Build the report generation pipeline           | `workflows/report-generation.md`        |
| Implement risk scoring                         | `scoring/scoring-system.md`             |
| Implement benchmarking logic                   | `scoring/benchmarking.md`               |
| Set up PostgreSQL tables                       | `data/database-schema.md`              |
| Set up Qdrant collections                      | `data/qdrant-setup.md`                  |
| Configure Redis / Mastra Memory                | `data/redis-memory.md`                  |
| Integrate Enkrypt AI safety checks             | `safety/enkrypt-ai-integration.md`      |

---

## 📌 Key Rules for AI Agents

1. **Always check this knowledge base** before writing code that touches agents, workflows, scoring, or data models.
2. **Follow the folder structure** in `architecture/folder-structure.md` when creating new files.
3. **Use the exact system prompts** defined in `agents/*.md` when configuring Mastra agents.
4. **Implement scoring exactly** as specified in `scoring/scoring-system.md` — the formula and weights are final.
5. **Never skip Enkrypt AI safety checks** — see `safety/enkrypt-ai-integration.md` for where and how to integrate.
6. **Use Qdrant for all legal/industry data retrieval** — never hardcode legal information.

---

## 🛠 Technology Stack Summary

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Frontend | Next.js 15 (TypeScript) | UI, upload, interactive reports |
| Orchestration | **Mastra** | Agent workflows, tool calling, memory |
| Vector DB | **Qdrant** | Legal docs + industry standards retrieval |
| Safety | **Enkrypt AI** | Hallucination & bias detection |
| Primary LLM | Gemini Flash | Legal Expert, Judge, document processing |
| Debate LLM | Groq Llama | User Advocate, Company Defender |
| Database | PostgreSQL | Persistent storage |
| Cache/Memory | Redis (Mastra Memory) | Inter-agent message passing |

---

*Last updated: June 2026 — Kavach v1.0*
