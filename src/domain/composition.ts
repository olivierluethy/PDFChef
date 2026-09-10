import type {
  CompositionItem,
  FolderNode,
  ItemId,
  NodeId,
  OutputDocument,
  Rotation,
  SourceId,
  Workspace,
} from './types';
import { parentKey } from './types';

/**
 * Alle Funktionen dieses Moduls mutieren einen Immer-Draft in place.
 * Der Store fuehrt sie in `produceWithPatches` aus und leitet daraus die
 * Undo-Inverse ab; Tests fuehren sie in `produce` aus.
 * Ids und Zeitstempel werden nie hier erzeugt, sondern immer hereingegeben.
 */

export function requireOutput(ws: Workspace, outputId: NodeId): OutputDocument {
  const node = ws.nodes[outputId];
  if (!node || node.type !== 'output') throw new Error(`Kein Output-Dokument: ${outputId}`);
  return node;
}

export function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.trunc(index), length);
}

export function buildItems(
  sourceId: SourceId,
  blockIndices: number[],
  ids: ItemId[],
): CompositionItem[] {
  if (ids.length !== blockIndices.length) {
    throw new Error('Zu jedem Block muss genau eine Item-Id vorliegen.');
  }
  return blockIndices.map((blockIndex, position) => ({
    id: ids[position],
    sourceId,
    blockIndex,
    rotation: 0,
  }));
}

export function insertItems(
  ws: Workspace,
  outputId: NodeId,
  items: CompositionItem[],
  index: number,
): void {
  const output = requireOutput(ws, outputId);
  // Erst alle Ids pruefen, dann schreiben: ein Teil-Einfuegen waere schlimmer
  // als ein sauberer Abbruch.
  for (const item of items) {
    if (ws.items[item.id]) throw new Error(`Item-Id bereits vergeben: ${item.id}`);
  }
  for (const item of items) ws.items[item.id] = item;
  output.items.splice(clampIndex(index, output.items.length), 0, ...items.map((item) => item.id));
}

export function removeItems(ws: Workspace, itemIds: ItemId[]): void {
  const doomed = new Set(itemIds);
  if (doomed.size === 0) return;
  for (const node of Object.values(ws.nodes)) {
    if (node.type !== 'output') continue;
    if (!node.items.some((id) => doomed.has(id))) continue;
    node.items = node.items.filter((id) => !doomed.has(id));
  }
  for (const id of doomed) delete ws.items[id];
}

/**
 * Verschiebt Items an Position `index` im Ziel-Output. Die Reihenfolge in
 * `itemIds` ist die Reihenfolge im Ziel -- das UI uebergibt sie in Lesereihenfolge.
 */
export function moveItems(
  ws: Workspace,
  itemIds: ItemId[],
  targetOutputId: NodeId,
  index: number,
): void {
  const target = requireOutput(ws, targetOutputId);
  const moving = itemIds.filter((id) => ws.items[id] !== undefined);
  if (moving.length === 0) return;
  const movingSet = new Set(moving);

  // Die Einfuegeposition wird gegen den Zustand VOR dem Entfernen bestimmt und
  // um die Items korrigiert, die vor ihr herausgenommen werden. Sonst
  // verrutscht jedes Umsortieren um die Zahl der gezogenen Seiten.
  const desired = clampIndex(index, target.items.length);
  const removedBefore = target.items.slice(0, desired).filter((id) => movingSet.has(id)).length;

  for (const node of Object.values(ws.nodes)) {
    if (node.type !== 'output') continue;
    if (!node.items.some((id) => movingSet.has(id))) continue;
    node.items = node.items.filter((id) => !movingSet.has(id));
  }

  target.items.splice(desired - removedBefore, 0, ...moving);
}

/** Umsortieren ist ein Verschieben mit gleichem Quell- und Zieldokument. */
export function reorderItems(
  ws: Workspace,
  outputId: NodeId,
  itemIds: ItemId[],
  index: number,
): void {
  moveItems(ws, itemIds, outputId, index);
}

export function copyItems(
  ws: Workspace,
  itemIds: ItemId[],
  targetOutputId: NodeId,
  index: number,
  newIds: ItemId[],
): void {
  if (newIds.length !== itemIds.length) {
    throw new Error('Zu jeder Kopie muss genau eine neue Item-Id vorliegen.');
  }
  const copies: CompositionItem[] = [];
  itemIds.forEach((itemId, position) => {
    const original = ws.items[itemId];
    if (!original) return;
    copies.push({ ...original, id: newIds[position] });
  });
  insertItems(ws, targetOutputId, copies, index);
}

export function rotateItems(ws: Workspace, itemIds: ItemId[], delta: 90 | 180 | 270): void {
  for (const itemId of itemIds) {
    const item = ws.items[itemId];
    if (!item) continue;
    // Zweimal modulo: die erste Rechnung kann bei negativen Zwischenwerten
    // negativ bleiben, die zweite bringt 360 wieder auf 0.
    item.rotation = ((((item.rotation + delta) % 360) + 360) % 360) as Rotation;
  }
}

export interface CreateNodeInput {
  id: NodeId;
  name: string;
  parentId: NodeId | null;
  /** Position im Elternordner; ohne Angabe hinten anfuegen. */
  index?: number;
}

function requireFolder(ws: Workspace, nodeId: NodeId): FolderNode {
  const node = ws.nodes[nodeId];
  if (!node || node.type !== 'folder') throw new Error(`Ziel ist kein Ordner: ${nodeId}`);
  return node;
}

function assertFreeNodeId(ws: Workspace, nodeId: NodeId): void {
  if (ws.nodes[nodeId]) throw new Error(`Node-Id bereits vergeben: ${nodeId}`);
}

