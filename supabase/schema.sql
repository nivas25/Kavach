-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║                    KAVACH — SUPABASE DATABASE SCHEMA               ║
-- ║                        Production-Ready v2.1                        ║
-- ║                                                                      ║
-- ║  Copy-paste this entire file into the Supabase SQL Editor and run.  ║
-- ║  Requires: Supabase Auth enabled (auth.users table exists)           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE 1: profiles
-- Purpose: Store user profile data. Links 1:1 with auth.users.
-- Solves: Data duplication by centralizing user_role, industry, etc.
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    company TEXT,
    user_role TEXT CHECK (user_role IN ('job_seeker', 'freelancer', 'consumer', 'custom')),
    user_experience TEXT,
    user_industry TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE 2: analyses
-- Purpose: Central table for contract analysis sessions.
-- Solves: Missing title/summary, soft deletes, and session_id uniqueness.
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    
    -- Display fields for history/dashboard
    title TEXT,
    summary TEXT,
    
    -- Analysis context
    user_concerns JSONB DEFAULT '[]'::jsonb,
    
    -- Document info
    original_file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'text')),
    file_size_bytes INTEGER,
    
    -- Extracted content
    extracted_markdown TEXT,
    extracted_json JSONB,
    
    -- Scoring
    overall_risk_score INTEGER CHECK (overall_risk_score BETWEEN 0 AND 100),
    overall_risk_level TEXT CHECK (overall_risk_level IN ('low', 'medium', 'high', 'critical')),
    total_clauses_analyzed INTEGER,
    
    -- Deep dive clause analysis
    -- JSONB Structure: [{ clause_id, category, summary, risk_score, alternatives: [...], ... }]
    clause_results JSONB DEFAULT '[]'::jsonb,
    
    key_findings JSONB DEFAULT '{}'::jsonb,
    recommended_actions JSONB DEFAULT '{}'::jsonb,
    
    -- Safety checks
    enkrypt_hallucination_passed BOOLEAN DEFAULT false,
    enkrypt_bias_passed BOOLEAN DEFAULT false,
    enkrypt_output_validation_passed BOOLEAN DEFAULT false,
    enkrypt_validation_details JSONB DEFAULT '{}'::jsonb,
    
    -- State & lifecycle
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'parsing', 'extracting', 'debating', 'scoring', 'validating', 'completed', 'failed')),
    error_message TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    viewed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ, -- Soft delete
    
    -- Analytics
    processing_time_ms INTEGER,
    total_llm_calls INTEGER,
    total_tokens_used INTEGER,
    
    -- Constraint: session_id must be unique PER USER, not globally
    UNIQUE (user_id, session_id)
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE 3: debate_messages
-- Purpose: Complete debate history per clause.
-- Solves: Redundant user_id removed; RLS secures via analysis_id.
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.debate_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    
    clause_id TEXT NOT NULL,
    clause_category TEXT,
    
    agent_role TEXT NOT NULL CHECK (agent_role IN ('user-advocate', 'company-defender', 'india-legal-expert', 'neutral-judge')),
    round_number INTEGER NOT NULL CHECK (round_number BETWEEN 1 AND 6),
    phase TEXT NOT NULL CHECK (phase IN ('opening_statements', 'rebuttal_1', 'rebuttal_2', 'cross_examination', 'closing_arguments', 'verdict')),
    
    content TEXT NOT NULL,
    content_length INTEGER GENERATED ALWAYS AS (length(content)) STORED,
    
    llm_provider TEXT,
    llm_model TEXT,
    tokens_used INTEGER,
    latency_ms INTEGER,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE 4: tool_usage_log
-- Purpose: Audit trail of all tool calls (Qdrant, Enkrypt AI, etc.)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.tool_usage_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    
    clause_id TEXT,
    agent_role TEXT,
    round_number INTEGER,
    
    tool_name TEXT NOT NULL,
    tool_input JSONB DEFAULT '{}'::jsonb,
    tool_output_summary TEXT,
    tool_output_full JSONB,
    
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    latency_ms INTEGER,
    result_count INTEGER,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════
-- TABLE 5: negotiation_messages
-- Purpose: Store user-AI chat history when negotiating clauses.
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE public.negotiation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    
    clause_id TEXT, -- NULL if general contract chat
    
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║                       TRIGGERS                                       ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_analyses_updated_at
    BEFORE UPDATE ON public.analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════
