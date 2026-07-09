// ─────────────────────────────────────────────
// Kavach — Qdrant Search Tool for Mastra Agents
// ─────────────────────────────────────────────
// Provides semantic search across all 3 Qdrant collections.
// Used by: India Legal Expert, Company Defender, User Advocate, Neutral Judge

import { qdrantClient, QDRANT_COLLECTIONS, VECTOR_CONFIG } from '@/lib/qdrant';
import type {
  CoreLegalSectionPayload,
  RiskPatternPayload,
  IndustryBenchmarkPayload,
  QdrantSearchResult,
} from '@/types/qdrant';
import type { ClauseCategory, Industry } from '@/lib/constants';

// ─── Embedding Generation ──────────────────

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

async function generateEmbedding(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${VECTOR_CONFIG.MODEL}:embedContent?key=${GOOGLE_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${VECTOR_CONFIG.MODEL}`,
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_QUERY',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Embedding API error: ${response.status} — ${error}`);
  }

  const data = (await response.json()) as {
    embedding: { values: number[] };
  };
  return data.embedding.values;
}

// ─── Filter Builder ────────────────────────

interface FilterCondition {
  key: string;
  match: { value: string } | { any: string[] };
}

function buildFilter(
  filters: Record<string, string | string[] | undefined>
): { must: FilterCondition[] } | undefined {
  const conditions: FilterCondition[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      if (value.length > 0) {
        conditions.push({ key, match: { any: value } });
      }
    } else {
      conditions.push({ key, match: { value } });
    }
  }

  return conditions.length > 0 ? { must: conditions } : undefined;
}

// ─── Core Search Function ──────────────────

async function searchCollection<T>(
  collectionName: string,
  queryText: string,
  filters?: Record<string, string | string[] | undefined>,
  limit: number = 5,
  scoreThreshold?: number
): Promise<QdrantSearchResult<T>[]> {
  const queryVector = await generateEmbedding(queryText);

  const filter = filters ? buildFilter(filters) : undefined;

  const results = await qdrantClient.search(collectionName, {
    vector: queryVector,
    filter,
    limit,
    with_payload: true,
    score_threshold: scoreThreshold ?? VECTOR_CONFIG.SCORE_THRESHOLD,
  });

  return results.map((r) => ({
    id: r.id,
    score: r.score,
    payload: r.payload as T,
  }));
}

// ─── Collection-Specific Search Functions ──

/**
 * Search core_legal_sections — Used by India Legal Expert
 *
 * Finds relevant Indian law sections, statutes, and judicial precedents
 * for a given clause or legal question.
 */
export async function searchLegalSections(
  queryText: string,
  options?: {
    clauseCategories?: ClauseCategory[];
    type?: 'statute' | 'precedent' | 'regulation' | 'guideline';
    jurisdiction?: string;
    limit?: number;
  }
): Promise<QdrantSearchResult<CoreLegalSectionPayload>[]> {
  return searchCollection<CoreLegalSectionPayload>(
    QDRANT_COLLECTIONS.CORE_LEGAL_SECTIONS,
    queryText,
    {
      clause_categories: options?.clauseCategories,
      type: options?.type,
      jurisdiction: options?.jurisdiction,
    },
    options?.limit ?? 5
  );
}

/**
 * Search risk_patterns — Used by User Advocate
 *
 * Finds known risk patterns that match the contract clause being analyzed.
 * Returns pre-computed risk intelligence including red flag phrases,
 * negotiation leverage, and typical scores.
 */
export async function searchRiskPatterns(
  queryText: string,
  options?: {
    clauseCategory?: ClauseCategory;
    severity?: string[];
    targetUsers?: string[];
    limit?: number;
  }
): Promise<QdrantSearchResult<RiskPatternPayload>[]> {
  return searchCollection<RiskPatternPayload>(
    QDRANT_COLLECTIONS.RISK_PATTERNS,
    queryText,
    {
      clause_category: options?.clauseCategory,
      severity: options?.severity,
    },
    options?.limit ?? 3
  );
}

/**
 * Search industry_benchmarks — Used by Company Defender
 *
 * Finds industry standard practices for a given clause type and industry.
 * Returns comparison dimensions showing what is normal vs. aggressive.
 */
export async function searchIndustryBenchmarks(
  queryText: string,
  options?: {
    industry?: Industry;
    clauseType?: ClauseCategory;
    limit?: number;
  }
): Promise<QdrantSearchResult<IndustryBenchmarkPayload>[]> {
  return searchCollection<IndustryBenchmarkPayload>(
    QDRANT_COLLECTIONS.INDUSTRY_BENCHMARKS,
    queryText,
    {
      industry: options?.industry,
      clause_type: options?.clauseType,
    },
    options?.limit ?? 3
  );
}

