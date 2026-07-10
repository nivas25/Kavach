import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { enkryptService } from '../../services/enkryptService';

export const xSearchTool = createTool({
  id: 'xSearch',
  description: 'Searches X (Twitter) for recent discussions, complaints, or public sentiment about specific companies or contract clauses using Tavily.',
  inputSchema: z.object({
    query: z.string().describe('The topic or company to search for on X.')
  }),
  execute: async ({ query }: any) => {
    try {
      console.log(`[XSearchTool] Enkrypt AI checking query: "${query}"`);
      const securityCheck = await enkryptService.checkToolCall(query);
      if (securityCheck.isBlocked) {
        console.warn(`[XSearchTool] Blocked by Enkrypt AI: ${securityCheck.reason}`);
        return `Security Violation: Query blocked by Enkrypt AI guardrails. Reason: ${securityCheck.reason}`;
      }

      const fullQuery = `site:twitter.com OR site:x.com ${query}`;
      console.log(`[XSearchTool] Searching X via Tavily for: "${fullQuery}"`);
      
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        throw new Error('TAVILY_API_KEY is missing');
      }

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: fullQuery,
          search_depth: 'basic',
          include_answer: false,
          include_images: false,
          include_raw_content: false,
          max_results: 5,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Tavily API error (${response.status}): ${errorData}`);
      }

      const data = await response.json();
      
      if (!data.results || data.results.length === 0) {
        return "No relevant discussions found on X.";
      }

      return data.results.map((res: any) => ({
        title: res.title,
        content: res.content,
        url: res.url
      }));
    } catch (error: any) {
      console.error("[XSearchTool] Error:", error.message);
      return `X search failed: ${error.message}`;
    }
  }
});
