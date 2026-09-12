import type { BlockRef } from '../../domain/types';
import type {
  DetectedField,
  DocumentAdapter,
  FileDescriptor,
  PageText,
  RenderOpts,
  RenderedBitmap,
  SourceProbeResult,
} from '../types';
import type { CreateSurface, PdfDocumentHandle, PdfEngine } from './pdfEngine';
import type { DocumentPool } from './pdfPool';

export interface PdfAdapterDeps {
  engine: PdfEngine;
  /** Der Pool wird von aussen gebaut, weil nur dort bekannt ist, wie Bytes zu einer Quelle kommen. */
  pool: DocumentPool<PdfDocumentHandle>;
  createSurface: CreateSurface;
  imageType?: string;
  imageQuality?: number;
}

/** Thumbnails werden nie in Originalaufloesung gerendert, die Geraeteaufloesung wird gedeckelt. */
const MAX_DPR = 2;

export function computeRenderScale(
  pageWidth: number,
  targetWidth: number,
  dpr = 1,
  maxDpr = MAX_DPR,
): number {
  if (!Number.isFinite(pageWidth) || pageWidth <= 0) return 1;
  return (targetWidth * Math.min(dpr, maxDpr)) / pageWidth;
}

const EMPTY_PROBE = {
  kind: 'pdf' as const,
  blockKind: 'page' as const,
  blockCount: 0,
  blockRotations: [] as number[],
};

export function createPdfAdapter({
  engine,
  pool,
  createSurface,
  imageType = 'image/webp',
  imageQuality = 0.8,
}: PdfAdapterDeps): DocumentAdapter {
  return {
    kind: 'pdf',

    accepts(file: FileDescriptor) {
      return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    },

    async probe(blob: Blob): Promise<SourceProbeResult> {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let document: PdfDocumentHandle;
      try {
        document = await engine.open(bytes);
      } catch (error) {
        // Der Stacktrace gehoert in die Konsole, nicht in die Oberflaeche.
        console.warn('Could not open PDF', error);
        if (engine.isPasswordError(error)) {
          return {
            ...EMPTY_PROBE,
            status: 'encrypted',
            statusDetail: 'This PDF is password protected.',
          };
        }
        return {
          ...EMPTY_PROBE,
          status: 'error',
          statusDetail:
            'This PDF could not be read. It may be damaged or encrypted.',
        };
      }

      try {
        // Einmalig beim Import: die Rotation jeder Quellseite merken, damit das
        // Raster spaeter nicht jede Seite dafuer oeffnen muss.
        const blockRotations: number[] = [];
        for (let index = 0; index < document.pageCount; index++) {
          const page = await document.page(index);
          blockRotations.push(page.rotation);
          page.release();
        }
        const outline = await document.outline();
        return {
          ...EMPTY_PROBE,
          blockCount: document.pageCount,
          blockRotations,
          ...(outline ? { outline } : {}),
          status: 'ready',
        };
      } finally {
        await document.destroy();
      }
    },

    async renderBlock(ref: BlockRef, opts: RenderOpts): Promise<RenderedBitmap> {
      opts.signal?.throwIfAborted();
      return pool.use(ref.sourceId, async (document) => {
        const page = await document.page(ref.blockIndex);
        try {
          const unscaled = page.size(1);
          const scale = computeRenderScale(unscaled.width, opts.targetWidth, opts.dpr ?? 1);
          const { width, height } = page.size(scale);
          const surface = createSurface(Math.round(width), Math.round(height));
          await page.render(surface, scale, opts.signal);
          return {
            blob: await surface.toBlob(imageType, imageQuality),
            width: surface.width,
            height: surface.height,
          };
        } finally {
          page.release();
        }
      });
    },

    async extractText(ref: BlockRef): Promise<PageText> {
      return pool.use(ref.sourceId, async (document) => {
        const page = await document.page(ref.blockIndex);
        try {
          const spans = await page.text();
          return {
            blockIndex: ref.blockIndex,
            text: spans.map((span) => span.text).join(' '),
            spans,
          };
        } finally {
          page.release();
        }
      });
    },

    async detectFields(ref: BlockRef): Promise<DetectedField[]> {
      return pool.use(ref.sourceId, async (document) => {
        const page = await document.page(ref.blockIndex);
        try {
          return await page.fields();
        } finally {
          page.release();
        }
      });
    },
  };
}
