# Contract Processing Workflow — Kavach v2.0

> **Document upload, LlamaParse parsing, and Gemini 2.5 Pro structured extraction.**

This document describes the two-stage document preprocessing pipeline that converts uploaded contracts into structured, analyzable data.

*Last updated: July 2026*

---

## Overview

```
Upload (PDF/DOCX/Text)
    → Validate
    → Stage 2A: LlamaParse (→ Markdown)
    → Stage 2B: Gemini 2.5 Pro (→ Structured JSON)
    → Store Both in Redis
    → Pass to Debate Pipeline
```

---

## Step 1 — Document Upload

### Accepted Formats

| Format | MIME Type | Processing Method |
|--------|----------|-------------------|
| PDF | `application/pdf` | LlamaParse API |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | LlamaParse API |
| Plain Text | `text/plain` | Direct input (skip LlamaParse) |

### File Validation

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
];

function validateUpload(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) return { valid: false, error: 'File exceeds 10MB limit' };
  if (!ALLOWED_TYPES.includes(file.type)) return { valid: false, error: 'Unsupported file format' };
  return { valid: true };
}
```

### API Route

```
POST /api/upload
Content-Type: multipart/form-data
Body: { file: File, userContext: UserContext }
Response: { sessionId: string, status: 'processing' }
```

---

## Step 2A — LlamaParse: Document → Markdown

### Why LlamaParse?

| Challenge | LlamaParse Solution |
|-----------|-------------------|
| Complex PDF tables | Preserves table structure in Markdown |
| Multi-column legal documents | Handles column layouts correctly |
| Numbered clause hierarchies | Maintains section numbering |
| Headers, footers, page numbers | Filters out automatically |
| Nested sub-clauses | Preserves indentation and hierarchy |

### Integration

```typescript
// src/mastra/tools/documentProcessor.ts
import { LlamaParseReader } from 'llamaindex';

const llamaParse = new LlamaParseReader({
  apiKey: process.env.LLAMAPARSE_API_KEY,
  resultType: 'markdown',
  parsingInstructions: `
    This is an Indian legal contract document.
    Preserve all numbered sections, sub-clauses, and defined terms.
    Maintain table structures for compensation and payment schedules.
    Do not merge multi-column layouts.
    Preserve original formatting hierarchy.
  `,
});

async function parseToMarkdown(fileBuffer: Buffer, fileName: string): Promise<string> {
  const documents = await llamaParse.loadData(fileBuffer, fileName);
  return documents.map(doc => doc.text).join('\n\n');
}
```

### Output

Clean, structured Markdown that faithfully represents the original document.

**Example:**

```markdown
# EMPLOYMENT AGREEMENT

**Between:** ABC Technology Solutions Pvt. Ltd. ("Company")
**And:** [Employee Name] ("Employee")
**Date:** January 15, 2026

## 1. POSITION AND DUTIES

1.1 The Employee shall serve as Senior Software Engineer...

## 2. COMPENSATION

| Component | Amount |
|-----------|--------|
| Base Salary | ₹18,00,000 per annum |
| Variable Pay | Up to 15% of base |

## 3. NON-COMPETE

3.1 The Employee agrees not to engage in any business or employment
that competes with the Company, directly or indirectly, anywhere in
India, for a period of 24 months following termination...
```

---

## Step 2B — Gemini 2.5 Pro: Markdown → Structured JSON

### Why a Separate Extraction Step?

- LlamaParse produces Markdown but doesn't **understand** the content
- Gemini 2.5 Pro **intelligently identifies** substantive clauses vs. boilerplate
- Extracts structured metadata (parties, dates, contract type)
- Categorizes each clause by type for targeted agent analysis

### Extraction Prompt

```
You are a contract analysis expert. Analyze this contract document and extract:

## Part 1: Document Metadata
Extract:
- parties: names of all parties
- contractType: employment | freelance | service | consumer | rental | other
- effectiveDate: the date the contract takes effect
- jurisdiction: which legal jurisdiction governs
- governingLaw: which law governs disputes

## Part 2: Substantive Clauses
Extract every substantive clause that creates obligations, restrictions, or liabilities.

For each clause:
1. Assign a unique ID (clause-001, clause-002, etc.)
2. Identify the category from:
   compensation_payment, termination, non_compete, ip_assignment,
   liability_indemnification, confidentiality_nda, dispute_resolution,
   governing_law, notice_period, probation, leave_policy, other
3. Extract the exact text of the clause
4. Write a one-line summary of what the clause says
5. Assign a position number based on order in the document

