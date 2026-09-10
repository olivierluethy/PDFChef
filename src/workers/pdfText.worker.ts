/// <reference lib="webworker" />
import * as pdfjs from 'pdfjs-dist';
import type { ExtractRequest, ExtractResponse, TextSpan } from '../adapters/types';

// Der Worker parst selbst; er nutzt keinen zweiten pdf.js-Worker (das waere
// eine verschachtelte Worker-Kette). disableWorker haelt die Verarbeitung in
// diesem Worker-Thread. cMaps und Schriften kommen aus dem eigenen Bundle.
const base = (self as unknown as { location: Location }).location.origin + '/';

self.onmessage = async (event: MessageEvent<ExtractRequest>) => {
  const request = event.data;
  if (request.type !== 'extract') return;
  const post = (message: ExtractResponse) => (self as unknown as Worker).postMessage(message);

  try {
    const doc = await pdfjs.getDocument({
      data: request.bytes.slice(),
      cMapUrl: `${base}pdfjs/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
      disableAutoFetch: true,
    } as Parameters<typeof pdfjs.getDocument>[0]).promise;

    for (const blockIndex of request.indices) {
      const page = await doc.getPage(blockIndex + 1);
      const content = await page.getTextContent();
      const spans: TextSpan[] = content.items
        .filter((item): item is typeof item & { str: string; transform: number[]; width: number; height: number } => 'str' in item)
        .map((item) => ({
          text: item.str,
          rect: [item.transform[4], item.transform[5], item.width, item.height],
        }));
      page.cleanup();
      post({ type: 'page', sourceId: request.sourceId, blockIndex, text: spans.map((s) => s.text).join(' '), spans });
    }
    post({ type: 'done', sourceId: request.sourceId });
  } catch (error) {
    console.error('Textextraktion fehlgeschlagen', error);
    post({ type: 'error', sourceId: request.sourceId, message: 'Der Text dieses Dokuments konnte nicht gelesen werden.' });
  }
};
