# Debate Workflow — Kavach v2.0

> **Complete 5-round multi-agent debate process with Mastra orchestration.**

This document defines the full debate workflow, including Mastra workflow configuration, message passing, round-by-round execution, and orchestration logic.

*Last updated: July 2026*

---

## Debate Overview

```
For each extracted clause:
  Round 1 → 3 agents produce Opening Statements (parallel)
  Store in Mastra Memory
  Round 2 → 3 agents produce Rebuttal 1 (sequential, reading previous rounds)
  Store in Mastra Memory
  Round 3 → 3 agents produce Rebuttal 2 (sequential)
  Store in Mastra Memory
  Round 4 → 3 agents Cross Examine each other (sequential)
  Store in Mastra Memory → Enkrypt AI CP-1 re-check
  Round 5 → 3 agents produce Closing Arguments (sequential)
  Store in Mastra Memory
  Judge → Reads full 15-message transcript, scores, renders verdict
  Enkrypt AI CP-2 → Bias detection on verdict
```

---

## 5-Round Debate Structure

| Round | Phase | Who Speaks | Execution | What Happens |
|-------|-------|-----------|-----------|-------------|
| 1 | **Opening Statements** | All 3 debate agents | **Parallel** | Each agent presents their initial position with evidence |
| 2 | **Rebuttal Round 1** | All 3 debate agents | Sequential | Agents reply to each other's Round 1 arguments |
| 3 | **Rebuttal Round 2** | All 3 debate agents | Sequential | Agents strengthen arguments, address rebuttals |
| 4 | **Cross Examination** | All 3 debate agents | Sequential | Direct challenges; Advocate vs Defender primary conflict |
| 5 | **Closing Arguments** | All 3 debate agents | Sequential | Final position after hearing all arguments |
| — | **Verdict** | Neutral Judge only | Single agent | Reads 15 messages, applies scoring formula |

---

## Mastra Workflow Structure

```typescript
// src/mastra/workflows/contractAnalysis.ts
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
  .step(readExtractedDocument)
  .then(runDebatesForAllClauses)    // Iterates over clauses (3 parallel max)
  .then(runEnkryptValidation)       // Checkpoints 2 & 3
  .then(generateAlternatives)       // Safer alternatives
  .then(compileReport)              // Assemble final report
  .then(persistToSupabase)          // Redis → Supabase transfer
  .then(cleanupRedis)               // Delete temp Redis keys
  .commit();
```

---

## Debate Flow Per Clause

### Round 1 — Opening Statements

All three agents run **in parallel** since they don't depend on each other.

```typescript
async function debateRound1(
  clause: ExtractedClause,
  userContext: UserContext,
  sessionId: string
) {
  // Run all 3 agents in parallel for speed
  const [advocateResult, defenderResult, expertResult] = await Promise.all([
    userAdvocateAgent.generate({
      clauseText: clause.originalText,
      clauseCategory: clause.category,
      userContext,
      round: 1,
      phase: 'opening_statements',
    }),
    companyDefenderAgent.generate({
      clauseText: clause.originalText,
      clauseCategory: clause.category,
      // Defender also queries Qdrant for industry standards
      round: 1,
      phase: 'opening_statements',
    }),
    indiaLegalExpertAgent.generate({
      clauseText: clause.originalText,
      clauseCategory: clause.category,
      // Expert queries Qdrant for Indian laws
      round: 1,
      phase: 'opening_statements',
    }),
  ]);

  // → Enkrypt AI Checkpoint 1: Validate Legal Expert citations
  const citationCheck = await verifyLegalCitations(expertResult);
  if (!citationCheck.passed) {
    // Re-run Legal Expert with stricter prompt
    expertResult = await rerunLegalExpert(clause, 'strict_qdrant_only');
  }

  // Store all 3 opening statements in Mastra Memory
  await memory.add({
    threadId: `debate:${sessionId}:${clause.id}`,
    messages: [
      { role: 'user-advocate', content: advocateResult, metadata: { round: 1, phase: 'opening_statements', ... } },
      { role: 'company-defender', content: defenderResult, metadata: { round: 1, phase: 'opening_statements', ... } },
      { role: 'india-legal-expert', content: expertResult, metadata: { round: 1, phase: 'opening_statements', ... } },
    ],
  });

  return { advocateResult, defenderResult, expertResult };
}
```