IGNORE boilerplate content such as:
- Formatting preambles and recitals
- Signature blocks and witness sections
- Date and party identification sections
- Standard definitions that don't create obligations
- Table of contents
- Headers and footers

Return valid JSON matching the schema below.

Contract Markdown:
{{markdown}}
```

### Output Schema

```typescript
interface ExtractionResult {
  metadata: {
    parties: string[];
    contractType: 'employment' | 'freelance' | 'service' | 'consumer' | 'rental' | 'other';
    effectiveDate?: string;
    jurisdiction?: string;
    governingLaw?: string;
  };
  clauses: ExtractedClause[];
}

interface ExtractedClause {
  id: string;                          // 'clause-001'
  category: ClauseCategory;
  originalText: string;                // Exact text from document
  summary: string;                     // One-line summary
  position: number;                    // Order in document (1-indexed)
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
  | 'notice_period'
  | 'probation'
  | 'leave_policy'
  | 'other';
```

### Gemini Integration

```typescript
// src/mastra/tools/documentProcessor.ts
import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';

async function extractClauses(markdown: string): Promise<ExtractionResult> {
  const model = google('gemini-2.5-pro', {
    apiKey: process.env.GEMINI_EXTRACTION_KEY,
  });

  const result = await generateObject({
    model,
    schema: ExtractionResultSchema,  // Zod schema matching ExtractionResult
    prompt: EXTRACTION_PROMPT.replace('{{markdown}}', markdown),
  });

  return result.object;
}
```

---

## Step 3 — Store in Redis

After both stages complete, both outputs are stored in Redis:

```typescript
async function storeExtractedData(sessionId: string, markdown: string, extraction: ExtractionResult) {
  await redis.hSet(`doc:${sessionId}`, {
    markdown: markdown,
    json: JSON.stringify(extraction),
    metadata: JSON.stringify({
      file_name: originalFileName,
      file_type: fileType,
      file_size: fileSizeBytes,
      clause_count: extraction.clauses.length,
      upload_time: new Date().toISOString(),
    }),
    status: 'ready',
  });
  await redis.expire(`doc:${sessionId}`, 7200); // 2 hour TTL
}
```

---

## Complete Pipeline Code

```typescript
// API Route: POST /api/upload
export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const userContext = JSON.parse(formData.get('userContext') as string);

  // 1. Validate
  const validation = validateUpload(file);
  if (!validation.valid) return Response.json({ error: validation.error }, { status: 400 });

  // 2. Generate session ID
  const sessionId = crypto.randomUUID();

  // 3. Update session status
  await updateSessionStatus(sessionId, { status: 'parsing', startedAt: new Date().toISOString() });

  // 4. Stage 2A: LlamaParse → Markdown
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const markdown = file.type === 'text/plain'
    ? await file.text()
    : await parseToMarkdown(fileBuffer, file.name);

  // 5. Update status
  await updateSessionStatus(sessionId, { status: 'extracting' });

  // 6. Stage 2B: Gemini 2.5 Pro → Structured JSON
  const extraction = await extractClauses(markdown);

  // 7. Store both in Redis
  await storeExtractedData(sessionId, markdown, extraction);

  // 8. Update status
  await updateSessionStatus(sessionId, {
    status: 'debating',
    totalClauses: extraction.clauses.length,
    currentClause: 0,
    completedClauses: 0,
  });

  // 9. Start Mastra workflow (async — returns immediately)
  mastra.workflows.get('contract-analysis').execute({
    sessionId,
    clauses: extraction.clauses,
    userContext,
  });

  // 10. Return session ID to frontend for polling
  return Response.json({
    sessionId,
    status: 'processing',
    totalClauses: extraction.clauses.length,
  });
}
```

---

## Error Handling

| Error | Recovery |
|-------|----------|
| File too large | Return error to frontend, suggest trimming |
| Corrupt/unreadable file | Return error, suggest re-uploading or pasting text |
| LlamaParse API failure | Retry once; if still fails, fall back to basic text extraction |
| Gemini extraction timeout | Retry once with shorter document; return partial results if possible |
| No substantive clauses found | Return warning, suggest the document may not be a contract |
| LLM rate limit | Queue and retry with exponential backoff |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| File upload + validation | < 1 second |
| LlamaParse (PDF → Markdown) | 3–8 seconds |
| Gemini 2.5 Pro extraction | 5–15 seconds |
| Redis storage | < 100ms |
| **Total preprocessing** | **< 20 seconds** |
