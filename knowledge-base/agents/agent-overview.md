# Agent Overview — Kavach v2.0

> **Summary of all 4 agents, their relationships, and the 5-round debate structure.**

Kavach uses a 4-agent system orchestrated by Mastra. Three agents debate through 5 structured rounds, and one judges.

*Last updated: July 2026*

---

## Agent Summary

| Agent | Role | LLM | Provider | Dedicated API Key | Perspective |
|-------|------|-----|----------|-------------------|-------------|
| **User Advocate** 🛡️ | Defends the user's interests | Llama 3.3 70B | Groq | `GROQ_USER_ADVOCATE_KEY` | "How could this clause harm the person signing it?" |
| **Company Defender** ⚖️ | Explains the company's rationale | Llama 3.3 70B | Groq | `GROQ_COMPANY_DEFENDER_KEY` | "Why would a reasonable company include this?" |
| **India Legal Expert** 📜 | Provides Indian law analysis | Gemini 2.5 Pro | Google | `GEMINI_LEGAL_EXPERT_KEY` | "What does Indian law say about this clause?" |
| **Neutral Judge** 🏛️ | Evaluates debate and scores | Gemini 2.5 Pro | Google | `GEMINI_JUDGE_KEY` | "Given all arguments, how risky is this clause?" |

---

## Agent Relationships & 5-Round Flow

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
    │  (Groq)     │ │  (Groq)     │ │ (Gemini 2.5) │
    └──────┬──────┘ └──────┬───────┘ └──────┬───────┘
           │               │                │
           │   Round 1: Opening Statements  │
           └───────────────┼────────────────┘
                           │ All args stored
                           ▼ in Mastra Memory
                    ┌──────────────┐
                    │  Mastra      │
                    │  Memory      │
                    │  (Redis)     │
                    └──────┬───────┘
                           │ Agents read
                           │ previous rounds
                           ▼
              ┌──────────────────────────┐
              │  Round 2: Rebuttal 1     │
              │  All 3 agents respond    │
              │  to each other           │
              └────────────┬─────────────┘
                           ▼
              ┌──────────────────────────┐
              │  Round 3: Rebuttal 2     │
              │  Deeper back-and-forth   │
              └────────────┬─────────────┘
                           ▼
              ┌──────────────────────────┐
              │  Round 4: Cross Exam     │
              │  Direct challenges       │
              │  Advocate vs Defender    │
              └────────────┬─────────────┘
                           ▼
              ┌──────────────────────────┐
              │  Round 5: Closing Args   │
              │  Final positions         │
              └────────────┬─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Neutral     │
                    │  Judge       │
                    │  (Gemini 2.5)│
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Enkrypt AI  │
                    │  Validation  │
                    └──────────────┘
```

---

## 5-Round Debate Structure

| Round | Phase | What Happens | Execution | Purpose |
|-------|-------|-------------|-----------|---------|
| 1 | **Opening Statements** | Each of the 3 agents presents their initial position with evidence | **Parallel** | Set their stance |
| 2 | **Rebuttal Round 1** | Agents reply to each other's opening arguments | Sequential | Challenge initial points |
| 3 | **Rebuttal Round 2** | Agents continue replying and strengthening their arguments | Sequential | Deeper back-and-forth |
| 4 | **Cross Examination** | Agents directly challenge each other (especially Advocate vs Defender) | Sequential | Pressure testing arguments |
| 5 | **Closing Arguments** | Each agent gives their final stance after hearing everything | Sequential | Final position |
| — | **Verdict** | Neutral Judge reads all 15 messages, scores, renders verdict | Single agent | Final risk assessment |

**Total messages per clause:** 15 debate + 1 verdict = **16 messages**

---

## Agent Participation by Round

| Round | User Advocate | Company Defender | India Legal Expert | Neutral Judge |
|-------|:---:|:---:|:---:|:---:|
| **Round 1 (Opening)** | ✅ Argues | ✅ Argues | ✅ Argues | ❌ Observes |
| **Round 2 (Rebuttal 1)** | ✅ Rebuts | ✅ Rebuts | ✅ Rebuts | ❌ Observes |
| **Round 3 (Rebuttal 2)** | ✅ Rebuts | ✅ Rebuts | ✅ Rebuts | ❌ Observes |
| **Round 4 (Cross Exam)** | ✅ Challenges | ✅ Challenges | ✅ Verifies | ❌ Observes |
| **Round 5 (Closing)** | ✅ Closes | ✅ Closes | ✅ Closes | ❌ Observes |
| **Verdict** | ❌ | ❌ | ❌ | ✅ Judges |

---

## Data Access by Agent

| Agent | User Context | Clause Text | Qdrant (Laws) | Qdrant (Standards) | Mastra Memory | Scoring Rubrics |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| User Advocate | ✅ | ✅ | ❌ | ❌ | ✅ (Rounds 2–5) | ❌ |
| Company Defender | ❌ | ✅ | ❌ | ✅ | ✅ (Rounds 2–5) | ❌ |
| India Legal Expert | ❌ | ✅ | ✅ | ❌ | ✅ (Rounds 2–5) | ❌ |
| Neutral Judge | ✅ | ✅ | ❌ | ❌ | ✅ (Full: all 15 messages) | ✅ |

---

## Mastra Agent Definition Pattern

Each agent in Mastra follows this definition pattern with **dedicated API keys**:

```typescript
import { Agent } from '@mastra/core';
import { google } from '@ai-sdk/google';
import { groq } from '@ai-sdk/groq';

// Gemini 2.5 Pro agent (India Legal Expert)
const indiaLegalExpert = new Agent({
  name: 'india-legal-expert',
  instructions: SYSTEM_PROMPT,
  model: google('gemini-2.5-pro', {
    apiKey: process.env.GEMINI_LEGAL_EXPERT_KEY,  // Dedicated key
  }),
  tools: {
    qdrantSearchLaws,
  },
});

// Groq Llama agent (User Advocate)
const userAdvocate = new Agent({
  name: 'user-advocate',
  instructions: SYSTEM_PROMPT,
  model: groq('llama-3.3-70b-versatile', {
    apiKey: process.env.GROQ_USER_ADVOCATE_KEY,   // Dedicated key
  }),
  tools: {},
});
```

---

## Detailed Agent Specifications

For complete specifications including system prompts, input/output schemas, and tool definitions, see:

- [User Advocate Agent](./user-advocate.md)
- [Company Defender Agent](./company-defender.md)
- [India Legal Expert Agent](./india-legal-expert.md)
- [Neutral Judge Agent](./neutral-judge.md)
