import type { ItemId, NodeId, ParentKey, Workspace } from './types';
import { parentKey } from './types';

/**
 * Prueft die sechs Invarianten aus dem Design und liefert die Verletzungen als Text.
 * Rueckgabe statt Wurf, damit Tests alle Probleme auf einmal sehen.
 */
export function checkWorkspaceInvariants(ws: Workspace): string[] {
  const problems: string[] = [];
  const ownerOfItem = new Map<ItemId, NodeId>();

  for (const node of Object.values(ws.nodes)) {
    if (node.parentId !== null) {
      const parent = ws.nodes[node.parentId];
      if (!parent) {
        problems.push(`Node ${node.id} references the unknown folder ${node.parentId}`);
      } else if (parent.type !== 'folder') {
        problems.push(`Node ${node.id} sits in ${parent.id}, which is not a folder`);
      }
    }

    if (node.type !== 'output') continue;

    for (const itemId of node.items) {
      const owner = ownerOfItem.get(itemId);
      if (owner !== undefined) {
        problems.push(`Item ${itemId} is in ${owner} and in ${node.id}`);
      } else {
        ownerOfItem.set(itemId, node.id);
      }

      const item = ws.items[itemId];
      if (!item) {
        problems.push(`Item ${itemId} is in ${node.id} but missing from items`);
        continue;
      }

      const source = ws.sources[item.sourceId];
      if (!source) {
        problems.push(`Item ${itemId} references the unknown source ${item.sourceId}`);
        continue;
      }
      if (item.blockIndex < 0 || item.blockIndex >= source.blockCount) {
        problems.push(
          `Item ${itemId} has blockIndex ${item.blockIndex} outside [0, ${source.blockCount})`,
        );
      }
    }
  }

  for (const itemId of Object.keys(ws.items)) {
    if (!ownerOfItem.has(itemId)) problems.push(`Item ${itemId} is in no output`);
  }

  const placed = new Set<NodeId>();
  for (const [key, children] of Object.entries(ws.childOrder) as [ParentKey, NodeId[]][]) {
    for (const childId of children) {
      if (placed.has(childId)) problems.push(`Node ${childId} appears multiple times in childOrder`);
      placed.add(childId);
      const child = ws.nodes[childId];
      if (!child) {
        problems.push(`childOrder[${key}] names the unknown node ${childId}`);
        continue;
      }
      if (parentKey(child.parentId) !== key) {
        problems.push(`Node ${childId} sits under ${key} but has parentId ${child.parentId}`);
      }
    }
  }
  for (const node of Object.values(ws.nodes)) {
    if (!placed.has(node.id)) problems.push(`Node ${node.id} missing from childOrder`);
  }

  for (const node of Object.values(ws.nodes)) {
    const seen = new Set<NodeId>([node.id]);
    let current = node.parentId;
    while (current !== null) {
      if (seen.has(current)) {
        problems.push(`Node ${node.id} is its own ancestor`);
        break;
      }
      seen.add(current);
      const parent = ws.nodes[current];
      if (!parent) break;
      current = parent.parentId;
    }
  }

  for (const sourceId of ws.sourceOrder) {
    if (!ws.sources[sourceId]) problems.push(`sourceOrder names the unknown source ${sourceId}`);
  }
  for (const sourceId of Object.keys(ws.sources)) {
    if (!ws.sourceOrder.includes(sourceId)) problems.push(`Source ${sourceId} missing from sourceOrder`);
  }

  return problems;
}

/** In Entwicklungsbuilds nach jedem Command aufzurufen (siehe Plan 3). */
export function assertWorkspaceInvariants(ws: Workspace): void {
  const problems = checkWorkspaceInvariants(ws);
  if (problems.length > 0) {
    throw new Error(`Workspace invariants violated:\n- ${problems.join('\n- ')}`);
  }
}
