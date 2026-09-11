import * as pdfjs from 'pdfjs-dist';
import type { OutlineNode } from '../../domain/types';
import type { DetectedField, TextSpan } from '../types';
import type {
  CreateSurface,
  PdfDocumentHandle,
  PdfEngine,
  PdfPageHandle,
  RenderSurface,
} from './pdfEngine';

// Alle Assets kommen aus dem eigenen Bundle (siehe scripts/sync-pdf-assets.mjs).
// BASE_URL statt eines fuehrenden Schraegstrichs, damit die App auch unter
// einem Unterpfad ausgeliefert werden kann.
const base = import.meta.env.BASE_URL;
pdfjs.GlobalWorkerOptions.workerSrc = `${base}pdfjs/pdf.worker.min.mjs`;
const CMAP_URL = `${base}pdfjs/cmaps/`;
const STANDARD_FONT_URL = `${base}pdfjs/standard_fonts/`;

type RawOutline = Awaited<ReturnType<pdfjs.PDFDocumentProxy['getOutline']>>[number];

export const createOffscreenSurface: CreateSurface = (width, height) => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Der Browser stellt keinen 2D-Kontext bereit.');
  return {
    width,
    height,
    context: context as unknown as OffscreenCanvasRenderingContext2D,
    async toBlob(type, quality) {
      return canvas.convertToBlob({ type, quality });
    },
  } satisfies RenderSurface;
};

export function createPdfjsEngine(): PdfEngine {
  return {
    async open(bytes) {
      // pdf.js uebernimmt den Puffer und leert ihn dabei; deshalb eine Kopie.
      const task = pdfjs.getDocument({
        data: bytes.slice(),
        cMapUrl: CMAP_URL,
        cMapPacked: true,
        standardFontDataUrl: STANDARD_FONT_URL,
        disableAutoFetch: true,
        isEvalSupported: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      return wrapDocument(await task.promise, task);
    },
    isPasswordError(error) {
      return (
        typeof error === 'object' &&
        error !== null &&
        (error as { name?: string }).name === 'PasswordException'
      );
    },
  };
}

function wrapDocument(
  doc: pdfjs.PDFDocumentProxy,
  task: ReturnType<typeof pdfjs.getDocument>,
): PdfDocumentHandle {
  return {
    pageCount: doc.numPages,
    async page(blockIndex) {
      return wrapPage(await doc.getPage(blockIndex + 1));
    },
    async outline() {
      const raw = await doc.getOutline();
      if (!raw || raw.length === 0) return undefined;
      return Promise.all(raw.map((entry) => toOutlineNode(doc, entry)));
    },
    async destroy() {
      // pdf.js v6 hat kein PDFDocumentProxy.destroy() mehr; der Abbau (Dokument
      // samt Worker-Transport) laeuft ueber den LoadingTask.
      await task.destroy();
    },
  };
}

async function toOutlineNode(doc: pdfjs.PDFDocumentProxy, entry: RawOutline): Promise<OutlineNode> {
  return {
    title: entry.title,
    blockIndex: await resolveDestination(doc, entry.dest),
    children: await Promise.all((entry.items ?? []).map((child) => toOutlineNode(doc, child))),
  };
}

async function resolveDestination(
  doc: pdfjs.PDFDocumentProxy,
  dest: RawOutline['dest'],
): Promise<number | null> {
  try {
    const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
    const target = Array.isArray(explicit) ? explicit[0] : null;
    if (!target || typeof target !== 'object') return null;
    return await doc.getPageIndex(target as Parameters<typeof doc.getPageIndex>[0]);
  } catch (error) {
    // Ein Bookmark ohne aufloesbares Ziel ist kein Grund, den Import abzubrechen.
    console.warn('Bookmark-Ziel konnte nicht aufgeloest werden', error);
    return null;
  }
}

function wrapPage(page: pdfjs.PDFPageProxy): PdfPageHandle {
  return {
    rotation: page.rotate,
    size(scale) {
      const viewport = page.getViewport({ scale });
      return { width: viewport.width, height: viewport.height };
    },
    async render(surface, scale, signal) {
      const viewport = page.getViewport({ scale });
      const task = page.render({
        canvas: null,
        canvasContext: surface.context as unknown as CanvasRenderingContext2D,
        viewport,
      });
      const cancel = () => task.cancel();
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        await task.promise;
      } finally {
        signal?.removeEventListener('abort', cancel);
      }
    },
    async text(): Promise<TextSpan[]> {
      const content = await page.getTextContent();
      const spans: TextSpan[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        spans.push({
          text: item.str,
          rect: [item.transform[4], item.transform[5], item.width, item.height],
        });
      }
      return spans;
    },
    async fields(): Promise<DetectedField[]> {
      const annotations = await page.getAnnotations();
      const viewport = page.getViewport({ scale: 1 });
      const vw = viewport.width;
      const vh = viewport.height;
      const out: DetectedField[] = [];
      // pdf.js typisiert Annotationen nur lose; die Widget-Felder werden roh gelesen.
      for (const raw of annotations as Array<Record<string, unknown>>) {
        if (raw.subtype !== 'Widget' || raw.hidden || raw.readOnly || raw.pushButton) continue;
        let kind: DetectedField['kind'] | null = null;
        let options: string[] | undefined;
        if (raw.fieldType === 'Tx') {
          kind = 'text';
        } else if (raw.fieldType === 'Ch') {
          kind = 'select';
          const rawOptions =
            (raw.options as Array<{ displayValue?: string; exportValue?: string }>) ?? [];
          options = rawOptions
            .map((o) => String(o.displayValue ?? o.exportValue ?? ''))
            .filter((v) => v !== '');
        } else if (raw.fieldType === 'Btn' && raw.checkBox) {
          kind = 'checkbox';
        }
        if (!kind || !Array.isArray(raw.rect)) continue;

        // Feld-Rechteck (PDF-Koordinaten, unten links) via Viewport-Matrix in
        // Anzeigekoordinaten (oben links) umrechnen -- so, wie es das gerenderte
        // Bild sieht. `transform` ist [a, b, c, d, e, f].
        const [a, b, c, d, e, f] = (viewport as unknown as { transform: number[] }).transform;
        const [rx1, ry1, rx2, ry2] = raw.rect as number[];
        const toView = (x: number, y: number): [number, number] => [a * x + c * y + e, b * x + d * y + f];
        const [ax, ay] = toView(rx1, ry1);
        const [bx, by] = toView(rx2, ry2);
        const left = Math.min(ax, bx);
        const right = Math.max(ax, bx);
        const top = Math.min(ay, by);
        const bottom = Math.max(ay, by);
        if (vw <= 0 || vh <= 0) continue;
        out.push({
          kind,
          x: left / vw,
          y: top / vh,
          w: (right - left) / vw,
          h: (bottom - top) / vh,
          options,
        });
      }
      return out;
    },
    release() {
      page.cleanup();
    },
  };
}
