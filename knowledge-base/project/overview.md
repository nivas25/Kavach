# Project Overview

## What is Kavach?

**Kavach** (कवच — meaning "shield" or "armor" in Hindi) is a production-grade AI Legal Agent that helps everyday individuals — job seekers, freelancers, and consumers — understand contracts, identify hidden risks, and negotiate better terms.

**Tagline:** *Your AI Legal Shield — Analyze. Debate. Protect.*

**Hackathon:** India's First AI Agent Hackathon  
**Mandatory Stack:** Mastra · Qdrant · Enkrypt AI

---

## Mission

Legal protection should not be a privilege of those who can afford lawyers. Kavach gives every individual the tools to understand, evaluate, and negotiate the contracts that shape their lives.

---

## Problem Being Solved

| Problem | Impact |
|---------|--------|
| **Legal illiteracy** | 80%+ of first-time job seekers sign offer letters without reading them |
| **Power asymmetry** | Contracts are drafted by company legal teams to protect the company |
| **Cost of legal advice** | ₹5,000–₹25,000+ per contract review — unaffordable for most |
| **Inaccessible language** | Legal jargon is designed for lawyers, not laypeople |
| **No benchmark awareness** | Users can't tell what is "standard" vs. unfair |

### What Existing Tools Fail to Address

- Surface-level summarization only
- Enterprise-first design (built for corporate legal teams)
- No Indian legal grounding
- No adversarial/multi-perspective reasoning
- No hallucination detection on legal citations

---

## Core Solution

Kavach uses a **4-agent debate system** that:

1. **Debates, not summarizes** — 4 agents argue from different perspectives
2. **Grounds in Indian law** — Retrieves real statutes from Qdrant
3. **Guarantees safety** — Enkrypt AI validates all outputs

---

## Key Objectives

| # | Objective |
|---|-----------|
| 1 | Democratize legal understanding for all Indians |
| 2 | Enable multi-perspective risk assessment through structured debate |
| 3 | Ground all analysis in real Indian law (via Qdrant retrieval) |
| 4 | Deliver actionable outputs (safer alternatives + negotiation messages) |
| 5 | Guarantee output safety (no hallucinated citations via Enkrypt AI) |
| 6 | Build entirely on Mastra + Qdrant + Enkrypt AI |

---

## Target Users

| Segment | Scenario | Key Concerns |
|---------|----------|-------------|
| **Job Seekers & Freshers** | Signing first offer letter | Non-compete, notice period, IP assignment, bonds |
| **Freelancers & Gig Workers** | Accepting service agreements | Payment terms, liability, termination without cause |
| **Consumers** | Subscription terms, rentals, loans | Auto-renewal, hidden fees, dispute resolution |
| **Small Business Owners** | Vendor/partnership contracts | Indemnity, exclusivity, payment timelines |

> **Important:** Kavach is NOT for lawyers or corporate legal teams. It is for the individual across the table from those teams.

---

## Core Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Intelligent Contract Parsing** | Accepts PDF/DOCX/text. Extracts substantive clauses using Gemini Flash via Mastra. |
| 2 | **Multi-Agent Debate** | 4 agents engage in 2-round structured debate per clause |
| 3 | **3-Factor Risk Scoring** | Transparent 0–100 score from Harm Potential, Legal Strength, Practical Likelihood |
| 4 | **Indian Law Benchmarking** | Compares clauses against Indian statutes from Qdrant |
| 5 | **Industry Standard Benchmarking** | Compares against sector norms from Qdrant |
| 6 | **Safer Alternatives** | Auto-generates 1–2 better versions of risky clauses |
| 7 | **Plain-Language Explanations** | Jargon-free explanations for non-lawyers |
| 8 | **Negotiation Support** | Ready-to-copy response messages |
| 9 | **Clause Simulator** | User edits a clause and re-runs analysis |
| 10 | **Enkrypt AI Safety** | Hallucination detection, bias detection, output validation |

---

## What Kavach Delivers Per Contract

For every contract uploaded, the user receives:

- **Overall Contract Risk Score** (0–100) with visual gauge
- **Clause-by-clause breakdown**, each with:
  - Risk level (Low / Medium / High / Critical)
  - Plain-language explanation
  - Debate summary
  - Benchmarking result
  - 1–2 safer alternatives
  - Ready-to-send negotiation message
- **Key findings summary** highlighting critical issues
- **Recommended actions** prioritized by severity

---

## Legal Disclaimer

> Kavach is not a replacement for professional legal counsel. It is a first line of defense — a shield that ensures no one signs a contract without understanding what they are agreeing to.
