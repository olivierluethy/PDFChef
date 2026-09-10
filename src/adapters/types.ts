import type {
  BlockKind,
  BlockRef,
  CompositionItem,
  OutlineNode,
  SourceId,
  SourceKind,
  SourceStatus,
  TargetFormat,
} from '../domain/types';

/** Was ein Adapter ueber eine Datei wissen muss, ohne sie zu lesen. */
export interface FileDescriptor {
  name: string;
  type: string;
  size: number;
}

export interface SourceProbeResult {
  kind: SourceKind;
  blockKind: BlockKind;
  blockCount: number;
  blockRotations: number[];
  outline?: OutlineNode[];
  status: SourceStatus;
  statusDetail?: string;
}

export interface RenderOpts {
  /** Zielbreite in CSS-Pixeln; die Hoehe folgt dem Seitenverhaeltnis. */
  targetWidth: number;
  /** Geraeteaufloesung, vom Aufrufer bereits gedeckelt. */
  dpr?: number;
  signal?: AbortSignal;
}

export interface RenderedBitmap {
  blob: Blob;
  width: number;
  height: number;
}

export interface TextSpan {
  text: string;
  /** [x, y, breite, hoehe] in Seitenkoordinaten bei Skalierung 1. */
  rect: [number, number, number, number];
}

export interface PageText {
  blockIndex: number;
  text: string;
  spans: TextSpan[];
}

export interface ExtractRequest {
  type: 'extract';
  sourceId: string;
  bytes: Uint8Array;
  indices: number[];
}

export type ExtractResponse =
  | { type: 'page'; sourceId: string; blockIndex: number; text: string; spans: TextSpan[] }
  | { type: 'done'; sourceId: string }
  | { type: 'error'; sourceId: string; message: string };

export interface DocumentAdapter {
  readonly kind: SourceKind;
  accepts(file: FileDescriptor): boolean;
  probe(blob: Blob): Promise<SourceProbeResult>;
  renderBlock(ref: BlockRef, opts: RenderOpts): Promise<RenderedBitmap>;
  extractText?(ref: BlockRef): Promise<PageText>;
}

/** Einbettbare PNG/JPEG-Bytes + Masse fuer den Assembler. */
export interface ImageEmbeddable {
  format: 'png' | 'jpeg';
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface AssembleCtx {
  /** Liefert die Original-Bytes einer Quelle; der Assembler ruft das je Quelle einmal. */
  readBytes(sourceId: SourceId): Promise<Uint8Array>;
  /** Quellart je Quelle -- entscheidet, ob kopiert oder eingebettet wird. */
  sourceKind(sourceId: SourceId): SourceKind;
  /** Nur fuer Bildquellen; der Assembler ruft das je Quelle hoechstens einmal. */
  imageData(sourceId: SourceId): Promise<ImageEmbeddable>;
  /** Nur fuer Textquellen: die paginierten Zeilen. Der Assembler ruft das je Quelle hoechstens einmal. */
  textData(sourceId: SourceId): Promise<string[][]>;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/** Ein Assembler haengt am ZIEL-Format, nicht am Quellformat. */
export interface BlockAssembler {
  readonly targetFormat: TargetFormat;
  assemble(items: CompositionItem[], ctx: AssembleCtx): Promise<Uint8Array>;
}

export interface AdapterRegistry {
  register(adapter: DocumentAdapter): void;
  registerAssembler(assembler: BlockAssembler): void;
  adapterFor(file: FileDescriptor): DocumentAdapter | undefined;
  adapterOfKind(kind: SourceKind): DocumentAdapter | undefined;
  assemblerFor(format: TargetFormat): BlockAssembler | undefined;
  /** Wert fuer das `accept`-Attribut des Dateidialogs. */
  acceptAttribute(): string;
}
