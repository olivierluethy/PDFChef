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

export type AnnotationId = string;

/** Farbe in 0..255 pro Kanal -- so wie ein <input type=color> sie liefert. */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Gemeinsame Lage aller Annotationen. Position und Groesse sind BRUCHTEILE
 * (0..1) der gerenderten Seitenflaeche in ihrer Anzeigeorientierung (also nach
 * dem in das Seitenbild eingebrannten /Rotate der Quelle). Bruchteile sind
 * unabhaengig von Zoom und Thumbnail-Groesse: dieselbe Zahl gilt in der grossen
 * Vorschau, in der Kachel und beim Export.
 */
export interface AnnotationBase {
  id: AnnotationId;
  /** Linke obere Ecke, Bruchteil von Seitenbreite/-hoehe. */
  x: number;
  y: number;
  /** Breite als Bruchteil der Seitenbreite. */
  width: number;
}

export interface TextAnnotation extends AnnotationBase {
  kind: 'text';
  text: string;
  /** fontId aus dem Font-Katalog (public/fonts/manifest.json). */
  fontId: string;
  bold: boolean;
  /**
   * Schriftgroesse als BRUCHTEIL der Seitenhoehe (Anzeigeorientierung). So ist
   * die Groesse -- wie Position und Breite -- unabhaengig von Zoom und
   * Thumbnail-Groesse. In Punkte umgerechnet: sizeFrac * Seitenhoehe(pt).
   */
  sizeFrac: number;
  color: RgbColor;
  align: 'left' | 'center' | 'right';
  /** Zeilenhoehe als Faktor der Schriftgroesse, z.B. 1.3. */
  lineHeight: number;
}

export interface SignatureAnnotation extends AnnotationBase {
  kind: 'signature';
  /** Hoehe als Bruchteil der Seitenhoehe. */
  height: number;
  /** Schluessel im annotationBlobStore -> PNG mit Transparenz. */
  blobKey: string;
  /** Natuerliches Seitenverhaeltnis (Breite/Hoehe) des Bildes. */
  aspect: number;
}

export type Annotation = TextAnnotation | SignatureAnnotation;

/** Eine Instanz einer Quellseite in genau einem Output. Eine Kopie ist ein zweites Item. */
export interface CompositionItem {
  id: ItemId;
  sourceId: SourceId;
  blockIndex: number;
  /** Additiv zur Rotation der Quellseite. */
  rotation: Rotation;
  /** Text-/Unterschrift-Ebene dieser Seiten-Instanz; fehlt = keine. */
  annotations?: Annotation[];
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
