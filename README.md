<p align="center">
  <img src="logo.png" alt="Kavach Logo" width="280" />
</p>

<h1 align="center">Kavach</h1>

<p align="center">
  <strong>Your AI Legal Shield — Analyze. Debate. Protect.</strong>
</p>

<p align="center">
  <em>An AI-powered Legal Document Intelligence Agent that helps everyday people understand contracts, uncover hidden risks, and negotiate better terms.</em>
</p>

<p align="center">
  Built with &nbsp;
  <img src="https://img.shields.io/badge/Mastra-Agent%20Orchestration-6366f1?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJ3aGl0ZSI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48L3N2Zz4=" alt="Mastra" />
  &nbsp;
  <img src="https://img.shields.io/badge/Qdrant-Vector%20Search-dc2626?style=flat-square" alt="Qdrant" />
  &nbsp;
  <img src="https://img.shields.io/badge/Enkrypt%20AI-Safety%20Layer-10b981?style=flat-square" alt="Enkrypt AI" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-000000?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License" />
</p>

---

## 🚨 The Problem

Every day, millions of people sign contracts they don't fully understand.

A fresh graduate signs an offer letter with a **2-year non-compete** that could block their entire career. A freelancer agrees to a service contract where **payment can be withheld indefinitely**. A consumer clicks "I Agree" on terms that let a company **use their data however they want**.

The consequences are real — but the contracts are written in dense legal jargon, deliberately designed to be understood by lawyers, not by the people actually signing them.

**The hard truth:**

- 📄 **80%+ of first-time job seekers** sign offer letters without reading them
- 💰 **Professional legal review** costs ₹5,000–₹25,000+ per contract — unaffordable for most
- ⚖️ **Existing AI tools** either give shallow summaries or are built for corporate legal teams
- 🏛️ **No tool grounds its analysis** in actual Indian law
- 🤖 **LLMs hallucinate** legal citations — and acting on a fabricated law can cause real harm

There's a massive gap between the people who need contract help the most and the tools available to them.

**Kavach fills that gap.**

---

## 🛡️ What is Kavach?

**Kavach** (कवच — *"shield" in Hindi*) is an AI Legal Agent that stands between you and an unfair contract.

Instead of giving you a quick summary and calling it done, Kavach runs a **structured multi-agent debate** — four specialized AI agents argue about every clause in your contract from different perspectives. One fights for you. One explains the company's side. One cites actual Indian law. And one acts as a neutral judge to deliver a fair, scored verdict.

The result? You get a **clear, honest, and grounded risk report** — in plain language you can actually understand — with safer alternatives you can propose and ready-to-send negotiation messages you can copy and use.

### What You Get for Every Contract

| Output | Description |
|--------|-------------|
| 📊 **Risk Score (0–100)** | Transparent, weighted score for every clause |
| 🔍 **Clause-by-Clause Analysis** | Detailed breakdown with risk level, explanation, and debate summary |
| ⚖️ **Legal Benchmarking** | How your clause compares to Indian law (from real statutes, not made-up citations) |
| 📏 **Industry Benchmarking** | How your clause compares to what's standard in your industry |
| ✏️ **Safer Alternatives** | Rewritten versions of risky clauses you can propose |
| 💬 **Negotiation Messages** | Professional, ready-to-copy messages to send to the other party |
| 🧪 **Clause Simulator** | Edit any clause and instantly see how the risk score changes |

---

## ✨ Key Features

### 🤖 Multi-Agent Debate (Not Just a Summary)
Four AI agents argue from different perspectives — User Advocate, Company Defender, India Legal Expert, and Neutral Judge. This isn't one model guessing. It's a structured adversarial process that catches risks a single agent would miss.

### 📐 Transparent Risk Scoring
Every clause gets a score from 0–100 based on three factors: **Harm Potential** (how badly it could hurt you), **Legal Strength** (how enforceable it is), and **Practical Likelihood** (how likely it is to actually affect you). The formula is fully transparent — no black boxes.

### 🏛️ Grounded in Indian Law
The India Legal Expert agent doesn't guess what the law says. It retrieves real statutes from the **Qdrant** vector database — Indian Contract Act, IT Act, labor laws, consumer protection, and judicial precedents. Real citations, not hallucinated ones.

### 🔒 Hallucination-Proof Legal Citations
**Enkrypt AI** scans every legal citation before it reaches you. If the AI fabricates a section number or invents a court case, Enkrypt catches it, flags it, and triggers re-generation. You never see a fake law.

### ✏️ Safer Alternatives, Not Just Warnings
Kavach doesn't just tell you something is risky — it shows you what a *better* version of that clause would look like. Alternatives are grounded in what Indian courts have historically enforced, so they're commercially reasonable and negotiation-ready.

