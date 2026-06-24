# Agent Overview

Kavach uses a 4-agent system orchestrated by Mastra. Three agents debate, and one judges. This document provides a summary of all agents and their relationships.

---

## Agent Summary

| Agent | Role | LLM | Perspective |
|-------|------|-----|------------|
| **User Advocate** 🛡️ | Defends the user's interests | Groq Llama | "How could this clause harm the person signing it?" |
| **Company Defender** ⚖️ | Explains the company's rationale | Groq Llama | "Why would a reasonable company include this?" |
| **India Legal Expert** 📜 | Provides Indian law analysis | Gemini Flash | "What does Indian law say about this clause?" |
| **Neutral Judge** 🏛️ | Evaluates debate and scores | Gemini Flash | "Given all arguments, how risky is this clause?" |

---

## Agent Relationships

```
                    ┌─────────────────┐
                    │   Mastra        │
                    │   Workflow      │
                    │   Engine        │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
    │   User      │ │  Company     │ │ India Legal  │
    │   Advocate  │ │  Defender    │ │ Expert       │
    │  (Groq)     │ │  (Groq)     │ │ (Gemini)     │
    └──────┬──────┘ └──────┬───────┘ └──────┬───────┘
           │               │                │
           │     Round 1   │                │
           └───────────────┼────────────────┘
                           │ All args stored
                           ▼ in Mastra Memory
                    ┌──────────────┐
                    │  Mastra      │
                    │  Memory      │
                    │  (Redis)     │
                    └──────┬───────┘
                           │ Agents read
                           │ each other's Round 1
                           ▼
              ┌──────────────────────────┐
              │  Round 2: Rebuttals      │
              │  All 3 agents respond    │
              │  to each other           │
              └────────────┬─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Neutral     │
                    │  Judge       │
                    │  (Gemini)    │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Enkrypt AI  │
                    │  Validation  │
                    └──────────────┘
```

---

## Agent Participation by Round

| Round | User Advocate | Company Defender | India Legal Expert | Neutral Judge |
|-------|:---:|:---:|:---:|:---:|
| **Round 1 (Opening)** | ✅ Argues | ✅ Argues | ✅ Argues | ❌ Observes |
| **Round 2 (Rebuttal)** | ✅ Rebuts | ✅ Rebuts | ✅ Rebuts | ❌ Observes |
| **Verdict** | ❌ | ❌ | ❌ | ✅ Judges |

---

## Data Access by Agent

| Agent | User Context | Clause Text | Qdrant (Laws) | Qdrant (Standards) | Mastra Memory | Scoring Rubrics |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| User Advocate | ✅ | ✅ | ❌ | ❌ | ✅ (Round 2) | ❌ |
| Company Defender | ❌ | ✅ | ❌ | ✅ | ✅ (Round 2) | ❌ |
| India Legal Expert | ❌ | ✅ | ✅ | ❌ | ✅ (Round 2) | ❌ |
| Neutral Judge | ✅ | ✅ | ❌ | ❌ | ✅ (Full) | ✅ |

---

## Mastra Agent Definition Pattern

Each agent in Mastra follows this definition pattern:

```typescript
import { Agent } from '@mastra/core';

const agentName = new Agent({
  name: 'agent-name',
  instructions: SYSTEM_PROMPT,  // See individual agent docs
  model: {
    provider: 'PROVIDER',       // 'GROQ' or 'GOOGLE'
    name: 'MODEL_NAME',        // 'llama-3.1-70b-versatile' or 'gemini-2.0-flash'
  },
  tools: {
    // Agent-specific tools
  },
});
```

---

## Detailed Agent Specifications

For complete specifications including system prompts, input/output schemas, and tool definitions, see:

- [User Advocate Agent](./user-advocate.md)
- [Company Defender Agent](./company-defender.md)
- [India Legal Expert Agent](./india-legal-expert.md)
- [Neutral Judge Agent](./neutral-judge.md)
