# End-to-End Data Flow

This document traces the complete journey of data through Kavach — from the moment a user uploads a contract to the delivery of the final risk report.

---

## Flow Summary

```
User → Upload → Parse → Extract Clauses → Debate (2 Rounds) → Score → Benchmark → Alternatives → Safety Check → Report
```

---

## Detailed Step-by-Step Flow

### Step 1 — User Onboarding & Context Setting

```
Frontend (Next.js)
│
├─ User selects role: Job Seeker | Freelancer | Consumer | Custom
├─ User answers 3–5 optional context questions
│   Example (Job Seeker): experience level, industry, specific concerns
└─ Context object created: { role, experience, industry, concerns[] }
```

**Data Created:**
```typescript
interface UserContext {
  role: 'job_seeker' | 'freelancer' | 'consumer' | 'custom';
  experience?: string;
  industry?: string;
  concerns?: string[];
  customContext?: string;
}
```

---

### Step 2 — Document Upload & Processing

```
Frontend → API Route → Mastra Workflow Engine
│
├─ User uploads PDF / DOCX / plain text
├─ File sent to Mastra via API route
├─ Mastra tool calls Gemini Flash for document processing:
│   ├─ Extract raw text from file
│   ├─ Normalize formatting
│   └─ Convert to structured text representation
└─ Output: Clean structured document text
```

**Data Created:**
```typescript
interface ProcessedDocument {
  id: string;
  originalFileName: string;
  rawText: string;
  structuredText: string;
  uploadedAt: Date;
  userId: string;
}
```

---

### Step 3 — Smart Section Extraction

```
Mastra Workflow Engine (Gemini Flash tool)
│
├─ Identifies substantive clauses from structured text
├─ Filters out boilerplate (headers, signature blocks, formatting)
├─ Extracts sections by category:
│   ├─ Compensation & Payment Terms
│   ├─ Termination Conditions
│   ├─ Non-Compete & Non-Solicitation
│   ├─ Intellectual Property Assignment
│   ├─ Liability & Indemnification
│   ├─ Confidentiality & NDA
│   ├─ Dispute Resolution
│   └─ Governing Law
└─ Each section becomes a debate topic
```

**Data Created:**
```typescript
interface ExtractedClause {
  id: string;
  category: ClauseCategory;
  originalText: string;
  summary: string;
  position: number; // order in document
}

type ClauseCategory =
  | 'compensation_payment'
  | 'termination'
  | 'non_compete'
  | 'ip_assignment'
  | 'liability_indemnification'
  | 'confidentiality_nda'
  | 'dispute_resolution'
  | 'governing_law'
  | 'other';
```

---

### Step 4 — Multi-Agent Debate (Round 1 — Opening Arguments)

```
Mastra Workflow → Dispatches 3 agents per clause (can run in parallel)
│
├─ User Advocate Agent (Groq Llama)
│   ├─ Input: clause text + user context
│   ├─ Action: Identifies risks, worst-case scenarios, power imbalances
│   └─ Output: Opening argument (stored in Mastra Memory)
│
├─ Company Defender Agent (Groq Llama)
│   ├─ Input: clause text + industry standards (from Qdrant)
│   ├─ Action: Explains business rationale, identifies standard aspects
│   └─ Output: Opening argument (stored in Mastra Memory)
│
└─ India Legal Expert Agent (Gemini Flash)
    ├─ Input: clause text
    ├─ Action: Queries Qdrant for Indian laws, assesses enforceability
    ├─ Qdrant Query: Semantic search on clause text → retrieve matching statutes
    └─ Output: Legal analysis with citations (stored in Mastra Memory)
```

**Data Flow:**
```
Clause Text → Agent → LLM (Groq/Gemini) → Argument → Mastra Memory (Redis)
                                                    → Enkrypt AI (Legal Expert output only)
```

---

### Step 5 — Multi-Agent Debate (Round 2 — Rebuttals)

```
Mastra Workflow → Agents read Round 1 from Memory → Produce rebuttals
│
├─ User Advocate reads Company Defender's + Legal Expert's Round 1
│   └─ Responds with rebuttal, may cite Legal Expert to strengthen case
│
├─ Company Defender reads User Advocate's + Legal Expert's Round 1
│   └─ Concedes valid points, defends reasonable protections
│
└─ India Legal Expert reads Advocate's + Defender's Round 1
    └─ Refines analysis with more targeted legal references from Qdrant
```

**Data Flow:**
```
Mastra Memory (Round 1 args) → Agent → LLM → Rebuttal → Mastra Memory (Round 2)
```

---

### Step 6 — Neutral Judge Scoring & Verdict

