import {
  addOverlay,
  copyItems,
  createFolder,
  createOutput,
  deleteNode,
  insertItems,
  itemsOfSource,
  moveItems,
  moveNode,
  removeItems,
  removeOverlay,
  removeSourceAndItems,
  renameNode,
  reorderItems,
  reorderOverlays,
  rotateItems,
  siblingNames,
  updateOverlay,
  type CreateNodeInput,
} from './composition';
import { resolveCollision, sanitizeName } from './naming';
import type {
  CompositionItem,
  ItemId,
  NodeId,
  Overlay,
  OverlayLayerMode,
  SourceDocument,
  SourceId,
  Workspace,
} from './types';

/** Ein Teil eines Splits: das neue Output und seine fertigen Items. */
export interface SplitOutputSpec {
  outputId: NodeId;
  name: string;
  items: CompositionItem[];
}

export type Command =
  | { type: 'importSources'; sources: SourceDocument[] }
  | { type: 'removeSource'; sourceId: SourceId }
  | { type: 'createFolder'; node: CreateNodeInput }
  | { type: 'createOutput'; node: CreateNodeInput }
  | { type: 'renameNode'; nodeId: NodeId; name: string }
  | { type: 'moveNode'; nodeId: NodeId; parentId: NodeId | null; index: number }
  | { type: 'deleteNode'; nodeId: NodeId }
  | { type: 'addItems'; outputId: NodeId; items: CompositionItem[]; index: number }
  | { type: 'moveItems'; itemIds: ItemId[]; outputId: NodeId; index: number }
  | { type: 'copyItems'; itemIds: ItemId[]; outputId: NodeId; index: number; newIds: ItemId[] }
  | { type: 'removeItems'; itemIds: ItemId[] }
  | { type: 'reorderItems'; outputId: NodeId; itemIds: ItemId[]; index: number }
  | { type: 'rotateItems'; itemIds: ItemId[]; delta: 90 | 180 | 270 }
  | { type: 'addOverlay'; itemId: ItemId; overlay: Overlay }
  | { type: 'updateOverlay'; itemId: ItemId; overlayId: string; patch: Partial<Overlay> }
  | { type: 'removeOverlay'; itemId: ItemId; overlayId: string }
  | { type: 'reorderOverlays'; itemId: ItemId; overlayIds: string[]; mode: OverlayLayerMode }
  | { type: 'splitSource'; sourceId: SourceId; parentId: NodeId | null; parts: SplitOutputSpec[] }
  | { type: 'renameWorkspace'; name: string }
  | { type: 'batch'; label: string; commands: Command[] };

export interface CommandCtx {
  /** Zeitstempel von aussen, damit ein Command deterministisch bleibt. */
  now: number;
}

function freeName(
  ws: Workspace,
  parentId: NodeId | null,
  wanted: string,
  exceptId?: NodeId,
): string {
  return resolveCollision(sanitizeName(wanted), siblingNames(ws, parentId, exceptId));
}