### Round 2 — Rebuttal Round 1

Agents read Round 1 from Mastra Memory and produce rebuttals.

```typescript
async function debateRound2(
  clause: ExtractedClause,
  round1: Round1Results,
  userContext: UserContext,
  sessionId: string
) {
  // Each agent reads the other two agents' Round 1 arguments

  const advocateRebuttal = await userAdvocateAgent.generate({
    clauseText: clause.originalText,
    round: 2,
    phase: 'rebuttal_1',
    previousArguments: {
      companyDefender: round1.defenderResult,
      indiaLegalExpert: round1.expertResult,
    },
    userContext,
    instructions: `
      Round 2: Rebuttal
      You have read the Company Defender's justification and the India Legal Expert's
      legal analysis from Round 1. Respond to their arguments:
      1. Challenge the Defender's justifications where they minimize real risks.
      2. Use the Legal Expert's findings to strengthen your case.
      3. Concede only genuinely valid points.
      4. Identify any additional risks revealed by their arguments.
    `,
  });

  const defenderRebuttal = await companyDefenderAgent.generate({
    clauseText: clause.originalText,
    round: 2,
    phase: 'rebuttal_1',
    previousArguments: {
      userAdvocate: round1.advocateResult,
      indiaLegalExpert: round1.expertResult,
    },
    instructions: `
      Round 2: Rebuttal
      Address the User Advocate's concerns and incorporate the Legal Expert's analysis.
      Concede valid points rather than defending everything — this builds credibility.
    `,
  });

  const expertRebuttal = await indiaLegalExpertAgent.generate({
    clauseText: clause.originalText,
    round: 2,
    phase: 'rebuttal_1',
    previousArguments: {
      userAdvocate: round1.advocateResult,
      companyDefender: round1.defenderResult,
    },
    instructions: `
      Round 2: Refined Legal Analysis
      Address specific legal claims made by both agents.
      Verify legal risks cited by the Advocate against Qdrant.
      Assess industry standard claims by the Defender.
      Maintain strict neutrality.
    `,
  });

  // Store rebuttals in Mastra Memory
  await memory.add({
    threadId: `debate:${sessionId}:${clause.id}`,
    messages: [
      { role: 'user-advocate', content: advocateRebuttal, metadata: { round: 2, phase: 'rebuttal_1', ... } },
      { role: 'company-defender', content: defenderRebuttal, metadata: { round: 2, phase: 'rebuttal_1', ... } },
      { role: 'india-legal-expert', content: expertRebuttal, metadata: { round: 2, phase: 'rebuttal_1', ... } },
    ],
  });

  return { advocateRebuttal, defenderRebuttal, expertRebuttal };
}
```

### Round 3 — Rebuttal Round 2

Same pattern as Round 2, but agents now have Rounds 1 and 2 in context.

```typescript
async function debateRound3(clause, round1, round2, userContext, sessionId) {
  // Each agent reads Rounds 1-2 from Mastra Memory
  // Produces deeper, more refined arguments
  // Stored in Memory as round: 3, phase: 'rebuttal_2'
  // ...same pattern as Round 2 with expanded context
}
```

### Round 4 — Cross Examination

The most adversarial round. Agents directly challenge specific claims.

