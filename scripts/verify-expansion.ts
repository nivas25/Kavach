// ─────────────────────────────────────────────
// Kavach — Data Expansion Verification
// ─────────────────────────────────────────────
// Tests that the new Small Business & Consumer
// data is searchable in Qdrant via semantic queries.

import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually (same approach as seed script)
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY!;
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY,
});

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-2',
        content: { parts: [{ text }] },
        taskType: 'RETRIEVAL_QUERY',
      }),
    }
  );
  const data = await res.json() as any;
  if (!data.embedding) {
    console.error('Embedding error:', JSON.stringify(data).substring(0, 200));
    throw new Error('Failed to get embedding');
  }
  return data.embedding.values;
}

async function search(query: string, collection: string) {
  const vector = await getEmbedding(query);
  return qdrant.search(collection, { vector, limit: 3, with_payload: true });
}

async function verify() {
  console.log("\n🔎 Kavach — New Data Verification Tests\n");
  console.log("════════════════════════════════════════════\n");

  const tests = [
    {
      name: 'SaaS vendor refusing to export my data',
      query: 'SaaS vendor refusing to export my data locked in proprietary format',
      collection: 'risk_patterns',
      format: (r: any) => `${r.payload.pattern_name} [${r.payload.severity}]`,
    },
    {
      name: 'bank charging prepayment penalty on floating rate home loan',
      query: 'bank charging prepayment penalty on floating rate home loan',
      collection: 'risk_patterns',
      format: (r: any) => `${r.payload.pattern_name} [${r.payload.severity}]`,
    },
    {
      name: 'landlord not returning security deposit after vacating',
      query: 'landlord not returning security deposit after vacating rental apartment',
      collection: 'risk_patterns',
      format: (r: any) => `${r.payload.pattern_name} [${r.payload.severity}]`,
    },
    {
      name: 'e-commerce refund policy standard in India',
      query: 'e-commerce refund policy standard in India return window',
      collection: 'industry_benchmarks',
      format: (r: any) => `${r.payload.industry} / ${r.payload.clause_type}`,
    },
    {
      name: 'insurance claim settlement timeline IRDAI',
      query: 'insurance claim settlement timeline India IRDAI',
      collection: 'industry_benchmarks',
      format: (r: any) => `${r.payload.industry} / ${r.payload.clause_type}`,
    },
    {
      name: 'rental security deposit standard Bangalore',
      query: 'rental security deposit standard Bangalore apartment',
      collection: 'industry_benchmarks',
      format: (r: any) => `${r.payload.industry} / ${r.payload.clause_type}`,
    },
    {
      name: 'builder delayed possession RERA refund',
      query: 'builder delayed possession refund with interest RERA',
      collection: 'core_legal_sections',
      format: (r: any) => `${r.payload.section} — ${r.payload.title}`,
    },
    {
      name: 'dark patterns subscription trap free trial',
      query: 'dark patterns subscription trap free trial auto conversion e-commerce',
      collection: 'core_legal_sections',
      format: (r: any) => `${r.payload.section} — ${r.payload.title}`,
    },
  ];

  for (const test of tests) {
    console.log(`Test: "${test.name}" → ${test.collection}`);
    try {
      const results = await search(test.query, test.collection);
      results.forEach((r: any) => {
        console.log(`  [${r.score.toFixed(3)}] ${test.format(r)}`);
      });
    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`);
    }
    console.log('');
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log("════════════════════════════════════════════");
  console.log("✅ All verification tests complete!\n");
}

verify();
