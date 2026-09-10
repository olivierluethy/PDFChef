import type { PageText } from '../../adapters/types';
import type { Database } from '../persistence/db';

export function pageTextKey(sourceId: string, blockIndex: number): string {
  return `${sourceId}:${blockIndex}`;
}

export interface StoredPageText extends PageText {
  key: string;
  sourceId: string;
  createdAt: number;
}

export interface PageTextStore {
  get(sourceId: string, blockIndex: number): Promise<PageText | undefined>;
  put(sourceId: string, page: PageText): Promise<void>;
  clear(): Promise<void>;
}

export function createPageTextStore(db: Database): PageTextStore {
  return {
    async get(sourceId, blockIndex) {
      const record = (await db.get('pageText', pageTextKey(sourceId, blockIndex))) as StoredPageText | undefined;
      if (!record) return undefined;
      return { blockIndex: record.blockIndex, text: record.text, spans: record.spans };
    },
    async put(sourceId, page) {
      const record: StoredPageText = { ...page, sourceId, key: pageTextKey(sourceId, page.blockIndex), createdAt: Date.now() };
      await db.put('pageText', record);
    },
    async clear() {
      await db.clear('pageText');
    },
  };
}