### 🗣️ Plain Language for Real People
Every explanation is written in clear, jargon-free language. You don't need a law degree to understand your own contract.

---

## ⚙️ How It Works

```
  Upload Contract          Smart Extraction         4-Agent Debate
┌─────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│  PDF / DOCX /   │───▶│  Extract substantive │───▶│  Round 1: Opening│
│  Paste Text     │    │  clauses only        │    │  Round 2: Rebut  │
└─────────────────┘    └─────────────────────┘    └────────┬─────────┘
                                                           │
  Final Report            Safety Validation          Judge Verdict
┌─────────────────┐    ┌─────────────────────┐    ┌───────▼──────────┐
│  Risk scores,   │◀───│  Enkrypt AI checks   │◀───│  Score each      │
│  alternatives,  │    │  for hallucinations  │    │  clause 0–100    │
│  action items   │    │  and bias            │    │                  │
└─────────────────┘    └─────────────────────┘    └──────────────────┘
```

**Step by step:**

1. **You upload** your contract (PDF, DOCX, or paste text) and tell Kavach your role (job seeker, freelancer, consumer)
2. **Kavach extracts** the important clauses — payment, termination, non-compete, IP, liability, confidentiality, dispute resolution
3. **Four agents debate** each clause across 2 rounds, arguing from different perspectives
4. **The Judge scores** each clause using a transparent 3-factor formula
5. **Enkrypt AI validates** every output — no hallucinated laws, no biased scoring
6. **You get a full report** — risk scores, explanations, benchmarks, safer alternatives, and negotiation messages

---

## 🧠 The Multi-Agent Debate System

This is the core intelligence of Kavach. Instead of asking one AI model for an opinion, we make four agents **debate** each clause:

<table>
  <tr>
    <td align="center" width="25%">
      <h3>🛡️ User Advocate</h3>
      <em>"How could this clause harm the person signing it?"</em>
      <br/><br/>
      Fights for your interests. Identifies worst-case scenarios, power imbalances, and unfair terms.
    </td>
    <td align="center" width="25%">
      <h3>⚖️ Company Defender</h3>
      <em>"Why would a reasonable company include this?"</em>
      <br/><br/>
      Explains the business rationale. Identifies which clauses are actually standard and fair.
    </td>
    <td align="center" width="25%">
      <h3>📜 India Legal Expert</h3>
      <em>"What does Indian law actually say?"</em>
      <br/><br/>
      Retrieves real statutes from Qdrant. Cites specific sections. Assesses enforceability.
    </td>
    <td align="center" width="25%">
      <h3>🏛️ Neutral Judge</h3>
      <em>"Given all arguments, what's the real risk?"</em>
      <br/><br/>
      Reads the full debate. Weighs all perspectives. Delivers a scored, balanced verdict.
    </td>
  </tr>
</table>

**Why debate works better than a single agent:**

- **Multiple perspectives** catch risks that one viewpoint would miss
- **Adversarial structure** means agents hold each other accountable
- **Legal citations** come from Qdrant retrieval, not model hallucinations
- **The Judge produces a balanced verdict**, not a one-sided opinion

The debate runs for **2 rounds** — opening arguments, then rebuttals where agents respond to each other — before the Judge delivers the final scored verdict.

---

