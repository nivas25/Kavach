import * as dotenv from 'dotenv';
import path from 'path';

// Load .env BEFORE anything else that might instantiate clients
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import fs from 'fs';
import { DocumentProcessorService } from '../src/services/documentProcessor';

async function runPhase5Test() {
  console.log('=== KAVACH PHASE 5: END-TO-END PIPELINE TEST ===\n');

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
      console.warn('⚠️ No users found in Supabase auth.users. Creating a temporary test user...');
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: 'test_phase5@kavach.local',
        password: 'password123',
        email_confirm: true
      });
      if (createError) throw new Error(`Failed to create test user: ${createError.message}`);
      userId = newUser.user.id;
    } else {
      userId = users.users[0].id;
    }
    
    console.log(`Using Test User ID: ${userId}`);
    
    console.log(`\nStarting pipeline for ${fileName}...`);
    
    // 2. Run the full pipeline
    const sessionId = await processor.processDocument(fileBuffer, fileName, userId);
    
    console.log(`\n🎉 PIPELINE COMPLETED SUCCESSFULLY 🎉`);
    console.log(`Session ID: ${sessionId}`);
    
    // 3. Verify in DB
    const { data: analysis, error: dbError } = await supabaseAdmin
      .from('analyses')
      .select('*')
      .eq('id', sessionId)
      .single();
      
    if (dbError) {
      console.error('Failed to verify in Supabase:', dbError);
    } else {
      console.log('\nFinal Record in Supabase:');
      console.log(JSON.stringify(analysis, null, 2));
    }
    
  } catch (error) {
    console.error('\n❌ PIPELINE TEST FAILED:', error);
  }
}

runPhase5Test();