-- TRIGGER: Auto-create profile on user signup
-- Purpose: When a new user signs up (email OR Google OAuth), automatically
--          insert a row in the profiles table so RLS and queries work
--          immediately without a separate "create profile" step.
--
-- How it works:
--   - Fires AFTER INSERT on auth.users (managed by Supabase Auth)
--   - Extracts full_name and avatar_url from the auth metadata
--   - Google OAuth stores name in 'full_name' or 'name', avatar in 'avatar_url' or 'picture'
--   - Email signup stores name in 'full_name' (passed via options.data)
--   - SECURITY DEFINER = runs with the function creator's permissions,
--     bypassing RLS (necessary because there's no authenticated user yet)
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data ->> 'full_name',
            NEW.raw_user_meta_data ->> 'name',
            ''
        ),
        COALESCE(
            NEW.raw_user_meta_data ->> 'avatar_url',
            NEW.raw_user_meta_data ->> 'picture',
            ''
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║                   ROW LEVEL SECURITY (RLS)                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debate_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiation_messages ENABLE ROW LEVEL SECURITY;

-- ═══ profiles policies ═══
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ═══ analyses policies ═══
-- Hide soft-deleted records by default
CREATE POLICY "Users can view own non-deleted analyses"
    ON public.analyses FOR SELECT 
    USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can create own analyses"
    ON public.analyses FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
    ON public.analyses FOR UPDATE 
    USING (auth.uid() = user_id AND deleted_at IS NULL)
    WITH CHECK (auth.uid() = user_id);

-- Soft delete is preferred, but this allows hard delete if required
CREATE POLICY "Users can delete own analyses"
    ON public.analyses FOR DELETE 
    USING (auth.uid() = user_id);

-- ═══ debate_messages policies ═══
-- MUST verify that the analysis_id belongs to the current user
CREATE POLICY "Users can view own debate messages"
    ON public.debate_messages FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.analyses 
        WHERE analyses.id = debate_messages.analysis_id 
        AND analyses.user_id = auth.uid() 
        AND analyses.deleted_at IS NULL
    ));

CREATE POLICY "Users can insert own debate messages"
    ON public.debate_messages FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.analyses 
        WHERE analyses.id = debate_messages.analysis_id 
        AND analyses.user_id = auth.uid()
        AND analyses.deleted_at IS NULL
    ));

-- ═══ tool_usage_log policies ═══
CREATE POLICY "Users can view own tool usage"
    ON public.tool_usage_log FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.analyses 
        WHERE analyses.id = tool_usage_log.analysis_id 
        AND analyses.user_id = auth.uid()
        AND analyses.deleted_at IS NULL
    ));

CREATE POLICY "Users can insert own tool usage"
    ON public.tool_usage_log FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.analyses 
        WHERE analyses.id = tool_usage_log.analysis_id 
        AND analyses.user_id = auth.uid()
        AND analyses.deleted_at IS NULL
    ));

-- ═══ negotiation_messages policies ═══
CREATE POLICY "Users can view own negotiation messages"
    ON public.negotiation_messages FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.analyses 
        WHERE analyses.id = negotiation_messages.analysis_id 
        AND analyses.user_id = auth.uid()
        AND analyses.deleted_at IS NULL
    ));

CREATE POLICY "Users can insert own negotiation messages"
    ON public.negotiation_messages FOR INSERT 
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.analyses 
        WHERE analyses.id = negotiation_messages.analysis_id 
        AND analyses.user_id = auth.uid()
        AND analyses.deleted_at IS NULL
    ));

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║                          INDEXES                                     ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE INDEX idx_analyses_user_id ON public.analyses (user_id);
CREATE INDEX idx_analyses_session_id ON public.analyses (session_id);
CREATE INDEX idx_analyses_status ON public.analyses (status);
CREATE INDEX idx_analyses_created_at ON public.analyses (created_at DESC);

CREATE INDEX idx_debate_analysis_id ON public.debate_messages (analysis_id);
CREATE INDEX idx_debate_clause ON public.debate_messages (analysis_id, clause_id);
CREATE INDEX idx_debate_ordering ON public.debate_messages (analysis_id, clause_id, round_number, agent_role);

CREATE INDEX idx_tool_analysis_id ON public.tool_usage_log (analysis_id);
CREATE INDEX idx_tool_name ON public.tool_usage_log (tool_name);

CREATE INDEX idx_negotiation_analysis_id ON public.negotiation_messages (analysis_id);
CREATE INDEX idx_negotiation_clause_id ON public.negotiation_messages (analysis_id, clause_id);
