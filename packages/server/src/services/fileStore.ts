import fs from 'node:fs';
import path from 'node:path';
import { CHUNK_SIZE, type FileInfo } from '@lan-share/shared';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const RECEIVED_DIR = path.join(DATA_DIR, 'received');
const META_FILE = path.join(DATA_DIR, 'meta.json');

if (!fs.existsSync(RECEIVED_DIR)) fs.mkdirSync(RECEIVED_DIR, { recursive: true });
if (!fs.existsSync(META_FILE)) fs.writeFileSync(META_FILE, '{}');

type MetaRecord = FileInfo & { storedName: string; receivedChunks: number[] };
let registry: Record<string, MetaRecord> = {};

try {
  registry = JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
} catch {
  registry = {};
}

function saveMeta() {
  fs.writeFileSync(META_FILE, JSON.stringify(registry, null, 2));
}

export function getFilePath(fileId: string): string | null {
  const meta = registry[fileId];
  if (!meta) return null;
  return path.join(RECEIVED_DIR, meta.storedName);
}

export function getFileMeta(fileId: string): FileInfo | null {
  const meta = registry[fileId];
  if (!meta) return null;
  const { storedName, receivedChunks, ...publicMeta } = meta;
  return publicMeta;
}

export function listFiles(): FileInfo[] {
  return Object.values(registry).map(meta => {
    const { storedName, receivedChunks, ...publicMeta } = meta;
    return publicMeta;
  }).sort((a, b) => b.ts - a.ts);
}

export function initFile(meta: Omit<FileInfo, 'ts'>): MetaRecord {
  if (registry[meta.id]) {
    return registry[meta.id]; 
  }
  const storedName = `${meta.id}_${meta.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const record: MetaRecord = { ...meta, ts: Date.now(), storedName, receivedChunks: [] };
  registry[meta.id] = record;
  saveMeta();
  
  const filePath = path.join(RECEIVED_DIR, storedName);
  fs.writeFileSync(filePath, '');
  return record;
}

export function writeChunk(fileId: string, chunkIndex: number, buffer: Buffer): boolean {
  const meta = registry[fileId];
  if (!meta) return false;
  
  const filePath = path.join(RECEIVED_DIR, meta.storedName);
  const offset = chunkIndex * CHUNK_SIZE;
  
  const fd = fs.openSync(filePath, 'r+');
  try {
    fs.writeSync(fd, buffer, 0, buffer.length, offset);
  } finally {
    fs.closeSync(fd);
  }
  
  if (!meta.receivedChunks.includes(chunkIndex)) {
    meta.receivedChunks.push(chunkIndex);
    saveMeta();
  }
  return true;
}

export function completeFile(fileId: string, totalChunks: number): boolean {
  const meta = registry[fileId];
  if (!meta) return false;
  return meta.receivedChunks.length === totalChunks;
}

export function deleteFile(fileId: string): boolean {
  const meta = registry[fileId];
  if (!meta) return false;
  
  const filePath = path.join(RECEIVED_DIR, meta.storedName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  
  delete registry[fileId];
  saveMeta();
  return true;
}