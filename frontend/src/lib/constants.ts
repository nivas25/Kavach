// ─────────────────────────────────────────────
// Kavach Constants
// ─────────────────────────────────────────────

// ─── Clause Categories ─────────────────────
// The canonical list of clause types Kavach can analyze.
export const CLAUSE_CATEGORIES = [
  'non_compete',
  'non_solicitation',
  'termination',
  'notice_period',
  'ip_assignment',
  'work_product',
  'compensation',
  'payment_terms',
  'liability',
  'indemnification',
  'confidentiality',
  'nda',
  'bond_training',
  'dispute_resolution',
  'governing_law',
  'data_privacy',
  'auto_renewal',
  'scope_of_work',
  'force_majeure',
  'assignment',
] as const;

export type ClauseCategory = (typeof CLAUSE_CATEGORIES)[number];

// ─── Industries ────────────────────────────
export const INDUSTRIES = [
  'information_technology',
  'consulting',
  'manufacturing',
  'healthcare',
  'education',
  'finance',
  'media_entertainment',
  'retail_ecommerce',
  'general',
] as const;

export type Industry = (typeof INDUSTRIES)[number];

// ─── User Roles ────────────────────────────
export const USER_ROLES = [
  'job_seeker',
  'freelancer',
  'consumer',
  'small_business',
  'custom',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

// ─── Risk Levels ───────────────────────────
export const RISK_LEVELS = {
  LOW: { label: 'Low Risk', color: 'green', emoji: '🟢', min: 0, max: 25 },
  MEDIUM: { label: 'Medium Risk', color: 'yellow', emoji: '🟡', min: 26, max: 50 },
  HIGH: { label: 'High Risk', color: 'orange', emoji: '🟠', min: 51, max: 75 },
  CRITICAL: { label: 'Critical Risk', color: 'red', emoji: '🔴', min: 76, max: 100 },
} as const;

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export function getRiskLevel(score: number): RiskLevel {
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 75) return 'high';
  return 'critical';
}

// ─── Scoring Weights ───────────────────────
export const SCORING_WEIGHTS = {
  HARM_POTENTIAL: 0.40,
  LEGAL_STRENGTH: 0.35,
  PRACTICAL_LIKELIHOOD: 0.25,
} as const;

// ─── Agent Roles ───────────────────────────
export const AGENT_ROLES = {
  USER_ADVOCATE: 'user-advocate',
  COMPANY_DEFENDER: 'company-defender',
  INDIA_LEGAL_EXPERT: 'india-legal-expert',
  NEUTRAL_JUDGE: 'neutral-judge',
} as const;

export type AgentRole = (typeof AGENT_ROLES)[keyof typeof AGENT_ROLES];

// ─── Contract Types ────────────────────────
export const CONTRACT_TYPES = [
  'employment',
  'freelance',
  'consulting',
  'service_agreement',
  'nda',
  'partnership',
  'vendor',
  'subscription',
  'rental',
  'loan',
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];

// ─── Urgency Levels ────────────────────────
export const URGENCY_LEVELS = [
  'informational',
  'review_recommended',
  'negotiate',
  'seek_legal_advice',
] as const;

export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

// ─── Severity Levels (for risk patterns) ──
export const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
export type Severity = (typeof SEVERITY_LEVELS)[number];

// ─── Compliance Levels ─────────────────────
export const COMPLIANCE_LEVELS = ['compliant', 'ambiguous', 'non_compliant'] as const;
export type ComplianceLevel = (typeof COMPLIANCE_LEVELS)[number];

// ─── Deviation Levels ──────────────────────
export const DEVIATION_LEVELS = [
  'within_norm',
  'slightly_stricter',
  'significantly_stricter',
] as const;
export type DeviationLevel = (typeof DEVIATION_LEVELS)[number];
