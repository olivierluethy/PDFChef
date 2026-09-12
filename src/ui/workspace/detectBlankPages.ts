import type { DocumentAdapter } from '../../adapters/types';
import { isBlank } from '../../domain/scanSplit';
import type { SourceId } from '../../domain/types';

const DEFAULT_THRESHOLD = 0.004;
const DARK_LUMINANCE = 110;
const RENDER_WIDTH = 120;

export interface DetectBlankPagesOpts {
  threshold?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Rendert jede Seite klein, misst den Anteil dunkler Pixel und liefert die
 * Indizes der (nahezu) leeren Seiten. Heuristik -- siehe
 * docs/superpowers/specs/2026-09-10-scan-detection-design.md.
 */
export async function detectBlankPages(
  adapter: DocumentAdapter,
  sourceId: SourceId,
  blockCount: number,
  opts?: DetectBlankPagesOpts,
): Promise<number[]> {
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD;
  const blankIndices: number[] = [];

  for (let blockIndex = 0; blockIndex < blockCount; blockIndex++) {
    if (opts?.signal?.aborted) break;

    const bitmap = await adapter.renderBlock({ sourceId, blockIndex }, { targetWidth: RENDER_WIDTH });
    const img = await createImageBitmap(bitmap.blob);
    try {
      const canvas = new OffscreenCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2D context available for detection.');
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, img.width, img.height);

      let darkCount = 0;
      const totalPixels = data.length / 4;
      for (let pixel = 0; pixel < totalPixels; pixel++) {
        const offset = pixel * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luminance < DARK_LUMINANCE) darkCount++;
      }

      const darkFraction = totalPixels > 0 ? darkCount / totalPixels : 0;
      if (isBlank(darkFraction, threshold)) blankIndices.push(blockIndex);
    } finally {
      img.close();
    }

    opts?.onProgress?.(blockIndex + 1, blockCount);
  }

  return blankIndices;
}
