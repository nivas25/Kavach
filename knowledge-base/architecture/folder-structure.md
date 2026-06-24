# Recommended Project Folder Structure

This document defines the recommended folder layout for the Kavach project (Next.js 15 + Mastra). All AI agents should follow this structure when creating new files.

---

## Root Structure

```
kavach/
├── knowledge-base/                    # This knowledge base (reference docs)
├── PROJECT_SYNOPSIS.md                # Full project synopsis
├── src/
│   ├── app/                           # Next.js App Router
│   ├── components/                    # React UI components
│   ├── lib/                           # Shared utilities and helpers
│   ├── mastra/                        # Mastra configuration and agents
│   ├── services/                      # Business logic services
│   └── types/                         # TypeScript type definitions
├── scripts/                           # Setup and seed scripts
├── public/                            # Static assets
├── prisma/                            # Prisma schema (PostgreSQL)
├── .env.local                         # Environment variables
├── .env.example                       # Environment variable template
├── next.config.ts                     # Next.js configuration
├── package.json
├── tsconfig.json
└── README.md
```

---

## Detailed Structure

### `src/app/` — Next.js App Router

```
src/app/
├── layout.tsx                         # Root layout with providers
├── page.tsx                           # Landing / home page
├── globals.css                        # Global styles
│
├── api/                               # API routes (backend)
│   ├── analyze/
│   │   └── route.ts                   # POST: Start contract analysis
│   ├── report/
│   │   └── [id]/
│   │       └── route.ts              # GET: Fetch report by ID
│   ├── simulate/
│   │   └── route.ts                   # POST: Re-analyze modified clause
│   └── upload/
│       └── route.ts                   # POST: Upload contract file
│
├── analyze/
│   └── page.tsx                       # Contract upload + analysis page
│
├── report/
│   └── [id]/
│       └── page.tsx                   # Risk report viewer page
│
└── onboarding/
    └── page.tsx                       # Role selection + context questions
```

### `src/components/` — React UI Components

```
src/components/
├── ui/                                # Base UI components (shadcn/ui)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── progress.tsx
│   ├── select.tsx
│   ├── tabs.tsx
│   └── textarea.tsx
│
├── upload/
│   ├── FileUploader.tsx               # Drag-and-drop file upload
│   └── TextPasteInput.tsx             # Paste contract text
│
├── onboarding/
│   ├── RoleSelector.tsx               # Role selection cards
│   └── ContextQuestions.tsx           # Dynamic context questions
│
├── report/
│   ├── RiskGauge.tsx                  # Overall risk score gauge
│   ├── ClauseCard.tsx                 # Individual clause card
│   ├── ClauseDetail.tsx              # Expanded clause view
│   ├── ScoreBreakdown.tsx             # 3-factor score visualization
│   ├── DebateTranscript.tsx           # Debate round viewer
│   ├── BenchmarkComparison.tsx        # Law + industry comparison table
│   ├── SaferAlternatives.tsx          # Alternative clause suggestions
│   ├── NegotiationMessage.tsx         # Copy-ready negotiation text
│   └── ReportSummary.tsx              # Key findings + actions
│
├── simulator/
│   └── ClauseSimulator.tsx            # Edit clause + re-analyze
│
└── layout/
    ├── Header.tsx
    ├── Footer.tsx
    └── ProgressStepper.tsx            # Pipeline progress indicator
```

### `src/mastra/` — Mastra Configuration

```
src/mastra/
├── index.ts                           # Mastra instance initialization
│
├── agents/
│   ├── userAdvocate.ts                # User Advocate agent definition
│   ├── companyDefender.ts             # Company Defender agent definition
│   ├── indiaLegalExpert.ts            # India Legal Expert agent definition
│   └── neutralJudge.ts               # Neutral Judge agent definition
│
├── tools/
│   ├── documentProcessor.ts           # Document parsing tool (Gemini Flash)
│   ├── qdrantSearch.ts                # Qdrant search tool (laws + standards)
│   ├── enkryptValidation.ts           # Enkrypt AI validation tool
│   └── alternativeGenerator.ts        # Safer alternative generation tool
│
├── workflows/
│   ├── contractAnalysis.ts            # Main analysis workflow
│   ├── debateRound.ts                 # Single debate round sub-workflow
│   └── reportGeneration.ts           # Report compilation workflow
│
└── memory/
    └── config.ts                      # Mastra Memory (Redis) configuration
```

### `src/services/` — Business Logic

```
src/services/
├── contractService.ts                 # Contract upload/retrieval logic
├── reportService.ts                   # Report generation/retrieval logic
├── scoringService.ts                  # Risk score calculation logic
├── benchmarkService.ts                # Benchmarking against law + standards
├── alternativeService.ts              # Safer alternative generation
└── enkryptService.ts                  # Enkrypt AI API integration
```

### `src/lib/` — Shared Utilities

```
src/lib/
├── constants.ts                       # App-wide constants
├── utils.ts                           # Utility functions
├── scoring.ts                         # Scoring formula and risk classification
├── qdrant.ts                          # Qdrant client initialization
├── prisma.ts                          # Prisma client singleton
└── redis.ts                           # Redis client initialization
```

### `src/types/` — TypeScript Type Definitions

```
src/types/
├── contract.ts                        # Contract, clause, document types
├── debate.ts                          # Debate message, round, transcript types
├── report.ts                          # Report, verdict, benchmark types
├── scoring.ts                         # Score, factor, risk level types
├── agent.ts                           # Agent input/output types
└── user.ts                            # User context, session types
```

### `scripts/` — Setup and Seed Scripts

```
scripts/
├── seed-qdrant.ts                     # Populate Qdrant with Indian laws
├── seed-industry-standards.ts         # Populate Qdrant with industry standards
├── setup-db.ts                        # Initialize PostgreSQL tables
└── test-agents.ts                     # Test individual agents
```

### `prisma/` — Database Schema

```
prisma/
├── schema.prisma                      # PostgreSQL schema definition
└── migrations/                        # Database migrations
```

---

## Environment Variables

```bash
# .env.example

# LLM Providers
GEMINI_API_KEY=
GROQ_API_KEY=

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# Enkrypt AI
ENKRYPT_API_KEY=

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/kavach

# Redis
REDIS_URL=redis://localhost:6379

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## File Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `ClauseCard.tsx` |
| Pages | lowercase | `page.tsx` |
| API routes | lowercase | `route.ts` |
| Services | camelCase | `contractService.ts` |
| Types | camelCase | `contract.ts` |
| Mastra agents | camelCase | `userAdvocate.ts` |
| Mastra tools | camelCase | `qdrantSearch.ts` |
| Utilities | camelCase | `scoring.ts` |
| Scripts | kebab-case | `seed-qdrant.ts` |

---

## Import Aliases

Configure in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/mastra/*": ["./src/mastra/*"],
      "@/services/*": ["./src/services/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/types/*": ["./src/types/*"]
    }
  }
}
```
