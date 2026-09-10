import type { OcrWorker } from '../../adapters/ocr/tesseractWorker';
import type { DocumentAdapter } from '../../adapters/types';
import type { SourceId } from '../../domain/types';
import type { PageTextStore } from './pageTextStore';

export interface OcrDeps {
  /** Der Dispatcher: rendert jede Seite unabhaengig von der Quellart. */
  adapter: DocumentAdapter;
  /** Schreibt den erkannten Text in den bestehenden pageText-Cache. */
  store: PageTextStore;
  /** Injizierte tesseract-Fassade. */
  createOcrWorker(): Promise<OcrWorker>;
}

export function createOcrService({ adapter, store, createOcrWorker }: OcrDeps): {
  run(
    sourceId: SourceId,
    blockCount: number,
    onProgress?: (done: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<void>;
} {
  return {
    async run(sourceId, blockCount, onProgress, signal) {
      const worker = await createOcrWorker();
      try {
        for (let blockIndex = 0; blockIndex < blockCount; blockIndex++) {
          if (signal?.aborted) break;
          const bitmap = await adapter.renderBlock({ sourceId, blockIndex }, { targetWidth: 1500 });
          const text = await worker.recognize(bitmap.blob);
          await store.put(sourceId, { blockIndex, text, spans: [] });
          onProgress?.(blockIndex + 1, blockCount);
        }
      } finally {
        await worker.terminate();
      }
    },
  };
}
