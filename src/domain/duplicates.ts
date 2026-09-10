import type { SourceId, Workspace } from './types';
import { itemsOfSource } from './composition';

/** Gruppe von Quellen mit identischem Inhalt. `sourceIds[0]` ist die kanonische Quelle (bleibt). */
export interface DuplicateGroup {
  contentHash: string;
  sourceIds: SourceId[];
}

/** Gruppen gleicher Inhalte mit mindestens zwei Quellen, stabil in `ws.sourceOrder`. */
export function findDuplicateSourceGroups(ws: Workspace): DuplicateGroup[] {
  const order: string[] = [];
  const bySourceHash = new Map<string, SourceId[]>();

  for (const sourceId of ws.sourceOrder) {
    const source = ws.sources[sourceId];
    if (!source || source.status !== 'ready') continue;
    const existing = bySourceHash.get(source.contentHash);
    if (existing) {
      existing.push(sourceId);
    } else {
      bySourceHash.set(source.contentHash, [sourceId]);
      order.push(source.contentHash);
    }
  }

  return order
    .map((contentHash) => ({ contentHash, sourceIds: bySourceHash.get(contentHash) ?? [] }))
    .filter((group) => group.sourceIds.length >= 2);
}

/** Nicht-kanonische Doppel, die in keinem Output verwendet werden -- sicher entfernbar. */
export function removableDuplicateSourceIds(ws: Workspace): SourceId[] {
  const groups = findDuplicateSourceGroups(ws);
  const removable: SourceId[] = [];
  for (const group of groups) {
    for (const sourceId of group.sourceIds.slice(1)) {
      if (itemsOfSource(ws, sourceId).length === 0) {
        removable.push(sourceId);
      }
    }
  }
  return removable;
}
