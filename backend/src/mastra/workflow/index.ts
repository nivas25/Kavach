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
    if (emit) emit({ type: 'typing', agent: 'advocate' });
    
    const [advocateRes, indiaRes] = await Promise.all([
      userAdvocate.generate(advocatePrompt, { threadId } as any),
      indiaLegalExpert.generate(indiaPrompt, { threadId } as any)
    ]);

    console.log(`\x1b[35m[AGENT: User Advocate]\x1b[0m Critique Generated:\n${advocateRes.text.substring(0, 200)}...\n`);
    if (emit) emit({ type: 'message', msg: { role: 'advocate', round: 1, text: advocateRes.text } });

    console.log(`\x1b[33m[AGENT: India Legal Expert]\x1b[0m Analysis Generated:\n${indiaRes.text.substring(0, 200)}...\n`);
    if (emit) emit({ type: 'message', msg: { role: 'expert', round: 1, text: indiaRes.text } });
    
    return { critique: advocateRes.text, legalAnalysis: indiaRes.text, threadId, contractData, userType, emit };
  }
} as any);

const round2Step = createStep({
  id: 'CompanyDefenderRebuttal',
  execute: async ({ getStepResult }: any) => {
    const data: any = getStepResult('InitialCritiques');
    const prompt = `The User Advocate (acting for a ${data.userType}) provided the following critique:\n\n${data.critique}\n\nAnd the India Legal Expert provided this analysis:\n\n${data.legalAnalysis}\n\nPlease provide a vigorous corporate defense and rebuttal addressing BOTH critiques.`;

    console.log(`\n\x1b[34m[AGENT: Company Defender]\x1b[0m Thinking...`);
    if (data.emit) data.emit({ type: 'typing', agent: 'defender' });

    const res = await companyDefender.generate(prompt, { threadId: data.threadId } as any);
    console.log(`\x1b[34m[AGENT: Company Defender]\x1b[0m Rebuttal Generated:\n${res.text.substring(0, 200)}...\n`);
    
    if (data.emit) data.emit({ type: 'message', msg: { role: 'defender', round: 1, text: res.text } });

    return { rebuttal: res.text, threadId: data.threadId, critique: data.critique, legalAnalysis: data.legalAnalysis, contractData: data.contractData, userType: data.userType, emit: data.emit };
  }
} as any);

const round3Step = createStep({
  id: 'UserAdvocateRebuttal',
  execute: async ({ getStepResult }: any) => {
    const data: any = getStepResult('CompanyDefenderRebuttal');
    const prompt = `The Company Defender provided this rebuttal:\n\n${data.rebuttal}\n\nPlease counter their arguments strongly to protect the ${data.userType}.`;

    console.log(`\n\x1b[35m[AGENT: User Advocate]\x1b[0m Rebutting...`);
    if (data.emit) data.emit({ type: 'typing', agent: 'advocate' });

    const res = await userAdvocate.generate(prompt, { threadId: data.threadId } as any);
    console.log(`\x1b[35m[AGENT: User Advocate]\x1b[0m Counter-Rebuttal Generated:\n${res.text.substring(0, 200)}...\n`);
    
    if (data.emit) data.emit({ type: 'message', msg: { role: 'advocate', round: 2, text: res.text } });

    return { advocateRebuttal: res.text, threadId: data.threadId, critique: data.critique, legalAnalysis: data.legalAnalysis, rebuttal: data.rebuttal, contractData: data.contractData, userType: data.userType, emit: data.emit };
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
    if (data.emit) data.emit({ type: 'typing', agent: 'judge' });

    const res = await neutralJudge.generate(prompt, { threadId: data.threadId } as any);
    console.log(`\x1b[32m[AGENT: Neutral Judge]\x1b[0m Final Verdict Reached!\n`);
    
    if (data.emit) data.emit({ type: 'message', msg: { role: 'judge', round: 3, text: res.text } });
    if (data.emit) data.emit({ type: 'verdict', finalVerdict: res.text });
    
    return { finalVerdict: res.text, threadId: data.threadId, transcript };
  }
} as any);

debateWorkflow
  .then(initialCritiquesStep)
  .then(round2Step)
  .then(round3Step)
  .then(round4Step);

debateWorkflow.commit();
