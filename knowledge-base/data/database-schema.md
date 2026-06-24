# PostgreSQL Database Schema

This document defines the relational database schema for Kavach using Prisma ORM with PostgreSQL.

---

## Schema Overview

```
User ──1:N── Session ──1:1── Document ──1:1── Report ──1:N── ClauseAnalysis
                                                                    │
                                                              1:N── DebateMessage
                                                              1:N── SaferAlternative
```

---

## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// USER & SESSION
// ─────────────────────────────────────────────

model User {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sessions  Session[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  
  role      String   // job_seeker, freelancer, consumer, custom
  experience String?
  industry   String?
  concerns   String[] @default([])
  customContext String?
  
  createdAt DateTime @default(now())
  expiresAt DateTime
  
  document  Document?
  report    Report?

  @@index([userId])
}

// ─────────────────────────────────────────────
// DOCUMENT
// ─────────────────────────────────────────────

model Document {
  id              String   @id @default(cuid())
  sessionId       String   @unique
  session         Session  @relation(fields: [sessionId], references: [id])
  
  originalFileName String
  fileType         String   // pdf, docx, text
  fileSize         Int      // bytes
  rawText          String   @db.Text
  structuredText   String   @db.Text
  
  status           DocumentStatus @default(UPLOADED)
  
  createdAt DateTime @default(now())
  processedAt DateTime?
  
  report    Report?
}

enum DocumentStatus {
  UPLOADED
  PROCESSING
  EXTRACTED
  FAILED
}

// ─────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────

model Report {
  id              String   @id @default(cuid())
  sessionId       String   @unique
  session         Session  @relation(fields: [sessionId], references: [id])
  documentId      String   @unique
  document        Document @relation(fields: [documentId], references: [id])
  
  overallRiskScore Int     // 0–100
  overallRiskLevel String  // low, medium, high, critical
  
  keyFindings       Json   // string[]
  recommendedActions Json  // { immediate: [], recommended: [], informational: [] }
  
  // Enkrypt AI validation results
  hallucinationCheckPassed Boolean @default(false)
  biasCheckPassed           Boolean @default(false)
  outputValidationPassed    Boolean @default(false)
  
  status           ReportStatus @default(PROCESSING)
  
  createdAt DateTime @default(now())
  completedAt DateTime?
  viewedAt   DateTime?
  
  clauses   ClauseAnalysis[]
}

enum ReportStatus {
  PROCESSING
  DEBATING
  SCORING
  VALIDATING
  COMPLETED
  FAILED
}

// ─────────────────────────────────────────────
// CLAUSE ANALYSIS
// ─────────────────────────────────────────────

model ClauseAnalysis {
  id         String @id @default(cuid())
  reportId   String
  report     Report @relation(fields: [reportId], references: [id])
  
  // Clause info
  category     String   // ClauseCategory
  originalText String   @db.Text
  summary      String
  position     Int      // Order in document
  
  // Verdict from Neutral Judge
  riskScore    Int      // 0–100
  riskLevel    String   // low, medium, high, critical
  
  // 3-Factor Scores
  harmPotentialScore     Int    // 1–10
  harmPotentialReasoning String @db.Text
  legalStrengthScore     Int    // 1–10
  legalStrengthReasoning String @db.Text
  practicalLikelihoodScore     Int    // 1–10
  practicalLikelihoodReasoning String @db.Text
  
  // Judge output
  verdictExplanation String @db.Text  // Plain language
  debateSummary      String @db.Text
  recommendation     String @db.Text
  urgency            String  // informational, review_recommended, negotiate, seek_legal_advice
  
  // Benchmarking
  legalBenchmark    Json    // LegalBenchmark object
  industryBenchmark Json    // IndustryBenchmark object
  
  // Negotiation
  negotiationMessage String? @db.Text
  
  createdAt DateTime @default(now())
  
  debateMessages   DebateMessage[]
  alternatives     SaferAlternative[]

  @@index([reportId])
  @@index([category])
  @@index([riskLevel])
}

// ─────────────────────────────────────────────
// DEBATE MESSAGES
// ─────────────────────────────────────────────

model DebateMessage {
  id              String @id @default(cuid())
  clauseAnalysisId String
  clauseAnalysis   ClauseAnalysis @relation(fields: [clauseAnalysisId], references: [id])
  
  agentRole String  // user-advocate, company-defender, india-legal-expert, neutral-judge
  round     Int     // 1, 2, or 3 (verdict)
  content   String  @db.Text
  
  agentModel String  // llama-3.1-70b-versatile, gemini-2.0-flash
  
  createdAt DateTime @default(now())

  @@index([clauseAnalysisId])
  @@index([agentRole])
}

// ─────────────────────────────────────────────
// SAFER ALTERNATIVES
// ─────────────────────────────────────────────

model SaferAlternative {
  id              String @id @default(cuid())
  clauseAnalysisId String
  clauseAnalysis   ClauseAnalysis @relation(fields: [clauseAnalysisId], references: [id])
  
  alternativeNumber Int     // 1 or 2
  rewrittenClause   String  @db.Text
  estimatedRiskScore Int    // 0–100
  changesExplained   String @db.Text
  riskReduction      String @db.Text
  
  createdAt DateTime @default(now())

  @@index([clauseAnalysisId])
}
```

---

## Key Relationships

| Relationship | Type | Description |
|---|---|---|
| User → Session | 1:N | A user can have multiple analysis sessions |
| Session → Document | 1:1 | Each session processes one document |
| Session → Report | 1:1 | Each session produces one report |
| Document → Report | 1:1 | Each document generates one report |
| Report → ClauseAnalysis | 1:N | A report contains multiple clause analyses |
| ClauseAnalysis → DebateMessage | 1:N | Each clause has 7 debate messages (3+3+1) |
| ClauseAnalysis → SaferAlternative | 1:N | Each clause may have 0–2 alternatives |

---

## Indexes

- `Session.userId` — Fast lookup of user's sessions
- `ClauseAnalysis.reportId` — Fast loading of report clauses
- `ClauseAnalysis.category` — Filter by clause type
- `ClauseAnalysis.riskLevel` — Filter by risk level
- `DebateMessage.clauseAnalysisId` — Load debate for a clause
- `DebateMessage.agentRole` — Filter by agent

---

## Common Queries

```typescript
// Get full report with all clauses
const report = await prisma.report.findUnique({
  where: { id: reportId },
  include: {
    clauses: {
      include: {
        debateMessages: { orderBy: { round: 'asc' } },
        alternatives: { orderBy: { alternativeNumber: 'asc' } },
      },
      orderBy: { position: 'asc' },
    },
  },
});

// Get user's analysis history
const history = await prisma.report.findMany({
  where: { session: { userId } },
  select: {
    id: true,
    overallRiskScore: true,
    overallRiskLevel: true,
    createdAt: true,
    document: { select: { originalFileName: true } },
  },
  orderBy: { createdAt: 'desc' },
});

// Get high-risk clauses across all reports
const riskyClases = await prisma.clauseAnalysis.findMany({
  where: { riskLevel: { in: ['high', 'critical'] } },
  include: { report: { include: { document: true } } },
});
```
