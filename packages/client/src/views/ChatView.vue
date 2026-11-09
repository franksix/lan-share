<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { useDeviceStore } from '../stores/device';
import { useSessionStore } from '../stores/session';
import { sendText } from '../services/ws';
import { uploadFile } from '../services/uploader';
import { uuid } from '../services/uuid';
import type { Device, ChatMessage, FileInfo } from '@lan-share/shared';

const device = useDeviceStore();
const session = useSessionStore();

const draft = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const messagesEnd = ref<HTMLElement | null>(null);

const showFileManager = ref(false);
const serverFiles = ref<FileInfo[]>([]);

const retryFileTarget = ref<{ targetId: string; msgId: string; fileId: string } | null>(null);
const retryInput = ref<HTMLInputElement | null>(null);

function scrollToBottom() {
  nextTick(() => {
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth' });
  });
}
watch(() => session.currentMessages.length, scrollToBottom);

function selectDevice(d: Device) {
  session.setActiveDevice(d);
  scrollToBottom();
}

function sendMessage() {
  const text = draft.value.trim();
  if (!text || !session.activeDevice || !device.self) return;

  const targetId = session.activeDevice.id;
  const msgId = uuid();
  const ts = Date.now();

  session.addMessage(targetId, {
    id: msgId, type: 'text', text,
    fromId: device.self.id, fromName: device.self.name,
    toId: targetId, ts, isSelf: true,
  });

  sendText(targetId, text);
  draft.value = '';
}

function triggerFileSelect() {
  if (!session.activeDevice) return;
  fileInput.value?.click();
}

async function doUpload(file: File, targetId: string, msgId: string, fileId: string) {
  if (!device.self) return;
  try {
    await uploadFile(file, targetId, device.self.id, device.self.name, fileId, (p) => {
      session.updateFileMessage(targetId, msgId, { progress: p.percent, speed: p.speed });
    });
    session.updateFileMessage(targetId, msgId, { status: 'success' });
  } catch (err: any) {
    session.updateFileMessage(targetId, msgId, { status: 'error' });
  }
}

async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !session.activeDevice || !device.self) return;

  const targetId = session.activeDevice.id;
  const msgId = uuid();
  const fileId = uuid();
  const ts = Date.now();

  session.addMessage(targetId, {
    id: msgId, type: 'file',
    file: { id: fileId, name: file.name, size: file.size, mimeType: file.type },
    fromId: device.self.id, fromName: device.self.name, toId: targetId, ts, isSelf: true,
    status: 'sending', progress: 0, speed: 0,
  });

  await doUpload(file, targetId, msgId, fileId);
}

function retryFile(m: ChatMessage) {
  if (m.type !== 'file' || !session.activeDevice) return;
  retryFileTarget.value = {
    targetId: session.activeDevice.id,
    msgId: m.id,
    fileId: m.file.id,
  };
  retryInput.value?.click();
}

async function onRetryFileSelected(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !retryFileTarget.value || !device.self) return;

  const { targetId, msgId, fileId } = retryFileTarget.value;
  retryFileTarget.value = null;

  session.updateFileMessage(targetId, msgId, { status: 'sending', progress: 0 });
  await doUpload(file, targetId, msgId, fileId);
}

async function openFileManager() {
  showFileManager.value = true;
  const res = await fetch('/api/files');
  const data = await res.json();
  serverFiles.value = data.files || [];
}

