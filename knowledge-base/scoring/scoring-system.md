# Scoring System

This document provides the complete specification of the 3-Factor Weighted Scoring System used by the Neutral Judge agent.

---

## Formula

```
Risk Score (0–100) = (Harm Potential × 0.40) + (Legal Strength × 0.35) + (Practical Likelihood × 0.25)
```

Each factor is scored **1–10**. The weighted sum is multiplied by **10** to produce a **0–100** final score.

---

## Factor Weights

| Factor | Weight | Rationale |
|--------|--------|-----------|
| **Harm Potential** | 40% | Severity of damage is the most important factor for user decisions |
| **Legal Strength** | 35% | Enforceability determines whether risk is theoretical or real |
| **Practical Likelihood** | 25% | Even high-harm, enforceable clauses matter less if rarely invoked |

---

## Factor 1 — Harm Potential (40%)

**Definition:** How severe could the negative impact be on the user's career, finances, or personal interests if this clause is invoked?

| Score | Level | Description | Example |
|-------|-------|-------------|---------|
| 1 | Negligible | No measurable impact | Standard formatting of party names |
| 2 | Negligible | Trivial inconvenience | Standard confidentiality for project names |
| 3 | Minor | Brief inconvenience | Standard 15-day notice period |
| 4 | Minor | Short-term limitation | 30-day notice period for termination |
| 5 | Moderate | Noticeable effect on career | Auto IP assignment for work during employment |
| 6 | Moderate | Meaningful financial impact | Late payment penalties exceeding standard |
| 7 | Serious | Significant career restriction | 12-month non-compete in specific geography |
| 8 | Serious | Major financial loss | 18-month non-compete across entire industry |
| 9 | Severe | Career-damaging | Unlimited personal liability with broad indemnity |
| 10 | Severe | Can destroy future opportunities | Multi-year non-compete + IP assignment + unlimited liability combined |

---

## Factor 2 — Legal Strength (35%)

**Definition:** How enforceable is this clause under Indian law?

> **IMPORTANT:** Higher Legal Strength = MORE enforceable = HIGHER risk when combined with high Harm Potential.

| Score | Level | Description | Example |
|-------|-------|-------------|---------|
| 1 | Unenforceable | Explicitly void under Indian law | Non-compete for employees (Section 27, Indian Contract Act) |
| 2 | Unenforceable | Clear judicial precedent against | Excessive bond without consideration |
| 3 | Weak | Partially conflicts with law | Overly broad non-solicitation post-employment |
| 4 | Weak | Likely challenged successfully | Excessive bond period without proportional training |
| 5 | Uncertain | Ambiguous, depends on interpretation | Broad IP clause with unclear scope |
| 6 | Uncertain | Case-by-case basis | Confidentiality covering general knowledge |
| 7 | Strong | Clear statutory basis | Reasonable NDA with defined scope and duration |
| 8 | Strong | Well-drafted and enforceable | Standard payment terms with milestones |
| 9 | Very Strong | Fully compliant, well-structured | Properly defined dispute resolution clause |
| 10 | Very Strong | Ironclad under Indian law | Standard terms with full statutory compliance |

---

## Factor 3 — Practical Likelihood (25%)

**Definition:** How likely is this clause to actually be invoked against the user in a real-world scenario?

| Score | Level | Description | Example |
|-------|-------|-------------|---------|
| 1 | Very Unlikely | Almost never invoked | Non-solicitation in junior internship |
| 2 | Very Unlikely | Rare, exists as deterrent | Force majeure clause |
| 3 | Low | Rarely invoked | Termination-for-cause in standard employment |
| 4 | Low | Unusual circumstances only | Indemnity for third-party IP claims |
| 5 | Moderate | Invoked sometimes | Late payment penalties in freelance work |
| 6 | Moderate | Meaningful percentage | IP ownership disputes in tech consulting |
| 7 | High | Frequently invoked | Non-compete notices sent to departing employees |
| 8 | High | Common source of disputes | Payment delay in milestone-based contracts |
| 9 | Almost Certain | Very high probability | Auto-renewal without cancellation option |
| 10 | Almost Certain | Will definitely affect user | Immediate termination without notice clause |

---

## Calculation

### Step-by-Step

