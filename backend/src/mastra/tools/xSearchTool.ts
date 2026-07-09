import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import google from 'googlethis';

export const xSearchTool = createTool({
  id: 'xSearch',
  description: 'Searches X (Twitter) for recent discussions, complaints, or public sentiment about specific companies or contract clauses.',
  inputSchema: z.object({
    query: z.string().describe('The topic or company to search for on X.')
  }),
  execute: async ({ query }: any) => {
    try {
      const fullQuery = `site:twitter.com OR site:x.com ${query}`;
      console.log(`[XSearchTool] Searching X for: "${fullQuery}"`);
      
      const options = {
        page: 0, 
        safe: false, 
        parse_ads: false, 
      };
      
      const response = await google.search(fullQuery, options);
      
      if (!response.results || response.results.length === 0) {
        return "No relevant discussions found on X.";
      }

      // Return top 5 results
      return response.results.slice(0, 5).map((res: any) => ({
        title: res.title,
        description: res.description,
        url: res.url
      }));
    } catch (error: any) {
      console.error("[XSearchTool] Error:", error);
      return `X search failed: ${error.message}`;
    }
  }
});
