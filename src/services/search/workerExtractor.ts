import type { ExtractRequest, ExtractResponse, PageText } from '../../adapters/types';

export interface WorkerLike {
  postMessage(message: ExtractRequest): void;
  addEventListener(type: 'message', callback: (event: MessageEvent<ExtractResponse>) => void): void;
  removeEventListener(type: 'message', callback: (event: MessageEvent<ExtractResponse>) => void): void;
}

export interface WorkerExtractorDeps {
  worker: WorkerLike;
  readBytes(sourceId: string): Promise<Uint8Array>;
}

/**
 * Buendelt Bytes-Lesen und Worker-Nachrichten zu der extractUncached-Funktion,
 * die der Suchdienst erwartet. Eine Anfrage sammelt die Seitennachrichten
 * dieser Quelle, bis der Worker done meldet.
 */
export function createWorkerExtractor({ worker, readBytes }: WorkerExtractorDeps) {
  return (sourceId: string, indices: number[]): Promise<PageText[]> =>
    new Promise<PageText[]>((resolve, reject) => {
      const pages: PageText[] = [];
      const onMessage = (event: MessageEvent<ExtractResponse>) => {
        const message = event.data;
        if (message.sourceId !== sourceId) return;
        if (message.type === 'page') {
          pages.push({ blockIndex: message.blockIndex, text: message.text, spans: message.spans });
        } else if (message.type === 'done') {
          worker.removeEventListener('message', onMessage);
          resolve(pages);
        } else if (message.type === 'error') {
          worker.removeEventListener('message', onMessage);
          reject(new Error(message.message));
        }
      };
      worker.addEventListener('message', onMessage);
      readBytes(sourceId)
        .then((bytes) => worker.postMessage({ type: 'extract', sourceId, bytes, indices }))
        .catch((error) => {
          worker.removeEventListener('message', onMessage);
          reject(error);
        });
    });
}
