# Database Schemas — Kavach v2.1

> **Production-quality Supabase (PostgreSQL) schema with Row Level Security + Redis temporary storage.**

This document defines all database tables, RLS policies, indexes, Redis key patterns, and data lifecycle.

**SQL file:** [`supabase/schema.sql`](file:///c:/Users/reddy/Desktop/Kavach/supabase/schema.sql) — ready to paste into Supabase SQL Editor.

*Last updated: July 2026*

---

## Storage Strategy

| Store | Purpose | Data Lifetime | Technology |
|-------|---------|---------------|-----------|
| **Redis** | Temporary fast storage during analysis | 2 hours (TTL) | Redis 7+ |
| **Supabase** | Permanent storage after analysis completes | Forever | PostgreSQL 15+ (Supabase) |
| **Qdrant** | Legal knowledge retrieval | Static (seeded at deploy) | Qdrant 1.7+ |

---

# Part 1: Supabase Schema

## Entity Relationship Diagram

```
  auth.users (Supabase Auth)
       │
       ├──1:1── profiles (User settings: role, industry)
       │
       └──1:N── analyses (title, summary, deleted_at)
                   │
                   ├──1:N── debate_messages
                   │
                   ├──1:N── negotiation_messages
                   │
                   └──1:N── tool_usage_log
```

> **Design Principle:** 5 tables. User details are centralized in `profiles`. The `analyses` table contains the core document data. Child tables (`debate_messages`, `negotiation_messages`, `tool_usage_log`) reference `analyses` directly, and RLS policies use `EXISTS` to securely check ownership without redundant `user_id` columns.

---

## Table 1: `profiles`

**Purpose:** Stores user profile data. Links 1:1 with `auth.users`.
Eliminates data duplication across analyses.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Matches `auth.users(id)` |
| `full_name` | TEXT | User's full name |
| `avatar_url` | TEXT | Avatar URL |
| `company` | TEXT | User's company (if applicable) |
| `user_role` | TEXT | 'job_seeker', 'freelancer', 'consumer', 'custom' |
| `user_experience` | TEXT | 'fresher', 'mid', 'senior' (optional) |
| `user_industry` | TEXT | Industry category (optional) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Auto-updated on change |

---

## Table 2: `analyses`

**Purpose:** One row per contract analysis session. Stores everything about the analysis result.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated primary key |
| `user_id` | UUID (FK) | The logged-in user who ran this analysis |
| `session_id` | TEXT | Correlation key. UNIQUE per `user_id` |
| `title` | TEXT | Short title for dashboard display |
| `summary` | TEXT | Brief summary of the contract |
| `user_concerns` | JSONB | Specific concerns for *this* document |
| `original_file_name` | TEXT | Name of the uploaded file |
| `file_type` | TEXT | 'pdf', 'docx', or 'text' |
| `extracted_markdown` | TEXT | Full Markdown from LlamaParse |
| `extracted_json` | JSONB | Structured extraction from Gemini |
| `overall_risk_score` | INTEGER | Weighted average of all clause scores |
| `clause_results` | JSONB | Full per-clause analysis array |
| `status` | TEXT | Pipeline status |
| `created_at` | TIMESTAMPTZ | When the analysis was started |
| `deleted_at` | TIMESTAMPTZ | Soft delete timestamp |

---

## Table 3: `debate_messages`

**Purpose:** Stores **every single message** from every agent in every round. 

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated primary key |
| `analysis_id` | UUID (FK) | Parent analysis |
| `clause_id` | TEXT | Which clause this message belongs to |
| `agent_role` | TEXT | 'user-advocate', 'company-defender', etc. |
| `round_number` | INTEGER | Which round of the debate (1-6) |
| `phase` | TEXT | 'opening_statements', 'rebuttal_1', etc. |
| `content` | TEXT | Full agent message text |
| `created_at` | TIMESTAMPTZ | When this message was generated |

---

## Table 4: `negotiation_messages`

**Purpose:** Stores user-AI chat history when negotiating specific clauses or the full contract. This allows users to resume past negotiation sessions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Auto-generated primary key |
| `analysis_id` | UUID (FK) | Parent analysis |
| `clause_id` | TEXT | Specific clause being discussed (NULL if general chat) |
| `role` | TEXT | 'user', 'assistant', or 'system' |
| `content` | TEXT | Chat message content |
| `created_at` | TIMESTAMPTZ | When this message was sent |

---

## Row Level Security (RLS)

**All tables have strict RLS enabled.**

1. **`profiles` and `analyses`** use direct column comparisons:
   `auth.uid() = id` or `auth.uid() = user_id`.
   Additionally, `analyses` SELECT policies exclude soft-deleted rows (`deleted_at IS NULL`).
   
2. **`debate_messages`, `negotiation_messages`, and `tool_usage_log`** do not duplicate `user_id`. Instead, they use a secure subquery to ensure the referenced analysis belongs to the user:
   ```sql
   EXISTS (
       SELECT 1 FROM public.analyses 
       WHERE analyses.id = debate_messages.analysis_id 
       AND analyses.user_id = auth.uid() 
       AND analyses.deleted_at IS NULL
   )
   ```
   This strictly prevents malicious inserts where an attacker might try to attach data to another user's `analysis_id`.

---

## Redis Temporary Storage (Unchanged)
Redis continues to manage `doc:{session_id}` and `debate:{session_id}:{clause_id}` for ultra-fast, temporary storage during the 5-round debate processing pipeline.