```typescript
function calculateRiskScore(
  harmPotential: number,       // 1–10
  legalStrength: number,       // 1–10
  practicalLikelihood: number  // 1–10
): {
  rawWeightedScore: number;
  finalRiskScore: number;
  riskLevel: string;
} {
  // Step 1: Calculate weighted sum
  const rawWeightedScore = 
    (harmPotential * 0.40) + 
    (legalStrength * 0.35) + 
    (practicalLikelihood * 0.25);

  // Step 2: Normalize to 0–100
  const finalRiskScore = Math.round(rawWeightedScore * 10);

  // Step 3: Classify risk level
  let riskLevel: string;
  if (finalRiskScore <= 25) riskLevel = 'low';
  else if (finalRiskScore <= 50) riskLevel = 'medium';
  else if (finalRiskScore <= 75) riskLevel = 'high';
  else riskLevel = 'critical';

  return { rawWeightedScore, finalRiskScore, riskLevel };
}
```

### Score Ranges

| Score Range | Risk Level | Color | Icon | User Action |
|-------------|-----------|-------|------|-------------|
| 0–25 | 🟢 Low Risk | `#22c55e` | ✅ | No action needed |
| 26–50 | 🟡 Medium Risk | `#eab308` | ⚠️ | Review recommended |
| 51–75 | 🟠 High Risk | `#f97316` | 🔶 | Negotiate before signing |
| 76–100 | 🔴 Critical Risk | `#ef4444` | 🚫 | Seek legal advice |

---

## Worked Examples

### Example 1: Broad Non-Compete (Employment)

| Factor | Score | Reasoning |
|--------|-------|-----------|
| Harm Potential | 8 | 2-year industry ban severely impacts career |
| Legal Strength | 3 | Unenforceable under Section 27, Indian Contract Act |
| Practical Likelihood | 5 | Some companies send legal notices |

```
Score = (8 × 0.40) + (3 × 0.35) + (5 × 0.25)
     = 3.20 + 1.05 + 1.25
     = 5.50 → 55/100 → 🟠 High Risk
```

### Example 2: Standard 30-Day Notice Period

| Factor | Score | Reasoning |
|--------|-------|-----------|
| Harm Potential | 3 | Minor inconvenience, industry standard |
| Legal Strength | 8 | Fully enforceable, well-drafted |
| Practical Likelihood | 4 | Most exits are amicable |

```
Score = (3 × 0.40) + (8 × 0.35) + (4 × 0.25)
     = 1.20 + 2.80 + 1.00
     = 5.00 → 50/100 → 🟡 Medium Risk
```

### Example 3: Unlimited Personal Liability

| Factor | Score | Reasoning |
|--------|-------|-----------|
| Harm Potential | 10 | Could result in financial ruin |
| Legal Strength | 7 | Generally enforceable if agreed |
| Practical Likelihood | 3 | Rarely invoked for individual contributors |

```
Score = (10 × 0.40) + (7 × 0.35) + (3 × 0.25)
     = 4.00 + 2.45 + 0.75
     = 7.20 → 72/100 → 🟠 High Risk
```

### Example 4: Auto-Renewal Subscription

| Factor | Score | Reasoning |
|--------|-------|-----------|
| Harm Potential | 6 | Unexpected charges |
| Legal Strength | 8 | Legally binding if disclosed |
| Practical Likelihood | 9 | Almost certain to trigger |

```
Score = (6 × 0.40) + (8 × 0.35) + (9 × 0.25)
     = 2.40 + 2.80 + 2.25
     = 7.45 → 75/100 → 🟠 High Risk
```

---

## Why This System is Fair

1. **Multi-dimensional** — Three independent factors prevent oversimplification
2. **Weighted by user impact** — Harm matters most to the person signing
3. **Grounded in debate** — Scores emerge from adversarial reasoning, not single-pass generation
4. **Fully auditable** — Users see every factor, score, and justification
5. **Calibrated by legal reality** — Unenforceable but scary clauses don't cause panic
6. **Transparent formula** — Users can verify the math themselves

---

## Implementation Notes

- The Neutral Judge outputs the factor scores as part of its structured JSON response
- The `calculateRiskScore` function should be implemented in `src/lib/scoring.ts`
- The frontend `ScoreBreakdown` component visualizes the three factors
- Enkrypt AI Checkpoint 3 verifies arithmetic consistency of scores
