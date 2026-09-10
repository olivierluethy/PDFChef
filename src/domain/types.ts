export type SourceId = string;
export type NodeId = string;
export type ItemId = string;

/** Schluessel in `Workspace.childOrder`: die Node-Id des Ordners oder 'root'. */
export type ParentKey = NodeId | 'root';
export const ROOT: ParentKey = 'root';

export type BlockKind = 'page' | 'slide' | 'sheet' | 'image' | 'section';
export type SourceKind = 'pdf' | 'image' | 'text';
export type TargetFormat = 'pdf';
export type Rotation = 0 | 90 | 180 | 270;
export type SourceStatus = 'ready' | 'error' | 'encrypted';

/** Herkunft eines Blocks: welches Quelldokument, welcher 0-basierte Index. */
export interface BlockRef {
  sourceId: SourceId;
  blockIndex: number;
}

export interface OutlineNode {
  title: string;
  blockIndex: number | null;
  children: OutlineNode[];
}

export interface SourceDocument {
  id: SourceId;
  kind: SourceKind;
  name: string;
  importPath?: string;
  blobKey: string;
  byteSize: number;
  contentHash: string;
  blockKind: BlockKind;
  blockCount: number;
  blockRotations: number[];
  outline?: OutlineNode[];
  status: SourceStatus;
  statusDetail?: string;
}

/** Eine Instanz einer Quellseite in genau einem Output. Eine Kopie ist ein zweites Item. */
export interface CompositionItem {
  id: ItemId;
  sourceId: SourceId;
  blockIndex: number;
  /** Additiv zur Rotation der Quellseite. */
  rotation: Rotation;
}

export interface FolderNode {
  id: NodeId;
  type: 'folder';
  name: string;
  parentId: NodeId | null;
}

export interface OutputDocument {
  id: NodeId;
  type: 'output';
  name: string;
  parentId: NodeId | null;
  targetFormat: TargetFormat;
  /** Die Reihenfolge dieser Liste IST die Seitenreihenfolge des Exports. */
  items: ItemId[];
}

export type WorkspaceNode = FolderNode | OutputDocument;

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
  sources: Record<SourceId, SourceDocument>;
  sourceOrder: SourceId[];
  nodes: Record<NodeId, WorkspaceNode>;
  childOrder: Record<ParentKey, NodeId[]>;
  items: Record<ItemId, CompositionItem>;
}

export function parentKey(parentId: NodeId | null): ParentKey {
  return parentId ?? ROOT;
}

export function isFolder(node: WorkspaceNode): node is FolderNode {
  return node.type === 'folder';
}

export function isOutput(node: WorkspaceNode): node is OutputDocument {
  return node.type === 'output';
}

export interface CreateWorkspaceInput {
  id: string;
  name: string;
  now?: number;
}

export function createEmptyWorkspace({ id, name, now = Date.now() }: CreateWorkspaceInput): Workspace {
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    sources: {},
    sourceOrder: [],
    nodes: {},
    childOrder: { root: [] },
    items: {},
  };
}
