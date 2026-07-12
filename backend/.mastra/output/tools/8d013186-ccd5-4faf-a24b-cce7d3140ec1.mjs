import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { e as enkryptService } from '../enkryptService.mjs';

const redditSearchTool = createTool({
  id: "redditSearch",
  description: "Searches Reddit for public discussions, legal advice subreddits, or real experiences regarding unfair contract terms using Tavily.",
  inputSchema: z.object({
    query: z.string().describe("The legal topic or experience to search for on Reddit.")
  }),
  execute: async ({ query }) => {
    try {
      console.log(`[RedditSearchTool] Enkrypt AI checking query: "${query}"`);
      const securityCheck = await enkryptService.checkToolCall(query);
      if (securityCheck.isBlocked) {
        console.warn(`[RedditSearchTool] Blocked by Enkrypt AI: ${securityCheck.reason}`);
        return `Security Violation: Query blocked by Enkrypt AI guardrails. Reason: ${securityCheck.reason}`;
      }
      const fullQuery = `site:reddit.com ${query}`;
      console.log(`[RedditSearchTool] Searching Reddit via Tavily for: "${fullQuery}"`);
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) {
        throw new Error("TAVILY_API_KEY is missing");
      }
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: fullQuery,
          search_depth: "basic",
          include_answer: false,
          include_images: false,
          include_raw_content: false,
          max_results: 5
        })
      });
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Tavily API error (${response.status}): ${errorData}`);
      }
      const data = await response.json();
      if (!data.results || data.results.length === 0) {
        return "No relevant discussions found on Reddit.";
      }
      return data.results.map((res) => ({
        title: res.title,
        content: res.content,
        url: res.url
      }));
    } catch (error) {
      console.error("[RedditSearchTool] Error:", error.message);
      return `Reddit search failed: ${error.message}`;
    }
  }
});

export { redditSearchTool };
