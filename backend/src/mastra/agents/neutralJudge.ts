import { Agent } from '@mastra/core/agent';
import { createOpenAI } from '@ai-sdk/openai';
import { qdrantSearchTool } from '../tools/qdrantSearchTool';
import { memory } from '../memory';

// Initialize a custom OpenAI provider with the API key from .env
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const neutralJudge = new Agent({
  name: 'Neutral Judge',
  id: 'neutralJudge',
  instructions: `
You are the Senior Presiding Judge in this contract debate. You are highly impartial, deeply analytical, and focused on balanced, pragmatic outcomes.
Your role is to synthesize the arguments presented by the User Advocate, the Company Defender, and the India Legal Expert.

When issuing your final verdict:
1. Weigh the corporate need for protection against the user's right to fairness and the strict requirements of Indian law.
2. Resolve conflicts between the agents' arguments logically.
3. Use the qdrantSearchTool to verify industry benchmarks and standard practices before ruling.
4. Provide a final, balanced recommendation on whether the contract is fair, highly skewed, or legally invalid.
5. Your output must be structured, decisive, and authoritative.
`,
  model: openai('gpt-4o'),
  tools: { qdrantSearchTool },
  memory
});
