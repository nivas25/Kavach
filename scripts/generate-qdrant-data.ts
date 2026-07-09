import * as fs from 'fs';
import * as path from 'path';

// --- Environment Loading ---
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required in .env");
  process.exit(1);
}

// --- Configuration ---
const DATA_DIR = path.resolve(__dirname, '../data/qdrant-seed');
const BATCH_SIZE = 5; // Generate 5 items per API call to ensure high quality and prevent timeouts

const GENERATION_PLAN = {
  risk_patterns: [
    { topic: "Training Bond / Bonded Employment traps", count: 9 },
    { topic: "Asymmetric Notice Period", count: 9 },
    { topic: "One-sided Confidentiality + Non-solicit", count: 9 },
    { topic: "Payment Delay + Penalty traps", count: 9 },
    { topic: "IP Assignment (overly broad)", count: 9 },
    { topic: "Dispute Resolution (unfavorable jurisdiction/arbitration)", count: 9 },
    { topic: "Force Majeure abuse", count: 9 },
    { topic: "Automatic Renewal traps", count: 9 },
    { topic: "Data Privacy & Monitoring clauses", count: 9 },
    { topic: "Non-poaching / Non-solicitation (employee side)", count: 9 }
  ],
  core_legal_sections: [
    { topic: "Indian Contract Act (Sections 10, 14, 15, 16, 17, 19, 23, 28, 56)", count: 15 },
    { topic: "Specific Relief Act (injunctions, personal skill enforcement)", count: 10 },
    { topic: "Companies Act (related to employment and director liabilities)", count: 10 },
    { topic: "Supreme Court & High Court landmark judgments on employment contracts", count: 10 }
  ],
  industry_benchmarks: [
    { topic: "Marketing & Advertising", count: 5 },
    { topic: "Design & Creative", count: 4 },
    { topic: "Sales & Business Development", count: 4 },
    { topic: "HR & Recruitment", count: 4 },
    { topic: "BPO / Customer Support", count: 5 },
    { topic: "Startups (early stage)", count: 4 },
    { topic: "Consulting", count: 5 },
    { topic: "E-commerce / Retail", count: 4 }
  ]
};

// --- LLM API Client ---
async function generateWithOpenAI(prompt: string): Promise<any[]> {
  const url = `https://api.openai.com/v1/chat/completions`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "system", content: "You are an expert legal AI. Output ONLY a valid JSON object containing an array called 'items'. Do not include markdown formatting or backticks." }, { role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API Error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  const rawJson = data.choices?.[0]?.message?.content;
  if (!rawJson) return [];
  
  try {
    const parsed = JSON.parse(rawJson);
    return parsed.items || [];
  } catch (e) {
    console.error("Failed to parse JSON:", rawJson.substring(0, 100));
    return [];
  }
}

// --- Prompts ---
function getRiskPrompt(topic: string, count: number) {
  return `Generate an array of exactly ${count} highly detailed JSON objects representing legal contract risk patterns related to: "${topic}". Focus on Indian contract law context. The output must be a valid JSON array of objects.

Each object MUST strictly follow this interface:
{
  "id": string (unique e.g. "risk_pattern_101"),
  "pattern_name": string (short title),
  "clause_category": string (e.g. "non_compete", "notice_period", "payment", "ip", "liability", "confidentiality", "termination", "dispute", "consumer", "other"),
  "contract_types": array of strings (e.g. ["employment", "freelance"]),
  "target_users": array of strings,
  "description": string,
  "why_risky": string,
  "severity": string ("critical", "high", "medium", "low"),
  "typical_harm_score": number (1-10),
  "typical_legal_strength": number (1-10),
  "typical_likelihood": number (1-10),
  "red_flag_phrases": array of strings,
  "trigger_keywords": array of strings,
  "what_to_look_for": string,
  "safer_alternative": string,
  "negotiation_leverage": string,
  "negotiation_script": string (ready-to-use reply for a freelancer/employee to push back),
  "indian_law_reference": string,
  "source": string,
  "confidence": string ("high" or "medium"),
  "last_updated": string (ISO date)
}
Output exactly like this: { "items": [ { ... } ] }
DO NOT wrap the JSON in markdown code blocks.`;
}

