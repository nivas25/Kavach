import { GoogleGenerativeAI } from '@google/generative-ai';
import { redis } from '../lib/redis';
import { supabaseAdmin } from '../lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export class DocumentProcessorService {
  private genAI: GoogleGenerativeAI;
  private llamaParseApiKey: string;

  constructor() {
    // Phase 1: We use GEMINI_API_KEY_3 for extraction due to Key 1 & 2 quota limits on 2.5-pro
    if (!process.env.GEMINI_API_KEY_3) {
      throw new Error("GEMINI_API_KEY_3 is missing in environment variables.");
    }
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_3);
    
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
    console.log(`[Gemini] Extracting dynamic structured JSON from markdown using gemini-2.5-flash...`);
    const model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

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

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    return JSON.parse(responseText);
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
   * Complete Pipeline: LlamaParse -> Gemini -> Redis/Supabase
   */
  async processDocument(fileBuffer: Buffer, fileName: string, userId: string): Promise<string> {
    const sessionId = uuidv4();
    
    // 1. Parse PDF/DOCX to Markdown
    const markdown = await this.parseWithLlamaParse(fileBuffer, fileName);
    
    // 2. Extract structured JSON using Gemini
    const extractedData = await this.extractWithGemini(markdown);
    
    // 3. Store the state
    await this.storeDocumentState(sessionId, markdown, extractedData, userId, fileName);
    
    return sessionId;
  }
}
