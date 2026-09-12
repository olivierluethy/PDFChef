import { isOutput, type NodeId, type SourceId, type Workspace } from '../../domain/types';
import type { SearchTarget } from './searchService';

export type SearchScopeKind = 'source' | 'output' | 'all';

function fullRange(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

export function targetsForScope(
  ws: Workspace,
  kind: SearchScopeKind,
  activeSourceId: SourceId | null,
  activeOutputId: NodeId | null,
): SearchTarget[] {
  if (kind === 'source') {
    const source = activeSourceId ? ws.sources[activeSourceId] : undefined;
    return source && source.status === 'ready'
      ? [{ sourceId: source.id, name: source.name, kind: source.kind, indices: fullRange(source.blockCount) }]
      : [];
  }

  if (kind === 'output') {
    const node = activeOutputId ? ws.nodes[activeOutputId] : undefined;
    if (!node || !isOutput(node)) return [];
    // Je Quelle die tatsaechlich enthaltenen Seiten, in Erst-Vorkommen-Reihenfolge.
    // Alle Quellarten werden aufgenommen; ohne Text (weder PDF-Layer noch OCR)
    // bleiben sie einfach nicht durchsuchbar.
    const bySource = new Map<SourceId, number[]>();
    for (const itemId of node.items) {
      const item = ws.items[itemId];
      if (!item) continue;
      const indices = bySource.get(item.sourceId) ?? [];
      if (!indices.includes(item.blockIndex)) indices.push(item.blockIndex);
      bySource.set(item.sourceId, indices);
    }
    return [...bySource].map(([sourceId, indices]) => {
      const source = ws.sources[sourceId];
      return { sourceId, name: source?.name ?? 'Source', kind: source?.kind ?? 'pdf', indices };
    });
  }

  return ws.sourceOrder
    .map((id) => ws.sources[id])
    .filter((source) => source && source.status === 'ready')
    .map((source) => ({ sourceId: source.id, name: source.name, kind: source.kind, indices: fullRange(source.blockCount) }));
}
