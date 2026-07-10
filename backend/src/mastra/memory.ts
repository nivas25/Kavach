import { Memory } from '@mastra/memory';
import { UpstashStore } from '@mastra/upstash';

// Prevent creating client during static analysis if env vars are missing
const getStore = () => {
  return new UpstashStore({
    id: 'debate-store',
    url: process.env.UPSTASH_REDIS_REST_URL || 'missing',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || 'missing'
  } as any);
};

export const memory = new Memory({
  storage: getStore(),
} as any);
