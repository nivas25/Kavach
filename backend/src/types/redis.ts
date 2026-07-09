// ─────────────────────────────────────────────
// Kavach — Redis Data Types
// ─────────────────────────────────────────────
// Type-safe interfaces for every Redis data structure.
// These map 1:1 with the key patterns in redisKeys.ts.

// ═══ Union Type Constants ════════════════════

/** Pipeline status values — matches analyses.status in Supabase */
export type SessionPhase =
  | 'uploading'
  | 'parsing'
  | 'extracting'
  | 'debating'
  | 'scoring'
  | 'validating'
  | 'persisting'
  | 'completed'
  | 'failed';

/** The 4 Kavach agents */
export type AgentRole =
  | 'user-advocate'
  | 'company-defender'
  | 'india-legal-expert'
  | 'neutral-judge';

/** Debate round phases — matches debate_messages.phase in Supabase */
export type DebatePhase =
  | 'opening_statements'
  | 'rebuttal_1'
  | 'rebuttal_2'
  | 'cross_examination'
  | 'closing_arguments'
  | 'verdict';

/** Risk severity levels — matches analyses.overall_risk_level in Supabase */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// ═══ Document Storage (Hash) ═════════════════
// Key: doc:{session_id}
// Structure: Redis Hash with 4 fields

/** Metadata stored alongside the extracted document */
export interface RedisDocumentMetadata {
  fileName: string;
  fileType: 'pdf' | 'docx' | 'text';
  fileSize: number;
  clauseCount: number;
  uploadedAt: string; // ISO 8601
}

/**
 * Represents the full document hash stored in Redis.
 *
 * Each field is stored as a separate hash field so we can
 * read markdown without loading the JSON and vice versa.
 */
export interface RedisDocumentData {
  /** Full LlamaParse output — can be several hundred KB */
  markdown: string;
  /** Gemini 2.5 Pro extraction result — structured clause JSON */
  json: string; // Serialized ExtractionResult
  /** File metadata — small, frequently accessed */
  metadata: RedisDocumentMetadata;
  /** Processing status of this document */
  status: 'processing' | 'ready' | 'error';
}

// ═══ Session Status (String/JSON) ════════════
// Key: session:{session_id}:status

/**
 * Live pipeline progress — polled by the frontend for progress updates.
 */
export interface RedisSessionStatus {
  /** Current pipeline phase */
  status: SessionPhase;
  /** Human-readable description of what's happening */
  message: string;
  /** Which clause is currently being debated (0-indexed) */
  currentClause: number;
  /** Total number of clauses extracted */
  totalClauses: number;
  /** Number of clauses fully debated + scored */
  completedClauses: number;
  /** Current debate round for the active clause (1-5) */
  currentRound?: number;
  /** Pipeline start time — used to compute elapsed time */
  startedAt: string; // ISO 8601
  /** Last update timestamp */
  updatedAt: string; // ISO 8601
  /** Error details if status === 'failed' */
  error?: string;
}

// ═══ Debate Messages (List) ══════════════════
// Key: debate:{session_id}:{clause_id}
// Structure: Redis List of serialized RedisDebateMessage objects

/**
 * A single debate message from one agent in one round.
 *
 * Stored as JSON strings in a Redis List via RPUSH.
 * Order of insertion = chronological order of the debate.
 */
export interface RedisDebateMessage {
  /** Which agent produced this message */
  agent: AgentRole;
  /** Debate round number (1-5 for debate agents, 6 for judge verdict) */
  round: number;
  /** Phase name for the round */
  phase: DebatePhase;
  /** The actual debate content / argument */
  content: string;
  /** LLM model used (e.g., 'llama-3.3-70b-versatile', 'gemini-2.5-pro') */
  model: string;
  /** Tokens consumed by this generation */
  tokensUsed: number;
  /** Latency in milliseconds for this LLM call */
  latencyMs: number;
  /** When this message was generated */
  createdAt: string; // ISO 8601
}

// ═══ Judge Verdict (String/JSON) ═════════════
// Key: verdict:{session_id}:{clause_id}

/**
 * The Neutral Judge's final verdict for a single clause.
 *
 * Stored separately from debate messages because:
 * 1. It's accessed independently during report generation
 * 2. It has a different structure (scores + reasoning)
 * 3. Multiple consumers need it (benchmarking, alternatives, report)
 */
export interface RedisVerdict {
  /** Composite risk score: (harm × 0.40) + (legal × 0.35) + (likelihood × 0.25) */
  riskScore: number;
  /** Classified risk level */
  riskLevel: RiskLevel;

  /** Sub-scores (each 0-100) */
  harmScore: number;
  legalScore: number;
  likelihoodScore: number;

  /** Judge's reasoning for the scores */
  reasoning: string;
  /** Points where all agents agreed */
  consensusPoints: string[];
  /** Points where agents fundamentally disagreed */
  disagreementPoints: string[];
  /** Key arguments that influenced the verdict */
  keyArguments: string[];

  /** LLM metadata */
  model: string;
  tokensUsed: number;
  latencyMs: number;
  createdAt: string; // ISO 8601
}

// ═══ Qdrant Cache (String/JSON) ══════════════
// Key: cache:qdrant:{sha256_hash}

/**
 * Cached Qdrant search results.
 * The value is the raw JSON array of search results,
 * typed generically since it varies by collection.
 */
export interface RedisQdrantCache<T = unknown> {
  /** Which Qdrant collection was queried */
  collection: string;
  /** The original query text (for debugging) */
  query: string;
  /** Search results */
  results: T[];
  /** When this cache entry was created */
  cachedAt: string; // ISO 8601
}

// ═══ Function Parameter Types ════════════════

/** Input for saving a document to Redis */
export interface SaveDocumentInput {
  markdown: string;
  json: string; // Serialized ExtractionResult
  metadata: RedisDocumentMetadata;
}

/** Input for updating session status */
export interface UpdateSessionStatusInput {
  status: SessionPhase;
  message: string;
  currentClause?: number;
  totalClauses?: number;
  completedClauses?: number;
  currentRound?: number;
  error?: string;
}

/** Input for appending a debate message */
export interface AppendDebateMessageInput {
  agent: AgentRole;
  round: number;
  phase: DebatePhase;
  content: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
}