```
Neutral Judge Agent (Gemini Flash)
│
├─ Input: Full debate transcript (6 messages: 3 opening + 3 rebuttals)
│         Retrieved from Mastra Memory
├─ Action:
│   ├─ Evaluates strength of each argument
│   ├─ Identifies consensus and disagreement points
│   ├─ Applies 3-Factor Weighted Scoring Formula:
│   │   Risk Score = (Harm × 0.40) + (Legal × 0.35) + (Likelihood × 0.25)
│   │   Each factor scored 1–10, final score normalized to 0–100
│   ├─ Classifies risk level: Low / Medium / High / Critical
│   └─ Generates plain-language explanation
└─ Output: Verdict object (score, factors, explanation, recommendation)
```

**Data Created:**
```typescript
interface ClauseVerdict {
  clauseId: string;
  riskScore: number; // 0–100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    harmPotential: { score: number; reasoning: string };
    legalStrength: { score: number; reasoning: string };
    practicalLikelihood: { score: number; reasoning: string };
  };
  explanation: string; // plain language
  recommendation: string;
  debateSummary: string;
}
```

---

### Step 7 — Benchmarking

```
Qdrant Retrieval
│
├─ Indian Law Benchmark:
│   ├─ Query: clause category + key terms → Qdrant legal collection
│   ├─ Returns: matching Indian statutes with sections
│   └─ Comparison: clause vs. legal requirements
│
└─ Industry Standard Benchmark:
    ├─ Query: clause category + user industry → Qdrant standards collection
    ├─ Returns: typical clause norms for that industry
    └─ Comparison: clause vs. industry norms
```

**Data Created:**
```typescript
interface BenchmarkResult {
  clauseId: string;
  legalBenchmark: {
    relevantLaws: Array<{ actName: string; section: string; summary: string }>;
    compliance: 'compliant' | 'ambiguous' | 'non_compliant';
    details: string;
  };
  industryBenchmark: {
    standardPractice: string;
    deviation: 'within_norm' | 'slightly_stricter' | 'significantly_stricter';
    details: string;
  };
}
```

---

### Step 8 — Safer Alternative Generation

```
Mastra Workflow (Gemini Flash)
│
├─ Input: risky clause + verdict + benchmark data
├─ For clauses with riskLevel = 'medium' | 'high' | 'critical':
│   ├─ Identifies risk-driving elements
│   ├─ Retrieves enforceability standards from Qdrant
│   └─ Generates 1–2 alternative clause versions
├─ Alternatives must:
│   ├─ Reduce identified risk factors
│   ├─ Maintain legitimate business purpose
│   ├─ Align with industry standard language
│   └─ Remain enforceable under Indian law
└─ Output: SaferAlternative[]
```

**Data Created:**
```typescript
interface SaferAlternative {
  clauseId: string;
  alternativeNumber: 1 | 2;
  rewrittenClause: string;
  estimatedRiskScore: number;
  changesExplained: string;
}
```

---

### Step 9 — Enkrypt AI Safety Validation

```
Enkrypt AI Safety Layer
│
├─ Checkpoint 1: Legal Citation Verification
│   ├─ Scans all cited act names, section numbers, case references
│   ├─ Flags hallucination markers
│   └─ If flagged → regenerate with stricter Qdrant retrieval
│
├─ Checkpoint 2: Agent Bias Detection
│   ├─ Analyzes Judge's scoring for disproportionate bias
│   ├─ Checks all perspectives were genuinely engaged
│   └─ If flagged → regenerate Judge verdict with bias warning
│
└─ Checkpoint 3: Output Validation
    ├─ Verifies score arithmetic consistency
    ├─ Checks alternatives don't introduce new risks
    ├─ Confirms plain-language accuracy
    └─ Screens for unauthorized legal advice
```

---

### Step 10 — Report Compilation & Delivery

```
Mastra Workflow → Compiles all results → PostgreSQL → Frontend
│
├─ Assembles final report:
│   ├─ Overall contract risk score (average of clause scores)
│   ├─ Clause-by-clause breakdown
│   ├─ Key findings summary
│   └─ Recommended actions (prioritized by severity)
│
├─ Saves to PostgreSQL (Reports Database)
│
└─ Returns to Frontend for rendering
```

**Final Report Structure:**
```typescript
interface ContractReport {
  id: string;
  userId: string;
  documentId: string;
  overallRiskScore: number;
  overallRiskLevel: string;
  clauses: Array<{
    clause: ExtractedClause;
    verdict: ClauseVerdict;
    benchmark: BenchmarkResult;
    alternatives: SaferAlternative[];
    negotiationMessage: string;
    debateTranscript: DebateMessage[];
  }>;
  keyFindings: string[];
  recommendedActions: string[];
  createdAt: Date;
  enkryptValidation: {
    hallucinationCheckPassed: boolean;
    biasCheckPassed: boolean;
    outputValidationPassed: boolean;
  };
}
```

---

### Step 11 — Interactive Exploration (Post-Report)

```
Frontend (Next.js)
│
├─ User views overall risk score with visual gauge
├─ Expands any clause to see full debate transcript
├─ Copies negotiation messages
├─ Uses Negotiation Simulator:
│   ├─ Edits a clause
│   ├─ Submits to Mastra for re-analysis
│   └─ Sees updated risk score
└─ Downloads report as PDF
```
