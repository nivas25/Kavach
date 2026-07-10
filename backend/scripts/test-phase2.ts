import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { qdrantSearchTool } from '../src/mastra/tools/qdrantSearchTool';
import { webSearchTool } from '../src/mastra/tools/webSearchTool';
import { xSearchTool } from '../src/mastra/tools/xSearchTool';
import { redditSearchTool } from '../src/mastra/tools/redditSearchTool';

async function testTools() {
  console.log("=== KAVACH PHASE 2: TOOLS TEST ===");

  try {
    // 1. Test Web Search
    console.log("\n🔍 Testing Web Search Tool...");
    const webResult = await webSearchTool.execute!({ query: "latest supreme court ruling on non-compete clauses 2026" }, {} as any);
    console.log("Result (Web):", JSON.stringify(webResult, null, 2));

    // 2. Test X (Twitter) Search
    console.log("\n🔍 Testing X (Twitter) Search Tool...");
    const xResult = await xSearchTool.execute!({ query: "Adobe terms of service complaints" }, {} as any);
    console.log("Result (X):", JSON.stringify(xResult, null, 2));

    // 3. Test Reddit Search
    console.log("\n🔍 Testing Reddit Search Tool...");
    const redditResult = await redditSearchTool.execute!({ query: "forced arbitration clause employment contract" }, {} as any);
    console.log("Result (Reddit):", JSON.stringify(redditResult, null, 2));

    // 4. Test Qdrant Search
    // Note: This might return empty if the Qdrant DB hasn't been seeded yet, 
    // but the connection and embedding generation should still succeed.
    console.log("\n🔍 Testing Qdrant Search Tool...");
    const qdrantResult = await qdrantSearchTool.execute!({ query: "What is the standard liability cap in a SaaS agreement?" }, {} as any);
    console.log("Result (Qdrant):", JSON.stringify(qdrantResult, null, 2));

    console.log("\n🎉 ALL 4 TOOLS EXECUTED SUCCESSFULLY 🎉");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ TOOL TEST FAILED:");
    console.error(error);
    process.exit(1);
  }
}

testTools();
