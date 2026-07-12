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

export { enkryptService as e };
