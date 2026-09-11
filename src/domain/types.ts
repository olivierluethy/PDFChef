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

export type OverlayKind = 'text' | 'image' | 'shape';

/**
 * Die zeichenbaren Formen. `box`-Formen (Rechteck/Ellipse/Highlight) werden ueber
 * ein aufgezogenes Rechteck definiert; `line`-Formen (Linie/Pfeil/Polygon/Freihand)
 * ueber `points` relativ zur Box; `mark`-Formen (Haken/Kreuz) sind feste Pfade in
 * der Box. Siehe `domain/overlayShapes.ts` fuer Katalog, Standardwerte und Geometrie.
 */
export type ShapeKind =
  | 'rect'
  | 'roundRect'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'polygon'
  | 'freehand'
  | 'highlight'
  | 'check'
  | 'cross';

/**
 * Ein frei platzierter Zusatz auf einer Seiteninstanz -- ein ausgefuelltes
 * Textfeld, eine Unterschrift oder eine Form. Alle Masse sind Bruchteile 0..1 der
 * ungedrehten Seite (Ursprung oben links), damit sie unabhaengig von Zoom und
 * Renderaufloesung sind und in der Vorschau wie im Export gleich landen.
 */
export interface Overlay {
  id: string;
  kind: OverlayKind;
  x: number;
  y: number;
  /** Breite des Kastens (Text/Form) bzw. sichtbare Breite (Bild). */
  w: number;
  /** Hoehe -- fuer Bilder und Formen relevant (Text waechst selbst). */
  h: number;
  /** Text: der eingegebene Wert (bei Auswahl der gewaehlte Eintrag; auch Text in einer Form). */
  text?: string;
  /** Text: Schriftgroesse als Bruchteil der Seitenhoehe. */
  fontSize?: number;
  /** Text: Schriftart-Schluessel aus OVERLAY_FONTS (Standard: Helvetica). */
  font?: string;
  /** Text: fett (echter Bold-Schnitt in Vorschau und Export). */
  bold?: boolean;
  /** Text: kursiv (synthetische Neigung in Vorschau und Export). */
  italic?: boolean;
  /** Text/Text-in-Form: Textfarbe als #RRGGBB (Standard: dunkles Grau). */
  color?: string;
  /** Bild/Unterschrift: PNG als data-URL. */
  dataUrl?: string;
  /**
   * Wenn gesetzt, ist das Feld eine Auswahl (erkanntes Select/Dropdown oder
   * Ankreuzfeld): der Editor zeigt statt eines Textfelds diese Optionen.
   */
  options?: string[];
  /** Form: welche Form (nur bei kind === 'shape'). */
  shape?: ShapeKind;
  /** Form: Fuellfarbe als #RRGGBB; 'none' oder undefined = keine Fuellung. */
  fill?: string;
  /** Form: Randfarbe als #RRGGBB; undefined = kein Rand. */
  stroke?: string;
  /** Form: Randstaerke als Bruchteil der Seitenhoehe. */
  strokeWidth?: number;
  /** Form: Gesamtdeckkraft 0..1 (Standard 1). */
  opacity?: number;
  /**
   * Form (Linie/Pfeil/Polygon/Freihand): Stuetzpunkte relativ zur Box als
   * [x0,y0,x1,y1,...], je 0..1. Bei Linie/Pfeil genau zwei Punkte.
   */
  points?: number[];
  /** Gruppierung: Overlays mit gleicher `groupId` verschieben/kopieren sich gemeinsam. */
  groupId?: string;
  /**
   * Export: als echtes, im Reader ausfuellbares AcroForm-Feld exportieren statt
   * eingebrannt. Nur fuer Text-, Auswahl- und Ankreuzfelder sinnvoll.
   */
  interactive?: boolean;
  /** Export: Feldname des interaktiven Feldes (wird bei Bedarf eindeutig gemacht). */
  fieldName?: string;
}

/** Eine Instanz einer Quellseite in genau einem Output. Eine Kopie ist ein zweites Item. */
export interface CompositionItem {
  id: ItemId;
  sourceId: SourceId;
  blockIndex: number;
  /** Additiv zur Rotation der Quellseite. */
  rotation: Rotation;
  /** Ausgefuellte Felder und Unterschriften auf dieser Seiteninstanz. */
  overlays?: Overlay[];
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

export function createEmptyWorkspace({
  id,
  name,
  now = Date.now(),
}: CreateWorkspaceInput): Workspace {
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
