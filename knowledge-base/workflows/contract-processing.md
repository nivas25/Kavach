# Contract Processing Workflow

This document describes the document upload, parsing, and smart section extraction pipeline.

---

## Overview

```
Upload (PDF/DOCX/Text) → Validate → Extract Text → Normalize → Extract Clauses → Return Clauses[]
```

---

## Step 1 — Document Upload

### Accepted Formats

| Format | MIME Type | Processing Method |
|--------|----------|-------------------|
| PDF | `application/pdf` | Parse with `pdf-parse` or Gemini Vision |
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Parse with `mammoth` |
| Plain Text | `text/plain` | Direct input, no parsing needed |

### File Validation

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

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
Response: { documentId: string, status: 'processing' }
```

---

## Step 2 — Text Extraction

### Mastra Tool: Document Processor

This is a Mastra tool that uses Gemini Flash to extract and structure document text.

```typescript
// src/mastra/tools/documentProcessor.ts
import { createTool } from '@mastra/core';

export const documentProcessor = createTool({
  id: 'document-processor',
  description: 'Extracts and structures text from uploaded contract documents',
  inputSchema: z.object({
    rawText: z.string(),
    fileType: z.enum(['pdf', 'docx', 'text']),
  }),
  execute: async ({ rawText, fileType }) => {
    // Process with Gemini Flash
    // Returns structured, normalized text
  },
});
```

### Processing Steps

1. **Extract raw text** from file format
2. **Normalize formatting**:
   - Remove excessive whitespace
   - Standardize line breaks
   - Remove page numbers and headers/footers
   - Merge split paragraphs
3. **Identify document structure**:
   - Numbered sections
   - Clause headers
   - Sub-clauses and definitions

---

## Step 3 — Smart Section Extraction

### Why Smart Extraction?

Sending the entire document to debate agents would:
- Dilute agent focus with irrelevant boilerplate
- Increase token costs unnecessarily
- Reduce analysis quality by expanding context windows

Instead, Kavach extracts only the **substantive clauses** that carry legal risk.

### Clause Categories

| Category | Key | Risk Indicators |
|----------|-----|----------------|
| Compensation & Payment | `compensation_payment` | Payment delays, vague milestones, penalties |
| Termination | `termination` | Without cause, short notice, immediate termination |
| Non-Compete | `non_compete` | Duration, geographic scope, competitor definition |
| IP Assignment | `ip_assignment` | Breadth of assignment, work-for-hire, inventions |
| Liability & Indemnification | `liability_indemnification` | Uncapped liability, one-sided indemnity |
| Confidentiality & NDA | `confidentiality_nda` | Duration, scope, post-employment obligations |
| Dispute Resolution | `dispute_resolution` | Arbitration venue, governing jurisdiction |
| Governing Law | `governing_law` | Jurisdiction selection, applicable law |

### Extraction Prompt for Gemini Flash

```
You are a contract analysis expert. Extract the substantive clauses from this contract document. For each clause:

1. Identify the category (from: compensation_payment, termination, non_compete, ip_assignment, liability_indemnification, confidentiality_nda, dispute_resolution, governing_law, other)
2. Extract the exact text of the clause
3. Write a one-line summary of what the clause says
4. Assign a position number based on order in the document

IGNORE boilerplate content such as:
- Formatting preambles and recitals
- Signature blocks
- Date and party identification sections
- Standard definitions that don't create obligations
- Table of contents

Return ONLY substantive clauses that create obligations, restrictions, or liabilities.

Contract Text:
{{structuredText}}
```

### Output Format

```typescript
interface ExtractionResult {
  documentId: string;
  totalClausesFound: number;
  clauses: ExtractedClause[];
}

interface ExtractedClause {
  id: string;                          // UUID
  category: ClauseCategory;
  originalText: string;                // Exact text from document
  summary: string;                     // One-line summary
  position: number;                    // Order in document
}
```

---

## Error Handling

| Error | Recovery |
|-------|----------|
| File too large | Return error to frontend, suggest trimming |
| Corrupt/unreadable file | Return error, suggest re-uploading or pasting text |
| No substantive clauses found | Return warning, suggest the document may not be a contract |
| Extraction timeout | Retry once, then return partial results if available |
| LLM rate limit | Queue and retry with exponential backoff |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| File upload | < 2 seconds |
| Text extraction | < 5 seconds |
| Clause extraction | < 10 seconds |
| Total processing | < 15 seconds |
