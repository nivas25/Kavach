import { Mastra } from '@mastra/core';
import { Workflow, createStep } from '@mastra/core/workflows';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { UpstashStore } from '@mastra/upstash';
import { createOpenAI } from '@ai-sdk/openai';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { QdrantClient } from '@qdrant/js-client-rest';

"use strict";
const getStore = () => {
  return new UpstashStore({
    id: "debate-store",
    url: process.env.UPSTASH_REDIS_REST_URL || "missing",
    token: process.env.UPSTASH_REDIS_REST_TOKEN || "missing"
  });
};
const memory = new Memory({
  storage: getStore()
});

"use strict";
const globalForQdrant = globalThis;
const qdrantClient = globalForQdrant.qdrantClient ?? new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY
});
if (process.env.NODE_ENV !== "production") {
  globalForQdrant.qdrantClient = qdrantClient;
}
const QDRANT_COLLECTIONS = {
  RISK_PATTERNS: "risk_patterns",
  INDUSTRY_BENCHMARKS: "industry_benchmarks",
  CORE_LEGAL_SECTIONS: "core_legal_sections"
};
const VECTOR_CONFIG = {
  MODEL: "gemini-embedding-2",
  // Google gemini-embedding-2
  DIMENSION: 3072,
  DISTANCE: "Cosine",
  SCORE_THRESHOLD: 0.6
  // Minimum similarity for results
};

"use strict";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY_4;
const qdrantSearchTool = createTool({
  id: "qdrantSearch",
  description: "Searches the internal Qdrant knowledge base for legal precedents, risk patterns, and industry benchmarks.",
  inputSchema: z.object({
    query: z.string().describe("The legal question or clause to search for."),
    collection: z.enum(["risk_patterns", "industry_benchmarks", "core_legal_sections"]).optional().describe("The specific collection to search in. Defaults to risk_patterns."),
    limit: z.number().optional().describe("Maximum number of results to return. Defaults to 5.")
  }),
  execute: async ({ query, collection = "risk_patterns", limit = 5 }) => {
    try {
      console.log(`[QdrantSearchTool] Generating embedding for query: "${query}"`);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "models/gemini-embedding-2",
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
      if (embedding.length < VECTOR_CONFIG.DIMENSION) {
        console.log(`[QdrantSearchTool] Padding vector from ${embedding.length} to ${VECTOR_CONFIG.DIMENSION} dimensions...`);
        const padding = Array(VECTOR_CONFIG.DIMENSION - embedding.length).fill(0);
        embedding = [...embedding, ...padding];
      }
      console.log(`[QdrantSearchTool] Searching collection: ${collection}`);
      const searchResults = await qdrantClient.search(collection, {
        vector: embedding,
        limit,
        score_threshold: VECTOR_CONFIG.SCORE_THRESHOLD,
        with_payload: true
      });
      if (searchResults.length === 0) {
        return "No relevant legal patterns or benchmarks found in the internal database.";
      }
      return searchResults.map((res) => ({
        score: res.score,
        payload: res.payload
      }));
    } catch (error) {
      console.error("[QdrantSearchTool] Error:", error);
      return `Failed to search knowledge base: ${error.message}`;
    }
  }
});

