import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import google from 'googlethis';

export const redditSearchTool = createTool({
  id: 'redditSearch',
  description: 'Searches Reddit for public discussions, legal advice subreddits, or real experiences regarding unfair contract terms.',
  inputSchema: z.object({
    query: z.string().describe('The legal topic or experience to search for on Reddit.')
  }),
  execute: async ({ query }: any) => {
    try {
      const fullQuery = `site:reddit.com ${query}`;
      console.log(`[RedditSearchTool] Searching Reddit for: "${fullQuery}"`);
      
      const options = {
        page: 0, 
        safe: false, 
        parse_ads: false, 
      };
      
      const response = await google.search(fullQuery, options);
      
      if (!response.results || response.results.length === 0) {
        return "No relevant discussions found on Reddit.";
      }

      // Return top 5 results
      return response.results.slice(0, 5).map((res: any) => ({
        title: res.title,
        description: res.description,
        url: res.url
      }));
    } catch (error: any) {
      console.error("[RedditSearchTool] Error:", error);
      return `Reddit search failed: ${error.message}`;
    }
  }
});
