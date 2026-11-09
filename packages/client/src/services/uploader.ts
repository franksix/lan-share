import { CHUNK_SIZE } from '@lan-share/shared';

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  speed: number;
}

export async function uploadFile(
  file: File,
  targetId: string,
  fromId: string,
  fromName: string,
  fileId: string,
  onProgress: (p: UploadProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const initRes = await fetch('/api/files/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileId,
      targetId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      fromId,
      fromName,
    }),
  });
  if (!initRes.ok) throw new Error('Init failed');
  
  const { file: serverFile } = await initRes.json();
  const receivedChunks: number[] = serverFile.receivedChunks || [];

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const missingChunks = [];
  let uploadedBytes = 0;
  
  for (let i = 0; i < totalChunks; i++) {
    if (receivedChunks.includes(i)) {
      uploadedBytes += Math.min(CHUNK_SIZE, file.size - i * CHUNK_SIZE);
    } else {
      missingChunks.push(i);
    }
  }

  const startTime = Date.now();
  onProgress({
    loaded: uploadedBytes,
    total: file.size,
    percent: uploadedBytes / file.size * 100,
    speed: 0,
  });

  const uploadChunkWithRetry = async (index: number, retries = 3): Promise<void> => {
    if (signal?.aborted) throw new Error('Aborted');
    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);
    
    try {
      const res = await fetch(`/api/files/${fileId}/chunk/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: chunk,
        signal,
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      uploadedBytes += chunk.size;
      const elapsed = (Date.now() - startTime) / 1000;
      onProgress({
        loaded: uploadedBytes,
        total: file.size,
        percent: uploadedBytes / file.size * 100,
        speed: uploadedBytes / elapsed,
      });
    } catch (err) {
      if (retries > 0 && !signal?.aborted) {
        await new Promise(r => setTimeout(r, 1000));
        return uploadChunkWithRetry(index, retries - 1);
      }
      throw err;
    }
  };

  const queue = [...missingChunks];
  const workers = Array.from({ length: 2 }, async () => {
    while (queue.length > 0) {
      const index = queue.shift();
      if (index !== undefined) await uploadChunkWithRetry(index);
    }
  });
  
  await Promise.all(workers);

  await fetch(`/api/files/${fileId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ totalChunks, targetId }),
  });
}