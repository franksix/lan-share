import type { FastifyInstance } from 'fastify';
import { initFile, writeChunk, completeFile, deleteFile, listFiles, getFilePath, getFileMeta } from '../services/fileStore.js';
import { broadcastToDevice } from '../ws/hub.js';
import { WS_TYPES } from '@lan-share/shared';
import fs from 'node:fs';

export async function fileRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/files', async () => {
    return { files: listFiles() };
  });

  app.delete('/api/files/:fileId', async (req) => {
    const { fileId } = req.params as { fileId: string };
    const ok = deleteFile(fileId);
    return { ok };
  });

  app.post('/api/files/init', async (req) => {
    const body = req.body as any;
    const record = initFile({
      id: body.fileId,
      name: body.name,
      size: body.size,
      mimeType: body.mimeType,
      fromId: body.fromId,
      fromName: body.fromName,
    });
    return { ok: true, file: record };
  });

  app.put('/api/files/:fileId/chunk/:index', async (req, reply) => {
    const { fileId, index } = req.params as { fileId: string; index: string };
    const chunks: Buffer[] = [];
    for await (const chunk of req.raw) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (!buffer.length) return reply.status(400).send({ error: 'Empty chunk' });

    const ok = writeChunk(fileId, parseInt(index), buffer);
    if (!ok) return reply.status(404).send({ error: 'File not found' });

    return { ok: true };
  });

  app.post('/api/files/:fileId/complete', async (req) => {
    const { fileId } = req.params as { fileId: string };
    const body = req.body as { totalChunks: number; targetId: string };
    
    const isValid = completeFile(fileId, body.totalChunks);
    if (!isValid) throw new Error('Chunks missing');

    const meta = getFileMeta(fileId);
    if (meta) {
      broadcastToDevice(body.targetId, WS_TYPES.FILE_INCOMING, { file: meta });
    }

    return { ok: true };
  });
  
  app.get('/api/files/:fileId/download', async (req, reply) => {
    const { fileId } = req.params as { fileId: string };
    const filePath = getFilePath(fileId);
    const meta = getFileMeta(fileId);
    
    if (!filePath || !fs.existsSync(filePath) || !meta) {
      return reply.status(404).send({ error: 'File not found' });
    }

    const encodedName = encodeURIComponent(meta.name);
    reply.header('Content-Type', meta.mimeType || 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`);
    
    return reply.send(fs.createReadStream(filePath));
  });
}