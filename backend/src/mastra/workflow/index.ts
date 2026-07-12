import { Workflow, createStep } from '@mastra/core/workflows';
import { userAdvocate, companyDefender, indiaLegalExpert, neutralJudge } from '../agents';
import { z } from 'zod';
import { memory } from '../memory';

// Memory is managed via workflow state now, so we remove manual assignment to agents

const formatInstruction = `\n\nCRITICAL FORMAT INSTRUCTION: You MUST structure your response EXACTLY as follows using these XML tags:
<UI_SUMMARY>
[Your punchy, extremely concise and authoritative argument directly to the user. Do not use prefixes inside.]
</UI_SUMMARY>
<DEEP_ANALYSIS>
[Your full detailed reasoning, legal points, citations, and complete context. This will be sent to the judge.]
</DEEP_ANALYSIS>`;

async function streamWithSummary(streamObj: any, msgId: string, emit: any) {
  let fullText = '';
  let buffer = '';
  let isStreamingToUI = false;
  let hasSeenFormat = false;

  const startTag = '<UI_SUMMARY>';
  const endTag = '</UI_SUMMARY>';
  const maxTagLen = Math.max(startTag.length, endTag.length);
  
  let charCount = 0;

  for await (const chunk of streamObj.textStream) {
    fullText += chunk;
    
    if (hasSeenFormat && !isStreamingToUI) {
      continue; // Skip processing buffer if we already sent the UI summary
    }
    
    buffer += chunk;
    charCount += chunk.length;

    if (!hasSeenFormat) {
      if (buffer.includes(startTag)) {
        hasSeenFormat = true;
        isStreamingToUI = true;
        buffer = buffer.slice(buffer.indexOf(startTag) + startTag.length).trimStart();
      } else if (charCount > 100 && !buffer.includes('<')) {
        // Fallback: if LLM didn't use tags at all after 100 chars, just stream everything
        hasSeenFormat = true;
        isStreamingToUI = true;
      }
    }

    if (isStreamingToUI) {
      if (buffer.includes(endTag)) {
        isStreamingToUI = false;
        const toEmit = buffer.slice(0, buffer.indexOf(endTag));
        if (emit && toEmit) emit({ type: 'stream_chunk', msg: { id: msgId, text: toEmit } });
        buffer = '';
      } else {
        if (buffer.length > maxTagLen) {
          const safeLength = buffer.length - maxTagLen;
          const toEmit = buffer.slice(0, safeLength);
          if (emit && toEmit) emit({ type: 'stream_chunk', msg: { id: msgId, text: toEmit } });
          buffer = buffer.slice(safeLength);
        }
      }
    }
  }

  // Flush remaining buffer if still streaming to UI
  if (isStreamingToUI && buffer.length > 0) {
    const toEmit = buffer.replace(endTag, '');
    if (emit && toEmit) emit({ type: 'stream_chunk', msg: { id: msgId, text: toEmit } });
  }

  if (emit) emit({ type: 'stream_end' });
  return fullText;
}

export const debateWorkflow = new Workflow({
  id: 'ContractDebate',
  triggerSchema: z.object({
    contractData: z.any(),
    threadId: z.string().optional(),
    userType: z.string().optional(),
    emit: z.any().optional() // Callback function for SSE
  })
} as any);

const initialCritiquesStep = createStep({
  id: 'InitialCritiques',
  execute: async ({ inputData }: any) => {
    const { contractData, threadId, userType = 'User', emit } = inputData as any;

    const advocatePrompt = `Review the following contract clauses from the perspective of a ${userType}:\n\n${JSON.stringify(contractData, null, 2)}\n\nProvide your initial critique identifying potential risks to the user.` + formatInstruction;
    const indiaPrompt = `Review the following contract clauses for a ${userType}:\n\n${JSON.stringify(contractData, null, 2)}\n\nPlease provide a strict analysis under Indian Law identifying potential issues or unenforceable terms.` + formatInstruction;

    if (emit) emit({ type: 'status', message: 'Analyzing clauses...' });
    
    console.log(`\n\x1b[35m[AGENT: User Advocate & India Expert]\x1b[0m Thinking in parallel...`);
    
    const advocateMsgId = `msg_${Date.now()}_advocate`;
    const indiaMsgId = `msg_${Date.now()}_expert`;
    
    if (emit) {
      emit({ type: 'stream_start', agent: 'advocate', msg: { id: advocateMsgId, role: 'advocate', round: 1, text: '' } });
      emit({ type: 'stream_start', agent: 'expert', msg: { id: indiaMsgId, role: 'expert', round: 1, text: '' } });
    }
    
    const [advocateStream, indiaStream] = await Promise.all([
      userAdvocate.stream(advocatePrompt, { threadId } as any),
      indiaLegalExpert.stream(indiaPrompt, { threadId } as any)
    ]);

    let advocateText = '';
    let indiaText = '';

    await Promise.all([
      (async () => {
        advocateText = await streamWithSummary(advocateStream, advocateMsgId, emit);
        console.log(`\x1b[35m[AGENT: User Advocate]\x1b[0m Critique Generated:\n${advocateText.substring(0, 200)}...\n`);
      })(),
      (async () => {
        indiaText = await streamWithSummary(indiaStream, indiaMsgId, emit);
        console.log(`\x1b[33m[AGENT: India Legal Expert]\x1b[0m Analysis Generated:\n${indiaText.substring(0, 200)}...\n`);
      })()
    ]);
    
    return { critique: advocateText, legalAnalysis: indiaText, threadId, contractData, userType, emit };
  }
} as any);

