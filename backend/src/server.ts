import Fastify from 'fastify';
import cors from '@fastify/cors';
import * as dotenv from 'dotenv';
import path from 'path';
import { getRedisInfo, redis } from './lib/redis';
import { pingSupabase } from './lib/supabase';
import { DocumentProcessorService } from './services/documentProcessor';
import { debateWorkflow } from './mastra/workflow';
import multipart from '@fastify/multipart';
import { v4 as uuidv4 } from 'uuid';

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const server = Fastify({
  logger: true
});

server.register(cors, {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://kavach25.vercel.app', 'http://localhost:3000'] 
    : true,   // Allow any origin in dev
  credentials: true,
});

server.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// ═══ Health Check ════════════════════════════
// Reports connectivity status for all external services.

server.get('/health', async (_request, _reply) => {
  const [redisInfo, supabaseOk] = await Promise.all([
    getRedisInfo(),
    pingSupabase(),
  ]);

  const allHealthy = redisInfo.connected && supabaseOk;

  return {
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      redis: {
        connected: redisInfo.connected,
        latencyMs: redisInfo.latencyMs,
      },
      supabase: {
        connected: supabaseOk,
      },
    },
  };
});

// ═══ Example: Protected Route ════════════════
// Uncomment when you start building authenticated API routes:
//
// import { authenticate } from './lib/auth';
// import { createUserClient } from './lib/supabase';
//
// server.get('/api/my-analyses', { preHandler: [authenticate] }, async (request, reply) => {
//   const supabase = createUserClient(request.accessToken!);
//   const { data, error } = await supabase
//     .from('analyses')
//     .select('id, title, status, overall_risk_level, created_at')
//     .order('created_at', { ascending: false });
//
//   if (error) return reply.code(500).send({ error: error.message });
//   return { analyses: data };
// });

// ═══ Phase 1 & 2: Upload & Initialize ════════════
const processor = new DocumentProcessorService();

server.post('/api/documents/upload', async (request, reply) => {
  try {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: "No file uploaded" });
    }

    const fileBuffer = await data.toBuffer();
    const fileName = data.filename;
    // Extract userType and userId from fields
    const userTypeField = data.fields.userType;
    const userType = userTypeField && 'value' in userTypeField ? String(userTypeField.value) : 'Unknown';
    
    const userIdField = data.fields.userId;
    const userId = userIdField && 'value' in userIdField ? String(userIdField.value) : null;

    server.log.info(`[UPLOAD] Starting process for ${fileName} | UserType: ${userType} | UserId: ${userId || 'None'}`);

    const sessionId = await processor.processAndExtractDocument(fileBuffer, fileName, userId, userType);

    server.log.info(`[UPLOAD] Processing completed for ${fileName}. Assigned Session: ${sessionId}`);

    return { 
      sessionId, 
      status: "processing", 
      message: "File uploaded and extraction completed."
    };
  } catch (error: any) {
    server.log.error(error);
    if (error.isLegalError) {
      return reply.code(400).send({ error: error.message, isLegalError: true });
    }
    return reply.code(500).send({ error: error.message });
  }
});

// ═══ Phase 4 & 5: Analysis Stream ════════════
server.get('/api/documents/:sessionId', async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  
  const doc = await redis.get(`doc:${sessionId}`);
  if (!doc) {
    return reply.status(404).send({ error: "Session not found" });
  }

  const parsedDoc = typeof doc === 'string' ? JSON.parse(doc) : doc;
  
  // Return the extracted data so the frontend can build the clauses view
  return reply.send({
    id: sessionId,
    userType: parsedDoc.userType || 'User',
    extractedData: parsedDoc.extractedData
  });
});

server.get('/api/documents/:sessionId/stream', async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache');
  reply.raw.setHeader('Connection', 'keep-alive');
  
  // Explicitly add CORS headers since flushHeaders bypasses the @fastify/cors plugin
  if (request.headers.origin) {
    reply.raw.setHeader('Access-Control-Allow-Origin', request.headers.origin);
    reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');
  }

  // Need to flush headers to establish SSE connection immediately
  reply.raw.flushHeaders();

  // Fetch document from Redis
  const doc = await redis.get(`doc:${sessionId}`);
  if (!doc) {
    reply.raw.write(`data: ${JSON.stringify({ type: 'error', error: "Session not found" })}\n\n`);
    reply.raw.end();
    return reply;
  }

  const parsedDoc = typeof doc === 'string' ? JSON.parse(doc) : doc;

  const emit = (data: any) => {
    reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    emit({ type: 'status', message: 'Starting analysis workflow...' });

    // Execute Mastra Workflow
    const run = await debateWorkflow.createRun({ runId: sessionId });
    const debateResult = await run.start({
      inputData: {
        contractData: parsedDoc.extractedData,
        threadId: sessionId,
        userType: parsedDoc.userType || 'User',
        emit
      }
    });

    const finalVerdictText = (debateResult as any).result?.finalVerdict || "Debate failed to reach a final verdict.";

    // Score the verdict
    const scoreData = await processor.calculateFinalScore(finalVerdictText);
    await processor.updateFinalState(sessionId, scoreData, finalVerdictText);

    emit({ 
      type: 'complete', 
      scoreData, 
      finalVerdictText 
    });

  } catch (err: any) {
    server.log.error(err);
    emit({ type: 'error', message: err.message });
  } finally {
    reply.raw.end();
  }
  
  return reply;
});

server.get('/api/documents/:sessionId/negotiation', async (request, reply) => {
  const { sessionId } = request.params as { sessionId: string };
  try {
    const suggestions = await processor.generateNegotiationSuggestions(sessionId);
    return { suggestions };
  } catch (err: any) {
    server.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
});
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`API Server running on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
