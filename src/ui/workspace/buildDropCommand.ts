import type { Command } from '../../domain/commands';
import type { CompositionItem, NodeId, Workspace } from '../../domain/types';
import { isFolder, parentKey } from '../../domain/types';
import { canMoveNode } from '../../domain/composition';
import { resolveDropAction, type DragOrigin, type DropTarget } from './dragLogic';

export interface BuildDropParams {
  origin: DragOrigin;
  target: DropTarget;
  modifier: boolean;
  ws: Workspace;
  newId(): string;
}

function pagesLabel(count: number): string {
  return count === 1 ? '1 Seite' : `${count} Seiten`;
}

/** Neue Items aus Quellseiten; jede Instanz bekommt eine eigene Identitaet. */
function itemsFromSource(sourceId: string, blockIndices: number[], newId: () => string): CompositionItem[] {
  return blockIndices.map((blockIndex) => ({ id: newId(), sourceId, blockIndex, rotation: 0 }));
}

function itemCount(origin: DragOrigin): number {
  if (origin.kind === 'source') return origin.blockIndices.length;
  if (origin.kind === 'output') return origin.itemIds.length;
  return 1; // Ein Knoten-Drag bewegt genau ein Element.
}

/** Ziel-Elternteil beim Umhaengen eines Knotens: Ordner selbst, der Ordner des
 *  getroffenen Baum-Dokuments, oder die Wurzel (null). */
function moveParentId(ws: Workspace, target: DropTarget): NodeId | null | undefined {
  if (target.kind === 'folder') return target.nodeId;
  if (target.kind === 'tree-root') return null;
  if (target.kind === 'tree-output') return ws.nodes[target.outputId]?.parentId ?? null;
  return undefined;
}

/**
 * Uebersetzt eine aufgeloeste Drop-Aktion in genau einen Command. Ein Drop in
 * einen Ordner erzeugt ein neues Output und fuellt es -- beides zusammen als ein
 * batch, damit es ein einziger Undo-Schritt ist.
 */
export function buildDropCommand({ origin, target, modifier, ws, newId }: BuildDropParams): Command | null {
  if (itemCount(origin) === 0) return null;
  const action = resolveDropAction(origin, target, modifier);

  switch (action.kind) {
    case 'addFromSource': {
      if (origin.kind !== 'source' || target.kind !== 'output') return null;
      return {
        type: 'addItems',
        outputId: target.outputId,
        index: target.index,
        items: itemsFromSource(origin.sourceId, origin.blockIndices, newId),
      };
    }
    case 'moveItems': {
      if (origin.kind !== 'output' || target.kind !== 'output') return null;
      // Dasselbe Output umsortieren ist reorderItems, nicht moveItems.
      if (origin.outputId === target.outputId) {
        return { type: 'reorderItems', outputId: target.outputId, itemIds: origin.itemIds, index: target.index };
      }
      return { type: 'moveItems', itemIds: origin.itemIds, outputId: target.outputId, index: target.index };
    }
    case 'copyItems': {
      if (origin.kind !== 'output' || target.kind !== 'output') return null;
      return {
        type: 'copyItems',
        itemIds: origin.itemIds,
        outputId: target.outputId,
        index: target.index,
        newIds: origin.itemIds.map(() => newId()),
      };
    }
    case 'createOutputFromFolder': {
      if (target.kind !== 'folder') return null;
      const folder = ws.nodes[target.nodeId];
      const name = folder && isFolder(folder) ? folder.name : 'Neues Dokument';
      const outputId = newId();
      const create: Command = { type: 'createOutput', node: { id: outputId, name, parentId: target.nodeId } };
      if (origin.kind === 'source') {
        const items = itemsFromSource(origin.sourceId, origin.blockIndices, newId);
        return {
          type: 'batch',
          label: `${pagesLabel(items.length)} in ein neues Dokument`,
          commands: [create, { type: 'addItems', outputId, index: 0, items }],
        };
      }
      // Ein ganzer Knoten landet nie hier (resolveDropAction -> moveNode); nur Seiten.
      if (origin.kind !== 'output') return null;
      return {
        type: 'batch',
        label: `${pagesLabel(origin.itemIds.length)} in ein neues Dokument`,
        commands: [create, { type: 'moveItems', itemIds: origin.itemIds, outputId, index: 0 }],
      };
    }
    case 'moveNode': {
      if (origin.kind !== 'node') return null;
      const newParentId = moveParentId(ws, target);
      if (newParentId === undefined) return null;
      // Zyklen (Ordner in sich selbst) und ungueltige Ziele hier abfangen, damit
      // der Command nie eine Invariante des Datenmodells verletzt.
      if (!canMoveNode(ws, origin.nodeId, newParentId)) return null;
      const index = (ws.childOrder[parentKey(newParentId)] ?? []).length;
      return { type: 'moveNode', nodeId: origin.nodeId, parentId: newParentId, index };
    }
    case 'none':
      return null;
  }
}