function getLegalPrompt(topic: string, count: number) {
  return `Generate an array of exactly ${count} highly detailed JSON objects representing core legal sections, statutes, or landmark judicial precedents in Indian Law related to: "${topic}".

Each object MUST strictly follow this interface:
{
  "id": string (unique e.g. "legal_sec_200"),
  "act_name": string,
  "act_short": string,
  "section": string (or "Precedent"),
  "title": string,
  "full_text": string,
  "plain_language_summary": string,
  "practical_implication": string,
  "common_misuse": string,
  "judicial_interpretation": string,
  "enforceability_status": string,
  "type": string ("statute", "precedent", "regulation", "guideline"),
  "clause_categories": array of strings,
  "contract_types": array of strings,
  "year": number,
  "last_amended": string or null,
  "jurisdiction": "India",
  "court": string or null,
  "case_citation": string or null,
  "keywords": array of strings,
  "related_sections": array of strings,
  "source_url": string,
  "verified": boolean
}
Output exactly like this: { "items": [ { ... } ] }
DO NOT wrap the JSON in markdown code blocks.`;
}

function getBenchmarkPrompt(topic: string, count: number) {
  return `Generate an array of exactly ${count} highly detailed JSON objects representing industry benchmarks for the following industry: "${topic}". Cover different clause types (e.g. non-compete, notice period, IP, liability).

Each object MUST strictly follow this interface:
{
  "id": string (unique e.g. "benchmark_300"),
  "industry": string (e.g. "marketing_advertising", "design_creative", "sales", "hr", "bpo", "startup", "consulting", "retail", "general"),
  "clause_type": string (e.g. "non_compete", "notice_period", "bond_training", "ip", "confidentiality", "termination", "liability", "payment", "dispute", "consumer", "other"),
  "standard_description": string,
  "typical_range": string,
  "risk_if_exceeded": string,
  "recommended_clause_language": string,
  "red_flag_language": string,
  "dimensions": array of objects { "name": string, "standard_value": string, "strict_threshold": string, "lenient_threshold": string, "notes": string },
  "contract_types": array of strings,
  "seniority_levels": array of strings,
  "source": string,
  "source_type": string ("industry_body", "aggregated_data", "expert_analysis"),
  "confidence": string ("high" or "medium"),
  "region": "India",
  "last_updated": string (ISO date),
  "applicable_company_size": string ("all", "startup", "enterprise", "mnc")
}
Output exactly like this: { "items": [ { ... } ] }
DO NOT wrap the JSON in markdown code blocks.`;
}

// --- Generator Logic ---
async function processCategory(collectionName: string, planList: any[], getPromptFn: (topic: string, count: number) => string) {
  console.log(`\n🚀 Generating data for collection: ${collectionName}`);
  const filePath = path.join(DATA_DIR, `${collectionName}.json`);
  let existingData: any[] = [];
  
  if (fs.existsSync(filePath)) {
    existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  
  let totalNew = 0;

  for (const plan of planList) {
    console.log(`  -> Generating ${plan.count} items for topic: "${plan.topic}"`);
    let generatedForTopic = 0;
    
    // Break into batches to prevent timeouts / low quality
    while (generatedForTopic < plan.count) {
      const toGenerate = Math.min(BATCH_SIZE, plan.count - generatedForTopic);
      const prompt = getPromptFn(plan.topic, toGenerate);
      
      try {
        const result = await generateWithOpenAI(prompt);
        if (result && Array.isArray(result) && result.length > 0) {
          // Re-assign random IDs to avoid collisions
          const sanitized = result.map((item, idx) => ({
            ...item,
            id: `${collectionName}_${Date.now()}_${Math.floor(Math.random() * 10000)}_${idx}`
          }));
          existingData.push(...sanitized);
          generatedForTopic += result.length;
          totalNew += result.length;
          console.log(`     ✅ Generated ${result.length} items. (Total for topic: ${generatedForTopic}/${plan.count})`);
          
          // Save incrementally
          fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
        } else {
          console.log(`     ⚠️  Empty or invalid response. Retrying batch...`);
        }
      } catch (e: any) {
        console.error(`     ❌ Error generating batch: ${e.message}`);
        if (e.message.includes('429')) {
          console.log(`     ⏳ Rate limit hit. Waiting 60 seconds...`);
          await new Promise(r => setTimeout(r, 60000));
        } else {
          await new Promise(r => setTimeout(r, 5000));
        }
      }
      
      // Delay between batches
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  console.log(`🎉 Finished ${collectionName}. Added ${totalNew} new items. New Total: ${existingData.length}`);
}

async function main() {
  console.log("Starting Kavach Qdrant Data Generation...");
  
  // 1. Generate Risk Patterns
  await processCategory('risk_patterns', GENERATION_PLAN.risk_patterns, getRiskPrompt);
  
  // 2. Generate Core Legal Sections
  await processCategory('core_legal_sections', GENERATION_PLAN.core_legal_sections, getLegalPrompt);
  
  // 3. Generate Industry Benchmarks
  await processCategory('industry_benchmarks', GENERATION_PLAN.industry_benchmarks, getBenchmarkPrompt);
  
  console.log("\n✅ All synthetic data generation complete!");
}

main().catch(console.error);
