# Debate Workflow

This document defines the complete 2-round multi-agent debate process, including Mastra workflow configuration, message passing, and orchestration logic.

---

## Debate Overview

```
For each extracted clause:
  Round 1 → 3 agents produce opening arguments (parallel)
  Store in Mastra Memory
  Round 2 → 3 agents produce rebuttals (sequential, reading memory)
  Store in Mastra Memory
  Judge → Reads full transcript, scores, renders verdict
```

---

## Mastra Workflow Structure

```typescript
// src/mastra/workflows/contractAnalysis.ts
import { Workflow, Step } from '@mastra/core';

export const contractAnalysisWorkflow = new Workflow({
  name: 'contract-analysis',
  triggerSchema: z.object({
    documentId: z.string(),
    clauses: z.array(ExtractedClauseSchema),
    userContext: UserContextSchema,
  }),
});

// For each clause, run the debate workflow
contractAnalysisWorkflow
  .step(processDocument)
  .then(extractClauses)
  .then(runDebatesForAllClauses)  // Iterates over clauses
  .then(validateWithEnkrypt)
  .then(compileReport)
  .commit();
```

---

## Debate Flow Per Clause

### Round 1 — Opening Arguments

All three agents can run **in parallel** since they don't depend on each other in Round 1.

```typescript
// Pseudo-code for Round 1
async function debateRound1(clause: ExtractedClause, userContext: UserContext) {
  // Run all 3 agents in parallel
  const [advocateResult, defenderResult, expertResult] = await Promise.all([
    userAdvocateAgent.generate({
      clauseText: clause.originalText,
      clauseCategory: clause.category,
      userContext,
      round: 1,
    }),
    companyDefenderAgent.generate({
      clauseText: clause.originalText,
      clauseCategory: clause.category,
      // Defender also queries Qdrant for industry standards
      round: 1,
    }),
    indiaLegalExpertAgent.generate({
      clauseText: clause.originalText,
      clauseCategory: clause.category,
      // Expert queries Qdrant for Indian laws
      round: 1,
    }),
  ]);

  // Store all arguments in Mastra Memory
  await memory.store({
    threadId: `debate-${clause.id}`,
    messages: [
      { role: 'user-advocate', content: advocateResult, round: 1 },
      { role: 'company-defender', content: defenderResult, round: 1 },
      { role: 'india-legal-expert', content: expertResult, round: 1 },
    ],
  });

  return { advocateResult, defenderResult, expertResult };
}
```

### Round 2 — Rebuttals

Agents must run **sequentially** (or at least read Round 1 results) because they need to respond to each other.

```typescript
// Pseudo-code for Round 2
async function debateRound2(
  clause: ExtractedClause,
  round1Results: Round1Results,
  userContext: UserContext
) {
  // Each agent reads the other two agents' Round 1 arguments
  
  const advocateRebuttal = await userAdvocateAgent.generate({
    clauseText: clause.originalText,
    round: 2,
    previousArguments: {
      companyDefender: round1Results.defenderResult,
      indiaLegalExpert: round1Results.expertResult,
    },
    userContext,
  });

  const defenderRebuttal = await companyDefenderAgent.generate({
    clauseText: clause.originalText,
    round: 2,
    previousArguments: {
      userAdvocate: round1Results.advocateResult,
      indiaLegalExpert: round1Results.expertResult,
    },
  });

  const expertRebuttal = await indiaLegalExpertAgent.generate({
    clauseText: clause.originalText,
    round: 2,
    previousArguments: {
      userAdvocate: round1Results.advocateResult,
      companyDefender: round1Results.defenderResult,
    },
  });

  // Store rebuttals in Mastra Memory
  await memory.store({
    threadId: `debate-${clause.id}`,
    messages: [
      { role: 'user-advocate', content: advocateRebuttal, round: 2 },
      { role: 'company-defender', content: defenderRebuttal, round: 2 },
      { role: 'india-legal-expert', content: expertRebuttal, round: 2 },
    ],
  });

  return { advocateRebuttal, defenderRebuttal, expertRebuttal };
}
```

### Verdict — Neutral Judge

