import type { Database } from './db';

export interface ThumbStore {
  get(key: string): Promise<Blob | undefined>;
  put(key: string, blob: Blob, width: number): Promise<void>;
  /** Der Cache ist verwerfbar: bei Speicherdruck wird er als erstes geleert. */
  clear(): Promise<void>;
}

export function createThumbStore(db: Database, now: () => number = () => Date.now()): ThumbStore {
  return {
    async get(key) {
      return (await db.get('thumbs', key))?.blob;
    },
    async put(key, blob, width) {
      await db.put('thumbs', { key, blob, width, createdAt: now() });
    },
    async clear() {
      await db.clear('thumbs');
    },
  };
}
