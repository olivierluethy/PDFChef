import type { PageText } from '../../adapters/types';
import type { SourceKind } from '../../domain/types';
import type { PageTextStore } from './pageTextStore';
import { findPageMatch, normalizeQuery, type PageMatch } from './textMatch';

export interface SearchTarget {
  sourceId: string;
  name: string;
  kind: SourceKind;
  /** Genau die zu durchsuchenden Seiten dieses Dokuments (0-basiert). */
  indices: number[];
}

export interface DocumentResult {
  sourceId: string;
  name: string;
  /** false, wenn das Dokument keinerlei Text enthaelt (gescannt, ohne Textschicht). */
  searchable: boolean;
  matches: PageMatch[];
}

export interface SearchDeps {
  store: PageTextStore;
  /** Zieht die fehlenden Seiten ueber den Worker nach; in Tests ein Fake. */
  extractUncached(sourceId: string, indices: number[]): Promise<PageText[]>;
}

export function createSearchService({ store, extractUncached }: SearchDeps) {
  async function pagesOf(target: SearchTarget): Promise<PageText[]> {
    const byIndex = new Map<number, PageText>();
    const missing: number[] = [];
    for (const index of target.indices) {
      const cached = await store.get(target.sourceId, index);
      if (cached) byIndex.set(index, cached);
      else missing.push(index);
    }
    // Nur PDF-Quellen ziehen fehlende Seiten ueber den Worker nach. Andere
    // Quellarten beziehen ihren Text ausschliesslich aus dem Cache, den OCR
    // gefuellt haben mag -- fehlende Seiten bleiben dann einfach unbesetzt.
    if (missing.length > 0 && target.kind === 'pdf') {
      const extracted = await extractUncached(target.sourceId, missing);
      for (const page of extracted) {
        await store.put(target.sourceId, page);
        byIndex.set(page.blockIndex, page);
      }
    }
    // In der Reihenfolge der gesuchten Seiten zurueckgeben.
    return target.indices
      .map((index) => byIndex.get(index))
      .filter((page): page is PageText => page !== undefined);
  }

  return {
    async search(
      query: string,
      targets: SearchTarget[],
      onProgress?: (done: number, total: number) => void,
    ): Promise<DocumentResult[]> {
      if (normalizeQuery(query) === '') return [];
      const results: DocumentResult[] = [];
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const pages = await pagesOf(target);
        const searchable = pages.some((page) => page.text.trim() !== '');
        const matches = pages
          .map((page) => findPageMatch(page, query))
          .filter((match): match is PageMatch => match !== null);
        results.push({ sourceId: target.sourceId, name: target.name, searchable, matches });
        onProgress?.(i + 1, targets.length);
      }
      return results;
    },
  };
}
