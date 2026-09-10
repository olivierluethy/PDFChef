import type {
  CompositionItem,
  ItemId,
  NodeId,
  Rotation,
  SourceDocument,
  SourceId,
  Workspace,
} from '../types';
import { createEmptyWorkspace, parentKey } from '../types';

export const IDS = {
  contract: 'src-contract',
  bank: 'src-bank',
  insurance: 'src-insurance',
  tax: 'n-tax',
  folderBank: 'n-folder-bank',
  folderInsurance: 'n-folder-insurance',
  folderContracts: 'n-folder-contracts',
  outContracts: 'n-out-contracts',
  outInsurance: 'n-out-insurance',
} as const;

export const FIXED_NOW = 1_700_000_000_000;

export function makeSource(id: SourceId, name: string, blockCount: number): SourceDocument {
  return {
    id,
    kind: 'pdf',
    name,
    blobKey: `hash-${id}`,
    byteSize: blockCount * 1024,
    contentHash: `hash-${id}`,
    blockKind: 'page',
    blockCount,
    blockRotations: new Array<number>(blockCount).fill(0),
    status: 'ready',
  };
}

export function makeItem(
  id: ItemId,
  sourceId: SourceId,
  blockIndex: number,
  rotation: Rotation = 0,
): CompositionItem {
  return { id, sourceId, blockIndex, rotation };
}

function addFolder(ws: Workspace, id: NodeId, name: string, parentId: NodeId | null): void {
  ws.nodes[id] = { id, type: 'folder', name, parentId };
  ws.childOrder[id] = [];
  (ws.childOrder[parentKey(parentId)] ??= []).push(id);
}

function addOutput(
  ws: Workspace,
  id: NodeId,
  name: string,
  parentId: NodeId | null,
  items: CompositionItem[],
): void {
  ws.nodes[id] = { id, type: 'output', name, parentId, targetFormat: 'pdf', items: items.map((i) => i.id) };
  for (const item of items) ws.items[item.id] = item;
  (ws.childOrder[parentKey(parentId)] ??= []).push(id);
}

/**
 * Der Workspace aus dem Akzeptanzszenario, kurz nach dem Import:
 * drei Quellen, der Ordnerbaum `Tax 2026/{Bank,Insurance,Contracts}`
 * und zwei bereits gefuellte Outputs.
 */
export function makeWorkspace(): Workspace {
  const ws = createEmptyWorkspace({ id: 'ws-test', name: 'Testablage', now: FIXED_NOW });

  for (const source of [
    makeSource(IDS.contract, 'Contract.pdf', 100),
    makeSource(IDS.bank, 'Bank.pdf', 50),
    makeSource(IDS.insurance, 'Insurance.pdf', 30),
  ]) {
    ws.sources[source.id] = source;
    ws.sourceOrder.push(source.id);
  }

  addFolder(ws, IDS.tax, 'Tax 2026', null);
  addFolder(ws, IDS.folderBank, 'Bank', IDS.tax);
  addFolder(ws, IDS.folderInsurance, 'Insurance', IDS.tax);
  addFolder(ws, IDS.folderContracts, 'Contracts', IDS.tax);

  addOutput(ws, IDS.outContracts, 'Contracts', IDS.folderContracts, [
    makeItem('i-c4', IDS.contract, 3),
    makeItem('i-c5', IDS.contract, 4),
    makeItem('i-c6', IDS.contract, 5),
  ]);
  addOutput(ws, IDS.outInsurance, 'Insurance', IDS.folderInsurance, [
    makeItem('i-i7', IDS.insurance, 6),
    makeItem('i-b17', IDS.bank, 16),
  ]);

  return ws;
}
