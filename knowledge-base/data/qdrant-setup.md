# Qdrant Setup & Configuration

This document defines the Qdrant vector database collections, schema, embedding strategy, and retrieval patterns for Kavach.

---

## Overview

Qdrant serves as the **legal knowledge retrieval engine** for Kavach, storing two primary datasets:

1. **Indian Laws** — Statutes, sections, judicial precedents
2. **Industry Standards** — Standard contract practices by industry

---

## Collections

### Collection 1: `indian_laws`

Stores Indian legal statutes, sections, and judicial precedents.

```typescript
// Collection configuration
const indianLawsConfig = {
  collectionName: 'indian_laws',
  vectorSize: 768,                    // text-embedding-004 dimension
  distance: 'Cosine',
  quantization: {
    scalar: { type: 'int8' },        // Memory optimization
  },
  optimizers: {
    indexing_threshold: 20000,
  },
};
```

#### Payload Schema

```typescript
interface IndianLawPayload {
  // Identification
  id: string;                         // Unique ID
  act_name: string;                   // "Indian Contract Act, 1872"
  section: string;                    // "Section 27"
  
  // Content
  title: string;                      // "Agreement in restraint of trade void"
  full_text: string;                  // Complete text of the section
  summary: string;                    // Plain-language summary
  
  // Classification
  type: 'statute' | 'precedent' | 'regulation' | 'guideline';
  category: string[];                 // ["employment", "non_compete", "restraint_of_trade"]
  
  // Metadata
  year: number;                       // 1872
  last_amended: string;               // "2023" or null
  jurisdiction: string;               // "central" | state name
  court?: string;                     // For precedents: "Supreme Court"
  case_name?: string;                 // For precedents
  
  // Search optimization
  keywords: string[];                 // ["non-compete", "restraint", "trade", "void"]
}
```

#### Sample Documents

```json
{
  "id": "ica-1872-s27",
  "act_name": "Indian Contract Act, 1872",
  "section": "Section 27",
  "title": "Agreement in restraint of trade void",
  "full_text": "Every agreement by which any one is restrained from exercising a lawful profession, trade or business of any kind, is to that extent void. Exception 1.—Saving of agreement not to carry on business of which goodwill is sold.—One who sells the goodwill of a business may agree with the buyer to refrain from carrying on a similar business, within specified local limits, so long as the buyer, or any person deriving title to the goodwill from him, carries on a like business therein, provided that such limits appear to the Court reasonable, regard being had to the nature of the business.",
  "summary": "Any agreement that prevents someone from practicing their lawful profession, trade, or business is void. The only exception is when selling business goodwill.",
  "type": "statute",
  "category": ["employment", "non_compete", "restraint_of_trade"],
  "year": 1872,
  "jurisdiction": "central",
  "keywords": ["non-compete", "restraint", "trade", "void", "profession", "business"]
}
```

---

### Collection 2: `industry_standards`

Stores standard contract practices, benchmarks, and norms by industry.

```typescript
const industryStandardsConfig = {
  collectionName: 'industry_standards',
  vectorSize: 768,
  distance: 'Cosine',
};
```

#### Payload Schema

```typescript
interface IndustryStandardPayload {
  // Identification
  id: string;
  industry: string;                   // "information_technology"
  clause_type: string;                // "non_compete"
  
  // Content
  standard_description: string;       // What is normal
  typical_range: string;              // "6-12 months"
  
  // Comparison data
  dimensions: Array<{
    name: string;                     // "Duration"
    standard_value: string;           // "6-12 months"
    strict_threshold: string;         // "> 12 months"
    lenient_threshold: string;        // "< 6 months"
  }>;
  
  // Source
  source: string;                     // "NASSCOM Guidelines 2024"
  confidence: 'high' | 'medium';
  
  // Metadata
  region: string;                     // "india" | specific state
  updated_at: string;
}
```

---

## Embedding Strategy

### Model

