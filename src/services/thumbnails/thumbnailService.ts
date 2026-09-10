import type { DocumentAdapter } from '../../adapters/types';
import type { BlockRef } from '../../domain/types';
import { thumbKey } from '../persistence/db';
import type { ThumbStore } from '../persistence/thumbStore';
import type { BlobUrlCache } from './thumbnailCache';
import type { RenderQueue } from './renderQueue';

/** Feste Zielbreite aus dem Design; Thumbnails werden nie in Originalgroesse gerendert. */
export const THUMBNAIL_WIDTH = 180;

export interface ThumbnailRequest {
  ref: BlockRef;
  width?: number;
  dpr?: number;
  /** Hoeher ist dringender; sichtbare Zellen bekommen den hoeheren Wert. */
  priority?: number;
}

export interface ThumbnailService {
  request(request: ThumbnailRequest): Promise<string>;
  /** Synchroner Blick in den Speicher-Cache, fuer das erste Rendern einer Zelle. */
  peek(ref: BlockRef, width?: number): string | undefined;
  cancel(ref: BlockRef, width?: number): void;
  keepOnly(refs: Iterable<BlockRef>, width?: number): void;
  clearMemory(): void;
}

export interface ThumbnailServiceDeps {
  adapter: DocumentAdapter;
  store: ThumbStore;
  queue: RenderQueue;
  cache: BlobUrlCache;
  dpr?: number;
}

export function createThumbnailService({
  adapter,
  store,
  queue,
  cache,
  dpr = 1,
}: ThumbnailServiceDeps): ThumbnailService {
  const keyOf = (ref: BlockRef, width: number) => thumbKey(ref.sourceId, ref.blockIndex, width);

  return {
    async request({ ref, width = THUMBNAIL_WIDTH, dpr: requestDpr = dpr, priority = 0 }) {
      const key = keyOf(ref, width);
      const known = cache.get(key);
      if (known) return known;

      return queue.run(key, priority, async (signal) => {
        // Zweite Stufe: ein frueher gerendertes Thumbnail liegt noch in der
        // Datenbank und muss nicht erneut aus dem PDF erzeugt werden.
        const stored = await store.get(key);
        if (stored) return cache.set(key, stored);

        const bitmap = await adapter.renderBlock(ref, { targetWidth: width, dpr: requestDpr, signal });
        await store.put(key, bitmap.blob, width);
        return cache.set(key, bitmap.blob);
      });
    },

    peek(ref, width = THUMBNAIL_WIDTH) {
      return cache.get(keyOf(ref, width));
    },

    cancel(ref, width = THUMBNAIL_WIDTH) {
      queue.cancel(keyOf(ref, width));
    },

    keepOnly(refs, width = THUMBNAIL_WIDTH) {
      queue.keepOnly([...refs].map((ref) => keyOf(ref, width)));
    },

    clearMemory() {
      cache.clear();
    },
  };
}
