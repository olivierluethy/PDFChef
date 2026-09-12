import type { Database } from './db';

export interface SourceBlobStore {
  /** Legt die Bytes ab; ein bereits vorhandener Inhalt wird nicht neu geschrieben. */
  put(contentHash: string, blob: Blob): Promise<void>;
  has(contentHash: string): Promise<boolean>;
  read(contentHash: string): Promise<Blob>;
  readBytes(contentHash: string): Promise<Uint8Array>;
  /** Loescht alle Blobs, deren Hash nicht in `inUse` steht, und liefert die geloeschten. */
  collectGarbage(inUse: Iterable<string>): Promise<string[]>;
  totalBytes(): Promise<number>;
}

export function createSourceBlobStore(
  db: Database,
  now: () => number = () => Date.now(),
): SourceBlobStore {
  // Freie Funktion statt `this`, damit einzelne Methoden herausgeloest
  // uebergeben werden koennen, ohne ihren Empfaenger zu verlieren.
  async function read(contentHash: string): Promise<Blob> {
    const record = await db.get('sourceBlobs', contentHash);
    if (!record) throw new Error(`The bytes for ${contentHash} are not stored.`);
    return record.blob;
  }

  return {
    async put(contentHash, blob) {
      // Gleicher Hash bedeutet gleicher Inhalt: der Doppelimport derselben
      // Datei kostet keinen zweiten Speicherplatz.
      const existing = await db.get('sourceBlobs', contentHash);
      if (existing) return;
      await db.put('sourceBlobs', {
        contentHash,
        blob,
        byteSize: blob.size,
        importedAt: now(),
      });
    },

    async has(contentHash) {
      return (await db.getKey('sourceBlobs', contentHash)) !== undefined;
    },

    read,

    async readBytes(contentHash) {
      return new Uint8Array(await (await read(contentHash)).arrayBuffer());
    },

    async collectGarbage(inUse) {
      const keep = new Set(inUse);
      const removed: string[] = [];
      const tx = db.transaction('sourceBlobs', 'readwrite');
      for (const key of await tx.store.getAllKeys()) {
        if (keep.has(key)) continue;
        await tx.store.delete(key);
        removed.push(key);
      }
      await tx.done;
      return removed;
    },

    async totalBytes() {
      const records = await db.getAll('sourceBlobs');
      return records.reduce((sum, record) => sum + record.byteSize, 0);
    },
  };
}
