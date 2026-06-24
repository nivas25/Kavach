# Benchmarking System

This document describes how Kavach benchmarks contract clauses against Indian law and industry standards, and how safer alternatives are generated.

---

## Dual Benchmarking Strategy

Every clause is compared against two reference frameworks:

1. **Indian Law Benchmark** — Is this clause legal and enforceable under Indian statutes?
2. **Industry Standard Benchmark** — Is this clause normal for the user's industry?

Both reference datasets are stored in **Qdrant** and retrieved using semantic + hybrid search.

---

## Indian Law Benchmarking

### Legal Sources in Qdrant

| Act | Key Sections | Use Case |
|-----|-------------|----------|
| Indian Contract Act, 1872 | S.10 (valid contracts), S.14 (free consent), S.16 (undue influence), S.23 (lawful object), S.27 (restraint of trade), S.56 (impossibility), S.73/74 (damages/penalties) | All contracts |
| Information Technology Act, 2000 | S.4 (legal recognition of e-records), S.10A (validity of electronic contracts), S.43A (data protection) | Digital/tech contracts |
| Industrial Disputes Act, 1947 | S.25F (retrenchment), S.25N (closure), S.25 (layoff conditions) | Employment contracts |
| Payment of Wages Act, 1936 | S.3 (responsibility for payment), S.5 (time of payment), S.7 (deductions) | Payment terms |
| Consumer Protection Act, 2019 | S.2(46) (unfair contract), S.47 (consumer rights) | Consumer agreements |
| Specific Relief Act, 1963 | S.14 (contracts not specifically enforceable) | Enforceability assessment |
| State Shops & Establishments Acts | Varies by state | Working conditions, leave, notice |

### How Benchmarking Works

```typescript
async function benchmarkAgainstLaw(
  clause: ExtractedClause
): Promise<LegalBenchmark> {
  // 1. Formulate search query from clause
  const query = generateLegalQuery(clause);
  
  // 2. Search Qdrant indian_laws collection
  const results = await qdrant.search('indian_laws', {
    vector: await embed(query),
    filter: {
      must: [
        { key: 'type', match: { value: 'statute' } },
      ],
    },
    limit: 5,
    with_payload: true,
  });
  
  // 3. Assess compliance
  const compliance = assessCompliance(clause, results);
  
  return {
    relevantLaws: results.map(r => ({
      actName: r.payload.act_name,
      section: r.payload.section,
      summary: r.payload.summary,
    })),
    compliance: compliance, // 'compliant' | 'ambiguous' | 'non_compliant'
    details: generateComplianceExplanation(clause, results),
  };
}
```

---

## Industry Standard Benchmarking

### Industry Data in Qdrant

| Data Source | Content |
|------------|---------|
| Standard contract templates | Employment, freelance, service agreements by industry |
| Industry body guidelines | NASSCOM, FICCI, CII recommendations |
| Platform norms | Common terms from major freelance platforms |
| Aggregated clause data | Typical durations, scopes, and limits by clause type |

### Industry Categories

```typescript
type IndustryCategory =
  | 'information_technology'
  | 'consulting'
  | 'manufacturing'
  | 'healthcare'
  | 'education'
  | 'finance'
  | 'media_entertainment'
  | 'retail_ecommerce'
  | 'general';
```

### How It Works

```typescript
async function benchmarkAgainstIndustry(
  clause: ExtractedClause,
  industry: IndustryCategory
): Promise<IndustryBenchmark> {
  // 1. Search Qdrant industry_standards collection
  const results = await qdrant.search('industry_standards', {
    vector: await embed(clause.originalText),
    filter: {
      must: [
        { key: 'industry', match: { value: industry } },
        { key: 'clause_type', match: { value: clause.category } },
      ],
    },
    limit: 5,
    with_payload: true,
  });
  
  // 2. Compare clause against standard
  return {
    standardPractice: summarizeStandard(results),
    deviation: assessDeviation(clause, results),
    details: generateDeviationExplanation(clause, results),
  };
}
```

---

## Benchmark Output Format

```typescript
interface BenchmarkResult {
  clauseId: string;
  
  legalBenchmark: {
    relevantLaws: Array<{
      actName: string;
      section: string;
      summary: string;
      similarity: number;  // Qdrant similarity score
    }>;
    compliance: 'compliant' | 'ambiguous' | 'non_compliant';
    details: string;
  };
  
  industryBenchmark: {
    standardPractice: string;
    deviation: 'within_norm' | 'slightly_stricter' | 'significantly_stricter';
    comparisonTable: Array<{
      dimension: string;
      yourContract: string;
      industryStandard: string;
      indianLaw: string;
    }>;
    details: string;
  };
}
```

### Example Benchmark Output

```json
{
  "clauseId": "clause-001",
  "legalBenchmark": {
    "relevantLaws": [
      {
        "actName": "Indian Contract Act, 1872",
        "section": "Section 27",
        "summary": "Every agreement by which any one is restrained from exercising a lawful profession, trade or business of any kind, is to that extent void.",
        "similarity": 0.92
      }
    ],
    "compliance": "non_compliant",
    "details": "This non-compete clause is likely void under Section 27 as it constitutes an agreement in restraint of trade."
  },
  "industryBenchmark": {
    "standardPractice": "Non-compete clauses in the Indian IT sector typically span 6-12 months and are limited to direct competitors within the employee's city.",
    "deviation": "significantly_stricter",
    "comparisonTable": [
      {
        "dimension": "Duration",
        "yourContract": "24 months",
        "industryStandard": "6-12 months",
        "indianLaw": "Generally unenforceable (Section 27)"
      },
      {
        "dimension": "Geographic Scope",
        "yourContract": "All of India",
        "industryStandard": "City or state-level",
        "indianLaw": "Must be reasonable"
      }
    ],
    "details": "This non-compete clause is significantly stricter than industry norms in duration, geographic scope, and competitor definition."
  }
}
```

---

## Safer Alternative Generation

### When to Generate

Alternatives are generated for clauses with risk level:
- 🟡 **Medium** (26–50) — 1 alternative
- 🟠 **High** (51–75) — 2 alternatives
- 🔴 **Critical** (76–100) — 2 alternatives

🟢 **Low** risk clauses do NOT get alternatives.

### Generation Rules

1. **Reduce risk factors** — Address the specific elements that drive the score up
2. **Maintain business purpose** — Keep the legitimate protection intact
3. **Align with industry norms** — Use standard language from the benchmark
4. **Remain enforceable** — Ensure the alternative works under Indian law
5. **Be commercially reasonable** — The company should be able to accept it

### Alternative Output

```typescript
interface SaferAlternative {
  clauseId: string;
  alternativeNumber: 1 | 2;
  rewrittenClause: string;
  estimatedRiskScore: number;  // What this version would score
  changesExplained: string;    // What was changed and why
  riskReduction: string;       // How this reduces risk
}
```