const round2Step = createStep({
  id: 'CompanyDefenderRebuttal',
  execute: async ({ getStepResult }: any) => {
    const data: any = getStepResult('InitialCritiques');
    const prompt = `The User Advocate (acting for a ${data.userType}) provided the following critique:\n\n${data.critique}\n\nAnd the India Legal Expert provided this analysis:\n\n${data.legalAnalysis}\n\nPlease provide a vigorous corporate defense and rebuttal addressing BOTH critiques.` + formatInstruction;

    console.log(`\n\x1b[34m[AGENT: Company Defender]\x1b[0m Thinking...`);
    
    const defenderMsgId = `msg_${Date.now()}_defender`;
    if (data.emit) data.emit({ type: 'stream_start', agent: 'defender', msg: { id: defenderMsgId, role: 'defender', round: 1, text: '' } });

    const streamRes = await companyDefender.stream(prompt, { threadId: data.threadId } as any);
    const fullText = await streamWithSummary(streamRes, defenderMsgId, data.emit);

    console.log(`\x1b[34m[AGENT: Company Defender]\x1b[0m Rebuttal Generated:\n${fullText.substring(0, 200)}...\n`);
    
    return { rebuttal: fullText, threadId: data.threadId, critique: data.critique, legalAnalysis: data.legalAnalysis, contractData: data.contractData, userType: data.userType, emit: data.emit };
  }
} as any);

const round3Step = createStep({
  id: 'UserAdvocateRebuttal',
  execute: async ({ getStepResult }: any) => {
    const data: any = getStepResult('CompanyDefenderRebuttal');
    const prompt = `The Company Defender provided this rebuttal:\n\n${data.rebuttal}\n\nPlease counter their arguments strongly to protect the ${data.userType}.` + formatInstruction;

    console.log(`\n\x1b[35m[AGENT: User Advocate]\x1b[0m Rebutting...`);
    
    const advocateMsgId2 = `msg_${Date.now()}_advocate_2`;
    if (data.emit) data.emit({ type: 'stream_start', agent: 'advocate', msg: { id: advocateMsgId2, role: 'advocate', round: 2, text: '' } });

    const streamRes = await userAdvocate.stream(prompt, { threadId: data.threadId } as any);
    const fullText = await streamWithSummary(streamRes, advocateMsgId2, data.emit);

    console.log(`\x1b[35m[AGENT: User Advocate]\x1b[0m Counter-Rebuttal Generated:\n${fullText.substring(0, 200)}...\n`);
    
    return { advocateRebuttal: fullText, threadId: data.threadId, critique: data.critique, legalAnalysis: data.legalAnalysis, rebuttal: data.rebuttal, contractData: data.contractData, userType: data.userType, emit: data.emit };
  }
} as any);

const round4Step = createStep({
  id: 'NeutralJudgeVerdict',
  execute: async ({ getStepResult }: any) => {
    const data: any = getStepResult('UserAdvocateRebuttal');
    
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

    console.log(`\n\x1b[32m[AGENT: Neutral Judge]\x1b[0m Reviewing full 3-round transcript...`);
    
    const judgeMsgId = `msg_${Date.now()}_judge`;
    if (data.emit) data.emit({ type: 'stream_start', agent: 'judge', msg: { id: judgeMsgId, role: 'judge', round: 3, text: '' } });

    const streamRes = await neutralJudge.stream(prompt, { threadId: data.threadId } as any);
    let fullText = '';
    for await (const chunk of streamRes.textStream) {
      fullText += chunk;
      if (data.emit) data.emit({ type: 'stream_chunk', msg: { id: judgeMsgId, text: chunk } });
    }
    if (data.emit) data.emit({ type: 'stream_end' });

    console.log(`\x1b[32m[AGENT: Neutral Judge]\x1b[0m Final Verdict Reached!\n`);
    
    if (data.emit) data.emit({ type: 'verdict', finalVerdict: fullText });
    
    return { finalVerdict: fullText, threadId: data.threadId, transcript };
  }
} as any);

debateWorkflow
  .then(initialCritiquesStep)
  .then(round2Step)
  .then(round3Step)
  .then(round4Step);

debateWorkflow.commit();
