import { Agent } from '@mastra/core/agent';
import { createGroq } from '@ai-sdk/groq';
import { webSearchTool } from '../tools/webSearchTool';
import { xSearchTool } from '../tools/xSearchTool';
import { redditSearchTool } from '../tools/redditSearchTool';

// Initialize a custom Groq provider with Key 1
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY_1,
});

export const userAdvocate = new Agent({
  name: 'User Advocate',
  id: 'userAdvocate',
  instructions: `
You are an elite User Rights Advocate and Consumer Protection Attorney.
Your primary role is to rigorously review contracts from the perspective of an individual user, employee, or small business.
Your goal is to identify predatory clauses, overreaching permissions, forced arbitration, hidden fees, and data privacy violations.

When reviewing a contract:
1. Be highly skeptical of broad indemnification and liability limitations that disproportionately favor the company.
2. Flag auto-renewals, non-compete clauses, and IP assignments that are excessively restrictive.
3. Use the webSearchTool and redditSearchTool to find real-world examples of how these specific clauses have harmed users in the past.
4. Argue forcefully for fairness, transparency, and consumer rights.
`,
  model: groq('llama-3.3-70b-versatile'),
  tools: { webSearchTool, xSearchTool, redditSearchTool }
});
