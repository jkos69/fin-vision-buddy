import type { CapexRecord } from '@/types/capex';
import type { CapexWorkerMessage } from './capex-parser.worker';

const MAX_FILE_SIZE_MB = 50;

export async function parseCapexFile(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<CapexRecord[]> {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`Arquivo muito grande (máx ${MAX_FILE_SIZE_MB}MB).`);
  }

  onProgress?.(0, 100);

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./capex-parser.worker.ts', import.meta.url), { type: 'module' });

    worker.onmessage = (event: MessageEvent<CapexWorkerMessage>) => {
      const message = event.data;
      if (message.type === 'progress') {
        onProgress?.(message.current, message.total);
        return;
      }
      worker.terminate();
      if (message.type === 'success') resolve(message.records);
      else reject(new Error(message.message));
    };

    worker.onerror = (error) => {
      worker.terminate();
      reject(new Error(error.message || 'Erro ao processar arquivo'));
    };

    worker.postMessage({ file });
  });
}