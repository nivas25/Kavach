// ─────────────────────────────────────────────
// Qdrant Client Configuration
// ─────────────────────────────────────────────
// Connects to Qdrant Cloud (or local) for legal knowledge retrieval.
// Used by: seed scripts, search tools, benchmark service.

import { QdrantClient } from '@qdrant/js-client-rest';

// Singleton Qdrant client
const globalForQdrant = globalThis as unknown as {
  qdrantClient: QdrantClient | undefined;
};

export const qdrantClient =
  globalForQdrant.qdrantClient ??
  new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForQdrant.qdrantClient = qdrantClient;
}

// ─────────────────────────────────────────────
// Collection Names (single source of truth)
// ─────────────────────────────────────────────

export const QDRANT_COLLECTIONS = {
  RISK_PATTERNS: 'risk_patterns',
  INDUSTRY_BENCHMARKS: 'industry_benchmarks',
  CORE_LEGAL_SECTIONS: 'core_legal_sections',
} as const;

export type QdrantCollectionName =
  (typeof QDRANT_COLLECTIONS)[keyof typeof QDRANT_COLLECTIONS];

// ─────────────────────────────────────────────
// Vector Configuration
// ─────────────────────────────────────────────

export const VECTOR_CONFIG = {
  MODEL: 'gemini-embedding-2', // Google gemini-embedding-2
  DIMENSION: 3072,
  DISTANCE: 'Cosine' as const,
  SCORE_THRESHOLD: 0.60, // Minimum similarity for results
} as const;