async function deleteServerFile(id: string) {
  if (!confirm('确定要删除该文件吗？')) return;
  await fetch(`/api/files/${id}`, { method: 'DELETE' });
  serverFiles.value = serverFiles.value.filter(f => f.id !== id);
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function formatPercent(p: number | undefined) {
  if (p === undefined) return '0.0';
  if (p >= 100) return '100';
  return p.toFixed(1);
}

function getLoadedSize(m: ChatMessage) {
  if (m.type !== 'file' || m.progress === undefined) return 0;
  return (m.progress / 100) * m.file.size;
}
</script>

<template>
  <div class="layout">
    <aside :class="['sidebar', { 'mobile-hidden': session.activeDevice }]">
      <div class="self-info">
        <span class="name">{{ device.self?.name }}</span>
        <span :class="['dot', device.status]"></span>
      </div>
      <ul class="device-list">
        <li v-for="d in device.others" :key="d.id"
            :class="['device-item', { active: session.activeDevice?.id === d.id }]"
            @click="selectDevice(d)">
          <span class="icon">{{ d.type === 'mobile' ? 'M' : 'D' }}</span>
          <span class="d-name">{{ d.name }}</span>
        </li>
      </ul>
      <div class="sidebar-footer">
        <button class="manager-btn" @click="openFileManager">服务端文件管理</button>
      </div>
    </aside>

    <main v-if="session.activeDevice" class="chat-main">
      <header class="chat-header">
        <button class="back-btn" @click="session.setActiveDevice(null)">&lt;</button>
        <span>{{ session.activeDevice.name }}</span>
      </header>

      <div class="message-area">
        <div v-for="m in session.currentMessages" :key="m.id" :class="['msg-row', m.isSelf ? 'self' : 'other']">
          <div class="bubble">
            <div class="msg-meta" v-if="!m.isSelf">{{ m.fromName }}</div>
            
            <div v-if="m.type === 'text'" class="msg-text">{{ m.text }}</div>
            
            <div v-if="m.type === 'file'" class="msg-file">
              <div class="file-icon">FILE</div>
              <div class="file-details">
                <div class="f-name">{{ m.file.name }}</div>
                <div class="f-size">{{ formatSize(m.file.size) }}</div>
                
                <div v-if="m.isSelf && m.status === 'sending'" class="progress-box">
                  <div class="bar">
                    <div class="fill" :style="{ width: Math.max(1, (m.progress || 0)) + '%' }"></div>
                  </div>
                  <div class="stats">
                    <span>{{ formatPercent(m.progress) }}%</span>
                    <span>{{ formatSize(getLoadedSize(m)) }} / {{ formatSize(m.file.size) }}</span>
                    <span>{{ formatSize(m.speed || 0) }}/s</span>
                  </div>
                </div>
                
                <div v-if="m.isSelf && m.status === 'error'" class="error-box">
                  <span class="err-text">发送中断</span>
                  <button class="retry-btn" @click="retryFile(m)">重试</button>
                </div>
                
                <a v-if="!m.isSelf" :href="`/api/files/${m.file.id}/download`" :download="m.file.name" class="dl-btn">下载</a>
              </div>
            </div>
          </div>
        </div>
        <div ref="messagesEnd"></div>
      </div>

      <footer class="chat-input-area">
        <button class="icon-btn" @click="triggerFileSelect">+</button>
        <input type="file" ref="fileInput" style="display: none;" @change="onFileSelected" />
        <input type="file" ref="retryInput" style="display: none;" @change="onRetryFileSelected" />
        <textarea v-model="draft" @keyup.enter.exact.prevent="sendMessage" placeholder="输入消息，按回车发送..."></textarea>
        <button class="send-btn" @click="sendMessage">发送</button>
      </footer>
    </main>

    <main v-else class="chat-main empty-state">
      <p>请选择左侧设备开始聊天</p>
    </main>

    <div v-if="showFileManager" class="modal-overlay" @click.self="showFileManager = false">
      <div class="modal">
        <h3>服务端文件管理</h3>
        <div v-if="serverFiles.length === 0" class="empty-list">暂无文件</div>
        <ul v-else class="file-list">
          <li v-for="f in serverFiles" :key="f.id">
            <div class="file-info">
              <div class="f-name">{{ f.name }}</div>
              <div class="f-meta">{{ formatSize(f.size) }} · 来自 {{ f.fromName }}</div>
            </div>
            <button class="del-btn" @click="deleteServerFile(f.id)">删除</button>
          </li>
        </ul>
        <div class="modal-actions">
          <button class="btn-close" @click="showFileManager = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  display: flex; height: calc(100vh - 60px); background: #fff;
  border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}

