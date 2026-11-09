import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { Device, ChatMessage } from '@lan-share/shared';

export const useSessionStore = defineStore('session', () => {
  const SESSION_KEY = 'lan-share.sessions';
  const ACTIVE_DEVICE_KEY = 'lan-share.activeDevice';

  const savedHistories = localStorage.getItem(SESSION_KEY);
  const histories = ref<Record<string, ChatMessage[]>>(savedHistories ? JSON.parse(savedHistories) : {});
  
  const savedActive = localStorage.getItem(ACTIVE_DEVICE_KEY);
  const activeDevice = ref<Device | null>(savedActive ? JSON.parse(savedActive) : null);

  watch(histories, (val) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(val));
  }, { deep: true });

  watch(activeDevice, (val) => {
    if (val) {
      localStorage.setItem(ACTIVE_DEVICE_KEY, JSON.stringify(val));
    } else {
      localStorage.removeItem(ACTIVE_DEVICE_KEY);
    }
  });

  const currentMessages = computed(() => {
    if (!activeDevice.value) return [];
    return histories.value[activeDevice.value.id] || [];
  });

  function setActiveDevice(device: Device | null) {
    activeDevice.value = device;
  }

  function addMessage(targetId: string, msg: ChatMessage) {
    if (!histories.value[targetId]) {
      histories.value[targetId] = [];
    }
    histories.value[targetId].push(msg);
  }

  function updateFileMessage(targetId: string, msgId: string, updates: Partial<ChatMessage>) {
    const msgs = histories.value[targetId];
    if (!msgs) return;
    const index = msgs.findIndex(m => m.id === msgId);
    if (index !== -1) {
      msgs[index] = { ...msgs[index], ...updates } as ChatMessage;
    }
  }

  return {
    activeDevice,
    histories,
    currentMessages,
    setActiveDevice,
    addMessage,
    updateFileMessage,
  };
});