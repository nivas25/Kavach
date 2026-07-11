import * as dotenv from 'dotenv';
import path from 'path';

// Load .env BEFORE anything else that might instantiate clients
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { DocumentProcessorService } from '../src/services/documentProcessor';

async function testEnkryptScore() {
  console.log("Testing Enkrypt Final Output Scoring...");
  const processor = new DocumentProcessorService();
  
  const mockVerdict = `
  Final Verdict:
  The contract is heavily skewed towards the Company. 
  Harm Score: 8
  Legal Score: 4
  Likelihood Score: 7
  The Company Defender successfully argued that data usage rights are industry standard.
  `;

  try {
    const scoreData = await processor.calculateFinalScore(mockVerdict);
    console.log("Calculated Score Data:");
    console.dir(scoreData, { depth: null });
    
    if (scoreData.enkrypt_hallucination_score !== undefined) {
      console.log(`✅ Enkrypt Hallucination Score: ${scoreData.enkrypt_hallucination_score}`);
      console.log(`✅ Enkrypt Explanation: ${scoreData.enkrypt_explanation}`);
    } else {
      console.error("❌ Enkrypt score is missing!");
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testEnkryptScore();
