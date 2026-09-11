import { describe, expect, it } from 'vitest';

import { omitExportedEntries, type ExportEntry, type ExportPlan } from './exportPlan';
import type { CompositionItem } from './types';

function entry(outputId: string, itemCount: number): ExportEntry {
  const items = Array.from({ length: itemCount }, () => ({}) as CompositionItem);
  return { outputId, path: [], fileName: `${outputId}.pdf`, items };
}

function plan(...entries: ExportEntry[]): ExportPlan {
  return {
    entries,
    skipped: [{ outputId: 'leer', name: 'Leer', reason: 'empty' }],
    totalBlocks: entries.reduce((sum, e) => sum + e.items.length, 0),
  };
}

describe('omitExportedEntries', () => {
  it('entfernt bereits einzeln exportierte Dokumente und rechnet totalBlocks neu', () => {
    const p = plan(entry('a', 3), entry('b', 2), entry('c', 4));
    const rest = omitExportedEntries(p, new Set(['b']));
    expect(rest.entries.map((e) => e.outputId)).toEqual(['a', 'c']);
    expect(rest.totalBlocks).toBe(7);
    // skipped bleibt unveraendert erhalten.
    expect(rest.skipped).toEqual(p.skipped);
  });

  it('laesst den Plan unveraendert, wenn nichts ausgeschlossen wird', () => {
    const p = plan(entry('a', 1));
    expect(omitExportedEntries(p, new Set())).toEqual(p);
  });

  it('liefert einen leeren Plan, wenn alle Eintraege exportiert wurden', () => {
    const p = plan(entry('a', 1), entry('b', 1));
    const rest = omitExportedEntries(p, new Set(['a', 'b']));
    expect(rest.entries).toHaveLength(0);
    expect(rest.totalBlocks).toBe(0);
  });
});
