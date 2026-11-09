import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import {
  WS_TYPES,
  WS_PATH,
  HEARTBEAT_TIMEOUT,
  type DeviceType,
  type WsMessage,
  type WsSendTextPayload,
} from '@lan-share/shared';
import * as registry from '../services/deviceRegistry.js';

const clients = new Map<string, WebSocket>();

export function send(ws: WebSocket, type: string, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, payload, ts: Date.now() }));
  }
}

export function broadcastToDevice(deviceId: string, type: string, payload: unknown): void {
  const ws = clients.get(deviceId);
  if (ws) {
    send(ws, type, payload);
  }
}

export function broadcast(type: string, payload: unknown, exceptId?: string): void {
  const data = JSON.stringify({ type, payload, ts: Date.now() });
  for (const [id, ws] of clients) {
    if (id !== exceptId && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

function handleMessage(deviceId: string, msg: WsMessage): void {
  switch (msg.type) {
    case WS_TYPES.PING:
      registry.touchDevice(deviceId);
      break;
    case WS_TYPES.RENAME: {
      const { name } = msg.payload as { name: string };
      const d = registry.renameDevice(deviceId, name);
      if (d) {
        broadcast(WS_TYPES.DEVICE_RENAMED, { deviceId, name: d.name });
      }
      break;
    }
    case WS_TYPES.SEND_TEXT: {
      const { targetId, text } = msg.payload as WsSendTextPayload;
      const fromDevice = registry.getDevice(deviceId);
      
      if (fromDevice) {
        broadcastToDevice(targetId, WS_TYPES.TEXT_INCOMING, {
          id: Math.random().toString(36).slice(2),
          fromId: deviceId,
          fromName: fromDevice.name,
          text,
          ts: Date.now(),
        });
      }
      break;
    }
  }
}

export function attachWs(server: Server): void {
  const wss = new WebSocketServer({ server, path: WS_PATH });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const deviceId = url.searchParams.get('deviceId');
    const name = url.searchParams.get('name') || 'Unknown';
    const type = (url.searchParams.get('type') as DeviceType) || 'desktop';
    const ip = req.socket.remoteAddress?.replace(/^::ffff:/, '') || 'unknown';

    if (!deviceId) {
      ws.close(1008, 'missing deviceId');
      return;
    }

    const oldWs = clients.get(deviceId);
    if (oldWs && oldWs !== ws) {
      oldWs.close(1000, 'replaced');
    }

    const device = registry.upsertDevice({ id: deviceId, name, type, ip });
    clients.set(deviceId, ws);

    send(ws, WS_TYPES.DEVICE_LIST, { devices: registry.listDevices() });
    broadcast(WS_TYPES.DEVICE_JOINED, { device }, deviceId);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage;
        handleMessage(deviceId, msg);
      } catch {
        // ignore
      }
    });

    ws.on('close', () => {
      if (clients.get(deviceId) === ws) {
        clients.delete(deviceId);
        registry.removeDevice(deviceId);
        broadcast(WS_TYPES.DEVICE_LEFT, { deviceId });
      }
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (const d of registry.listDevices()) {
      if (now - d.lastSeen > HEARTBEAT_TIMEOUT) {
        const ws = clients.get(d.id);
        if (ws) ws.close(1000, 'heartbeat timeout');
      }
    }
  }, 3000);
}