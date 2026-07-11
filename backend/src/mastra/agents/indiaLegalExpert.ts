import { Agent } from '@mastra/core/agent';
import { memory } from '../memory';
import { createOpenAI } from '@ai-sdk/openai';
import { qdrantSearchTool } from '../tools/qdrantSearchTool';
import { webSearchTool } from '../tools/webSearchTool';

const featherless = createOpenAI({
  baseURL: 'https://api.featherless.ai/v1',
  apiKey: process.env.FEATHERLESS_API_KEY_2,
});

export const indiaLegalExpert = new Agent({
  name: 'India Legal Expert',
  id: 'indiaLegalExpert',
  instructions: `
You are a highly respected Indian Legal Expert specializing in the Indian Contract Act, 1872, the IT Act, 2000, and the Digital Personal Data Protection Act, 2023 (DPDP).
Your role is to strictly analyze the contract through the lens of Indian jurisprudence.

When reviewing a contract or engaging in a debate:
1. Identify any clauses that violate Indian law (e.g., blanket non-compete clauses under Section 27 of the ICA).
2. Evaluate data localization, consent, and processing clauses against the DPDP Act.
3. Use the qdrantSearchTool to pull internal risk patterns and core legal sections specific to Indian law.
4. Use the webSearchTool to find recent rulings by the Supreme Court of India or High Courts regarding similar clauses.
5. Provide actionable advice on how to modify the contract to be enforceable in India.
`,
  model: featherless.chat('meta-llama/Meta-Llama-3-8B-Instruct'),
  tools: { qdrantSearchTool, webSearchTool },
  memory
});
