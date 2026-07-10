import * as dotenv from 'dotenv';
import path from 'path';

// Load .env BEFORE anything else that might instantiate clients
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import fs from 'fs';
import { DocumentProcessorService } from '../src/services/documentProcessor';
import { memory } from '../src/mastra/memory';

async function runVerboseTest() {
  console.log('\n======================================================');
  console.log('   KAVACH FULL PIPELINE & DEBATE VISUALIZER');
  console.log('======================================================\n');

  try {
    const processor = new DocumentProcessorService();
    
    // 1. Read the sample contract
    const sampleFilePath = path.resolve(__dirname, '../sample-contract.txt');
    if (!fs.existsSync(sampleFilePath)) {
      throw new Error(`Sample file not found at ${sampleFilePath}`);
    }
    const fileBuffer = fs.readFileSync(sampleFilePath);
    const fileName = 'sample-contract.txt';
    
    const { supabaseAdmin } = require('../src/lib/supabase');
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    let userId;
    if (userError || !users || users.users.length === 0) {
      console.warn('⚠️ No users found. Creating a temporary test user...');
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: 'test_verbose@kavach.local',
        password: 'password123',
        email_confirm: true
      });
      if (createError) throw new Error(`Failed to create test user: ${createError.message}`);
      userId = newUser.user.id;
    } else {
      userId = users.users[0].id;
    }
    
    console.log(`[INIT] Using Test User ID: ${userId}`);
    console.log(`[INIT] Processing document... Please wait, this takes ~60-90 seconds to run all agents.\n`);
    
    // 2. Run the full pipeline
    const sessionId = await processor.processDocument(fileBuffer, fileName, userId);
    
    console.log(`\n======================================================`);
    console.log(`   PIPELINE FINISHED SUCCESSFULLY`);
    console.log(`======================================================\n`);
    
    // 4. Print final DB state
    const { data: analysis } = await supabaseAdmin
      .from('analyses')
      .select('overall_risk_score, overall_risk_level, summary')
      .eq('id', sessionId)
      .single();
      
    console.log(`======================================================`);
    console.log(`               FINAL KAVACH VERDICT`);
    console.log(`======================================================`);
    console.log(`RISK LEVEL: \x1b[1m${analysis?.overall_risk_level?.toUpperCase()}\x1b[0m`);
    console.log(`RISK SCORE: \x1b[1m${analysis?.overall_risk_score} / 100\x1b[0m`);
    console.log(`\nSUMMARY:\n${analysis?.summary}`);
    console.log(`======================================================\n`);
    
  } catch (error) {
    console.error('\n❌ SCRIPT FAILED:', error);
  }
}

runVerboseTest();