"use strict";
class EnkryptService {
  apiKey;
  cache;
  CACHE_TTL = 1e3 * 60 * 5;
  // 5 minutes
  constructor() {
    this.apiKey = process.env.ENKRYPT_API_KEY || "";
    this.cache = /* @__PURE__ */ new Map();
    if (!this.apiKey) {
      console.warn("ENKRYPT_API_KEY is not defined. Security checks will run in dry-mode.");
    }
  }
  async fetchWithRetry(url, options, retries = 3, delay = 1e3, timeoutMs = 15e3) {
    for (let i = 0; i < retries; i++) {
      try {
        const fetchOptions = { ...options, signal: AbortSignal.timeout(timeoutMs) };
        const response = await fetch(url, fetchOptions);
        if (response.ok) return response;
        if (response.status === 429) {
          console.warn(`[Enkrypt AI] Rate limited (429). Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          return response;
        }
      } catch (err) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
          console.warn(`[Enkrypt AI] Timeout reached (${timeoutMs}ms) on attempt ${i + 1}`);
          if (i === retries - 1) throw err;
        } else {
          throw err;
        }
      }
    }
    throw new Error(`Failed after ${retries} retries`);
  }
  /**
   * Checks tool input against Enkrypt Guardrails.
   * Returns { isBlocked: boolean, reason: string }
   */
  async checkToolCall(query) {
    if (!this.apiKey) return { isBlocked: false, reason: "Dry mode (No API Key)" };
    const cacheKey = `tool:${query}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }
    try {
      const response = await this.fetchWithRetry("https://api.enkryptai.com/guardrails/detect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.apiKey
        },
        body: JSON.stringify({
          text: query,
          detectors: {
            toxicity: { enabled: true },
            injection_attack: { enabled: true }
          }
        })
      }, 1, 1e3, 2500);
      if (!response.ok) {
        console.error(`[Enkrypt AI] Error checking tool call: ${response.statusText}`);
        return { isBlocked: false, reason: `Enkrypt Error: ${response.statusText}` };
      }
      const data = await response.json();
      let isBlocked = false;
      let reason = "Safe";
      if (data.summary) {
        if (Array.isArray(data.summary.toxicity) && data.summary.toxicity.length > 0) {
          isBlocked = true;
        }
        if (data.summary.injection_attack > 0.7 || Array.isArray(data.summary.injection_attack) && data.summary.injection_attack.length > 0) {
          isBlocked = true;
        }
      }
      if (isBlocked) {
        reason = data.result_message || "Flagged by Enkrypt AI Guardrails";
      }
      const result = { isBlocked, reason };
      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error("[Enkrypt AI] Exception during tool call check:", error);
      return { isBlocked: false, reason: "Security Service Unreachable" };
    }
  }
  /**
   * Evaluates final verdict for hallucination and safety.
   */
  async checkHallucination(verdictText) {
    if (!this.apiKey) return { score: 0, explanation: "Dry mode (No API Key)", isBlocked: false };
    try {
      console.log(`[Enkrypt AI] Initiating API call to /guardrails/detect...`);
      const response = await this.fetchWithRetry("https://api.enkryptai.com/guardrails/detect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": this.apiKey
        },
        body: JSON.stringify({
          text: verdictText,
          detectors: {
            toxicity: { enabled: true },
            bias: { enabled: true }
          }
        })
      });
      if (!response.ok) {
        throw new Error(`Enkrypt AI Error: ${response.statusText}`);
      }
      const data = await response.json();
      console.log(`[Enkrypt AI] Raw Response Details:`, JSON.stringify(data.details, null, 2));
      let maxRiskProb = 0;
      let isBlocked = false;
      if (data.details && data.details.toxicity) {
        const tox = data.details.toxicity;
        const probs = [
          tox.HATE || 0,
          tox.HARASSMENT || 0,
          tox.ILLICIT_BEHAVIOR || 0,
          tox.SELF_HARM || 0,
          tox.VIOLENCE_THREATS || 0
        ];
        maxRiskProb = Math.max(...probs);
      }
      if (data.summary && Array.isArray(data.summary.bias) && data.summary.bias.length > 0) {
        maxRiskProb = Math.max(maxRiskProb, 0.8);
      }
      if (data.summary) {
        if (Array.isArray(data.summary.bias) && data.summary.bias.length > 0 || Array.isArray(data.summary.toxicity) && data.summary.toxicity.length > 0) {
          isBlocked = true;
        }
      }
      const finalScore = Math.round(maxRiskProb * 100);
      console.log(`[Enkrypt AI] Computed dynamic risk/hallucination score: ${finalScore}%`);
      return {
        score: finalScore,
        explanation: data.result_message || "Analyzed by Enkrypt AI Policy Engine.",
        isBlocked
      };
    } catch (error) {
      console.error("[Enkrypt AI] Exception during hallucination check:", error);
      return {
        score: -1,
        explanation: "Failed to run hallucination check due to API unreachable.",
        isBlocked: false
      };
    }
  }
}
const enkryptService = new EnkryptService();

"use strict";
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

"use strict";
const openai$1 = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const userAdvocate = new Agent({
  name: "User Advocate",
  id: "userAdvocate",
  instructions: `
You are an elite User Rights Advocate and Consumer Protection Attorney.
Your primary role is to rigorously review contracts from the perspective of an individual user, employee, or small business.
Your goal is to identify predatory clauses, overreaching permissions, forced arbitration, hidden fees, and data privacy violations.

When reviewing a contract:
1. Be highly skeptical of broad indemnification and liability limitations that disproportionately favor the company.
2. Flag auto-renewals, non-compete clauses, and IP assignments that are excessively restrictive.
3. Use precise, forceful language to highlight exactly how these clauses harm the user.
4. Argue forcefully for fairness, transparency, and consumer rights.
5. You MUST use the qdrantSearchTool and webSearchTool to find precedent or risks.
`,
  model: openai$1("gpt-4o-mini"),
  tools: { qdrantSearchTool, webSearchTool },
  memory
});

