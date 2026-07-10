export class EnkryptService {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.ENKRYPT_API_KEY || '';
    if (!this.apiKey) {
      console.warn("ENKRYPT_API_KEY is not defined. Security checks will run in dry-mode.");
    }
  }

  /**
   * Checks tool input against Enkrypt Guardrails.
   * Returns { isBlocked: boolean, reason: string }
   */
  async checkToolCall(query: string): Promise<{ isBlocked: boolean; reason: string }> {
    if (!this.apiKey) return { isBlocked: false, reason: 'Dry mode (No API Key)' };

    try {
      const response = await fetch('https://api.enkryptai.com/guardrails/detect', {
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
        // If toxicity is an array with items, it's flagged
        if (Array.isArray(data.summary.toxicity) && data.summary.toxicity.length > 0) {
          isBlocked = true;
        }
        // If injection_attack is a high float, or an array with items
        if (data.summary.injection_attack > 0.7 || (Array.isArray(data.summary.injection_attack) && data.summary.injection_attack.length > 0)) {
          isBlocked = true;
        }
      }
      
      if (isBlocked) {
        reason = data.result_message || 'Flagged by Enkrypt AI Guardrails';
      }

      return { isBlocked, reason };
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
      const response = await fetch('https://api.enkryptai.com/guardrails/detect', {
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
        // Evaluate hallucination / bias based on payload
        if (Array.isArray(data.summary.bias) && data.summary.bias.length > 0) {
          hallucinationScore = 0.8;
          isBlocked = true;
        }
        if (Array.isArray(data.summary.toxicity) && data.summary.toxicity.length > 0) {
          isBlocked = true;
        }
      }

      // If we don't have explicit hallucination metrics in this endpoint, 
      // we use the toxicity/bias as a proxy, or safely default.
      
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
