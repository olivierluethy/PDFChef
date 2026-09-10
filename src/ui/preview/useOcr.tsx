import { useCallback, useRef, useState } from 'react';
import { createTesseractWorker } from '../../adapters/ocr/tesseractWorker';
import type { SourceId } from '../../domain/types';
import { createOcrService } from '../../services/search/ocrService';
import { createPageTextStore } from '../../services/search/pageTextStore';
import { useServices } from '../app/StoreProvider';

export function useOcr(): {
  runForSource(sourceId: SourceId, blockCount: number): Promise<void>;
  progress: { done: number; total: number } | null;
} {
  const services = useServices();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const serviceRef = useRef<ReturnType<typeof createOcrService> | null>(null);

  // Der Dienst wird erst beim ersten Lauf erzeugt -- App-Tests, die nie OCR
  // ausloesen, brauchen so keinen tesseract-Worker.
  const getService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = createOcrService({
        adapter: services.adapter,
        store: createPageTextStore(services.db),
        createOcrWorker: createTesseractWorker,
      });
    }
    return serviceRef.current;
  }, [services]);

  const runForSource = useCallback(
    async (sourceId: SourceId, blockCount: number) => {
      setProgress({ done: 0, total: blockCount });
      try {
        await getService().run(sourceId, blockCount, (done, total) => setProgress({ done, total }));
      } finally {
        setProgress(null);
      }
    },
    [getService],
  );

  return { runForSource, progress };
}
