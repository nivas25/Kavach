import Fastify from 'fastify';
import cors from '@fastify/cors';
import * as dotenv from 'dotenv';
import path from 'path';
import { getRedisInfo } from './lib/redis';
import { pingSupabase } from './lib/supabase';
import { DocumentProcessorService } from './services/documentProcessor';
import multipart from '@fastify/multipart';
import { v4 as uuidv4 } from 'uuid';

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const server = Fastify({
  logger: true
});

server.register(cors, {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-domain.com'] // Replace with your production domain
    : ['http://localhost:3000'],   // Next.js dev server
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
    // Extract userType from fields (fastify-multipart populates data.fields)
    const userTypeField = data.fields.userType;
    const userType = userTypeField && 'value' in userTypeField ? String(userTypeField.value) : 'Unknown';
    // For now, use a dummy userId until auth is fully wired
    const userId = '00000000-0000-0000-0000-000000000000';

    const sessionId = await processor.processAndExtractDocument(fileBuffer, fileName, userId, userType);

    server.log.info(`[UPLOAD] Processing completed for ${fileName}. Assigned Session: ${sessionId}`);

    return { 
      sessionId, 
      status: "processing", 
      message: "File uploaded and extraction completed."
    };
  } catch (error: any) {
    server.log.error(error);
    return reply.code(500).send({ error: error.message });
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
