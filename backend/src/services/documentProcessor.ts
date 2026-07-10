import { redis } from '../lib/redis';
import { supabaseAdmin } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { debateWorkflow } from '../mastra/workflow';
import { enkryptService } from './enkryptService';

export class DocumentProcessorService {
  private llamaParseApiKey: string;
  private openaiApiKey: string;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is missing in environment variables.");
    }
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!process.env.LLAMAPARSE_API_KEY) {
      throw new Error("LLAMAPARSE_API_KEY is missing in environment variables.");
    }
    this.llamaParseApiKey = process.env.LLAMAPARSE_API_KEY;
  }

  /**
   * Uploads a file to LlamaParse and polls for the markdown result.
   */
  async parseWithLlamaParse(fileBuffer: Buffer, fileName: string): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)]);
    formData.append('file', blob, fileName);

    // 1. Upload to LlamaParse
    console.log(`[LlamaParse] Uploading ${fileName}...`);
    const uploadRes = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.llamaParseApiKey}`,
        'Accept': 'application/json'
      },
      body: formData
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      throw new Error(`LlamaParse upload failed: ${uploadRes.status} - ${errorText}`);
    }

    const { id: jobId } = await uploadRes.json();
    console.log(`[LlamaParse] Job created: ${jobId}. Waiting for completion...`);

    // 2. Poll for completion
    let status = 'PENDING';
    while (status === 'PENDING' || status === 'PROCESSING') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}`, {
        headers: { 'Authorization': `Bearer ${this.llamaParseApiKey}` }
      });
      const statusData = await statusRes.json();
      status = statusData.status;
      if (status === 'ERROR') {
        throw new Error('LlamaParse job failed');
      }
    }

    // 3. Get Markdown result
    console.log(`[LlamaParse] Job complete. Fetching markdown...`);
    const resultRes = await fetch(`https://api.cloud.llamaindex.ai/api/parsing/job/${jobId}/result/markdown`, {
      headers: { 'Authorization': `Bearer ${this.llamaParseApiKey}` }
    });
    
    if (!resultRes.ok) {
      throw new Error('Failed to fetch markdown result');
    }

    const { markdown } = await resultRes.json();
    return markdown;
  }

  /**
   * Uses Gemini to extract a structured JSON representation of the contract.
   */
  async extractWithGemini(markdown: string): Promise<any> {
    console.log(`[OpenAI] Extracting dynamic structured JSON from markdown using gpt-4o-mini...`);
    const prompt = `
      You are an elite, highly experienced legal AI architect analyzing a document.
      Your task is to extract a comprehensive, dynamic JSON representation of the provided legal document.

      REQUIREMENTS:
      1. You MUST include a "title" string field (the name or best guessed title of the document).
      2. You MUST include a "riskLevel" string field representing the overall legal/business risk. It MUST be exactly one of: "low", "medium", "high", "critical".
      3. BEYOND those two required fields, you must dynamically create an intelligent schema that best fits the specific type of document provided (e.g., NDA, Lease, Employment, MSA).
      4. Extract deep, granular details. Examples of dynamic fields you might create:
         - "parties": detailed breakdown of entities involved.
         - "keyDates": effective date, expiration, milestones.
         - "coreObligations": what each party is required to do.
         - "financialTerms": payment schedules, penalties.
         - "governingLaw": jurisdiction and dispute resolution.
         - "criticalClauses": a deep dive into specific clauses, highlighting any unusual liabilities, indemnification, or auto-renewals.
      5. Do not hallucinate. Only extract what is present in the markdown.
      6. Return ONLY valid JSON.

      Document:
      ${markdown}
    `;

    const result = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!result.ok) {
      const errorText = await result.text();
      throw new Error(`OpenAI API Error: ${errorText}`);
    }

    const jsonResponse = await result.json();
    const responseText = jsonResponse.choices[0].message.content;

    try {
      return JSON.parse(responseText);
    } catch (e) {
      console.error("[OpenAI] Failed to parse JSON:", responseText);
      throw new Error("Failed to parse the structured data from OpenAI.");
    }
  }

  /**
   * Stores the extracted state in Upstash Redis and metadata in Supabase.
   */
  async storeDocumentState(
    sessionId: string,
    markdown: string,
    extractedData: any,
    userId: string,
    fileName: string
  ): Promise<void> {
    console.log(`[Storage] Storing document state for session: ${sessionId}...`);
    
    // 1. Store in Upstash Redis (Session specific data)
    const docKey = `doc:${sessionId}`;
    await redis.set(docKey, JSON.stringify({
      markdown,
      extractedData,
      fileName,
      status: 'extracted',
      uploadedAt: new Date().toISOString()
    }), { ex: 86400 }); // Expire in 24 hours

    // 2. Store Metadata in Supabase
    console.log(`[Storage] Saving metadata to Supabase 'analyses' table...`);
    const { error } = await supabaseAdmin.from('analyses').insert({
      id: sessionId,
      session_id: sessionId,
      user_id: userId,
      title: extractedData.title || fileName,
      original_file_name: fileName,
      file_type: fileName.endsWith('.pdf') ? 'pdf' : fileName.endsWith('.docx') ? 'docx' : 'text',
      status: 'debating',
      overall_risk_level: (extractedData.riskLevel || 'medium').toLowerCase(),
      created_at: new Date().toISOString()
    });

    if (error) {
      console.error('[Storage] Supabase Insert Error:', error);
      throw new Error(`Failed to save to Supabase: ${error.message}`);
    }
  }

  /**
   * Generates a numerical score and summary based on the Judge's Verdict.
   */
  async calculateFinalScore(verdict: string): Promise<{
    overall_risk_score: number;
    overall_risk_level: string;
    summary: string;
    enkrypt_hallucination_score: number;
    enkrypt_explanation: string;
    factors: {
      harmPotential: number;
      legalStrength: number;
      practicalLikelihood: number;
    }
  }> {
    console.log(`[Scoring] Calculating final risk score from verdict...`);
    const prompt = `
      You are a legal scoring system. Read the following judge's verdict and evaluate the contract across three factors (each 1-10).
      
      SCORING RUBRICS:
      
      1. harmPotential: (1-10) Extract the explicit "Harm Score" provided by the Judge based on the knowledge base.
      2. legalStrength: (1-10) Extract the explicit "Legal Score" provided by the Judge based on the knowledge base.
      3. practicalLikelihood: (1-10) Extract the explicit "Likelihood Score" provided by the Judge based on the knowledge base.

      REQUIREMENTS:
      1. Output a strict JSON object with:
         - "harmPotential": number 1-10 (extracted exactly from the verdict)
         - "legalStrength": number 1-10 (extracted exactly from the verdict)
         - "practicalLikelihood": number 1-10 (extracted exactly from the verdict)
         - "summary": A concise, 2-3 sentence executive summary of the verdict and main risks.

      Verdict:
      ${verdict}
    `;

    const result = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!result.ok) {
      const errorText = await result.text();
      throw new Error(`OpenAI API Error: ${errorText}`);
    }

    const jsonResponse = await result.json();
    const responseText = jsonResponse.choices[0].message.content;
    const data = JSON.parse(responseText);

    const harmPotential = Math.max(1, Math.min(10, data.harmPotential || 5));
    const legalStrength = Math.max(1, Math.min(10, data.legalStrength || 5));
    const practicalLikelihood = Math.max(1, Math.min(10, data.practicalLikelihood || 5));

    const rawWeightedScore = (harmPotential * 0.40) + (legalStrength * 0.35) + (practicalLikelihood * 0.25);
    const overall_risk_score = Math.round(rawWeightedScore * 10);

    let overall_risk_level = 'critical';
    if (overall_risk_score <= 25) overall_risk_level = 'low';
    else if (overall_risk_score <= 50) overall_risk_level = 'medium';
    else if (overall_risk_score <= 75) overall_risk_level = 'high';

    console.log(`[Enkrypt AI] Validating final verdict for hallucinations...`);
    const hallucinationCheck = await enkryptService.checkHallucination(verdict);
    
    return {
      overall_risk_score,
      overall_risk_level,
      summary: data.summary,
      enkrypt_hallucination_score: hallucinationCheck.score,
      enkrypt_explanation: hallucinationCheck.explanation,
      factors: { harmPotential, legalStrength, practicalLikelihood }
    };
  }

  /**
   * Updates the final document state in Supabase and Upstash after the debate.
   */
  async updateFinalState(
    sessionId: string, 
    scoreData: { 
      overall_risk_score: number; 
      overall_risk_level: string; 
      summary: string;
      enkrypt_hallucination_score?: number;
      enkrypt_explanation?: string;
      factors: any;
    },
    verdictText: string
  ): Promise<void> {
    console.log(`[Storage] Updating final score in Supabase for session: ${sessionId}...`);
    
    const { error } = await supabaseAdmin
      .from('analyses')
      .update({
        status: 'completed',
        overall_risk_score: scoreData.overall_risk_score,
        overall_risk_level: scoreData.overall_risk_level.toLowerCase(),
        summary: scoreData.summary,
        enkrypt_hallucination_score: scoreData.enkrypt_hallucination_score,
        enkrypt_explanation: scoreData.enkrypt_explanation
      })
      .eq('id', sessionId);

    if (error) {
      console.error('[Storage] Supabase Update Error:', error);
      throw new Error(`Failed to update Supabase: ${error.message}`);
    }

    // Also update Redis to include the verdict and score
    const docKey = `doc:${sessionId}`;
    const existing = await redis.get(docKey);
    if (existing) {
      const data = typeof existing === 'string' ? JSON.parse(existing) : existing;
      data.status = 'completed';
      data.scoreData = scoreData;
      data.finalVerdict = verdictText;
      await redis.set(docKey, JSON.stringify(data), { ex: 86400 });
    }
  }

  /**
   * Complete Pipeline: LlamaParse -> Gemini -> Mastra Workflow -> Scoring -> Redis/Supabase
   */
  async processDocument(fileBuffer: Buffer, fileName: string, userId: string): Promise<string> {
    const sessionId = uuidv4();
    
    // 1. Parse PDF/DOCX to Markdown
    const markdown = await this.parseWithLlamaParse(fileBuffer, fileName);
    
    // 2. Extract structured JSON using Gemini
    const extractedData = await this.extractWithGemini(markdown);
    
    // 3. Store initial state
    await this.storeDocumentState(sessionId, markdown, extractedData, userId, fileName);
    
    // 4. Trigger 5-Round Debate Workflow
    console.log(`[Workflow] Triggering 5-Round Mastra Debate for session: ${sessionId}...`);
    const run = await debateWorkflow.createRun({ runId: sessionId });
    const debateResult = await run.start({
      inputData: {
        contractData: extractedData,
        threadId: sessionId
      }
    });

    const finalVerdict = (debateResult as any).result?.finalVerdict || "Debate failed to reach a final verdict.";

    // 5. Score the Verdict
    const scoreData = await this.calculateFinalScore(finalVerdict);

    // 6. Update Final State in DB and Cache
    await this.updateFinalState(sessionId, scoreData, finalVerdict);

    console.log(`[Pipeline] Document processing complete. Final Score: ${scoreData.overall_risk_score}`);
    
    return sessionId;
  }
}
