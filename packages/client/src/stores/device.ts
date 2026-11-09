import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Device, DeviceType } from '@lan-share/shared';
import { uuid } from '../services/uuid';
import { connectWs, rename as wsRename } from '../services/ws';
import { useSessionStore } from './session';

const DEVICE_ID_KEY = 'lan-share.deviceId';
const DEVICE_NAME_KEY = 'lan-share.deviceName';

function detectType(): DeviceType {
  return /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
}

function detectDefaultName(): string {
  const ua = navigator.userAgent;
  let os = 'Device';
  if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac OS/.test(ua)) os = 'Mac';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  return `${os}-${Math.random().toString(36).slice(2, 6)}`;
}

function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export const useDeviceStore = defineStore('device', () => {
  const sessionStore = useSessionStore();
  const self = ref<Device | null>(null);
  const devices = ref<Device[]>([]);
  const status = ref<'connecting' | 'open' | 'closed'>('connecting');

  const others = computed(() => devices.value.filter((d) => d.id !== self.value?.id));

  function init(): void {
    const id = getOrCreateDeviceId();
    const name = localStorage.getItem(DEVICE_NAME_KEY) || detectDefaultName();
    localStorage.setItem(DEVICE_NAME_KEY, name);
    const type = detectType();

    self.value = { id, name, type, ip: '', online: true, lastSeen: Date.now() };

    connectWs(id, name, type, {
      onList: (list) => { devices.value = list; },
      onJoined: (d) => { if (!devices.value.find((x) => x.id === d.id)) devices.value.push(d); },
      onLeft: (deviceId) => { devices.value = devices.value.filter((x) => x.id !== deviceId); },
      onRenamed: ({ deviceId, name: newName }) => {
        const d = devices.value.find((x) => x.id === deviceId);
        if (d) d.name = newName;
        if (self.value?.id === deviceId) {
          self.value.name = newName;
          localStorage.setItem(DEVICE_NAME_KEY, newName);
        }
      },
      onTextIncoming: (payload) => {
        sessionStore.addMessage(payload.fromId, {
          id: payload.id,
          type: 'text',
          text: payload.text,
          fromId: payload.fromId,
          fromName: payload.fromName,
          toId: id,
          ts: payload.ts,
          isSelf: false,
        });
      },
      onFileIncoming: (payload) => {
        sessionStore.addMessage(payload.file.fromId, {
          id: uuid(),
          type: 'file',
          file: {
            id: payload.file.id,
            name: payload.file.name,
            size: payload.file.size,
            mimeType: payload.file.mimeType,
          },
          fromId: payload.file.fromId,
          fromName: payload.file.fromName,
          toId: id,
          ts: payload.file.ts,
          isSelf: false,
          status: 'success',
        });
      },
      onStatus: (s) => { status.value = s; },
    });
  }

  function rename(newName: string): void {
    const trimmed = newName.trim();
    if (!trimmed) return;
    wsRename(trimmed);
  }

  return { self, devices, others, status, init, rename };
});