import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { qdrantClient, QDRANT_COLLECTIONS, VECTOR_CONFIG } from '../../lib/qdrant';

// Using a dedicated key for embeddings to avoid rate limits
const GEMINI_API_KEY = process.env.GEMINI_API_KEY_4;

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
      
      // 1. Generate embedding using Gemini REST API directly
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/gemini-embedding-2',
          content: {
            parts: [{ text: query }]
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API Error: ${response.statusText} - ${errText}`);
      }

      const data = await response.json();
      let embedding = data.embedding.values;

      // Pad the embedding to match Qdrant's expected 3072 dimensions if necessary
      if (embedding.length < VECTOR_CONFIG.DIMENSION) {
        console.log(`[QdrantSearchTool] Padding vector from ${embedding.length} to ${VECTOR_CONFIG.DIMENSION} dimensions...`);
        const padding = Array(VECTOR_CONFIG.DIMENSION - embedding.length).fill(0);
        embedding = [...embedding, ...padding];
      }

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
