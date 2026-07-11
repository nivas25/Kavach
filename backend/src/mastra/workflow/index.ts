import { Workflow, createStep } from '@mastra/core/workflows';
import { userAdvocate, companyDefender, indiaLegalExpert, neutralJudge } from '../agents';
import { z } from 'zod';
import { memory } from '../memory';

// Memory is managed via workflow state now, so we remove manual assignment to agents

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

    const advocatePrompt = `Review the following contract clauses from the perspective of a ${userType}:\n\n${JSON.stringify(contractData, null, 2)}\n\nProvide your initial critique identifying potential risks to the user.`;
    const indiaPrompt = `Review the following contract clauses for a ${userType}:\n\n${JSON.stringify(contractData, null, 2)}\n\nPlease provide a strict analysis under Indian Law identifying potential issues or unenforceable terms.`;

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
        for await (const chunk of advocateStream.fullStream) {
          if (chunk.type === 'text-delta') {
            advocateText += chunk.textDelta;
            if (emit) emit({ type: 'stream_chunk', msg: { id: advocateMsgId, text: chunk.textDelta } });
          } else if (chunk.type === 'tool-call') {
            if (emit) emit({ type: 'stream_tool', msg: { id: advocateMsgId, toolCallId: chunk.toolCallId, toolName: chunk.toolName, args: chunk.args } });
          } else if (chunk.type === 'tool-result') {
            const isBlocked = typeof chunk.result === 'string' && chunk.result.toLowerCase().includes('enkrypt');
            if (emit) emit({ type: 'stream_tool_result', msg: { id: advocateMsgId, toolCallId: chunk.toolCallId, isBlocked } });
          }
        }
        if (emit) emit({ type: 'stream_end' });
        console.log(`\x1b[35m[AGENT: User Advocate]\x1b[0m Critique Generated:\n${advocateText.substring(0, 200)}...\n`);
      })(),
      (async () => {
        for await (const chunk of indiaStream.fullStream) {
          if (chunk.type === 'text-delta') {
            indiaText += chunk.textDelta;
            if (emit) emit({ type: 'stream_chunk', msg: { id: indiaMsgId, text: chunk.textDelta } });
          } else if (chunk.type === 'tool-call') {
            if (emit) emit({ type: 'stream_tool', msg: { id: indiaMsgId, toolCallId: chunk.toolCallId, toolName: chunk.toolName, args: chunk.args } });
          } else if (chunk.type === 'tool-result') {
            const isBlocked = typeof chunk.result === 'string' && chunk.result.toLowerCase().includes('enkrypt');
            if (emit) emit({ type: 'stream_tool_result', msg: { id: indiaMsgId, toolCallId: chunk.toolCallId, isBlocked } });
          }
        }
        if (emit) emit({ type: 'stream_end' });
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
    const prompt = `The User Advocate (acting for a ${data.userType}) provided the following critique:\n\n${data.critique}\n\nAnd the India Legal Expert provided this analysis:\n\n${data.legalAnalysis}\n\nPlease provide a vigorous corporate defense and rebuttal addressing BOTH critiques.`;

    console.log(`\n\x1b[34m[AGENT: Company Defender]\x1b[0m Thinking...`);
    
    const defenderMsgId = `msg_${Date.now()}_defender`;
    if (data.emit) data.emit({ type: 'stream_start', agent: 'defender', msg: { id: defenderMsgId, role: 'defender', round: 1, text: '' } });

    const streamRes = await companyDefender.stream(prompt, { threadId: data.threadId } as any);
    let fullText = '';
    for await (const chunk of streamRes.fullStream) {
      if (chunk.type === 'text-delta') {
        fullText += chunk.textDelta;
        if (data.emit) data.emit({ type: 'stream_chunk', msg: { id: defenderMsgId, text: chunk.textDelta } });
      } else if (chunk.type === 'tool-call') {
        if (data.emit) data.emit({ type: 'stream_tool', msg: { id: defenderMsgId, toolCallId: chunk.toolCallId, toolName: chunk.toolName, args: chunk.args } });
      } else if (chunk.type === 'tool-result') {
        const isBlocked = typeof chunk.result === 'string' && chunk.result.toLowerCase().includes('enkrypt');
        if (data.emit) data.emit({ type: 'stream_tool_result', msg: { id: defenderMsgId, toolCallId: chunk.toolCallId, isBlocked } });
      }
    }
    if (data.emit) data.emit({ type: 'stream_end' });

    console.log(`\x1b[34m[AGENT: Company Defender]\x1b[0m Rebuttal Generated:\n${fullText.substring(0, 200)}...\n`);
    
    return { rebuttal: fullText, threadId: data.threadId, critique: data.critique, legalAnalysis: data.legalAnalysis, contractData: data.contractData, userType: data.userType, emit: data.emit };
  }
} as any);

const round3Step = createStep({
  id: 'UserAdvocateRebuttal',
  execute: async ({ getStepResult }: any) => {
    const data: any = getStepResult('CompanyDefenderRebuttal');
    const prompt = `The Company Defender provided this rebuttal:\n\n${data.rebuttal}\n\nPlease counter their arguments strongly to protect the ${data.userType}.`;

    console.log(`\n\x1b[35m[AGENT: User Advocate]\x1b[0m Rebutting...`);
    
    const advocateMsgId2 = `msg_${Date.now()}_advocate_2`;
    if (data.emit) data.emit({ type: 'stream_start', agent: 'advocate', msg: { id: advocateMsgId2, role: 'advocate', round: 2, text: '' } });

    const streamRes = await userAdvocate.stream(prompt, { threadId: data.threadId } as any);
    let fullText = '';
    for await (const chunk of streamRes.fullStream) {
      if (chunk.type === 'text-delta') {
        fullText += chunk.textDelta;
        if (data.emit) data.emit({ type: 'stream_chunk', msg: { id: advocateMsgId2, text: chunk.textDelta } });
      } else if (chunk.type === 'tool-call') {
        if (data.emit) data.emit({ type: 'stream_tool', msg: { id: advocateMsgId2, toolCallId: chunk.toolCallId, toolName: chunk.toolName, args: chunk.args } });
      } else if (chunk.type === 'tool-result') {
        const isBlocked = typeof chunk.result === 'string' && chunk.result.toLowerCase().includes('enkrypt');
        if (data.emit) data.emit({ type: 'stream_tool_result', msg: { id: advocateMsgId2, toolCallId: chunk.toolCallId, isBlocked } });
      }
    }
    if (data.emit) data.emit({ type: 'stream_end' });

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
    for await (const chunk of streamRes.fullStream) {
      if (chunk.type === 'text-delta') {
        fullText += chunk.textDelta;
        if (data.emit) data.emit({ type: 'stream_chunk', msg: { id: judgeMsgId, text: chunk.textDelta } });
      } else if (chunk.type === 'tool-call') {
        if (data.emit) data.emit({ type: 'stream_tool', msg: { id: judgeMsgId, toolCallId: chunk.toolCallId, toolName: chunk.toolName, args: chunk.args } });
      } else if (chunk.type === 'tool-result') {
        const isBlocked = typeof chunk.result === 'string' && chunk.result.toLowerCase().includes('enkrypt');
        if (data.emit) data.emit({ type: 'stream_tool_result', msg: { id: judgeMsgId, toolCallId: chunk.toolCallId, isBlocked } });
      }
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
