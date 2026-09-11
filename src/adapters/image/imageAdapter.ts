import type { BlockRef, SourceId } from '../../domain/types';
import { computeRenderScale } from '../pdf/pdfAdapter';
import type { CreateSurface, RenderSurface } from '../pdf/pdfEngine';
import type {
  DocumentAdapter,
  FileDescriptor,
  ImageEmbeddable,
  RenderOpts,
  RenderedBitmap,
  SourceProbeResult,
} from '../types';

export interface ImageAdapterDeps {
  readBytes(sourceId: SourceId): Promise<Uint8Array>;
  /** Dieselbe OffscreenCanvas-Fassade wie beim PDF-Adapter. */
  createSurface: CreateSurface;
  /** = createImageBitmap, injiziert fuer Testbarkeit. */
  decode(blob: Blob): Promise<ImageBitmap>;
  imageType?: string;
  imageQuality?: number;
}

export interface ImageAdapter extends DocumentAdapter {
  /** Einbettbare PNG/JPEG-Bytes + Masse fuer den Assembler. */
  toEmbeddable(bytes: Uint8Array): Promise<ImageEmbeddable>;
}

const ACCEPTED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const ACCEPTED_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

const EMPTY_PROBE = {
  kind: 'image' as const,
  blockKind: 'image' as const,
  blockCount: 0,
  blockRotations: [] as number[],
};

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function guessMimeFromBytes(bytes: Uint8Array): string {
  // Fuer decode() genuegt eine grobe Zuordnung; createImageBitmap erkennt das
  // Format ohnehin selbst anhand der Bytes, der type dient nur als Hinweis.
  if (isPng(bytes)) return 'image/png';
  if (isJpeg(bytes)) return 'image/jpeg';
  return 'application/octet-stream';
}

export function createImageAdapter({
  readBytes,
  createSurface,
  decode,
  imageType = 'image/webp',
  imageQuality = 0.8,
}: ImageAdapterDeps): ImageAdapter {
  async function decodeBytes(bytes: Uint8Array): Promise<ImageBitmap> {
    const blob = new Blob([bytes as BufferSource], { type: guessMimeFromBytes(bytes) });
    return decode(blob);
  }

  function drawToSurface(bitmap: ImageBitmap): RenderSurface {
    const surface = createSurface(bitmap.width, bitmap.height);
    surface.context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
    return surface;
  }

  return {
    kind: 'image',

    accepts(file: FileDescriptor) {
      const name = file.name.toLowerCase();
      return ACCEPTED_MIME.has(file.type) || ACCEPTED_EXT.some((ext) => name.endsWith(ext));
    },

    async probe(blob: Blob): Promise<SourceProbeResult> {
      try {
        const bitmap = await decode(blob);
        bitmap.close();
        return {
          ...EMPTY_PROBE,
          blockCount: 1,
          blockRotations: [0],
          status: 'ready',
        };
      } catch (error) {
        console.warn('Bild konnte nicht gelesen werden', error);
        return {
          ...EMPTY_PROBE,
          status: 'error',
          statusDetail: 'Dieses Bild konnte nicht gelesen werden. Es ist moeglicherweise beschaedigt.',
        };
      }
    },

    async renderBlock(ref: BlockRef, opts: RenderOpts): Promise<RenderedBitmap> {
      opts.signal?.throwIfAborted();
      const bytes = await readBytes(ref.sourceId);
      const bitmap = await decodeBytes(bytes);
      try {
        const scale = computeRenderScale(bitmap.width, opts.targetWidth, opts.dpr ?? 1);
        const width = Math.round(bitmap.width * scale);
        const height = Math.round(bitmap.height * scale);
        const surface = createSurface(width, height);
        surface.context.drawImage(bitmap, 0, 0, width, height);
        return {
          blob: await surface.toBlob(imageType, imageQuality),
          width: surface.width,
          height: surface.height,
          // Bildquellen werden beim Export mit ihren Pixelmassen als Punkte
          // eingebettet (siehe pdfAssembler), daher gilt hier px == pt.
          pageWidth: bitmap.width,
          pageHeight: bitmap.height,
        };
      } finally {
        bitmap.close();
      }
    },

    async toEmbeddable(bytes: Uint8Array): Promise<ImageEmbeddable> {
      if (isPng(bytes)) {
        const bitmap = await decodeBytes(bytes);
        const { width, height } = bitmap;
        bitmap.close();
        return { format: 'png', bytes, width, height };
      }
      if (isJpeg(bytes)) {
        const bitmap = await decodeBytes(bytes);
        const { width, height } = bitmap;
        bitmap.close();
        return { format: 'jpeg', bytes, width, height };
      }

      // WebP/GIF: verlustfrei fuer den sichtbaren Inhalt auf PNG rastern.
      const bitmap = await decodeBytes(bytes);
      try {
        const surface = drawToSurface(bitmap);
        const pngBlob = await surface.toBlob('image/png', 1);
        const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
        return { format: 'png', bytes: pngBytes, width: bitmap.width, height: bitmap.height };
      } finally {
        bitmap.close();
      }
    },
  };
}
