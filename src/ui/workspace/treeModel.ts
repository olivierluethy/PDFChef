import { ROOT, isFolder, type NodeId, type Workspace } from '../../domain/types';

export interface FlatNode {
  id: NodeId;
  depth: number;
  type: 'folder' | 'output';
}

/** Vorordnungs-Durchlauf in childOrder-Reihenfolge; Grundlage fuer die Anzeige. */
export function flattenTree(ws: Workspace): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (parentKey: string, depth: number) => {
    for (const id of ws.childOrder[parentKey] ?? []) {
      const node = ws.nodes[id];
      if (!node) continue;
      const type = isFolder(node) ? 'folder' : 'output';
      out.push({ id, depth, type });
      if (type === 'folder') walk(id, depth + 1);
    }
  };
  walk(ROOT, 0);
  return out;
}
