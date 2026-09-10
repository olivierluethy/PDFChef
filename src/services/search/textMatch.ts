import type { PageText, TextSpan } from '../../adapters/types';

export interface PageMatch {
  blockIndex: number;
  snippet: string;
  count: number;
  spanRects: TextSpan['rect'][];
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Ausschnitt um den ersten Treffer, damit die Trefferliste Kontext zeigt. */
function snippetAround(text: string, at: number, length: number): string {
  const radius = 30;
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + length + radius);
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
}

export function findPageMatch(page: PageText, query: string): PageMatch | null {
  const needle = normalizeQuery(query);
  if (needle === '' || page.text.trim() === '') return null;

  const haystack = page.text.toLowerCase();
  let count = 0;
  let from = haystack.indexOf(needle);
  const first = from;
  while (from !== -1) {
    count += 1;
    from = haystack.indexOf(needle, from + needle.length);
  }
  if (count === 0) return null;

  const spanRects = page.spans
    .filter((span) => span.text.toLowerCase().includes(needle))
    .map((span) => span.rect);

  return {
    blockIndex: page.blockIndex,
    snippet: snippetAround(page.text, first, needle.length),
    count,
    spanRects,
  };
}
