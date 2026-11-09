import type { Device, DeviceType } from '@lan-share/shared';

const devices = new Map<string, Device>();

export function upsertDevice(input: {
  id: string;
  name: string;
  type: DeviceType;
  ip: string;
}): Device {
  const device: Device = {
    id: input.id,
    name: input.name,
    type: input.type,
    ip: input.ip,
    online: true,
    lastSeen: Date.now(),
  };
  devices.set(device.id, device);
  return device;
}

export function touchDevice(id: string): void {
  const d = devices.get(id);
  if (d) {
    d.lastSeen = Date.now();
    d.online = true;
  }
}

export function removeDevice(id: string): void {
  devices.delete(id);
}

export function renameDevice(id: string, name: string): Device | undefined {
  const d = devices.get(id);
  if (d) d.name = name;
  return d;
}

export function getDevice(id: string): Device | undefined {
  return devices.get(id);
}

export function listDevices(): Device[] {
  return [...devices.values()];
}