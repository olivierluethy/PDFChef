import { isOutput, type SourceId, type Workspace } from '../../domain/types';

/**
 * Blockindex -> Zahl der Outputs, die genau diese Quellseite verwenden.
 * Gezaehlt werden Outputs, nicht Items: zwei Kopien derselben Seite im selben
 * Output ergeben den Wert 1, weil das Badge "in wie vielen Dokumenten" meint.
 */
export function computeSourceUsage(ws: Workspace, sourceId: SourceId): Map<number, number> {
  const outputsByBlock = new Map<number, Set<string>>();
  for (const node of Object.values(ws.nodes)) {
    if (!isOutput(node)) continue;
    for (const itemId of node.items) {
      const item = ws.items[itemId];
      if (!item || item.sourceId !== sourceId) continue;
      const set = outputsByBlock.get(item.blockIndex) ?? new Set<string>();
      set.add(node.id);
      outputsByBlock.set(item.blockIndex, set);
    }
  }
  const usage = new Map<number, number>();
  for (const [blockIndex, outputs] of outputsByBlock) usage.set(blockIndex, outputs.size);
  return usage;
}
