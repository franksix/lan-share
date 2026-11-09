import type { FastifyInstance } from 'fastify';
import * as registry from '../services/deviceRegistry.js';

export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/devices', async () => ({
    devices: registry.listDevices(),
  }));

  app.get('/api/info', async () => ({
    name: 'LAN Share',
    version: '0.1.0',
    time: Date.now(),
  }));
}