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
    return source && source.status === 'ready' && source.kind === 'pdf'
      ? [{ sourceId: source.id, name: source.name, indices: fullRange(source.blockCount) }]
      : [];
  }

  if (kind === 'output') {
    const node = activeOutputId ? ws.nodes[activeOutputId] : undefined;
    if (!node || !isOutput(node)) return [];
    // Je Quelle die tatsaechlich enthaltenen Seiten, in Erst-Vorkommen-Reihenfolge.
    // Bildquellen haben keinen durchsuchbaren Text und werden ausgelassen.
    const bySource = new Map<SourceId, number[]>();
    for (const itemId of node.items) {
      const item = ws.items[itemId];
      if (!item) continue;
      if (ws.sources[item.sourceId]?.kind !== 'pdf') continue;
      const indices = bySource.get(item.sourceId) ?? [];
      if (!indices.includes(item.blockIndex)) indices.push(item.blockIndex);
      bySource.set(item.sourceId, indices);
    }
    return [...bySource].map(([sourceId, indices]) => ({
      sourceId,
      name: ws.sources[sourceId]?.name ?? 'Quelle',
      indices,
    }));
  }

  return ws.sourceOrder
    .map((id) => ws.sources[id])
    .filter((source) => source && source.status === 'ready' && source.kind === 'pdf')
    .map((source) => ({ sourceId: source.id, name: source.name, indices: fullRange(source.blockCount) }));
}
