# Report Generation Workflow

This document describes how the final risk report is compiled, validated, and delivered to the user.

---

## Overview

```
Clause Verdicts + Benchmarks + Alternatives → Compile → Enkrypt AI Validate → Save to PostgreSQL → Deliver to Frontend
```

---

## Step 1 — Collect All Clause Results

After all debates are complete, the workflow has the following data per clause:

```typescript
interface ClauseAnalysisResult {
  clause: ExtractedClause;
  verdict: NeutralJudgeOutput;
  benchmark: BenchmarkResult;
  alternatives: SaferAlternative[];
  debateTranscript: DebateMessage[];
}
```

---

## Step 2 — Calculate Overall Contract Risk Score

```typescript
function calculateOverallScore(clauseResults: ClauseAnalysisResult[]): number {
  // Weighted average: Critical clauses weigh more
  const weights: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const result of clauseResults) {
    const weight = weights[result.verdict.riskLevel];
    totalWeightedScore += result.verdict.finalRiskScore * weight;
    totalWeight += weight;
  }

  return Math.round(totalWeightedScore / totalWeight);
}
```

---

## Step 3 — Generate Safer Alternatives

For every clause with risk level **medium**, **high**, or **critical**:

```typescript
async function generateAlternatives(
  clause: ExtractedClause,
  verdict: NeutralJudgeOutput,
  benchmark: BenchmarkResult
): Promise<SaferAlternative[]> {
  // Use Gemini Flash to generate 1-2 safer versions
  const prompt = `
    You are a contract rewriting specialist. Generate 1-2 safer alternative versions
    of the following contract clause.

    ORIGINAL CLAUSE:
    ${clause.originalText}

    RISK ASSESSMENT:
    - Risk Score: ${verdict.finalRiskScore}/100
    - Harm Potential: ${verdict.factors.harmPotential.score}/10
    - Legal Strength: ${verdict.factors.legalStrength.score}/10
    - Practical Likelihood: ${verdict.factors.practicalLikelihood.score}/10
    - Key Risk: ${verdict.verdictExplanation}

    BENCHMARKS:
    - Indian Law: ${benchmark.legalBenchmark.details}
    - Industry Standard: ${benchmark.industryBenchmark.details}

    REQUIREMENTS for alternatives:
    1. Reduce the identified risk factors
    2. Maintain the legitimate business purpose
    3. Align with industry standard language
    4. Remain enforceable under Indian law
    5. Be commercially reasonable (so the company is likely to accept)

    Return JSON array of alternatives.
  `;

  return await geminiFlash.generate(prompt);
}
```

---

## Step 4 — Generate Negotiation Messages

For each risky clause, generate a ready-to-send message:

```typescript
async function generateNegotiationMessage(
  clause: ExtractedClause,
  verdict: NeutralJudgeOutput,
  alternative: SaferAlternative
): Promise<string> {
  const prompt = `
    Generate a professional, polite negotiation message that the user can send
    to the company/other party to propose a change to this clause.

    CURRENT CLAUSE: ${clause.originalText}
    PROPOSED ALTERNATIVE: ${alternative.rewrittenClause}
    REASON FOR CHANGE: ${verdict.recommendation}

    The message should:
    1. Be respectful and professional
    2. Reference the specific clause
    3. Explain the concern briefly
    4. Propose the alternative
    5. Be ready to copy-paste and send
    6. Not sound adversarial or threatening
  `;

  return await geminiFlash.generate(prompt);
}
```

---

## Step 5 — Generate Key Findings & Recommended Actions

```typescript
interface KeyFindings {
  criticalIssues: string[];     // Risk score >= 76
  highRiskIssues: string[];     // Risk score 51-75
  positiveFindings: string[];   // Risk score <= 25 (good clauses)
  overallAssessment: string;    // One-paragraph summary
}

interface RecommendedActions {
  immediate: string[];          // Must address before signing
  recommended: string[];        // Should address if possible
  informational: string[];      // Good to know
}
```

---

## Step 6 — Enkrypt AI Final Validation (Checkpoint 3)

Before saving and delivering, the full report passes through Enkrypt AI:

```typescript
async function validateReport(report: ContractReport): Promise<ValidationResult> {
  return await enkryptAI.validate({
    // Check 1: Score arithmetic consistency
    scoreConsistency: report.clauses.map(c => ({
      factors: c.verdict.factors,
      calculatedScore: c.verdict.finalRiskScore,
    })),
    
    // Check 2: Alternatives don't introduce new risks
    alternatives: report.clauses.flatMap(c => c.alternatives),
    
    // Check 3: Plain-language accuracy
    explanations: report.clauses.map(c => c.verdict.verdictExplanation),
    
    // Check 4: No unauthorized legal advice
    fullReportText: JSON.stringify(report),
  });
}
```

---

## Step 7 — Save to PostgreSQL

```typescript
async function saveReport(report: ContractReport): Promise<void> {
  await prisma.report.create({
    data: {
      id: report.id,
      userId: report.userId,
      documentId: report.documentId,
      overallRiskScore: report.overallRiskScore,
      overallRiskLevel: report.overallRiskLevel,
      keyFindings: report.keyFindings,
      recommendedActions: report.recommendedActions,
      enkryptValidation: report.enkryptValidation,
      createdAt: new Date(),
      clauses: {
        create: report.clauses.map(clause => ({
          clauseId: clause.clause.id,
          category: clause.clause.category,
          originalText: clause.clause.originalText,
          riskScore: clause.verdict.finalRiskScore,
          riskLevel: clause.verdict.riskLevel,
          verdict: clause.verdict,
          benchmark: clause.benchmark,
          alternatives: clause.alternatives,
          negotiationMessage: clause.negotiationMessage,
          debateTranscript: clause.debateTranscript,
        })),
      },
    },
  });
}
```

---

## Step 8 — Deliver to Frontend

```typescript
// API Response
// GET /api/report/[id]
interface ReportAPIResponse {
  success: boolean;
  data: {
    id: string;
    overallRiskScore: number;
    overallRiskLevel: string;
    clauseCount: number;
    criticalCount: number;
    highRiskCount: number;
    clauses: ClauseReportData[];
    keyFindings: KeyFindings;
    recommendedActions: RecommendedActions;
    generatedAt: string;
    enkryptValidated: boolean;
  };
}
```

---

## Report Lifecycle

```
PROCESSING → DEBATING → SCORING → VALIDATING → COMPLETED → VIEWED
```

| Status | Description |
|--------|-------------|
| `processing` | Document uploaded, text being extracted |
| `debating` | Multi-agent debates in progress |
| `scoring` | Judge scoring clauses |
| `validating` | Enkrypt AI running safety checks |
| `completed` | Report ready for viewing |
| `viewed` | User has opened the report |
