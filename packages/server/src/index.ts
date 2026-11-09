import os from 'node:os';
import { createApp } from './app.js';
import { attachWs } from './ws/hub.js';
import { config } from './config.js';

function printLanAddresses(port: number): void {
  const nets = os.networkInterfaces();
  const lines: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        lines.push(`  http://${net.address}:${port}`);
      }
    }
  }
  console.log('\n局域网访问地址：');
  console.log(lines.join('\n') || '  (未检测到局域网 IPv4 地址)');
  console.log('');
}

async function main(): Promise<void> {
  const app = createApp();
  await app.listen({ host: config.host, port: config.port });
  attachWs(app.server);
  printLanAddresses(config.port);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});