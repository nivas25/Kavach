# Enkrypt AI Safety Integration

This document defines how Enkrypt AI is integrated into Kavach to prevent hallucinations, detect bias, and validate outputs.

---

## Why Safety is Critical

In a legal application:
- A **hallucinated statute** (e.g., "Section 42A of the Indian Contract Act" — which doesn't exist) could lead a user to make decisions based on false legal information.
- **Biased scoring** could cause unnecessary alarm or dangerous complacency.
- **Fabricated case law** could give users false confidence in unenforceable positions.

Enkrypt AI prevents all of these failure modes.

---

## Three Safety Checkpoints

```
                    ┌──────────────────────┐
                    │  India Legal Expert   │
                    │  Agent Output         │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  CHECKPOINT 1        │
                    │  Legal Citation      │
                    │  Verification        │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Neutral Judge       │
                    │  Agent Output        │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  CHECKPOINT 2        │
                    │  Agent Bias          │
                    │  Detection           │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Compiled Report     │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  CHECKPOINT 3        │
                    │  Output Validation   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  ✅ Validated Report  │
                    │  Delivered to User   │
                    └──────────────────────┘
```

---

## Checkpoint 1 — Legal Citation Verification

### When
After the **India Legal Expert** agent produces its analysis (both Round 1 and Round 2).

### What It Checks
| Check | Description |
|-------|-------------|
| **Act name validity** | Does the cited act actually exist? |
| **Section number validity** | Does the cited section exist within that act? |
| **Case name validity** | Is the cited case a real case? |
| **Court validity** | Is the cited court a real court? |
| **Content accuracy** | Does the summary match the actual legal text? |

### Implementation

```typescript
// src/mastra/tools/enkryptValidation.ts
import { createTool } from '@mastra/core';

export const legalCitationCheck = createTool({
  id: 'enkrypt-legal-citation-check',
  description: 'Validates legal citations for hallucination using Enkrypt AI',
  inputSchema: z.object({
    agentOutput: z.string(),
    citedLaws: z.array(z.object({
      actName: z.string(),
      section: z.string(),
      summary: z.string(),
    })),
  }),
  execute: async ({ agentOutput, citedLaws }) => {
    const result = await enkryptAI.detectHallucination({
      text: agentOutput,
      context: 'Indian legal statutes and judicial precedents',
      claims: citedLaws.map(law => ({
        claim: `${law.actName}, ${law.section}: ${law.summary}`,
        type: 'legal_citation',
      })),
    });

    return {
      passed: result.hallucinationScore < 0.3,  // Threshold
      score: result.hallucinationScore,
      flaggedCitations: result.flaggedClaims,
      confidence: result.confidence,
    };
  },
});
```

### Recovery on Failure

If Checkpoint 1 flags hallucinations:

1. Log the flagged citations
2. Re-run the India Legal Expert with a stricter prompt:
   ```
   CRITICAL: Only cite laws that you found through the Qdrant search tool.
   Do NOT cite any law, section, or case from your training data.
   If you cannot find a relevant law in Qdrant, explicitly state:
   "No directly applicable statute was found in the knowledge base."
   ```
3. Re-validate the new output
4. If still flagged after 2 attempts, annotate the output with a confidence disclaimer:
   ```
   ⚠️ Legal citations in this analysis could not be fully verified.
   Please consult a legal professional for confirmation.
   ```

---

## Checkpoint 2 — Agent Bias Detection

### When
After the **Neutral Judge** produces its verdict.

### What It Checks

| Check | Description |
|-------|-------------|
| **Scoring balance** | Does the Judge engage with ALL agents' arguments? |
| **Systematic bias** | Does the Judge consistently favor one agent? |
| **Proportionate response** | Are scores proportionate to argument strength? |
| **Reasoning quality** | Does the reasoning demonstrate genuine analysis? |

### Implementation

```typescript
export const biasDetection = createTool({
  id: 'enkrypt-bias-detection',
  description: 'Detects bias in the Neutral Judge verdict using Enkrypt AI',
  inputSchema: z.object({
    judgeVerdict: z.string(),
    debateTranscript: z.object({
      userAdvocate: z.string(),
      companyDefender: z.string(),
      indiaLegalExpert: z.string(),
    }),
    scores: z.object({
      harmPotential: z.number(),
      legalStrength: z.number(),
      practicalLikelihood: z.number(),
    }),
  }),
  execute: async ({ judgeVerdict, debateTranscript, scores }) => {
    const result = await enkryptAI.detectBias({
      text: judgeVerdict,
      sources: [
        { name: 'User Advocate', content: debateTranscript.userAdvocate },
        { name: 'Company Defender', content: debateTranscript.companyDefender },
        { name: 'India Legal Expert', content: debateTranscript.indiaLegalExpert },
      ],
      scores,
    });

    return {
      passed: result.biasScore < 0.4,
      score: result.biasScore,
      biasDirection: result.direction,  // 'user_favoring' | 'company_favoring' | 'balanced'
      details: result.explanation,
    };
  },
});
```

### Recovery on Failure

If Checkpoint 2 flags bias:

1. Log the bias direction and score
2. Re-run the Neutral Judge with an explicit anti-bias instruction:
   ```
   WARNING: Your previous verdict was flagged for bias toward the {{biasDirection}} perspective.
   
   Please re-evaluate this debate with STRICT NEUTRALITY:
   - Give equal weight to all three agents' arguments
   - Cite specific points from EACH agent in your reasoning
   - If you agree with one agent more, explain EXACTLY why their argument was stronger
   - Do not inflate or deflate scores based on sympathy
   ```
3. Re-validate the new verdict
4. If still flagged, include both verdicts in the report with a note

---

## Checkpoint 3 — Output Validation

### When
Before the **final report** is delivered to the frontend.

### What It Checks

| Check | Description |
|-------|-------------|
| **Score arithmetic** | Do factor scores × weights = final score? |
| **Alternative safety** | Do safer alternatives introduce new legal risks? |
| **Explanation accuracy** | Do plain-language explanations match the analysis? |
| **Legal advice boundary** | Does output stay advisory, not prescriptive? |

### Implementation

```typescript
export const outputValidation = createTool({
  id: 'enkrypt-output-validation',
  description: 'Validates final report for consistency and safety using Enkrypt AI',
  inputSchema: z.object({
    report: z.object({
      clauses: z.array(z.object({
        riskScore: z.number(),
        factors: z.object({
          harmPotential: z.number(),
          legalStrength: z.number(),
          practicalLikelihood: z.number(),
        }),
        explanation: z.string(),
        alternatives: z.array(z.string()),
      })),
    }),
  }),
  execute: async ({ report }) => {
    const checks = {
      scoreConsistency: true,
      alternativeSafety: true,
      explanationAccuracy: true,
      legalAdviceBoundary: true,
    };

    // Check 1: Score arithmetic
    for (const clause of report.clauses) {
      const expected = Math.round(
        (clause.factors.harmPotential * 0.40 +
         clause.factors.legalStrength * 0.35 +
         clause.factors.practicalLikelihood * 0.25) * 10
      );
      if (Math.abs(clause.riskScore - expected) > 2) {
        checks.scoreConsistency = false;
      }
    }

    // Check 2-4: Use Enkrypt AI for content validation
    const contentCheck = await enkryptAI.validateOutput({
      text: JSON.stringify(report),
      checks: ['hallucination', 'bias', 'safety'],
    });

    checks.alternativeSafety = contentCheck.safetyScore > 0.7;
    checks.explanationAccuracy = contentCheck.consistencyScore > 0.7;
    checks.legalAdviceBoundary = !contentCheck.containsLegalAdvice;

    return {
      passed: Object.values(checks).every(v => v),
      checks,
      details: contentCheck.explanation,
    };
  },
});
```

### Recovery on Failure

| Failed Check | Recovery |
|---|---|
| Score arithmetic inconsistent | Recalculate scores programmatically from factor scores |
| Alternative introduces risks | Regenerate alternative with stricter constraints |
| Explanation doesn't match | Regenerate explanation from verdict data |
| Contains legal advice | Add disclaimer: "This is informational analysis, not legal advice." |

---

## Enkrypt AI Service Setup

```typescript
// src/services/enkryptService.ts
import { EnkryptAI } from 'enkrypt-ai';

export const enkryptAI = new EnkryptAI({
  apiKey: process.env.ENKRYPT_API_KEY,
});

// Convenience functions
export async function checkHallucination(text: string, claims: any[]) {
  return enkryptAI.detectHallucination({ text, claims });
}

export async function checkBias(text: string, sources: any[]) {
  return enkryptAI.detectBias({ text, sources });
}

export async function validateOutput(text: string) {
  return enkryptAI.validateOutput({ text, checks: ['hallucination', 'bias', 'safety'] });
}
```

---

## Safety Rules for AI Agents

1. **NEVER skip safety checkpoints** — Even during development/testing.
2. **Log all Enkrypt AI results** — Store validation scores for audit trail.
3. **Fail safe** — If Enkrypt AI is unavailable, add a visible disclaimer to the report.
4. **Don't trust LLM-generated legal citations** — Always verify through Qdrant + Enkrypt AI.
5. **Include the disclaimer** — Every report must state: "This is AI-generated analysis, not legal advice."