// ─── Comprehensive Search (Neutral Judge) ──

/**
 * Search ALL collections — Used by Neutral Judge
 *
 * Performs parallel searches across all three collections to give
 * the judge a comprehensive view of laws, risks, and benchmarks.
 */
export async function searchAll(
  clauseText: string,
  clauseCategory: ClauseCategory,
  industry?: Industry
): Promise<{
  legalSections: QdrantSearchResult<CoreLegalSectionPayload>[];
  riskPatterns: QdrantSearchResult<RiskPatternPayload>[];
  industryBenchmarks: QdrantSearchResult<IndustryBenchmarkPayload>[];
}> {
  const [legalSections, riskPatterns, industryBenchmarks] = await Promise.all([
    searchLegalSections(clauseText, {
      clauseCategories: [clauseCategory],
      limit: 3,
    }),
    searchRiskPatterns(clauseText, {
      clauseCategory,
      limit: 2,
    }),
    searchIndustryBenchmarks(clauseText, {
      industry: industry ?? 'general',
      clauseType: clauseCategory,
      limit: 2,
    }),
  ]);

  return { legalSections, riskPatterns, industryBenchmarks };
}

// ─── Context Builders for Agent Prompts ────

/**
 * Formats legal search results into a context string
 * for injection into agent prompts.
 */
export function formatLegalContext(
  results: QdrantSearchResult<CoreLegalSectionPayload>[]
): string {
  if (results.length === 0) {
    return 'No directly relevant Indian law sections found in the knowledge base for this clause.';
  }

  return results
    .map(
      (r, i) => `
--- LEGAL REFERENCE ${i + 1} (Similarity: ${r.score.toFixed(2)}) ---
Act: ${r.payload.act_name}
Section: ${r.payload.section}
Title: ${r.payload.title}
Full Text: ${r.payload.full_text}
Plain Language: ${r.payload.plain_language_summary}
Practical Implication: ${r.payload.practical_implication}
Common Misuse: ${r.payload.common_misuse}
Judicial Interpretation: ${r.payload.judicial_interpretation}
Enforceability Status: ${r.payload.enforceability_status}
---`
    )
    .join('\n');
}

/**
 * Formats risk pattern results into a context string.
 */
export function formatRiskContext(
  results: QdrantSearchResult<RiskPatternPayload>[]
): string {
  if (results.length === 0) {
    return 'No matching risk patterns found in the knowledge base for this clause.';
  }

  return results
    .map(
      (r, i) => `
--- RISK PATTERN ${i + 1} (Similarity: ${r.score.toFixed(2)}) ---
Pattern: ${r.payload.pattern_name}
Severity: ${r.payload.severity.toUpperCase()}
Description: ${r.payload.description}
Why Risky: ${r.payload.why_risky}
What to Look For: ${r.payload.what_to_look_for}
Red Flag Phrases: ${r.payload.red_flag_phrases.join(', ')}
Safer Alternative: ${r.payload.safer_alternative}
Negotiation Leverage: ${r.payload.negotiation_leverage}
Negotiation Script: ${r.payload.negotiation_script}
Law Reference: ${r.payload.indian_law_reference}
Typical Scores: Harm=${r.payload.typical_harm_score}/10, Legal Strength=${r.payload.typical_legal_strength}/10, Likelihood=${r.payload.typical_likelihood}/10
---`
    )
    .join('\n');
}

/**
 * Formats benchmark results into a context string.
 */
export function formatBenchmarkContext(
  results: QdrantSearchResult<IndustryBenchmarkPayload>[]
): string {
  if (results.length === 0) {
    return 'No matching industry benchmarks found for this clause type and industry.';
  }

  return results
    .map(
      (r, i) => `
--- INDUSTRY BENCHMARK ${i + 1} (Similarity: ${r.score.toFixed(2)}) ---
Industry: ${r.payload.industry}
Clause Type: ${r.payload.clause_type}
Standard Practice: ${r.payload.standard_description}
Typical Range: ${r.payload.typical_range}
Risk If Exceeded: ${r.payload.risk_if_exceeded}
Recommended Clause Language: ${r.payload.recommended_clause_language}
Red Flag Language: ${r.payload.red_flag_language}
Comparison Dimensions:
${r.payload.dimensions
  .map(
    (d) =>
      `  • ${d.name}: Standard = ${d.standard_value} | Strict = ${d.strict_threshold} | Lenient = ${d.lenient_threshold} | Notes: ${d.notes}`
  )
  .join('\n')}
Source: ${r.payload.source} (Confidence: ${r.payload.confidence})
---`
    )
    .join('\n');
}