```typescript
async function debateRound4(clause, round1, round2, round3, userContext, sessionId) {
  const advocateCrossExam = await userAdvocateAgent.generate({
    clauseText: clause.originalText,
    round: 4,
    phase: 'cross_examination',
    allPreviousRounds: { round1, round2, round3 },
    instructions: `
      Round 4: Cross Examination
      You are now in cross-examination. This is your opportunity to directly
      challenge the Company Defender's specific claims:
      1. Pick the Defender's WEAKEST argument and dismantle it.
      2. Present evidence that contradicts the Defender's claims.
      3. If the Legal Expert's analysis supports you, cite it forcefully.
      4. Ask pointed questions that expose the clause's real risks.
      5. Be assertive but professional.
    `,
  });

  const defenderCrossExam = await companyDefenderAgent.generate({
    // ... similar pattern, challenging the Advocate
  });

  const expertCrossExam = await indiaLegalExpertAgent.generate({
    // ... verifies/corrects legal claims from both sides
    instructions: `
      Round 4: Cross Examination — Legal Fact Check
      Both agents have made specific legal claims across 3 rounds.
      Your role is to:
      1. Verify legal claims made by the Advocate — are they accurate?
      2. Verify legal claims made by the Defender — are they accurate?
      3. Correct any legal misconceptions from either side.
      4. Provide additional legal context revealed by the cross-examination.
    `,
  });

  // → Enkrypt AI Checkpoint 1b: Re-verify Legal Expert citations
  await verifyLegalCitations(expertCrossExam);

  // Store in Mastra Memory
  await memory.add({
    threadId: `debate:${sessionId}:${clause.id}`,
    messages: [
      { role: 'user-advocate', content: advocateCrossExam, metadata: { round: 4, phase: 'cross_examination', ... } },
      { role: 'company-defender', content: defenderCrossExam, metadata: { round: 4, phase: 'cross_examination', ... } },
      { role: 'india-legal-expert', content: expertCrossExam, metadata: { round: 4, phase: 'cross_examination', ... } },
    ],
  });
}
```

### Round 5 — Closing Arguments

Each agent gives their final position after hearing 4 rounds of debate.

```typescript
async function debateRound5(clause, allRounds, userContext, sessionId) {
  const advocateClosing = await userAdvocateAgent.generate({
    instructions: `
      Round 5: Closing Arguments
      This is your FINAL statement. After hearing all arguments across 4 rounds:
      1. Summarize the key risks you've identified.
      2. Acknowledge any valid points the Defender made.
      3. State your final recommendation to the user clearly.
      4. End with your strongest argument.
    `,
  });

  const defenderClosing = await companyDefenderAgent.generate({
    // ... similar closing pattern
  });

  const expertClosing = await indiaLegalExpertAgent.generate({
    instructions: `
      Round 5: Closing Legal Summary
      Provide your final legal assessment after 4 rounds of debate:
      1. State the definitive legal position on this clause.
      2. Summarize enforceability assessment.
      3. Note any legal nuances revealed during the debate.
      4. Provide your final recommendation from a legal standpoint.
    `,
  });

  // Store closing arguments
  await memory.add({
    threadId: `debate:${sessionId}:${clause.id}`,
    messages: [
      { role: 'user-advocate', content: advocateClosing, metadata: { round: 5, phase: 'closing_arguments', ... } },
      { role: 'company-defender', content: defenderClosing, metadata: { round: 5, phase: 'closing_arguments', ... } },
      { role: 'india-legal-expert', content: expertClosing, metadata: { round: 5, phase: 'closing_arguments', ... } },
    ],
  });
}
```

### Verdict — Neutral Judge

```typescript
async function renderVerdict(clause, sessionId, userContext) {
  // Read full 15-message debate transcript from Mastra Memory
  const fullDebate = await memory.get({
    threadId: `debate:${sessionId}:${clause.id}`,
  });

  // Compile transcript by round
  const debateTranscript = {
    round1: { /* Opening Statements from all 3 agents */ },
    round2: { /* Rebuttal 1 from all 3 agents */ },
    round3: { /* Rebuttal 2 from all 3 agents */ },
    round4: { /* Cross Examination from all 3 agents */ },
    round5: { /* Closing Arguments from all 3 agents */ },
  };

  const verdict = await neutralJudgeAgent.generate({
    clauseId: clause.id,
    clauseText: clause.originalText,
    clauseCategory: clause.category,
    userContext,
    debateTranscript,
  });

  // → Enkrypt AI Checkpoint 2: Bias detection
  const biasCheck = await detectJudgeBias(verdict, debateTranscript);
  if (!biasCheck.passed) {
    verdict = await rerunJudge(clause, debateTranscript, biasCheck.biasDirection);
  }

  // Store verdict in Mastra Memory
  await memory.add({
    threadId: `debate:${sessionId}:${clause.id}`,
    messages: [{
      role: 'neutral-judge',
      content: JSON.stringify(verdict),
      metadata: { round: 6, phase: 'verdict', ... },
    }],
  });

  return verdict; // Structured NeutralJudgeOutput
}
```

