import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { qdrantClient, QDRANT_COLLECTIONS, VECTOR_CONFIG } from '../../lib/qdrant';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini for embeddings
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2 || process.env.GEMINI_API_KEY_3 || '');

export const qdrantSearchTool = createTool({
  id: 'qdrantSearch',
  description: 'Searches the internal Qdrant knowledge base for legal precedents, risk patterns, and industry benchmarks.',
  inputSchema: z.object({
    query: z.string().describe('The legal question or clause to search for.'),
    collection: z.enum(['risk_patterns', 'industry_benchmarks', 'core_legal_sections']).optional().describe('The specific collection to search in. Defaults to risk_patterns.'),
    limit: z.number().optional().describe('Maximum number of results to return. Defaults to 5.')
  }),
  execute: async ({ query, collection = 'risk_patterns', limit = 5 }: any) => {
    try {
      
      console.log(`[QdrantSearchTool] Generating embedding for query: "${query}"`);
      
      // 1. Generate embedding for the query
      const model = genAI.getGenerativeModel({ model: "embedding-001" }); // Standard Gemini embedding model
      const result = await model.embedContent(query);
      const embedding = result.embedding.values;

      // 2. Search Qdrant
      console.log(`[QdrantSearchTool] Searching collection: ${collection}`);
      const searchResults = await qdrantClient.search(collection, {
        vector: embedding,
        limit,
        score_threshold: VECTOR_CONFIG.SCORE_THRESHOLD,
        with_payload: true,
      });

      // 3. Format and return results
      if (searchResults.length === 0) {
        return "No relevant legal patterns or benchmarks found in the internal database.";
      }

      return searchResults.map(res => ({
        score: res.score,
        payload: res.payload
      }));
    } catch (error: any) {
      console.error("[QdrantSearchTool] Error:", error);
      return `Failed to search knowledge base: ${error.message}`;
    }
  }
});
