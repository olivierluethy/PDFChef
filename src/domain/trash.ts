import type { Command } from './commands';
import type { CompositionItem, NodeId, Workspace } from './types';

/**
 * Ein unveraenderlicher Schnappschuss eines Teilbaums (Ordner/Output + Kinder),
 * ausreichend um ihn spaeter mit denselben Ids wiederherzustellen.
 */
export interface NodeSnapshot {
  rootId: NodeId;
  rootParentId: NodeId | null;
  /** Vorordnung: die Wurzel zuerst, jeder Elternteil vor seinen Kindern. */
  nodes: { id: NodeId; type: 'folder' | 'output'; name: string; parentId: NodeId | null }[];
  items: { outputId: NodeId; items: CompositionItem[] }[];
}

/** Baut einen Schnappschuss des Teilbaums ab `nodeId` in Vorordnung. */
export function buildNodeSnapshot(ws: Workspace, nodeId: NodeId): NodeSnapshot {
  const nodes: NodeSnapshot['nodes'] = [];
  const items: NodeSnapshot['items'] = [];

  function visit(id: NodeId): void {
    const node = ws.nodes[id];
    if (!node) return;
    nodes.push({ id: node.id, type: node.type, name: node.name, parentId: node.parentId });
    if (node.type === 'output') {
      items.push({
        outputId: node.id,
        items: node.items.map((itemId) => ws.items[itemId]).filter((item): item is CompositionItem => !!item),
      });
    }
    for (const childId of ws.childOrder[id] ?? []) visit(childId);
  }

  visit(nodeId);

  const root = ws.nodes[nodeId];
  return {
    rootId: nodeId,
    rootParentId: root?.parentId ?? null,
    nodes,
    items,
  };
}

/** Baut aus einem Schnappschuss ein Batch-Command, das den Teilbaum mit den Original-Ids wiederherstellt. */
export function buildRestoreCommand(snapshot: NodeSnapshot, ws: Workspace): Command {
  const commands: Command[] = [];

  snapshot.nodes.forEach((node, index) => {
    const isRoot = index === 0;
    const parentId = isRoot
      ? snapshot.rootParentId !== null && ws.nodes[snapshot.rootParentId]
        ? snapshot.rootParentId
        : null
      : node.parentId;
    commands.push({
      type: node.type === 'folder' ? 'createFolder' : 'createOutput',
      node: { id: node.id, name: node.name, parentId },
    });
  });

  for (const entry of snapshot.items) {
    const items = entry.items.filter((item) => !!ws.sources[item.sourceId]);
    if (items.length === 0) continue;
    commands.push({ type: 'addItems', outputId: entry.outputId, items, index: 0 });
  }

  return { type: 'batch', label: 'Wiederhergestellt', commands };
}
