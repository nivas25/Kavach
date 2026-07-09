// ─────────────────────────────────────────────
// Kavach — Qdrant Seed Script
// ─────────────────────────────────────────────
// Seeds all 3 Qdrant collections with curated legal knowledge.
// Run: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/seed-qdrant.ts
//
// Requirements:
//   QDRANT_URL and QDRANT_API_KEY in .env
//   GOOGLE_API_KEY in .env (for embedding generation)

import { QdrantClient } from '@qdrant/js-client-rest';
import * as fs from 'fs';
import * as path from 'path';

// ─── Load .env (no dotenv dependency) ──────
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
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
  console.log('✅ Loaded .env file');
}

// ─── Configuration ─────────────────────────

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

const VECTOR_DIMENSION = 3072; // gemini-embedding-2
const EMBEDDING_MODEL = 'gemini-embedding-2';
const BATCH_SIZE = 20; // Embeddings per batch

const COLLECTIONS = {
  RISK_PATTERNS: 'risk_patterns',
  INDUSTRY_BENCHMARKS: 'industry_benchmarks',
  CORE_LEGAL_SECTIONS: 'core_legal_sections',
};

// ─── Qdrant Client ─────────────────────────

const qdrant = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY || undefined,
});

// ─── Embedding Generation ──────────────────

