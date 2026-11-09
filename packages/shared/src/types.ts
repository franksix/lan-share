export type DeviceType = 'desktop' | 'mobile';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  ip: string;
  online: boolean;
  lastSeen: number;
}

export type MessageType = 'text' | 'file';
export type MessageStatus = 'sending' | 'success' | 'error';

export interface BaseMessage {
  id: string;
  type: MessageType;
  fromId: string;
  fromName: string;
  toId: string;
  ts: number;
  isSelf: boolean;
}

export interface TextMessage extends BaseMessage {
  type: 'text';
  text: string;
}

export interface FileMessage extends BaseMessage {
  type: 'file';
  file: {
    id: string;
    name: string;
    size: number;
    mimeType: string;
  };
  status?: MessageStatus;
  progress?: number;
  speed?: number;
}

export type ChatMessage = TextMessage | FileMessage;

export interface FileInfo {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  fromId: string;
  fromName: string;
  ts: number;
}

export interface StoredFileInfo extends FileInfo {
  receivedChunks: number[];
}