import { Mastra } from '@mastra/core';
import { debateWorkflow } from './workflow';
import { userAdvocate, companyDefender, indiaLegalExpert, neutralJudge } from './agents';

export const mastra = new Mastra({
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
