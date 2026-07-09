// ─────────────────────────────────────────────
// Qdrant Payload Types for Kavach Collections
// ─────────────────────────────────────────────
// These interfaces define the payload structure stored in each
// Qdrant collection. They are used by the seed script and search tools.

import type { ClauseCategory, ContractType, Industry, Severity } from '@/lib/constants';

// ─── Collection: risk_patterns ─────────────

export interface RiskPatternPayload {
  // Identification
  id: string;
  pattern_name: string;

  // Classification
  clause_category: ClauseCategory;
  contract_types: ContractType[];
  target_users: string[];

  // Risk Intelligence
  description: string;
  why_risky: string;
  severity: Severity;

  typical_harm_score: number;       // 1-10
  typical_legal_strength: number;   // 1-10
  typical_likelihood: number;       // 1-10

  // Detection Signals
  red_flag_phrases: string[];
  trigger_keywords: string[];

  // Actionable Guidance
  what_to_look_for: string;
  safer_alternative: string;
  negotiation_leverage: string;
  negotiation_script: string;
  indian_law_reference: string;

  // Metadata
  source: string;
  confidence: 'high' | 'medium';
  last_updated: string;
}

// ─── Collection: industry_benchmarks ───────

export interface BenchmarkDimension {
  name: string;
  standard_value: string;
  strict_threshold: string;
  lenient_threshold: string;
  notes: string;
}

export interface IndustryBenchmarkPayload {
  // Identification
  id: string;
  industry: Industry;
  clause_type: ClauseCategory;

  // Benchmark Data
  standard_description: string;
  typical_range: string;
  risk_if_exceeded: string;
  recommended_clause_language: string;
  red_flag_language: string;

  // Comparison Dimensions
  dimensions: BenchmarkDimension[];

  // Contract Type Specifics
  contract_types: ContractType[];
  seniority_levels: string[];

  // Sourcing
  source: string;
  source_type: 'industry_body' | 'aggregated_data' | 'expert_analysis';
  confidence: 'high' | 'medium';

  // Metadata
  region: string;
  last_updated: string;
  applicable_company_size: 'all' | 'startup' | 'enterprise' | 'mnc';
}

// ─── Collection: core_legal_sections ───────

export interface CoreLegalSectionPayload {
  // Identification
  id: string;
  act_name: string;
  act_short: string;
  section: string;

  // Content
  title: string;
  full_text: string;
  plain_language_summary: string;

  // Practical Analysis (Agent-Ready)
  practical_implication: string;
  common_misuse: string;
  judicial_interpretation: string;
  enforceability_status: string;

  // Classification
  type: 'statute' | 'precedent' | 'regulation' | 'guideline';
  clause_categories: ClauseCategory[];
  contract_types: ContractType[];

  // Metadata
  year: number;
  last_amended: string | null;
  jurisdiction: string;
  court: string | null;
  case_citation: string | null;

  // Search Optimization
  keywords: string[];
  related_sections: string[];

  // Sourcing
  source_url: string;
  verified: boolean;
}

// ─── Search Result Types ───────────────────

export interface QdrantSearchResult<T> {
  id: string | number;
  score: number;
  payload: T;
}

export interface RiskPatternSearchResult extends QdrantSearchResult<RiskPatternPayload> {}
export interface IndustryBenchmarkSearchResult extends QdrantSearchResult<IndustryBenchmarkPayload> {}
export interface CoreLegalSectionSearchResult extends QdrantSearchResult<CoreLegalSectionPayload> {}

// ─── Benchmark Output Types ────────────────

export interface LegalBenchmark {
  relevantLaws: Array<{
    actName: string;
    section: string;
    summary: string;
    similarity: number;
  }>;
  compliance: 'compliant' | 'ambiguous' | 'non_compliant';
  details: string;
}

export interface IndustryBenchmark {
  standardPractice: string;
  deviation: 'within_norm' | 'slightly_stricter' | 'significantly_stricter';
  comparisonTable: Array<{
    dimension: string;
    yourContract: string;
    industryStandard: string;
    indianLaw: string;
  }>;
  details: string;
}

// ─── Embedding Helper Types ────────────────

export interface EmbeddableEntry {
  id: string;
  embeddingText: string;
  payload: Record<string, unknown>;
}
