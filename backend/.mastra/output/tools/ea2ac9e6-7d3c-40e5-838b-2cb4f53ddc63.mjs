import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { e as enkryptService } from '../enkryptService.mjs';

const webSearchTool = createTool({
  id: "webSearch",
  description: "Searches the general web for legal precedents, case laws, and news using Tavily.",
  inputSchema: z.object({
    query: z.string().describe("The legal question or case to search for on the web.")
  }),
  execute: async ({ query }) => {
    try {
      console.log(`[WebSearchTool] Enkrypt AI checking query: "${query}"`);
      const securityCheck = await enkryptService.checkToolCall(query);
      if (securityCheck.isBlocked) {
        console.warn(`[WebSearchTool] Blocked by Enkrypt AI: ${securityCheck.reason}`);
        return `Security Violation: Query blocked by Enkrypt AI guardrails. Reason: ${securityCheck.reason}`;
      }
      console.log(`[WebSearchTool] Searching Tavily for: "${query}"`);
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
          query,
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
        return "No relevant results found on the web.";
      }
      return data.results.map((res) => ({
        title: res.title,
        content: res.content,
        url: res.url
      }));
    } catch (error) {
      console.error("[WebSearchTool] Error:", error.message);
      return `Web search failed: ${error.message}`;
    }
  }
});

export { webSearchTool };
