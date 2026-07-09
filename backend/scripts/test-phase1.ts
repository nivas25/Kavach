import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';

// Load env before importing services
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { DocumentProcessorService } from '../src/services/documentProcessor';
import { supabaseAdmin } from '../src/lib/supabase';
import { redis } from '../src/lib/redis';

async function runTest() {
  console.log("=== KAVACH PHASE 1 TEST ===");
  
  // 1. Get a valid User ID
  const { data: users, error: userError } = await supabaseAdmin.from('profiles').select('id').limit(1);
  
  if (userError || !users || users.length === 0) {
    console.error("❌ Failed to find a valid user in the 'profiles' table. Please register a user first.");
    if (userError) console.error(userError);
    process.exit(1);
  }
  
  const userId = users[0].id;
  console.log(`✅ Using User ID: ${userId}`);

  // 2. Read Sample Document
  const samplePath = path.resolve(__dirname, '../sample-contract.txt');
  const fileBuffer = fs.readFileSync(samplePath);
  const fileName = 'sample-contract.txt';
  
  console.log(`✅ Loaded sample document: ${fileName}`);

  try {
    const processor = new DocumentProcessorService();
    
    console.log("🚀 Starting Document Processing Pipeline...");
    
    // Process Document (Parses, Extracts, Stores)
    const sessionId = await processor.processDocument(fileBuffer, fileName, userId);
    
    console.log(`✅ Pipeline Complete! Session ID: ${sessionId}`);

    // 3. Verify Redis Storage
    console.log("🔍 Verifying Redis Storage...");
    const redisDataStr = await redis.get(`doc:${sessionId}`);
    
    if (!redisDataStr) {
      throw new Error("❌ Data not found in Redis!");
    }
    const redisData = typeof redisDataStr === 'string' ? JSON.parse(redisDataStr) : redisDataStr;
    console.log("✅ Redis Data Verified.");
    
    console.log("\n=======================================================");
    console.log("📄 LLAMAPARSE EXTRACTED MARKDOWN (PREVIEW)");
    console.log("=======================================================");
    const mdPreview = redisData.markdown.substring(0, 500);
    console.log(mdPreview + (redisData.markdown.length > 500 ? "\n... [TRUNCATED]" : ""));
    console.log("=======================================================\n");

    console.log("=======================================================");
    console.log("🧠 GEMINI 2.5 PRO DYNAMIC JSON EXTRACTION");
    console.log("=======================================================");
    console.log(JSON.stringify(redisData.extractedData, null, 2));
    console.log("=======================================================\n");

    // 4. Verify Supabase Storage
    console.log("🔍 Verifying Supabase Storage...");
    const { data: supabaseData, error: sbError } = await supabaseAdmin
      .from('analyses')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sbError || !supabaseData) {
      throw new Error(`❌ Data not found in Supabase! Error: ${sbError?.message}`);
    }
    
    console.log("✅ Supabase Data Verified.");
    console.log("- Analysis ID:", supabaseData.id);
    console.log("- Overall Risk:", supabaseData.overall_risk_level);

    console.log("\n🎉 PHASE 1 TESTING SUCCESSFUL 🎉");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ PIPELINE FAILED:");
    console.error(error);
    process.exit(1);
  }
}

runTest();
