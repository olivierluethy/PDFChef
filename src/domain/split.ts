import { formatRanges, parseRanges, rangesToIndices } from './ranges';

export type SplitStrategy =
  | { kind: 'equalParts'; parts: number }
  | { kind: 'everyNBlocks'; size: number }
  | { kind: 'customRanges'; input: string }
  | { kind: 'selection'; indices: number[] };

/** Ein geplantes Ergebnisdokument: 0-basierte Blockindizes der Quelle. */
export interface SplitPart {
  label: string;
  indices: number[];
}

export type SplitPlanResult = { ok: true; parts: SplitPart[] } | { ok: false; error: string };

export function planSplit(strategy: SplitStrategy, blockCount: number): SplitPlanResult {
  if (blockCount <= 0) return { ok: false, error: 'Das Dokument hat keine Seiten.' };
  switch (strategy.kind) {
    case 'equalParts':
      return equalParts(strategy.parts, blockCount);
    case 'everyNBlocks':
      return everyNBlocks(strategy.size, blockCount);
    case 'customRanges':
      return customRanges(strategy.input, blockCount);
    case 'selection':
      return selection(strategy.indices, blockCount);
  }
}

/** Beschriftung im Split-Panel, z. B. `Seiten 1-51 (51)`. */
export function describeSplitPart(part: SplitPart): string {
  return `Seiten ${formatRanges(part.indices)} (${part.indices.length})`;
}

function label(index: number): string {
  return `Teil ${index + 1}`;
}

function blockRange(start: number, size: number): number[] {
  return Array.from({ length: size }, (_, offset) => start + offset);
}

function equalParts(parts: number, blockCount: number): SplitPlanResult {
  if (!Number.isInteger(parts) || parts < 2) return { ok: false, error: 'Mindestens 2 Teile.' };
  if (parts > blockCount) {
    return { ok: false, error: `Bei ${blockCount} Seiten sind hoechstens ${blockCount} Teile moeglich.` };
  }

  // Restseiten gehen an die vorderen Teile: 101 Seiten in 2 Teile ergibt 51/50.
  const base = Math.floor(blockCount / parts);
  const remainder = blockCount % parts;
  const result: SplitPart[] = [];
  let cursor = 0;
  for (let index = 0; index < parts; index++) {
    const size = base + (index < remainder ? 1 : 0);
    result.push({ label: label(index), indices: blockRange(cursor, size) });
    cursor += size;
  }
  return { ok: true, parts: result };
}

function everyNBlocks(size: number, blockCount: number): SplitPlanResult {
  if (!Number.isInteger(size) || size < 1) return { ok: false, error: 'Mindestens 1 Seite pro Teil.' };
  const result: SplitPart[] = [];
  for (let cursor = 0; cursor < blockCount; cursor += size) {
    result.push({
      label: label(result.length),
      indices: blockRange(cursor, Math.min(size, blockCount - cursor)),
    });
  }
  return { ok: true, parts: result };
}

function customRanges(input: string, blockCount: number): SplitPlanResult {
  const parsed = parseRanges(input, blockCount);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (parsed.ranges.length === 0) return { ok: false, error: 'Keine Bereiche angegeben.' };
  return {
    ok: true,
    parts: parsed.ranges.map((range, index) => ({
      label: label(index),
      indices: rangesToIndices([range]),
    })),
  };
}

function selection(indices: number[], blockCount: number): SplitPlanResult {
  const usable = [...new Set(indices)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < blockCount)
    .sort((a, b) => a - b);
  if (usable.length === 0) return { ok: false, error: 'Keine Seiten ausgewaehlt.' };
  return { ok: true, parts: [{ label: label(0), indices: usable }] };
}
