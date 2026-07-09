export interface AnalyzeRequest {
  contractText: string;
}

export interface AnalyzeResponse {
  riskScore: number;
  report: string;
}

export interface QdrantRiskPattern {
  id: string;
  pattern_name: string;
  severity: string;
}