---

## Message Passing via Mastra Memory

### Memory Thread Structure

Each clause debate gets its own memory thread:

```
Thread ID: debate:{session_id}:{clause_id}

Messages (16 total):
├── [Round 1] user-advocate: Opening argument
├── [Round 1] company-defender: Opening argument
├── [Round 1] india-legal-expert: Opening argument (+ Qdrant citations)
├── [Round 2] user-advocate: Rebuttal 1
├── [Round 2] company-defender: Rebuttal 1
├── [Round 2] india-legal-expert: Rebuttal 1
├── [Round 3] user-advocate: Rebuttal 2
├── [Round 3] company-defender: Rebuttal 2
├── [Round 3] india-legal-expert: Rebuttal 2
├── [Round 4] user-advocate: Cross Examination
├── [Round 4] company-defender: Cross Examination
├── [Round 4] india-legal-expert: Cross Examination (fact-check)
├── [Round 5] user-advocate: Closing Argument
├── [Round 5] company-defender: Closing Argument
├── [Round 5] india-legal-expert: Closing Argument
└── [Verdict] neutral-judge: Final verdict + scores (JSON)
```

---

## Orchestration Rules

### Rule 1: Round 1 is Parallelizable
All three agents in Round 1 operate independently. Run them in parallel for speed.

### Rule 2: Rounds 2–5 are Sequential After Previous Rounds
Each subsequent round cannot start until ALL messages from the previous round are stored in Mastra Memory.

### Rule 3: Judge Runs After Round 5
The Neutral Judge cannot run until ALL 15 debate messages (5 rounds × 3 agents) are stored.

### Rule 4: One Debate Per Clause
Each clause gets its own independent debate. Debates for different clauses CAN run in parallel (limited by LLM rate limits).

### Rule 5: Enkrypt AI Runs After Legal Expert (Rounds 1 & 4) and After Judge
- Checkpoint 1a: After Legal Expert Round 1
- Checkpoint 1b: After Legal Expert Round 4
- Checkpoint 2: After Judge verdict

---

## Error Handling

| Error | Recovery Strategy |
|-------|-------------------|
| Agent timeout (LLM too slow) | Retry once with 60s timeout. If still fails, mark clause as "analysis incomplete." |
| Agent produces empty output | Retry once with slightly modified prompt. If still empty, use a fallback response. |
| Mastra Memory write failure | Retry 3x with exponential backoff. If persistent, log error and continue with in-memory state. |
| Enkrypt AI flags hallucination | Re-run India Legal Expert with stricter Qdrant-only prompt (max 2 retries). |
| Enkrypt AI flags bias | Re-run Neutral Judge with explicit anti-bias prompt (max 1 retry). |
| Rate limit hit | Queue and retry with exponential backoff. Dedicated keys reduce this risk. |

---

## Performance Targets

| Stage | Target Latency |
|-------|---------------|
| Round 1 (3 agents, parallel) | < 5 seconds |
| Round 2 (3 agents, sequential) | < 10 seconds |
| Round 3 (3 agents, sequential) | < 10 seconds |
| Round 4 (3 agents, sequential) | < 10 seconds |
| Round 5 (3 agents, sequential) | < 10 seconds |
| Judge verdict | < 10 seconds |
| Enkrypt AI validation (per check) | < 3 seconds |
| **Total per clause (5 rounds + verdict)** | **< 60 seconds** |
| **Total for 8 clauses (3 parallel)** | **< 5 minutes** |

---

## Concurrency Limits

```typescript
const DEBATE_CONCURRENCY = {
  maxParallelClauses: 3,       // Max clauses debated simultaneously
  groqRateLimit: 30,           // Requests per minute per key
  geminiRateLimit: 60,         // Requests per minute per key
  maxRetries: 2,               // Max retries per agent call
  retryDelayMs: 1000,          // Base delay between retries
};
```

When analyzing a contract with 8 clauses, process 3 at a time to stay within rate limits.
