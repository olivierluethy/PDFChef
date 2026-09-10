// Einzige Datei, die tesseract.js kennt. Konfiguriert ausschliesslich lokale
// Asset-Pfade (Worker, Core-WASM, Sprachdaten) unter `${BASE_URL}tesseract/…`
// -- kein CDN-Fallback zur Laufzeit, damit local-first gewahrt bleibt.
import { createWorker, OEM } from 'tesseract.js';

export interface OcrWorker {
  recognize(image: Blob): Promise<string>;
  terminate(): Promise<void>;
}

export async function createTesseractWorker(): Promise<OcrWorker> {
  const base = import.meta.env.BASE_URL;
  const worker = await createWorker('deu+eng', OEM.LSTM_ONLY, {
    workerPath: `${base}tesseract/worker.min.js`,
    corePath: `${base}tesseract/core`,
    langPath: `${base}tesseract/lang`,
    workerBlobURL: false,
    gzip: true,
  });

  return {
    async recognize(image) {
      const { data } = await worker.recognize(image);
      return data.text;
    },
    async terminate() {
      await worker.terminate();
    },
  };
}
