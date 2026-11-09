export const WS_TYPES = {
  // server -> client
  DEVICE_LIST: 'device.list',
  DEVICE_JOINED: 'device.joined',
  DEVICE_LEFT: 'device.left',
  DEVICE_RENAMED: 'device.renamed',
  TEXT_INCOMING: 'text.incoming',
  FILE_INCOMING: 'file.incoming',
  ERROR: 'error',
  // client -> server
  PING: 'ping',
  RENAME: 'rename',
  SEND_TEXT: 'send.text',
} as const;

export type WsType = typeof WS_TYPES[keyof typeof WS_TYPES];

export interface WsMessage<T = unknown> {
  type: WsType;
  payload: T;
  ts: number;
}

export interface WsDeviceListPayload { devices: import('./types').Device[] }
export interface WsDeviceJoinedPayload { device: import('./types').Device }
export interface WsDeviceLeftPayload { deviceId: string }
export interface WsDeviceRenamedPayload { deviceId: string; name: string }
export interface WsRenamePayload { name: string }

export interface WsSendTextPayload {
  targetId: string;
  text: string;
}

export interface WsTextIncomingPayload {
  id: string;
  fromId: string;
  fromName: string;
  text: string;
  ts: number;
}

export interface FileInfo {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  fromId: string;
  fromName: string;
  ts: number;
}

export interface WsFileIncomingPayload {
  file: FileInfo;
}