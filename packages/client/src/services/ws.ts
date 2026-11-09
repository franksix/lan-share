import {
  WS_TYPES,
  PING_INTERVAL,
  WS_PATH,
  type DeviceType,
  type Device,
  type WsTextIncomingPayload,
  type WsFileIncomingPayload,
} from '@lan-share/shared';

export interface WsHandlers {
  onList: (devices: Device[]) => void;
  onJoined: (device: Device) => void;
  onLeft: (deviceId: string) => void;
  onRenamed: (p: { deviceId: string; name: string }) => void;
  onTextIncoming?: (payload: WsTextIncomingPayload) => void;
  onFileIncoming?: (payload: WsFileIncomingPayload) => void;
  onStatus?: (status: 'connecting' | 'open' | 'closed') => void;
}

let currentWs: WebSocket | null = null;
let pingTimer: number | null = null;
let reconnectTimer: number | null = null;
let closedByUser = false;

export function connectWs(
  deviceId: string,
  name: string,
  type: DeviceType,
  handlers: WsHandlers,
): void {
  closedByUser = false;
  open(deviceId, name, type, handlers);
}

function open(
  deviceId: string,
  name: string,
  type: DeviceType,
  handlers: WsHandlers,
): void {
  handlers.onStatus?.('connecting');

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}${WS_PATH}?deviceId=${encodeURIComponent(
    deviceId,
  )}&name=${encodeURIComponent(name)}&type=${type}`;

  const ws = new WebSocket(url);
  currentWs = ws;

  ws.onopen = () => {
    handlers.onStatus?.('open');
    pingTimer = window.setInterval(() => {
      send({ type: WS_TYPES.PING, payload: {}, ts: Date.now() });
    }, PING_INTERVAL);
  };

  ws.onmessage = (e) => {
    let msg: { type: string; payload: any };
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    switch (msg.type) {
      case WS_TYPES.DEVICE_LIST: handlers.onList(msg.payload.devices); break;
      case WS_TYPES.DEVICE_JOINED: handlers.onJoined(msg.payload.device); break;
      case WS_TYPES.DEVICE_LEFT: handlers.onLeft(msg.payload.deviceId); break;
      case WS_TYPES.DEVICE_RENAMED: handlers.onRenamed(msg.payload); break;
      case WS_TYPES.TEXT_INCOMING: handlers.onTextIncoming?.(msg.payload); break;
      case WS_TYPES.FILE_INCOMING: handlers.onFileIncoming?.(msg.payload); break;
    }
  };

  ws.onclose = () => {
    handlers.onStatus?.('closed');
    if (pingTimer) clearInterval(pingTimer);
    if (!closedByUser) {
      reconnectTimer = window.setTimeout(() => open(deviceId, name, type, handlers), 2000);
    }
  };
}

export function send(msg: { type: string; payload: unknown; ts: number }): void {
  if (currentWs?.readyState === WebSocket.OPEN) {
    currentWs.send(JSON.stringify(msg));
  }
}

export function rename(name: string): void {
  send({ type: WS_TYPES.RENAME, payload: { name }, ts: Date.now() });
}

export function sendText(targetId: string, text: string): void {
  send({ type: WS_TYPES.SEND_TEXT, payload: { targetId, text }, ts: Date.now() });
}

export function disconnect(): void {
  closedByUser = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  currentWs?.close();
  currentWs = null;
}