.sidebar {
  width: 240px; border-right: 1px solid #eee; display: flex; flex-direction: column; background: #fafafa;
}
.self-info { padding: 16px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 8px; font-weight: 600; background: #fff; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #999; }
.dot.open { background: #22c55e; }
.device-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex: 1; }
.device-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; }
.device-item:hover { background: #f3f4f6; }
.device-item.active { background: #eff6ff; border-left: 3px solid #3b82f6; }
.device-item .icon { font-size: 12px; font-weight: 700; color: #3b82f6; }
.sidebar-footer { padding: 12px; border-top: 1px solid #eee; background: #fff; }
.manager-btn { width: 100%; padding: 8px; background: #f3f4f6; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; color: #555; }
.manager-btn:hover { background: #e5e7eb; }

.chat-main { flex: 1; display: flex; flex-direction: column; background: #f9fafb; }
.empty-state { align-items: center; justify-content: center; color: #999; }
.chat-header { padding: 12px 20px; background: #fff; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 12px; font-weight: 600; }
.back-btn { display: none; background: none; border: none; font-size: 18px; cursor: pointer; font-weight: bold; }

.message-area { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
.msg-row { display: flex; }
.msg-row.self { justify-content: flex-end; }
.msg-row.other { justify-content: flex-start; }
.bubble { max-width: 70%; background: #fff; border-radius: 12px; padding: 12px 16px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.self .bubble { background: #3b82f6; color: #fff; border-bottom-right-radius: 2px; }
.other .bubble { background: #fff; border-bottom-left-radius: 2px; }
.msg-meta { font-size: 11px; color: #888; margin-bottom: 4px; }
.msg-text { font-size: 15px; line-height: 1.5; white-space: pre-wrap; word-break: break-all; }

.msg-file { display: flex; gap: 12px; align-items: flex-start; min-width: 220px; }
.file-icon { font-size: 10px; font-weight: bold; background: rgba(0,0,0,0.1); padding: 4px 6px; border-radius: 4px; }
.self .file-icon { background: rgba(255,255,255,0.2); }
.file-details { flex: 1; }
.f-name { font-weight: 500; font-size: 14px; word-break: break-all; margin-bottom: 2px; }
.f-size { font-size: 12px; opacity: 0.8; }
.self .f-size { color: #dbeafe; }

.progress-box { margin-top: 8px; }
.bar { height: 4px; background: rgba(0,0,0,0.1); border-radius: 2px; overflow: hidden; margin-bottom: 6px; }
.fill { height: 100%; background: #fff; transition: width 0.2s; }
.self .fill { background: #fff; }
.other .fill { background: #3b82f6; }
.stats { display: flex; justify-content: space-between; font-size: 11px; opacity: 0.9; gap: 8px; }

.error-box { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
.err-text { color: #fca5a5; font-size: 12px; }
.retry-btn { background: #fff; color: #3b82f6; border: none; padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: bold; }

.dl-btn { display: inline-block; margin-top: 8px; padding: 4px 12px; background: #eff6ff; color: #3b82f6; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 500; }

.chat-input-area { padding: 16px; background: #fff; border-top: 1px solid #eee; display: flex; gap: 12px; align-items: flex-end; }
.icon-btn { background: none; border: 1px solid #ccc; font-size: 20px; cursor: pointer; padding: 4px 12px; border-radius: 8px; color: #666; line-height: 1.5; }
.icon-btn:hover { background: #f3f4f6; }
.chat-input-area textarea { flex: 1; height: 44px; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; resize: none; font-family: inherit; font-size: 14px; outline: none; transition: border-color 0.2s; }
.chat-input-area textarea:focus { border-color: #3b82f6; }
.send-btn { background: #3b82f6; color: #fff; border: none; height: 44px; padding: 0 20px; border-radius: 8px; cursor: pointer; font-weight: 500; }
.send-btn:hover { background: #2563eb; }

.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #fff; width: 90%; max-width: 500px; border-radius: 12px; padding: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); display: flex; flex-direction: column; max-height: 80vh; }
.modal h3 { margin: 0 0 16px; font-size: 16px; }
.file-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex: 1; }
.file-list li { display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #eee; }
.file-info { display: flex; flex-direction: column; gap: 4px; }
.file-info .f-name { font-weight: 500; font-size: 14px; }
.file-info .f-meta { font-size: 12px; color: #888; }
.del-btn { background: #fee2e2; color: #ef4444; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold; }
.del-btn:hover { background: #fecaca; }
.empty-list { text-align: center; color: #999; padding: 20px; }
.modal-actions { display: flex; justify-content: flex-end; margin-top: 16px; }
.btn-close { background: #f3f4f6; color: #333; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; }

@media (max-width: 600px) {
  .sidebar { width: 100%; }
  .sidebar.mobile-hidden { display: none; }
  .back-btn { display: block; }
  .layout { height: calc(100vh - 40px); border-radius: 0; }
}
</style>