```typescript
const EMBEDDING_MODEL = 'text-embedding-004';  // Google
const VECTOR_DIMENSION = 768;
```

### What Gets Embedded

| Collection | Embedded Content |
|-----------|-----------------|
| `indian_laws` | Concatenation of: `title + " " + summary + " " + keywords.join(" ")` |
| `industry_standards` | Concatenation of: `industry + " " + clause_type + " " + standard_description` |

### Why Not Full Text?

- Full legal text is verbose and dilutes semantic meaning
- Summary + keywords capture the core semantics more effectively
- Full text is stored in payload for display after retrieval

---

## Retrieval Strategy: Hybrid Search

Kavach uses **hybrid search** (dense + sparse vectors) for optimal retrieval:

### Dense Search (Semantic)
- Captures meaning: "restrictions after leaving a job" → matches "non-compete"
- Uses cosine similarity on embedding vectors
- Good for conceptual queries

### Sparse Search (Keyword)
- Captures exact terms: "Section 27" → exact match
- Critical for legal documents where section numbers matter
- Uses BM25-style matching

### Hybrid Configuration

```typescript
async function hybridSearch(
  collectionName: string,
  query: string,
  filters?: Record<string, any>,
  limit: number = 5
) {
  const queryVector = await embed(query);
  
  return await qdrantClient.search(collectionName, {
    vector: queryVector,
    filter: filters ? { must: Object.entries(filters).map(([key, value]) => ({
      key,
      match: { value },
    })) } : undefined,
    limit,
    with_payload: true,
    score_threshold: 0.65,     // Minimum similarity
  });
}
```

---

## Search Patterns by Agent

### India Legal Expert — Law Search

```typescript
// Search for relevant Indian laws
const lawResults = await hybridSearch('indian_laws', 
  `non-compete clause employment agreement enforceability India`,
  { type: 'statute' },
  5
);

// Search for judicial precedents
const precedentResults = await hybridSearch('indian_laws',
  `non-compete clause employee Supreme Court judgment`,
  { type: 'precedent' },
  3
);
```

### Company Defender — Industry Standards Search

```typescript
// Search for industry norms
const standardResults = await hybridSearch('industry_standards',
  `non-compete clause standard practice`,
  { 
    industry: 'information_technology',
    clause_type: 'non_compete',
  },
  3
);
```

---

## Seed Script

```typescript
// scripts/seed-qdrant.ts
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({ url: process.env.QDRANT_URL });

async function seedIndianLaws() {
  // 1. Create collection
  await client.createCollection('indian_laws', {
    vectors: { size: 768, distance: 'Cosine' },
  });

  // 2. Load legal documents from JSON/CSV
  const laws = loadLegalDocuments(); // From prepared dataset

  // 3. Generate embeddings
  const embeddings = await batchEmbed(laws.map(l => l.embeddableText));

  // 4. Upsert points
  await client.upsert('indian_laws', {
    points: laws.map((law, i) => ({
      id: law.id,
      vector: embeddings[i],
      payload: law,
    })),
  });
}

async function seedIndustryStandards() {
  await client.createCollection('industry_standards', {
    vectors: { size: 768, distance: 'Cosine' },
  });

  const standards = loadIndustryStandards();
  const embeddings = await batchEmbed(standards.map(s => s.embeddableText));

  await client.upsert('industry_standards', {
    points: standards.map((std, i) => ({
      id: std.id,
      vector: embeddings[i],
      payload: std,
    })),
  });
}
```

---

## Data Volume Estimates

| Collection | Estimated Documents | Size |
|-----------|-------------------|------|
| `indian_laws` | 500–1000 sections | ~2MB vectors + ~10MB payloads |
| `industry_standards` | 200–500 entries | ~1MB vectors + ~5MB payloads |

---

## Qdrant Client Setup

```typescript
// src/lib/qdrant.ts
import { QdrantClient } from '@qdrant/js-client-rest';

export const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
});
```
