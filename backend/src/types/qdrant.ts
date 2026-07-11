import type { ClauseCategory, Industry } from '../lib/constants';

export interface CoreLegalSectionPayload {
  section_id: string;
  title: string;
  description: string;
  category: ClauseCategory;
}

export interface RiskPatternPayload {
  pattern_id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: ClauseCategory;
}

export interface IndustryBenchmarkPayload {
  benchmark_id: string;
  industry: Industry;
  metric: string;
  value: number;
  unit: string;
  description: string;
}

export interface QdrantSearchResult<T> {
  id: string;
  score: number;
  payload: T;
}
