import { Workflow, createStep } from '@mastra/core/workflows';
import { userAdvocate, companyDefender, indiaLegalExpert, neutralJudge } from '../agents';
import { z } from 'zod';
import { memory } from '../memory';

// Memory is managed via workflow state now, so we remove manual assignment to agents

export const debateWorkflow = new Workflow({
  id: 'ContractDebate',
  triggerSchema: z.object({
    contractData: z.any(),
    threadId: z.string().optional()
  })
} as any);

const round1Step = createStep({
  id: 'UserAdvocateInitial',
  execute: async ({ inputData }: any) => {
    const { contractData, threadId } = inputData as any;

    const prompt = `Review the following contract clauses:\n\n${JSON.stringify(contractData, null, 2)}\n\nProvide your initial critique identifying potential risks to the user.`;

    console.log(`\n\x1b[35m[AGENT: User Advocate]\x1b[0m Thinking...`);
    const res = await userAdvocate.generate(prompt, { threadId } as any);
    console.log(`\x1b[35m[AGENT: User Advocate]\x1b[0m Critique Generated:\n${res.text.substring(0, 300)}...\n`);
    return { critique: res.text, threadId, contractData };
  }
} as any);

const round2Step = createStep({
  id: 'CompanyDefenderRebuttal',
  execute: async ({ getStepResult }: any) => {
    const data: any = getStepResult('UserAdvocateInitial');
    const prompt = `The User Advocate has provided the following critique:\n\n${data.critique}\n\nPlease provide a vigorous corporate defense and rebuttal.`;

    console.log(`\n\x1b[34m[AGENT: Company Defender]\x1b[0m Thinking...`);
    const res = await companyDefender.generate(prompt, { threadId: data.threadId } as any);
    console.log(`\x1b[34m[AGENT: Company Defender]\x1b[0m Rebuttal Generated:\n${res.text.substring(0, 300)}...\n`);
    return { rebuttal: res.text, threadId: data.threadId, critique: data.critique, contractData: data.contractData };
  }
} as any);

const round3Step = createStep({
  id: 'UserAdvocateRebuttal',
  execute: async ({ getStepResult }: any) => {
    const data: any = getStepResult('CompanyDefenderRebuttal');
    const prompt = `The Company Defender provided this rebuttal:\n\n${data.rebuttal}\n\nPlease counter their arguments strongly.`;

    console.log(`\n\x1b[35m[AGENT: User Advocate]\x1b[0m Rebutting...`);
    const res = await userAdvocate.generate(prompt, { threadId: data.threadId } as any);
    console.log(`\x1b[35m[AGENT: User Advocate]\x1b[0m Counter-Rebuttal Generated:\n${res.text.substring(0, 300)}...\n`);
    return { advocateRebuttal: res.text, threadId: data.threadId, critique: data.critique, rebuttal: data.rebuttal, contractData: data.contractData };
  }
} as any);

const round4Step = createStep({
  id: 'IndiaLegalExpertReview',
  execute: async ({ getStepResult }: any) => {
    const data: any = getStepResult('UserAdvocateRebuttal');
    const prompt = `Review the following contract clauses:\n\n${JSON.stringify(data.contractData, null, 2)}\n\nAnd the ongoing debate so far:\n\nUser Advocate Critique:\n${data.critique}\n\nCompany Defender Rebuttal:\n${data.rebuttal}\n\nUser Advocate Counter-Rebuttal:\n${data.advocateRebuttal}\n\nPlease provide a strict analysis under Indian Law.`;

    console.log(`\n\x1b[33m[AGENT: India Legal Expert]\x1b[0m Analyzing...`);
    const res = await indiaLegalExpert.generate(prompt, { threadId: data.threadId } as any);
    console.log(`\x1b[33m[AGENT: India Legal Expert]\x1b[0m Analysis Generated:\n${res.text.substring(0, 300)}...\n`);
    return { legalAnalysis: res.text, threadId: data.threadId, critique: data.critique, rebuttal: data.rebuttal, advocateRebuttal: data.advocateRebuttal, contractData: data.contractData };
  }
} as any);

const round5Step = createStep({
  id: 'NeutralJudgeVerdict',
  execute: async ({ getStepResult }: any) => {
    const data: any = getStepResult('IndiaLegalExpertReview');
    
    const transcript = `
    --- CONTRACT DATA ---
    ${JSON.stringify(data.contractData, null, 2)}

    --- ROUND 1: USER ADVOCATE ---
    ${data.critique}
    
    --- ROUND 2: COMPANY DEFENDER ---
    ${data.rebuttal}
    
    --- ROUND 3: USER ADVOCATE ---
    ${data.advocateRebuttal}
    
    --- ROUND 4: INDIA LEGAL EXPERT ---
    ${data.legalAnalysis}
    `;

    const prompt = `You are the final judge. Review the entire thread below and the contract clauses. Please issue your final, balanced verdict.
    
    THE DEBATE TRANSCRIPT:
    ${transcript}
    `;

    console.log(`\n\x1b[32m[AGENT: Neutral Judge]\x1b[0m Reviewing full 4-round transcript...`);
    const res = await neutralJudge.generate(prompt, { threadId: data.threadId } as any);
    console.log(`\x1b[32m[AGENT: Neutral Judge]\x1b[0m Final Verdict Reached!\n`);
    
    return { finalVerdict: res.text, threadId: data.threadId, transcript };
  }
} as any);

debateWorkflow
  .then(round1Step)
  .then(round2Step)
  .then(round3Step)
  .then(round4Step)
  .then(round5Step);

debateWorkflow.commit();
