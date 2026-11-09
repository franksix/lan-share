<script setup lang="ts">
import { onMounted } from 'vue';
import { useDeviceStore } from './stores/device';

const device = useDeviceStore();
onMounted(() => device.init());
</script>

<template>
  <div class="app">
    <header class="topbar">
      <h1>LAN Share</h1>
      <span class="subtitle">局域网文件互传</span>
    </header>
    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<style>
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f5f6f8;
  color: #1f2937;
}
.app { max-width: 1000px; margin: 0 auto; padding: 16px; height: 100vh; display: flex; flex-direction: column; }
.topbar { display: flex; align-items: baseline; gap: 10px; padding: 8px 0 16px; flex-shrink: 0; }
.topbar h1 { font-size: 20px; margin: 0; }
.subtitle { color: #999; font-size: 13px; }
.content { flex: 1; overflow: hidden; }
</style>