## 🧰 Technology Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Agent Orchestration** | **[Mastra](https://mastra.ai)** | Workflow engine, agent definitions, tool calling, inter-agent memory and message passing |
| **Vector Database** | **[Qdrant](https://qdrant.tech)** | Semantic + hybrid search over Indian legal statutes and industry standard practices |
| **Safety & Guardrails** | **[Enkrypt AI](https://enkryptai.com)** | Hallucination detection on legal citations, bias detection in scoring, output validation |
| **Frontend** | Next.js 15 (TypeScript) | Interactive UI for upload, analysis, and report viewing |
| **Primary LLM** | Gemini Flash | Document processing, Legal Expert, and Judge (precision tasks) |
| **Debate LLM** | Groq Llama | User Advocate and Company Defender (fast debate inference) |
| **Database** | PostgreSQL (Prisma) | Persistent storage for reports, sessions, and analysis history |
| **Memory** | Redis (Mastra Memory) | Inter-agent debate message passing and session state |

### How the Mandatory Stack Powers Kavach

- **Mastra** orchestrates the entire pipeline — from document upload to multi-agent debate to report generation. Every agent handoff, tool call, and state transition runs through Mastra workflows. Inter-agent message passing during debates uses Mastra Memory (Redis-backed).

- **Qdrant** stores the entire Indian legal knowledge base — statutes, sections, judicial precedents, and industry standard contract practices. The India Legal Expert and Company Defender agents retrieve context from Qdrant using hybrid search (dense + sparse vectors) to ensure both semantic relevance and keyword precision.

- **Enkrypt AI** acts as the safety net at three critical checkpoints: (1) verifying legal citations aren't hallucinated, (2) detecting bias in the Judge's verdict, and (3) validating the final report for consistency and safety before it reaches the user.

---

## 🏆 Why Kavach Stands Out

| Dimension | Typical AI Legal Tools | Kavach |
|-----------|----------------------|--------|
| **Approach** | Single-agent summary | 4-agent structured debate with rebuttals |
| **Perspective** | Neutral or company-favoring | Explicitly user-first, balanced by adversarial process |
| **Legal Grounding** | None, or global/generic | Indian law corpus in Qdrant with real citations |
| **Scoring** | Opaque "risk level" label | Transparent 3-factor formula — fully auditable |
| **Benchmarking** | Not available | Dual benchmarking against Indian law AND industry standards |
| **Alternatives** | Not provided | Auto-generated safer clauses for every risky term |
| **Safety** | No hallucination check | Enkrypt AI validates all outputs before delivery |
| **Target User** | Corporate legal teams | Job seekers, freelancers, and everyday consumers |
| **Language** | Legal jargon | Plain language anyone can understand |

**The bottom line:** Kavach is the only solution that combines multi-perspective debate, real legal grounding, transparent scoring, proactive alternatives, and verified safety — all designed for the person who actually needs protection: **you**.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- **Docker** (for Qdrant and Redis)
- **PostgreSQL** database
- API keys for: Gemini, Groq, Qdrant, Enkrypt AI

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/kavach.git
cd kavach
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys:

```env
# LLM Providers
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=your_qdrant_key

# Enkrypt AI
ENKRYPT_API_KEY=your_enkrypt_key

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/kavach

# Redis
REDIS_URL=redis://localhost:6379
```

### 4. Start Infrastructure

```bash
# Start Qdrant
docker run -p 6333:6333 qdrant/qdrant

# Start Redis
docker run -p 6379:6379 redis:alpine
```

### 5. Initialize the Database

```bash
npx prisma generate
npx prisma db push
```

### 6. Seed Legal Knowledge Base

```bash
npx tsx scripts/seed-qdrant.ts
npx tsx scripts/seed-industry-standards.ts
```

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and upload your first contract.

---

## 📁 Project Structure

```
kavach/
├── src/
│   ├── app/                        # Next.js App Router (pages + API routes)
│   ├── components/                 # React UI components
│   │   ├── upload/                 # File upload components
│   │   ├── report/                 # Risk report & visualization
│   │   ├── onboarding/            # Role selection & context
│   │   └── simulator/             # Clause negotiation simulator
│   ├── mastra/                     # 🔑 Mastra configuration
│   │   ├── agents/                 # Agent definitions (4 agents)
│   │   ├── tools/                  # Qdrant search, Enkrypt AI, doc processing
│   │   ├── workflows/              # Analysis pipeline orchestration
│   │   └── memory/                 # Redis-backed debate memory
│   ├── services/                   # Business logic layer
│   ├── lib/                        # Utilities, clients, scoring formula
│   └── types/                      # TypeScript type definitions
├── scripts/                        # Qdrant seeding & setup scripts
├── prisma/                         # PostgreSQL schema
├── knowledge-base/                 # Technical reference documentation
├── public/                         # Static assets
└── PROJECT_SYNOPSIS.md             # Full project synopsis
```

---

## 🗺️ Future Roadmap

| Phase | Feature | Description |
|-------|---------|-------------|
| 🔜 **v1.1** | Multi-language Support | Analyze contracts in Hindi, Tamil, Telugu, and other Indian languages |
| 📱 **v1.2** | WhatsApp Integration | Upload contracts and get risk reports via WhatsApp |
| 🔗 **v1.3** | Browser Extension | Highlight and analyze terms on any website (rental platforms, job portals) |
| 📚 **v2.0** | Case Law Deep Dive | Expanded judicial precedent database with outcome predictions |
| 🤝 **v2.1** | Collaborative Review | Share reports with friends, mentors, or lawyers for second opinions |
| 🏛️ **v3.0** | Regional Law Expansion | Cover state-specific labor laws and emerging regulations (DPDPA 2023) |

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

Built for **India's First AI Agent Hackathon** using the mandatory stack:

- [**Mastra**](https://mastra.ai) — The orchestration backbone that makes multi-agent workflows possible
- [**Qdrant**](https://qdrant.tech) — The vector database that grounds our legal analysis in real Indian law
- [**Enkrypt AI**](https://enkryptai.com) — The safety layer that ensures no hallucinated legal citation ever reaches a user

---

<p align="center">
  <strong>Kavach — because legal protection shouldn't be a privilege.</strong>
  <br/>
  <em>कवच — क्योंकि कानूनी सुरक्षा सिर्फ अमीरों का हक़ नहीं।</em>
</p>
