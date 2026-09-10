import type { Command } from '../../domain/commands';
import type { CompositionItem, Workspace } from '../../domain/types';
import { isFolder } from '../../domain/types';
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
  return origin.kind === 'source' ? origin.blockIndices.length : origin.itemIds.length;
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
      return {
        type: 'batch',
        label: `${pagesLabel(origin.itemIds.length)} in ein neues Dokument`,
        commands: [create, { type: 'moveItems', itemIds: origin.itemIds, outputId, index: 0 }],
      };
    }
    case 'none':
      return null;
  }
}