/** Kinderliste eines Elternteils, bei Bedarf angelegt. */
function childList(ws: Workspace, parentId: NodeId | null): NodeId[] {
  const key = parentKey(parentId);
  const existing = ws.childOrder[key];
  if (existing) return existing;
  ws.childOrder[key] = [];
  return ws.childOrder[key];
}

export function createFolder(ws: Workspace, input: CreateNodeInput): void {
  assertFreeNodeId(ws, input.id);
  if (input.parentId !== null) requireFolder(ws, input.parentId);
  ws.nodes[input.id] = { id: input.id, type: 'folder', name: input.name, parentId: input.parentId };
  // Ordner bekommen sofort eine eigene Kinderliste, Outputs nie (Invariante 1).
  ws.childOrder[input.id] = [];
  const siblings = childList(ws, input.parentId);
  siblings.splice(clampIndex(input.index ?? siblings.length, siblings.length), 0, input.id);
}

export function createOutput(ws: Workspace, input: CreateNodeInput): void {
  assertFreeNodeId(ws, input.id);
  if (input.parentId !== null) requireFolder(ws, input.parentId);
  ws.nodes[input.id] = {
    id: input.id,
    type: 'output',
    name: input.name,
    parentId: input.parentId,
    targetFormat: 'pdf',
    items: [],
  };
  const siblings = childList(ws, input.parentId);
  siblings.splice(clampIndex(input.index ?? siblings.length, siblings.length), 0, input.id);
}

export function renameNode(ws: Workspace, nodeId: NodeId, name: string): void {
  const node = ws.nodes[nodeId];
  if (!node) return;
  node.name = name;
}

export function isDescendant(ws: Workspace, nodeId: NodeId, maybeAncestorId: NodeId): boolean {
  const seen = new Set<NodeId>([nodeId]);
  let current = ws.nodes[nodeId]?.parentId ?? null;
  while (current !== null) {
    if (current === maybeAncestorId) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    current = ws.nodes[current]?.parentId ?? null;
  }
  return false;
}

/** Invariante 6: kein Ordner darf sein eigener Vorfahre werden. */
export function canMoveNode(ws: Workspace, nodeId: NodeId, newParentId: NodeId | null): boolean {
  if (!ws.nodes[nodeId]) return false;
  if (newParentId === null) return true;
  const parent = ws.nodes[newParentId];
  if (!parent || parent.type !== 'folder') return false;
  if (newParentId === nodeId) return false;
  return !isDescendant(ws, newParentId, nodeId);
}

export function moveNode(
  ws: Workspace,
  nodeId: NodeId,
  newParentId: NodeId | null,
  index: number,
): void {
  if (!canMoveNode(ws, nodeId, newParentId)) {
    throw new Error(`Verschieben nicht erlaubt: ${nodeId} -> ${String(newParentId)}`);
  }
  const node = ws.nodes[nodeId];
  if (!node) return;

  const fromKey = parentKey(node.parentId);
  const toKey = parentKey(newParentId);
  const fromList = ws.childOrder[fromKey] ?? [];
  const targetBefore = fromKey === toKey ? fromList : (ws.childOrder[toKey] ?? []);

  // Wie bei moveItems: Position gegen den Zustand vor dem Entfernen bestimmen.
  const desired = clampIndex(index, targetBefore.length);
  const removedBefore =
    fromKey === toKey ? targetBefore.slice(0, desired).filter((id) => id === nodeId).length : 0;

  ws.childOrder[fromKey] = fromList.filter((id) => id !== nodeId);
  node.parentId = newParentId;
  const targetList = childList(ws, newParentId);
  targetList.splice(desired - removedBefore, 0, nodeId);
}

export function collectSubtree(ws: Workspace, nodeId: NodeId): NodeId[] {
  const collected: NodeId[] = [];
  const stack: NodeId[] = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    if (!ws.nodes[current]) continue;
    collected.push(current);
    stack.push(...(ws.childOrder[current] ?? []));
  }
  return collected;
}

export function deleteNode(ws: Workspace, nodeId: NodeId): void {
  const node = ws.nodes[nodeId];
  if (!node) return;

  const subtree = collectSubtree(ws, nodeId);
  const doomedItems: ItemId[] = [];
  for (const id of subtree) {
    const current = ws.nodes[id];
    if (current && current.type === 'output') doomedItems.push(...current.items);
  }
  for (const itemId of doomedItems) delete ws.items[itemId];
  for (const id of subtree) {
    delete ws.nodes[id];
    delete ws.childOrder[id];
  }

  // Die inneren Nodes verschwinden mit ihren geloeschten Kinderlisten,
  // nur der Elternordner der obersten Node muss noch bereinigt werden.
  const parentList = ws.childOrder[parentKey(node.parentId)];
  if (parentList) {
    ws.childOrder[parentKey(node.parentId)] = parentList.filter((id) => id !== nodeId);
  }
}

export function itemsOfSource(ws: Workspace, sourceId: SourceId): ItemId[] {
  return Object.values(ws.items)
    .filter((item) => item.sourceId === sourceId)
    .map((item) => item.id);
}

/** Invariante 3: ohne Quelle kann kein Item bestehen bleiben. */
export function removeSourceAndItems(ws: Workspace, sourceId: SourceId): void {
  removeItems(ws, itemsOfSource(ws, sourceId));
  delete ws.sources[sourceId];
  ws.sourceOrder = ws.sourceOrder.filter((id) => id !== sourceId);
}

export function siblingNames(ws: Workspace, parentId: NodeId | null, exceptId?: NodeId): string[] {
  return (ws.childOrder[parentKey(parentId)] ?? [])
    .filter((id) => id !== exceptId)
    .map((id) => ws.nodes[id]?.name ?? '')
    .filter((name) => name !== '');
}
