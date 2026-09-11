import type { BlockRef, SourceId } from '../../domain/types';
import { computeRenderScale } from '../pdf/pdfAdapter';
import type { CreateSurface, RenderSurface } from '../pdf/pdfEngine';
import type { DocumentAdapter, FileDescriptor, RenderOpts, RenderedBitmap, SourceProbeResult } from '../types';
import { TEXT_PAGE, paginateText } from './textLayout';

export interface TextAdapterDeps {
  readBytes(sourceId: SourceId): Promise<Uint8Array>;
  /** Dieselbe OffscreenCanvas-Fassade wie beim PDF-/Bild-Adapter. */
  createSurface: CreateSurface;
  /** Formatbewusste Extraktion (TXT/MD direkt, DOCX/PPTX/XLSX via OOXML). */
  extractText(bytes: Uint8Array): Promise<string>;
  imageType?: string;
  imageQuality?: number;
}

const ACCEPTED_MIME = new Set([
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const ACCEPTED_EXT = ['.txt', '.md', '.docx', '.pptx', '.xlsx'];

const EMPTY_PROBE = {
  kind: 'text' as const,
  blockKind: 'page' as const,
  blockCount: 0,
  blockRotations: [] as number[],
};

const TEXT_COLOR = { r: 0.1, g: 0.1, b: 0.1 };

function drawPage(surface: RenderSurface, lines: string[], scale: number): void {
  const { context, width, height } = surface;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);

  const fontSize = TEXT_PAGE.fontSize * scale;
  const margin = TEXT_PAGE.margin * scale;
  const lineHeight = TEXT_PAGE.lineHeight * scale;

  context.font = `${fontSize}px monospace`;
  context.fillStyle = `rgb(${Math.round(TEXT_COLOR.r * 255)}, ${Math.round(TEXT_COLOR.g * 255)}, ${Math.round(TEXT_COLOR.b * 255)})`;
  context.textBaseline = 'top';

  lines.forEach((line, index) => {
    context.fillText(line, margin, margin + index * lineHeight);
  });
}

export function createTextAdapter({
  readBytes,
  createSurface,
  extractText,
  imageType = 'image/webp',
  imageQuality = 0.8,
}: TextAdapterDeps): DocumentAdapter {
  return {
    kind: 'text',

    accepts(file: FileDescriptor) {
      const name = file.name.toLowerCase();
      return ACCEPTED_MIME.has(file.type) || ACCEPTED_EXT.some((ext) => name.endsWith(ext));
    },

    async probe(blob: Blob): Promise<SourceProbeResult> {
      try {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const pages = paginateText(await extractText(bytes));
        return {
          ...EMPTY_PROBE,
          blockCount: pages.length,
          blockRotations: pages.map(() => 0),
          status: 'ready',
        };
      } catch (error) {
        console.warn('Textdatei konnte nicht gelesen werden', error);
        return {
          ...EMPTY_PROBE,
          status: 'error',
          statusDetail: 'Diese Textdatei konnte nicht gelesen werden.',
        };
      }
    },

    async renderBlock(ref: BlockRef, opts: RenderOpts): Promise<RenderedBitmap> {
      opts.signal?.throwIfAborted();
      const bytes = await readBytes(ref.sourceId);
      const pages = paginateText(await extractText(bytes));
      const lines = pages[ref.blockIndex] ?? [''];

      const scale = computeRenderScale(TEXT_PAGE.width, opts.targetWidth, opts.dpr ?? 1);
      const width = Math.round(TEXT_PAGE.width * scale);
      const height = Math.round(TEXT_PAGE.height * scale);
      const surface = createSurface(width, height);
      drawPage(surface, lines, scale);

      return {
        blob: await surface.toBlob(imageType, imageQuality),
        width: surface.width,
        height: surface.height,
        pageWidth: TEXT_PAGE.width,
        pageHeight: TEXT_PAGE.height,
      };
    },
  };
}
