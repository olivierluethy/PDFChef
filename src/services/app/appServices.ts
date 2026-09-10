import { createDispatchingAdapter } from '../../adapters/dispatchAdapter';
import { createImageAdapter } from '../../adapters/image/imageAdapter';
import { createPdfAdapter } from '../../adapters/pdf/pdfAdapter';
import { createPdfAssembler } from '../../adapters/pdf/pdfAssembler';
import { createDocumentPool } from '../../adapters/pdf/pdfPool';
import type { PdfDocumentHandle } from '../../adapters/pdf/pdfEngine';
import { createOffscreenSurface, createPdfjsEngine } from '../../adapters/pdf/pdfjsEngine';
import { createRegistry } from '../../adapters/registry';
import { createTextAdapter } from '../../adapters/text/textAdapter';
import { paginateText } from '../../adapters/text/textLayout';
import type { AdapterRegistry, BlockAssembler, DocumentAdapter, ImageEmbeddable } from '../../adapters/types';
import type { SourceId, SourceKind } from '../../domain/types';
import { newId } from '../../domain/ids';
import { createAutosave, type Autosave } from '../persistence/autosave';
import { openWorkspaceDb, type Database } from '../persistence/db';
import { createSourceBlobStore, type SourceBlobStore } from '../persistence/sourceBlobStore';
import { createStorageGuard, type StorageGuard } from '../persistence/storage';
import { createThumbStore } from '../persistence/thumbStore';
import { createWorkspaceRepo, type WorkspaceRepo } from '../persistence/workspaceRepo';
import { createBlobUrlCache } from '../thumbnails/thumbnailCache';
import { createRenderQueue } from '../thumbnails/renderQueue';
import { createThumbnailService, type ThumbnailService } from '../thumbnails/thumbnailService';
import {
  collectFromDataTransfer,
  collectFromFileList,
  expandZipCandidates,
  type DataTransferItemLike,
} from '../import/fileSources';
import { importCandidates, sha256Hex, type ImportReport } from '../import/importSources';

export interface AppServicesDeps {
  /**
   * Beantwortet, welcher Inhalt zu einer Quelle gehoert. Der Aufrufer liest
   * das aus seinem aktuellen Workspace -- die Adapter-Schicht darf ihn nicht kennen.
   */
  contentHashOf(sourceId: SourceId): string | undefined;
  /**
   * Beantwortet die Quellart einer Quelle. Der Aufrufer liest das aus seinem
   * aktuellen Workspace -- die Adapter-Schicht darf ihn nicht kennen.
   */
  sourceKindOf(sourceId: SourceId): SourceKind | undefined;
  dbName?: string;
}

export interface AppServices {
  db: Database;
  registry: AdapterRegistry;
  adapter: DocumentAdapter;
  assembler: BlockAssembler;
  blobStore: SourceBlobStore;
  repo: WorkspaceRepo;
  storage: StorageGuard;
  autosave: Autosave;
  thumbnails: ThumbnailService;
  readBytesForSource(sourceId: SourceId): Promise<Uint8Array>;
  imageEmbeddable(sourceId: SourceId): Promise<ImageEmbeddable>;
  textPages(sourceId: SourceId): Promise<string[][]>;
  importForDrop(items: DataTransferItem[]): Promise<ImportReport>;
  importForFiles(files: FileList | File[]): Promise<ImportReport>;
  dispose(): Promise<void>;
}

export async function createAppServices({
  contentHashOf,
  sourceKindOf,
  dbName,
}: AppServicesDeps): Promise<AppServices> {
  const db = await openWorkspaceDb(dbName);
  const blobStore = createSourceBlobStore(db);
  const repo = createWorkspaceRepo(db);
  const storage = createStorageGuard(globalThis.navigator?.storage);

  function hashOrThrow(sourceId: SourceId): string {
    const hash = contentHashOf(sourceId);
    if (!hash) throw new Error(`Zur Quelle ${sourceId} ist kein gespeicherter Inhalt bekannt.`);
    return hash;
  }

  const readBytesForSource = (sourceId: SourceId) => blobStore.readBytes(hashOrThrow(sourceId));

  const engine = createPdfjsEngine();
  const pool = createDocumentPool<PdfDocumentHandle>({
    load: async (sourceId) => engine.open(await readBytesForSource(sourceId)),
    destroy: (document) => document.destroy(),
    maxOpen: 4,
  });

  const pdfAdapter = createPdfAdapter({ engine, pool, createSurface: createOffscreenSurface });
  const imageAdapter = createImageAdapter({
    readBytes: readBytesForSource,
    createSurface: createOffscreenSurface,
    decode: (blob) => createImageBitmap(blob),
  });
  const textAdapter = createTextAdapter({
    readBytes: readBytesForSource,
    createSurface: createOffscreenSurface,
    decodeText: (bytes) => new TextDecoder().decode(bytes),
  });
  const assembler = createPdfAssembler();
  const registry = createRegistry();
  registry.register(pdfAdapter);
  registry.register(imageAdapter);
  registry.register(textAdapter);
  registry.registerAssembler(assembler);

  const dispatcher = createDispatchingAdapter({
    sourceKindOf,
    byKind: { pdf: pdfAdapter, image: imageAdapter, text: textAdapter },
  });

  const thumbnails = createThumbnailService({
    adapter: dispatcher,
    store: createThumbStore(db),
    queue: createRenderQueue({ concurrency: 3 }),
    cache: createBlobUrlCache({
      createUrl: (blob) => URL.createObjectURL(blob),
      revokeUrl: (url) => URL.revokeObjectURL(url),
    }),
    dpr: Math.min(globalThis.devicePixelRatio || 1, 2),
  });

  const autosave = createAutosave({ save: (ws) => repo.save(ws) });

  const importDeps = { registry, blobStore, storage, hash: sha256Hex, newId };

  return {
    db,
    registry,
    adapter: dispatcher,
    assembler,
    blobStore,
    repo,
    storage,
    autosave,
    thumbnails,
    readBytesForSource,
    async imageEmbeddable(sourceId) {
      return imageAdapter.toEmbeddable(await readBytesForSource(sourceId));
    },
    async textPages(sourceId) {
      return paginateText(new TextDecoder().decode(await readBytesForSource(sourceId)));
    },
    async importForDrop(items) {
      return importCandidates(
        await expandZipCandidates(await collectFromDataTransfer(items as DataTransferItemLike[])),
        importDeps,
      );
    },
    async importForFiles(files) {
      return importCandidates(await expandZipCandidates(collectFromFileList(files)), importDeps);
    },
    async dispose() {
      autosave.dispose();
      thumbnails.clearMemory();
      await pool.clear();
      db.close();
    },
  };
}
