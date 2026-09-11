import type { Database } from './db';

/**
 * Speichert die Bild-Bytes gezeichneter oder hochgeladener Unterschriften.
 * Analog zum sourceBlobStore, aber ueber einen frei vergebenen `key` (nicht
 * ueber einen Inhalts-Hash) adressiert, weil zwei Unterschriften identisch
 * aussehen duerfen und trotzdem getrennt bleiben sollen.
 */
export interface AnnotationBlobStore {
  put(key: string, blob: Blob): Promise<void>;
  read(key: string): Promise<Blob>;
  readBytes(key: string): Promise<Uint8Array>;
  has(key: string): Promise<boolean>;
  /** Loescht alle Blobs, deren Key nicht in `inUse` steht; liefert die geloeschten. */
  collectGarbage(inUse: Iterable<string>): Promise<string[]>;
}

export function createAnnotationBlobStore(
  db: Database,
  now: () => number = () => Date.now(),
): AnnotationBlobStore {
  async function read(key: string): Promise<Blob> {
    const record = await db.get('annotationBlobs', key);
    if (!record) throw new Error(`Die Bytes zur Annotation ${key} sind nicht gespeichert.`);
    return record.blob;
  }

  return {
    async put(key, blob) {
      await db.put('annotationBlobs', { key, blob, byteSize: blob.size, createdAt: now() });
    },
    read,
    async readBytes(key) {
      return new Uint8Array(await (await read(key)).arrayBuffer());
    },
    async has(key) {
      return (await db.getKey('annotationBlobs', key)) !== undefined;
    },
    async collectGarbage(inUse) {
      const keep = new Set(inUse);
      const removed: string[] = [];
      const tx = db.transaction('annotationBlobs', 'readwrite');
      for (const key of await tx.store.getAllKeys()) {
        if (keep.has(key)) continue;
        await tx.store.delete(key);
        removed.push(key);
      }
      await tx.done;
      return removed;
    },
  };
}