export function applyCommand(ws: Workspace, command: Command, ctx: CommandCtx): void {
  switch (command.type) {
    case 'importSources':
      for (const source of command.sources) {
        if (!ws.sources[source.id]) ws.sourceOrder.push(source.id);
        ws.sources[source.id] = source;
      }
      break;
    case 'removeSource':
      removeSourceAndItems(ws, command.sourceId);
      break;
    case 'createFolder':
      createFolder(ws, {
        ...command.node,
        name: freeName(ws, command.node.parentId, command.node.name),
      });
      break;
    case 'createOutput':
      createOutput(ws, {
        ...command.node,
        name: freeName(ws, command.node.parentId, command.node.name),
      });
      break;
    case 'renameNode': {
      const node = ws.nodes[command.nodeId];
      if (node) renameNode(ws, node.id, freeName(ws, node.parentId, command.name, node.id));
      break;
    }
    case 'moveNode':
      moveNode(ws, command.nodeId, command.parentId, command.index);
      break;
    case 'deleteNode':
      deleteNode(ws, command.nodeId);
      break;
    case 'addItems':
      insertItems(ws, command.outputId, command.items, command.index);
      break;
    case 'moveItems':
      moveItems(ws, command.itemIds, command.outputId, command.index);
      break;
    case 'copyItems':
      copyItems(ws, command.itemIds, command.outputId, command.index, command.newIds);
      break;
    case 'removeItems':
      removeItems(ws, command.itemIds);
      break;
    case 'reorderItems':
      reorderItems(ws, command.outputId, command.itemIds, command.index);
      break;
    case 'rotateItems':
      rotateItems(ws, command.itemIds, command.delta);
      break;
    case 'addOverlay':
      addOverlay(ws, command.itemId, command.overlay);
      break;
    case 'updateOverlay':
      updateOverlay(ws, command.itemId, command.overlayId, command.patch);
      break;
    case 'removeOverlay':
      removeOverlay(ws, command.itemId, command.overlayId);
      break;
    case 'reorderOverlays':
      reorderOverlays(ws, command.itemId, command.overlayIds, command.mode);
      break;
    case 'splitSource':
      for (const part of command.parts) {
        createOutput(ws, {
          id: part.outputId,
          name: freeName(ws, command.parentId, part.name),
          parentId: command.parentId,
        });
        insertItems(ws, part.outputId, part.items, 0);
      }
      break;
    case 'renameWorkspace': {
      const name = command.name.trim();
      if (name !== '') ws.name = name;
      break;
    }
    case 'batch':
      for (const inner of command.commands) applyCommand(ws, inner, ctx);
      break;
  }
  ws.updatedAt = ctx.now;
}

function pages(count: number): string {
  return count === 1 ? '1 page' : `${count} pages`;
}

function documents(count: number): string {
  return count === 1 ? '1 document' : `${count} documents`;
}

function nodeLabel(ws: Workspace, nodeId: NodeId): string {
  const node = ws.nodes[nodeId];
  if (!node) return 'Item';
  return node.type === 'folder' ? `Folder "${node.name}"` : `Document "${node.name}"`;
}

/**
 * Das Label des History-Eintrags. Es wird gegen den Zustand VOR dem Command
 * gebildet, weil geloeschte Nodes danach keinen Namen mehr haben.
 */
export function describeCommand(command: Command, before: Workspace): string {
  switch (command.type) {
    case 'importSources':
      return `Imported ${documents(command.sources.length)}`;
    case 'removeSource': {
      const items = itemsOfSource(before, command.sourceId);
      const outputs = new Set<NodeId>();
      for (const node of Object.values(before.nodes)) {
        if (node.type !== 'output') continue;
        if (node.items.some((id) => items.includes(id))) outputs.add(node.id);
      }
      return `Removed source (${pages(items.length)} from ${documents(outputs.size)})`;
    }
    case 'createFolder':
      return `Created folder "${sanitizeName(command.node.name)}"`;
    case 'createOutput':
      return `Created document "${sanitizeName(command.node.name)}"`;
    case 'renameNode':
      return `Renamed to "${sanitizeName(command.name)}"`;
    case 'moveNode':
      return `Moved ${nodeLabel(before, command.nodeId)}`;
    case 'deleteNode':
      return `Deleted ${nodeLabel(before, command.nodeId)}`;
    case 'addItems':
      return `Added ${pages(command.items.length)}`;
    case 'moveItems':
      return `Moved ${pages(command.itemIds.length)}`;
    case 'copyItems':
      return `Copied ${pages(command.itemIds.length)}`;
    case 'removeItems':
      return `Removed ${pages(command.itemIds.length)}`;
    case 'reorderItems':
      return `Reordered ${pages(command.itemIds.length)}`;
    case 'rotateItems':
      return `Rotated ${pages(command.itemIds.length)}`;
    case 'addOverlay':
      return command.overlay.kind === 'image'
        ? 'Added signature'
        : command.overlay.kind === 'shape'
          ? 'Added shape'
          : 'Added field';
    case 'updateOverlay':
      return 'Edited field';
    case 'removeOverlay':
      return 'Removed field';
    case 'reorderOverlays':
      return 'Reordered layers';
    case 'splitSource': {
      const source = before.sources[command.sourceId];
      const name = source ? source.name : 'Source';
      return `Split "${name}" into ${documents(command.parts.length)}`;
    }
    case 'renameWorkspace':
      return 'Renamed workspace';
    case 'batch':
      return command.label;
  }
}