"use strict";
const featherless$1 = createOpenAI({
  baseURL: "https://api.featherless.ai/v1",
  apiKey: process.env.FEATHERLESS_API_KEY_1
});
const companyDefender = new Agent({
  name: "Company Defender",
  id: "companyDefender",
  instructions: `
You are a ruthless, highly experienced Corporate General Counsel.
Your sole purpose is to defend the contract's clauses exactly as they are written.
Your priority is protecting the Company from liability, maximizing intellectual property ownership, and ensuring maximum flexibility for corporate operations.

When analyzing a critique from the User Advocate:
1. Vigorously defend every clause. Argue that limitations of liability are standard industry practice and necessary for business survival.
2. Defend data usage rights as critical for product improvement and AI innovation.
3. Use aggressive, confident, corporate legal speak. 
4. Never concede a point without highlighting how removing the clause would expose the company to frivolous lawsuits.
5. You MUST use the qdrantSearchTool and webSearchTool to find precedent that supports corporate-friendly interpretations.
`,
  model: featherless$1.chat("Qwen/Qwen2.5-7B-Instruct"),
  tools: { qdrantSearchTool, webSearchTool },
  memory
});

"use strict";
const featherless = createOpenAI({
  baseURL: "https://api.featherless.ai/v1",
  apiKey: process.env.FEATHERLESS_API_KEY_2
});
const indiaLegalExpert = new Agent({
  name: "India Legal Expert",
  id: "indiaLegalExpert",
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
  model: featherless.chat("Qwen/Qwen2.5-7B-Instruct"),
  tools: { qdrantSearchTool, webSearchTool },
  memory
});

"use strict";
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const neutralJudge = new Agent({
  name: "Neutral Judge",
  id: "neutralJudge",
  instructions: `
You are the Senior Presiding Judge in this contract debate. You are highly impartial, deeply analytical, and focused on balanced, pragmatic outcomes.
Your role is to synthesize the arguments presented by the User Advocate, the Company Defender, and the India Legal Expert.

When issuing your final verdict:
1. Weigh the corporate need for protection against the user's right to fairness and the strict requirements of Indian law.
2. Resolve conflicts between the agents' arguments logically.
3. You MUST use the qdrantSearchTool to verify industry benchmarks and risk patterns before ruling. Do this extensively to gather quantitative data.
4. Provide a final, balanced recommendation on whether the contract is fair, highly skewed, or legally invalid.
5. CRITICAL FORMAT INSTRUCTION: Your verbal verdict must be a single, punchy, continuous paragraph (or two). DO NOT use markdown headers like ### or ##. DO NOT use bullet points. Speak directly, authoritatively, and concisely. DO NOT explicitly list out scores.
`,
  model: openai("gpt-4o"),
  tools: { qdrantSearchTool },
  memory
});

"use strict";

