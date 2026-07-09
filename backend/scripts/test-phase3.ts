import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { userAdvocate, companyDefender, indiaLegalExpert, neutralJudge } from '../src/mastra/agents';

async function testAgents() {
  console.log("=== KAVACH PHASE 3: AGENTS INITIALIZATION TEST ===\n");

  try {
    const testPrompt = "Hello! Briefly introduce yourself and tell me your primary role in analyzing a non-compete clause.";

    console.log("🤖 Testing User Advocate (Groq)...");
    const advocateResponse = await userAdvocate.generate(testPrompt);
    console.log("Response:", advocateResponse.text, "\n");

    console.log("🤖 Testing Company Defender (Groq)...");
    const defenderResponse = await companyDefender.generate(testPrompt);
    console.log("Response:", defenderResponse.text, "\n");

    console.log("🤖 Testing India Legal Expert (Gemini)...");
    const expertResponse = await indiaLegalExpert.generate(testPrompt);
    console.log("Response:", expertResponse.text, "\n");

    console.log("🤖 Testing Neutral Judge (Gemini)...");
    const judgeResponse = await neutralJudge.generate(testPrompt);
    console.log("Response:", judgeResponse.text, "\n");

    console.log("🎉 ALL 4 AGENTS INITIALIZED AND RESPONDED SUCCESSFULLY 🎉");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ AGENT TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

testAgents();
