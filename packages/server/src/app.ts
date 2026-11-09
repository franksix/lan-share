import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { deviceRoutes } from './routes/devices.js';
import { fileRoutes } from './routes/files.js';

export function createApp(): FastifyInstance {
  const app = Fastify({ logger: { level: 'info' } });

  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    reply.status(500).send({ error: err.message });
  });

  app.addContentTypeParser('application/octet-stream', (req, payload, done) => {
    done(null, payload);
  });

  app.register(deviceRoutes);
  app.register(fileRoutes);

  // 托管前端打包产物
  const clientDist = path.resolve(process.cwd(), '../client/dist');
  if (fs.existsSync(clientDist)) {
    app.register(fastifyStatic, {
      root: clientDist,
      prefix: '/',
    });

    // SPA 路由降级：非 API 请求全部返回 index.html
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith('/api') || req.raw.url?.startsWith('/ws')) {
        reply.status(404).send({ error: 'Not Found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  }

  return app;
}