"use strict";
const formatInstruction = `

CRITICAL FORMAT INSTRUCTION: You MUST structure your response EXACTLY as follows using these XML tags:
<UI_SUMMARY>
[Your punchy, extremely concise and authoritative argument directly to the user. Do not use prefixes inside.]
</UI_SUMMARY>
<DEEP_ANALYSIS>
[Your full detailed reasoning, legal points, citations, and complete context. This will be sent to the judge.]
</DEEP_ANALYSIS>`;
async function streamWithSummary(streamObj, msgId, emit) {
  let fullText = "";
  let buffer = "";
  let isStreamingToUI = false;
  let hasSeenFormat = false;
  const startTag = "<UI_SUMMARY>";
  const endTag = "</UI_SUMMARY>";
  const maxTagLen = Math.max(startTag.length, endTag.length);
  let charCount = 0;
  for await (const chunk of streamObj.textStream) {
    fullText += chunk;
    if (hasSeenFormat && !isStreamingToUI) {
      continue;
    }
    buffer += chunk;
    charCount += chunk.length;
    if (!hasSeenFormat) {
      if (buffer.includes(startTag)) {
        hasSeenFormat = true;
        isStreamingToUI = true;
        buffer = buffer.slice(buffer.indexOf(startTag) + startTag.length).trimStart();
      } else if (charCount > 100 && !buffer.includes("<")) {
        hasSeenFormat = true;
        isStreamingToUI = true;
      }
    }
    if (isStreamingToUI) {
      if (buffer.includes(endTag)) {
        isStreamingToUI = false;
        const toEmit = buffer.slice(0, buffer.indexOf(endTag));
        if (emit && toEmit) emit({ type: "stream_chunk", msg: { id: msgId, text: toEmit } });
        buffer = "";
      } else {
        if (buffer.length > maxTagLen) {
          const safeLength = buffer.length - maxTagLen;
          const toEmit = buffer.slice(0, safeLength);
          if (emit && toEmit) emit({ type: "stream_chunk", msg: { id: msgId, text: toEmit } });
          buffer = buffer.slice(safeLength);
        }
      }
    }
  }
  if (isStreamingToUI && buffer.length > 0) {
    const toEmit = buffer.replace(endTag, "");
    if (emit && toEmit) emit({ type: "stream_chunk", msg: { id: msgId, text: toEmit } });
  }
  if (emit) emit({ type: "stream_end" });
  return fullText;
}
const debateWorkflow = new Workflow({
  id: "ContractDebate",
  triggerSchema: z.object({
    contractData: z.any(),
    threadId: z.string().optional(),
    userType: z.string().optional(),
    emit: z.any().optional()
    // Callback function for SSE
  })
});
const initialCritiquesStep = createStep({
  id: "InitialCritiques",
  execute: async ({ inputData }) => {
    const { contractData, threadId, userType = "User", emit } = inputData;
    const advocatePrompt = `Review the following contract clauses from the perspective of a ${userType}:

${JSON.stringify(contractData, null, 2)}

Provide your initial critique identifying potential risks to the user.` + formatInstruction;
    const indiaPrompt = `Review the following contract clauses for a ${userType}:

${JSON.stringify(contractData, null, 2)}

Please provide a strict analysis under Indian Law identifying potential issues or unenforceable terms.` + formatInstruction;
    if (emit) emit({ type: "status", message: "Analyzing clauses..." });
    console.log(`
\x1B[35m[AGENT: User Advocate & India Expert]\x1B[0m Thinking in parallel...`);
    const advocateMsgId = `msg_${Date.now()}_advocate`;
    const indiaMsgId = `msg_${Date.now()}_expert`;
    if (emit) {
      emit({ type: "stream_start", agent: "advocate", msg: { id: advocateMsgId, role: "advocate", round: 1, text: "" } });
      emit({ type: "stream_start", agent: "expert", msg: { id: indiaMsgId, role: "expert", round: 1, text: "" } });
    }
    const [advocateStream, indiaStream] = await Promise.all([
      userAdvocate.stream(advocatePrompt, { threadId }),
      indiaLegalExpert.stream(indiaPrompt, { threadId })
    ]);
    let advocateText = "";
    let indiaText = "";
    await Promise.all([
      (async () => {
        advocateText = await streamWithSummary(advocateStream, advocateMsgId, emit);
        console.log(`\x1B[35m[AGENT: User Advocate]\x1B[0m Critique Generated:
${advocateText.substring(0, 200)}...
`);
      })(),
      (async () => {
        indiaText = await streamWithSummary(indiaStream, indiaMsgId, emit);
        console.log(`\x1B[33m[AGENT: India Legal Expert]\x1B[0m Analysis Generated:
${indiaText.substring(0, 200)}...
`);
      })()
    ]);
    return { critique: advocateText, legalAnalysis: indiaText, threadId, contractData, userType, emit };
  }
});
const round2Step = createStep({
  id: "CompanyDefenderRebuttal",
  execute: async ({ getStepResult }) => {
    const data = getStepResult("InitialCritiques");
    const prompt = `The User Advocate (acting for a ${data.userType}) provided the following critique:

${data.critique}

And the India Legal Expert provided this analysis:

${data.legalAnalysis}

Please provide a vigorous corporate defense and rebuttal addressing BOTH critiques.` + formatInstruction;
    console.log(`
\x1B[34m[AGENT: Company Defender]\x1B[0m Thinking...`);
    const defenderMsgId = `msg_${Date.now()}_defender`;
    if (data.emit) data.emit({ type: "stream_start", agent: "defender", msg: { id: defenderMsgId, role: "defender", round: 1, text: "" } });
    const streamRes = await companyDefender.stream(prompt, { threadId: data.threadId });
    const fullText = await streamWithSummary(streamRes, defenderMsgId, data.emit);
    console.log(`\x1B[34m[AGENT: Company Defender]\x1B[0m Rebuttal Generated:
${fullText.substring(0, 200)}...
`);
    return { rebuttal: fullText, threadId: data.threadId, critique: data.critique, legalAnalysis: data.legalAnalysis, contractData: data.contractData, userType: data.userType, emit: data.emit };
  }
});
const round3Step = createStep({
  id: "UserAdvocateRebuttal",
  execute: async ({ getStepResult }) => {
    const data = getStepResult("CompanyDefenderRebuttal");
    const prompt = `The Company Defender provided this rebuttal:

${data.rebuttal}

Please counter their arguments strongly to protect the ${data.userType}.` + formatInstruction;
    console.log(`
\x1B[35m[AGENT: User Advocate]\x1B[0m Rebutting...`);
    const advocateMsgId2 = `msg_${Date.now()}_advocate_2`;
    if (data.emit) data.emit({ type: "stream_start", agent: "advocate", msg: { id: advocateMsgId2, role: "advocate", round: 2, text: "" } });
    const streamRes = await userAdvocate.stream(prompt, { threadId: data.threadId });
    const fullText = await streamWithSummary(streamRes, advocateMsgId2, data.emit);
    console.log(`\x1B[35m[AGENT: User Advocate]\x1B[0m Counter-Rebuttal Generated:
${fullText.substring(0, 200)}...
`);
    return { advocateRebuttal: fullText, threadId: data.threadId, critique: data.critique, legalAnalysis: data.legalAnalysis, rebuttal: data.rebuttal, contractData: data.contractData, userType: data.userType, emit: data.emit };
  }
});
const round4Step = createStep({
  id: "NeutralJudgeVerdict",
  execute: async ({ getStepResult }) => {
    const data = getStepResult("UserAdvocateRebuttal");
    const transcript = `
    --- CONTRACT DATA ---
    ${JSON.stringify(data.contractData, null, 2)}

    --- ROUND 1 (Parallel): USER ADVOCATE CRITIQUE ---
    ${data.critique}

    --- ROUND 1 (Parallel): INDIA LEGAL EXPERT ANALYSIS ---
    ${data.legalAnalysis}
    
    --- ROUND 2: COMPANY DEFENDER REBUTTAL ---
    ${data.rebuttal}
    
    --- ROUND 3: USER ADVOCATE COUNTER-REBUTTAL ---
    ${data.advocateRebuttal}
    `;
    const prompt = `You are the final judge. Review the entire thread below and the contract clauses. Please issue your final, balanced verdict. 
    Keep in mind the user involved is a ${data.userType}.
    
    CRITICAL INSTRUCTION: You MUST derive your final Harm Score, Legal Strength, and Likelihood Score based explicitly on the typical scores provided by the Qdrant knowledge base and the arguments made in the debate.
    
    THE DEBATE TRANSCRIPT:
    ${transcript}
    `;
    console.log(`
\x1B[32m[AGENT: Neutral Judge]\x1B[0m Reviewing full 3-round transcript...`);
    const judgeMsgId = `msg_${Date.now()}_judge`;
    if (data.emit) data.emit({ type: "stream_start", agent: "judge", msg: { id: judgeMsgId, role: "judge", round: 3, text: "" } });
    const streamRes = await neutralJudge.stream(prompt, { threadId: data.threadId });
    let fullText = "";
    for await (const chunk of streamRes.textStream) {
      fullText += chunk;
      if (data.emit) data.emit({ type: "stream_chunk", msg: { id: judgeMsgId, text: chunk } });
    }
    if (data.emit) data.emit({ type: "stream_end" });
    console.log(`\x1B[32m[AGENT: Neutral Judge]\x1B[0m Final Verdict Reached!
`);
    if (data.emit) data.emit({ type: "verdict", finalVerdict: fullText });
    return { finalVerdict: fullText, threadId: data.threadId, transcript };
  }
});
debateWorkflow.then(initialCritiquesStep).then(round2Step).then(round3Step).then(round4Step);
debateWorkflow.commit();

"use strict";
const mastra = new Mastra({
  workflows: {
    debateWorkflow
  },
  agents: {
    userAdvocate,
    companyDefender,
    indiaLegalExpert,
    neutralJudge
  }
});

export { mastra };