```typescript
async function renderVerdict(
  clause: ExtractedClause,
  round1: Round1Results,
  round2: Round2Results,
  userContext: UserContext
) {
  // Compile full debate transcript
  const debateTranscript = {
    round1: {
      userAdvocate: round1.advocateResult,
      companyDefender: round1.defenderResult,
      indiaLegalExpert: round1.expertResult,
    },
    round2: {
      userAdvocate: round2.advocateRebuttal,
      companyDefender: round2.defenderRebuttal,
      indiaLegalExpert: round2.expertRebuttal,
    },
  };

  const verdict = await neutralJudgeAgent.generate({
    clauseId: clause.id,
    clauseText: clause.originalText,
    clauseCategory: clause.category,
    userContext,
    debateTranscript,
  });

  return verdict; // Structured NeutralJudgeOutput
}
```

---

## Message Passing via Mastra Memory

### Memory Thread Structure

Each clause debate gets its own memory thread:

```
Thread ID: debate-{clauseId}

Messages:
├── [Round 1] user-advocate: Opening argument
├── [Round 1] company-defender: Opening argument
├── [Round 1] india-legal-expert: Opening argument
├── [Round 2] user-advocate: Rebuttal
├── [Round 2] company-defender: Rebuttal
├── [Round 2] india-legal-expert: Rebuttal
└── [Verdict] neutral-judge: Final verdict
```

### Memory Configuration

```typescript
// src/mastra/memory/config.ts
import { Memory } from '@mastra/memory';
import { Redis } from '@upstash/redis';

export const memory = new Memory({
  storage: new Redis({
    url: process.env.REDIS_URL,
    token: process.env.REDIS_TOKEN,
  }),
  options: {
    lastMessages: 10,        // Keep all debate messages accessible
    semanticRecall: false,   // We use explicit thread IDs, not semantic search
  },
});
```

### Storing Messages

```typescript
interface DebateMessage {
  threadId: string;          // debate-{clauseId}
  role: 'user-advocate' | 'company-defender' | 'india-legal-expert' | 'neutral-judge';
  content: string;
  metadata: {
    round: 1 | 2 | 'verdict';
    clauseId: string;
    timestamp: Date;
    agentModel: string;      // Which LLM was used
  };
}
```

---

## Orchestration Rules

### Rule 1: Round 1 is Parallelizable
All three agents in Round 1 operate independently. Run them in parallel for speed.

### Rule 2: Round 2 is Sequential After Round 1
Round 2 cannot start until ALL Round 1 results are stored in Mastra Memory.

### Rule 3: Judge Runs After Round 2
The Neutral Judge cannot run until ALL Round 2 rebuttals are stored.

### Rule 4: One Debate Per Clause
Each clause gets its own independent debate. Debates for different clauses CAN run in parallel (limited by LLM rate limits).

### Rule 5: Enkrypt AI Runs After Judge
The Judge's output goes through Enkrypt AI before being included in the report.

---

## Error Handling

| Error | Recovery Strategy |
|-------|------------------|
| Agent timeout (LLM too slow) | Retry once with 30s timeout. If still fails, mark clause as "analysis incomplete." |
| Agent produces empty output | Retry once. If still empty, use a fallback prompt. |
| Mastra Memory write failure | Retry 3x with exponential backoff. If persistent, log error and continue with in-memory state. |
| Enkrypt AI flags hallucination | Re-run the India Legal Expert with stricter Qdrant retrieval. |
| Enkrypt AI flags bias | Re-run the Neutral Judge with explicit bias warning in prompt. |

---

## Performance Targets

| Stage | Target Latency |
|-------|---------------|
| Round 1 (3 agents, parallel) | < 8 seconds |
| Round 2 (3 agents, sequential) | < 15 seconds |
| Judge verdict | < 8 seconds |
| Enkrypt AI validation | < 3 seconds |
| **Total per clause** | **< 35 seconds** |
| **Total for 8 clauses** | **< 5 minutes** |

---

## Concurrency Limits

```typescript
const DEBATE_CONCURRENCY = {
  maxParallelClauses: 3,      // Max clauses debated simultaneously
  groqRateLimit: 30,          // Requests per minute
  geminiRateLimit: 60,        // Requests per minute
};
```

When analyzing a contract with 8 clauses, process 3 at a time to stay within rate limits.
