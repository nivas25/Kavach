import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import google from 'googlethis';

export const webSearchTool = createTool({
  id: 'webSearch',
  description: 'Searches the general web for legal precedents, case laws, and news.',
  inputSchema: z.object({
    query: z.string().describe('The legal question or case to search for on the web.')
  }),
  execute: async ({ query }: any) => {
    try {
      console.log(`[WebSearchTool] Searching Google for: "${query}"`);
      
      const options = {
        page: 0, 
        safe: false, 
        parse_ads: false, 
        additional_params: { 
          hl: 'en' 
        }
      };
      
      const response = await google.search(query, options);
      
      if (!response.results || response.results.length === 0) {
        return "No relevant results found on the web.";
      }

      // Return top 5 results
      return response.results.slice(0, 5).map((res: any) => ({
        title: res.title,
        description: res.description,
        url: res.url
      }));
    } catch (error: any) {
      console.error("[WebSearchTool] Error:", error);
      return `Web search failed: ${error.message}`;
    }
  }
});