interface EmbeddingResponse {
  values: number[];
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${GOOGLE_API_KEY}`;

  const requests = texts.map((text) => ({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
    taskType: 'RETRIEVAL_DOCUMENT',
  }));

  let response: Response;
  let retries = 3;
  while (true) {
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests }),
      });
      break;
    } catch (err: any) {
      if (retries > 0 && err.message && (err.message.includes('fetch failed') || err.message.includes('ENOTFOUND'))) {
        console.log(`⏳ Network disconnect on embedding. Retrying... (${retries} left)`);
        retries--;
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw err;
      }
    }
  }

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 429) {
      console.log(`⏳ Embedding Rate limit hit. Waiting 60 seconds...`);
      await new Promise(r => setTimeout(r, 60000));
      return generateEmbeddings(texts); // Retry after waiting
    }
    throw new Error(`Embedding API error: ${response.status} — ${error}`);
  }

  const data = (await response.json()) as { embeddings: EmbeddingResponse[] };
  return data.embeddings.map((e) => e.values);
}

// ─── Embedding Text Builders ───────────────
// These control what text gets embedded for each collection.
// Payload fields like full_text are stored but NOT embedded.

function buildCoreLegalEmbeddingText(entry: Record<string, unknown>): string {
  const parts = [
    entry.title,
    entry.section,
    entry.act_short,
    entry.plain_language_summary,
    entry.practical_implication,
    entry.enforceability_status,
    (entry.keywords as string[])?.join(' '),
  ];
  return parts.filter(Boolean).join(' ');
}

function buildRiskPatternEmbeddingText(entry: Record<string, unknown>): string {
  const parts = [
    entry.pattern_name,
    entry.description,
    entry.why_risky,
    entry.safer_alternative,
    entry.negotiation_script,
    (entry.trigger_keywords as string[])?.join(' '),
  ];
  return parts.filter(Boolean).join(' ');
}

function buildIndustryBenchmarkEmbeddingText(entry: Record<string, unknown>): string {
  const parts = [
    entry.industry,
    entry.clause_type,
    entry.standard_description,
    entry.risk_if_exceeded,
    entry.recommended_clause_language,
    (entry.dimensions as Array<{ name: string; standard_value: string }>)
      ?.map((d) => `${d.name} ${d.standard_value}`)
      .join(' '),
  ];
  return parts.filter(Boolean).join(' ');
}

// ─── Collection Setup ──────────────────────

async function createCollection(name: string): Promise<void> {
  // Delete if exists (idempotent)
  try {
    await qdrant.deleteCollection(name);
    console.log(`  ♻️  Deleted existing collection: ${name}`);
  } catch {
    // Collection doesn't exist, that's fine
  }

  // Create with optimized config
  await qdrant.createCollection(name, {
    vectors: {
      size: VECTOR_DIMENSION,
      distance: 'Cosine',
    },
    quantization_config: {
      scalar: {
        type: 'int8',
        quantile: 0.99,
        always_ram: true,
      },
    },
    optimizers_config: {
      indexing_threshold: 20000,
    },
  });

  console.log(`  ✅ Created collection: ${name}`);
}

async function createPayloadIndexes(name: string): Promise<void> {
  const indexConfigs: Record<string, string[]> = {
    [COLLECTIONS.RISK_PATTERNS]: [
      'clause_category',
      'severity',
    ],
    [COLLECTIONS.INDUSTRY_BENCHMARKS]: [
      'industry',
      'clause_type',
    ],
    [COLLECTIONS.CORE_LEGAL_SECTIONS]: [
      'type',
      'act_short',
      'jurisdiction',
    ],
  };

  const fields = indexConfigs[name] || [];
  for (const field of fields) {
    await qdrant.createPayloadIndex(name, {
      field_name: field,
      field_schema: 'keyword',
    });
  }

  if (fields.length > 0) {
    console.log(`  🔍 Created ${fields.length} payload indexes for: ${name}`);
  }
}

// ─── Seeding Logic ─────────────────────────

interface SeedConfig {
  collectionName: string;
  dataFile: string;
  buildEmbeddingText: (entry: Record<string, unknown>) => string;
}

async function seedCollection(config: SeedConfig): Promise<void> {
  const { collectionName, dataFile, buildEmbeddingText } = config;

  console.log(`\n📦 Seeding: ${collectionName}`);
  console.log(`   Source: ${dataFile}`);

  // 1. Load data
  const filePath = path.resolve(__dirname, '..', dataFile);
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const entries: Record<string, unknown>[] = JSON.parse(rawData);
  console.log(`   Loaded ${entries.length} entries`);

  // 2. Create collection
  await createCollection(collectionName);

  // 3. Generate embeddings in batches
  console.log(`   Generating embeddings (batch size: ${BATCH_SIZE})...`);
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);
    const embeddings = await generateEmbeddings(texts);
    allEmbeddings.push(...embeddings);

    const progress = Math.min(i + BATCH_SIZE, entries.length);
    console.log(`   Embedded ${progress}/${entries.length}`);

    // Rate limit: small delay between batches
    if (i + BATCH_SIZE < entries.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // 4. Upsert points in smaller chunks with retries to prevent ECONNRESET
  console.log(`   Upserting ${entries.length} points...`);
  const points = entries.map((entry, idx) => ({
    id: idx + 1, // Qdrant requires numeric or UUID IDs
    vector: allEmbeddings[idx],
    payload: entry,
  }));

  const UPSERT_CHUNK_SIZE = 50;
  for (let i = 0; i < points.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = points.slice(i, i + UPSERT_CHUNK_SIZE);
    
    let retries = 3;
    while (retries > 0) {
      try {
        await qdrant.upsert(collectionName, {
          wait: true,
          points: chunk,
        });
        break;
      } catch (err: any) {
        if (err.message && (err.message.includes('ECONNRESET') || err.message.includes('fetch failed'))) {
          console.log(`   ⚠️ Network disconnect on upsert. Retrying... (${retries} left)`);
          retries--;
          await new Promise(r => setTimeout(r, 2000));
          if (retries === 0) throw err;
        } else {
          throw err;
        }
      }
    }
  }

  // 5. Create payload indexes
  await createPayloadIndexes(collectionName);

  // 6. Verify
  const info = await qdrant.getCollection(collectionName);
  console.log(`   ✅ Collection "${collectionName}" — ${info.points_count} points stored`);
}

// ─── Verification ──────────────────────────

async function verifySeedQuality(): Promise<void> {
  console.log('\n🔎 Running seed verification...\n');

  // Test 1: Search core_legal_sections for non-compete
  const testQuery = 'non-compete clause employment agreement enforceability';
  const testEmbedding = (await generateEmbeddings([testQuery]))[0];

  const legalResults = await qdrant.search(COLLECTIONS.CORE_LEGAL_SECTIONS, {
    vector: testEmbedding,
    limit: 3,
    with_payload: true,
    score_threshold: 0.5,
  });

  console.log('Test 1: "non-compete enforceability" → core_legal_sections');
  for (const result of legalResults) {
    const payload = result.payload as Record<string, unknown>;
    console.log(`  [${result.score.toFixed(3)}] ${payload.section} — ${payload.title}`);
  }

  // Test 2: Search risk_patterns for IP assignment
  const testQuery2 = 'intellectual property assignment all work product';
  const testEmbedding2 = (await generateEmbeddings([testQuery2]))[0];

  const riskResults = await qdrant.search(COLLECTIONS.RISK_PATTERNS, {
    vector: testEmbedding2,
    limit: 3,
    with_payload: true,
    score_threshold: 0.5,
  });

  console.log('\nTest 2: "IP assignment work product" → risk_patterns');
  for (const result of riskResults) {
    const payload = result.payload as Record<string, unknown>;
    console.log(`  [${result.score.toFixed(3)}] ${payload.pattern_name}`);
  }

  // Test 3: Search industry_benchmarks with filter
  const testQuery3 = 'notice period standard practice';
  const testEmbedding3 = (await generateEmbeddings([testQuery3]))[0];

  const benchmarkResults = await qdrant.search(COLLECTIONS.INDUSTRY_BENCHMARKS, {
    vector: testEmbedding3,
    filter: {
      must: [{ key: 'industry', match: { value: 'information_technology' } }],
    },
    limit: 3,
    with_payload: true,
    score_threshold: 0.5,
  });

  console.log('\nTest 3: "notice period standard" → industry_benchmarks (IT only)');
  for (const result of benchmarkResults) {
    const payload = result.payload as Record<string, unknown>;
    console.log(`  [${result.score.toFixed(3)}] ${payload.industry} / ${payload.clause_type}`);
  }

  console.log('\n✅ Verification complete!\n');
}

// ─── Main ──────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     KAVACH — Qdrant Seed Script          ║');
  console.log('║     Seeding 3 collections                ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Validate environment
  if (!GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_API_KEY is not set. Required for embedding generation.');
    process.exit(1);
  }

  console.log(`Qdrant URL: ${QDRANT_URL}`);
  console.log(`API Key: ${QDRANT_API_KEY ? '✅ Set' : '⚠️  Not set (local mode)'}`);
  console.log(`Embedding Model: ${EMBEDDING_MODEL} (${VECTOR_DIMENSION}d)`);

  try {
    // Test Qdrant connection
    const collections = await qdrant.getCollections();
    console.log(`\n✅ Connected to Qdrant (${collections.collections.length} existing collections)`);
  } catch (error) {
    console.error('❌ Failed to connect to Qdrant:', error);
    process.exit(1);
  }

  // Seed all collections
  await seedCollection({
    collectionName: COLLECTIONS.CORE_LEGAL_SECTIONS,
    dataFile: 'data/qdrant-seed/core_legal_sections.json',
    buildEmbeddingText: buildCoreLegalEmbeddingText,
  });

  await seedCollection({
    collectionName: COLLECTIONS.RISK_PATTERNS,
    dataFile: 'data/qdrant-seed/risk_patterns.json',
    buildEmbeddingText: buildRiskPatternEmbeddingText,
  });

  await seedCollection({
    collectionName: COLLECTIONS.INDUSTRY_BENCHMARKS,
    dataFile: 'data/qdrant-seed/industry_benchmarks.json',
    buildEmbeddingText: buildIndustryBenchmarkEmbeddingText,
  });

  // Run verification
  await verifySeedQuality();

  console.log('╔══════════════════════════════════════════╗');
  console.log('║     ✅ All collections seeded!            ║');
  console.log('╚══════════════════════════════════════════╝');
}

main().catch((error) => {
  console.error('❌ Seed script failed:', error);
  process.exit(1);
});
