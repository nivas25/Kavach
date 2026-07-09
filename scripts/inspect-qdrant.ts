import 'dotenv/config';
import { qdrantClient, QDRANT_COLLECTIONS } from '../src/lib/qdrant';

async function inspectQdrant() {
  console.log("\n🔍 Inspecting Qdrant Database...\n");
  
  try {
    // 1. Check connection and list collections
    const response = await qdrantClient.getCollections();
    const collections = response.collections.map(c => c.name);
    console.log(`Found ${collections.length} collections in Qdrant:`, collections.join(', '));
    console.log("\n======================================================\n");

    // 2. Iterate through our expected collections
    for (const collectionName of Object.values(QDRANT_COLLECTIONS)) {
      if (!collections.includes(collectionName)) {
        console.log(`❌ Collection "${collectionName}" is missing in the database!`);
        console.log("======================================================\n");
        continue;
      }

      // 3. Get total points count
      const info = await qdrantClient.getCollection(collectionName);
      console.log(`📦 Collection: \x1b[36m${collectionName}\x1b[0m`);
      console.log(`📊 Total Data Points: \x1b[33m${info.points_count}\x1b[0m`);
      console.log(`------------------------------------------------------`);
      console.log(`Sampling 3 entries from ${collectionName}...\n`);

      // 4. Fetch 3 sample items (without vectors to keep output clean)
      const scrollResult = await qdrantClient.scroll(collectionName, {
        limit: 3,
        with_payload: true,
        with_vector: false
      });

      // 5. Cleanly print the important fields based on which collection it is
      scrollResult.points.forEach((point, index) => {
        console.log(`  🔹 \x1b[1mEntry ${index + 1}\x1b[0m (ID: ${point.id})`);
        const p = point.payload as any;
        
        if (collectionName === QDRANT_COLLECTIONS.CORE_LEGAL_SECTIONS) {
          console.log(`     Section:     ${p.section} (${p.act_short})`);
          console.log(`     Title:       ${p.title}`);
          console.log(`     Summary:     ${p.plain_language_summary}`);
          console.log(`     Status:      ${p.enforceability_status}`);
        } 
        else if (collectionName === QDRANT_COLLECTIONS.RISK_PATTERNS) {
          console.log(`     Pattern:     ${p.pattern_name}`);
          console.log(`     Category:    ${p.clause_category}`);
          console.log(`     Severity:    ${p.severity}`);
          // Truncating alternative so it doesn't take up the whole screen
          const alt = p.safer_alternative ? p.safer_alternative.substring(0, 90) + '...' : 'N/A';
          console.log(`     Alternative: ${alt}`);
        }
        else if (collectionName === QDRANT_COLLECTIONS.INDUSTRY_BENCHMARKS) {
          console.log(`     Industry:    ${p.industry}`);
          console.log(`     Clause:      ${p.clause_type}`);
          console.log(`     Range:       ${p.typical_range}`);
          console.log(`     Risk:        ${p.risk_if_exceeded}`);
        }
        console.log('');
      });

      console.log("======================================================\n");
    }
    
    console.log("✅ Qdrant inspection successfully completed.");
    
  } catch (error: any) {
    console.error("❌ Failed to inspect Qdrant:", error.message || error);
    console.error("Please ensure your QDRANT_URL and QDRANT_API_KEY are correct.");
  }
}

inspectQdrant();
