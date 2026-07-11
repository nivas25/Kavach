export class EnkryptService {
  private apiKey: string;
  private cache: Map<string, { result: any; timestamp: number }>;
  private CACHE_TTL = 1000 * 60 * 5; // 5 minutes

  constructor() {
    this.apiKey = process.env.ENKRYPT_API_KEY || '';
    this.cache = new Map();
    if (!this.apiKey) {
      console.warn("ENKRYPT_API_KEY is not defined. Security checks will run in dry-mode.");
    }
  }

  private async fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 1000): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 429) {
        console.warn(`[Enkrypt AI] Rate limited (429). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        return response; // Return other errors immediately
      }
    }
    throw new Error(`Failed after ${retries} retries`);
  }

  /**
   * Checks tool input against Enkrypt Guardrails.
   * Returns { isBlocked: boolean, reason: string }
   */
  async checkToolCall(query: string): Promise<{ isBlocked: boolean; reason: string }> {
    if (!this.apiKey) return { isBlocked: false, reason: 'Dry mode (No API Key)' };

    const cacheKey = `tool:${query}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    try {
      const response = await this.fetchWithRetry('https://api.enkryptai.com/guardrails/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey
        },
        body: JSON.stringify({ 
          text: query,
          detectors: {
            toxicity: { enabled: true },
            injection_attack: { enabled: true }
          }
        })
      });

      if (!response.ok) {
        console.error(`[Enkrypt AI] Error checking tool call: ${response.statusText}`);
        return { isBlocked: false, reason: `Enkrypt Error: ${response.statusText}` };
      }

      const data = await response.json();
      
      let isBlocked = false;
      let reason = 'Safe';

      if (data.summary) {
        if (Array.isArray(data.summary.toxicity) && data.summary.toxicity.length > 0) {
          isBlocked = true;
        }
        if (data.summary.injection_attack > 0.7 || (Array.isArray(data.summary.injection_attack) && data.summary.injection_attack.length > 0)) {
          isBlocked = true;
        }
      }
      
      if (isBlocked) {
        reason = data.result_message || 'Flagged by Enkrypt AI Guardrails';
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
  async checkHallucination(verdictText: string): Promise<{
    score: number;
    explanation: string;
    isBlocked: boolean;
  }> {
    if (!this.apiKey) return { score: 0, explanation: 'Dry mode (No API Key)', isBlocked: false };

    try {
      const response = await this.fetchWithRetry('https://api.enkryptai.com/guardrails/detect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey
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
      
      let hallucinationScore = 0;
      let isBlocked = false;

      if (data.summary) {
        if (Array.isArray(data.summary.bias) && data.summary.bias.length > 0) {
          hallucinationScore = 0.8;
          isBlocked = true;
        }
        if (Array.isArray(data.summary.toxicity) && data.summary.toxicity.length > 0) {
          isBlocked = true;
        }
      }

      return {
        score: Math.round(hallucinationScore * 100) || 5,
        explanation: data.result_message || 'Analyzed by Enkrypt AI Policy Engine.',
        isBlocked
      };
    } catch (error: any) {
      console.error("[Enkrypt AI] Exception during hallucination check:", error);
      return {
        score: -1,
        explanation: 'Failed to run hallucination check due to API unreachable.',
        isBlocked: false
      };
    }
  }
}

export const enkryptService = new EnkryptService();
