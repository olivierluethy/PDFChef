/** Ein Seitenbereich in der Schreibweise des Nutzers: 1-basiert und inklusiv. */
export interface RangeSpec {
  start: number;
  end: number;
}

export type ParseRangesResult =
  | { ok: true; ranges: RangeSpec[]; indices: number[] }
  | { ok: false; error: string };

/**
 * Liest Eingaben wie `4-49` oder `1-3,50-100`.
 * Absteigende Bereiche werden gedreht, ueberlappende und angrenzende verschmolzen,
 * das Ende auf `blockCount` gedeckelt. Ein Bereich, der vollstaendig hinter dem
 * Dokument liegt, ist ein Fehler statt einer stillen Leerauswahl -- sonst haette
 * der Nutzer keinen Hinweis auf seinen Tippfehler.
 */
export function parseRanges(input: string, blockCount: number): ParseRangesResult {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: true, ranges: [], indices: [] };
  if (blockCount <= 0) return { ok: false, error: 'The document has no pages.' };

  const parsed: RangeSpec[] = [];
  for (const part of trimmed.split(',')) {
    const token = part.trim();
    if (token === '') return { ok: false, error: `Empty range in "${trimmed}".` };

    const segments = token.split('-').map((segment) => segment.trim());
    if (segments.length > 2 || segments.some((segment) => !/^\d+$/.test(segment))) {
      return {
        ok: false,
        error: `"${token}" is not a page range. Examples: 7 or 4-49.`,
      };
    }

    const first = Number(segments[0]);
    const second = segments.length === 2 ? Number(segments[1]) : first;
    if (first === 0 || second === 0) return { ok: false, error: 'Page numbers start at 1.' };

    const start = Math.min(first, second);
    const end = Math.max(first, second);
    if (start > blockCount)
      return { ok: false, error: `The document has only ${blockCount} pages.` };

    parsed.push({ start, end: Math.min(end, blockCount) });
  }

  const ranges = mergeRanges(parsed);
  return { ok: true, ranges, indices: rangesToIndices(ranges) };
}

export function mergeRanges(ranges: RangeSpec[]): RangeSpec[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: RangeSpec[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    // `last.end + 1`: 1-3 und 4-8 sind zusammenhaengend und werden zu 1-8.
    if (last && range.start <= last.end + 1) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

export function normalizeRanges(ranges: RangeSpec[], blockCount: number): RangeSpec[] {
  const clamped: RangeSpec[] = [];
  for (const range of ranges) {
    const start = Math.max(1, Math.min(range.start, range.end));
    const end = Math.min(Math.max(range.start, range.end), blockCount);
    if (start <= end) clamped.push({ start, end });
  }
  return mergeRanges(clamped);
}

export function rangesToIndices(ranges: RangeSpec[]): number[] {
  const indices: number[] = [];
  for (const range of ranges) {
    for (let page = range.start; page <= range.end; page++) indices.push(page - 1);
  }
  return indices;
}

export function indicesToRanges(indices: number[]): RangeSpec[] {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const ranges: RangeSpec[] = [];
  for (const index of sorted) {
    const page = index + 1;
    const last = ranges[ranges.length - 1];
    if (last && page === last.end + 1) last.end = page;
    else ranges.push({ start: page, end: page });
  }
  return ranges;
}

/** Gegenrichtung zu `parseRanges`: 0-basierte Indizes -> `4-49` fuer das Range-Feld. */
export function formatRanges(indices: number[]): string {
  return indicesToRanges(indices)
    .map((range) => (range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`))
    .join(',');
}
