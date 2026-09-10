import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderUp, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { newId } from '../../domain/ids';
import { buildNodeSnapshot } from '../../domain/trash';
import { isOutput, type NodeId, type SourceId } from '../../domain/types';
import { SplitPane } from '../common/SplitPane';
import type { SaveStatus } from '../../services/persistence/autosave';
import { createTrashService } from '../../services/persistence/trashService';
import { SourceGrid } from '../sources/SourceGrid';
import { SourceList } from '../sources/SourceList';
import { DuplicatesNotice } from '../sources/DuplicatesNotice';
import { RangeField } from '../sources/RangeField';
import { OutlinePanel } from '../sources/OutlinePanel';
import { OutputGrid } from '../workspace/OutputGrid';
import { OutputTree } from '../workspace/OutputTree';
import { SplitPanel } from '../workspace/SplitPanel';
import { TrashPanel } from '../workspace/TrashPanel';
import { DragPreview } from '../workspace/DragPreview';
import { usePointerDrag } from '../workspace/usePointerDrag';
import { useExternalDrop } from '../workspace/useExternalDrop';
import { PreviewPane } from '../preview/PreviewPane';
import { useOcr } from '../preview/useOcr';
import { useSearch } from '../preview/useSearch';
import { useExport } from '../export/useExport';
import { useLatexExport } from '../export/useLatexExport';
import { CommandPalette } from './CommandPalette';
import type { PaletteAction } from './commandFilter';
import { ContextBar } from './ContextBar';
import { Header } from './Header';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { bootstrapWorkspace } from './bootstrap';
import {
  StoreProvider,
  useDispatch,
  useServices,
  useSelectionStore,
  useWorkspace,
  useWorkspaceStore,
  type StoreContextValue,
} from './StoreProvider';

export interface AppProps {
  bootstrap?: () => Promise<StoreContextValue>;
}

export function App({ bootstrap = bootstrapWorkspace }: AppProps = {}) {
  const [store, setStore] = useState<StoreContextValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    bootstrap()
      .then((value) => active && setStore(value))
      .catch((cause) => {
        console.error('Arbeitsbereich konnte nicht geladen werden', cause);
        if (active) setError('Der Arbeitsbereich konnte nicht geladen werden.');
      });
    return () => {
      active = false;
    };
  }, [bootstrap]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-shell text-neutral-300">
        <p>{error}</p>
      </div>
    );
  }
  if (!store) {
    return (
      <div className="grid min-h-screen place-items-center bg-shell text-neutral-500">
        <p>Arbeitsbereich wird geladen...</p>
      </div>
    );
  }

  return (
    <StoreProvider value={store}>
      <Workspace />
    </StoreProvider>
  );
}

function Workspace() {
  const workspace = useWorkspace();
  const services = useServices();
  const dispatch = useDispatch();
  const workspaceStore = useWorkspaceStore();
  const selectionStore = useSelectionStore();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [activeSourceId, setActiveSourceId] = useState<SourceId | null>(null);
  const [activeOutputId, setActiveOutputId] = useState<NodeId | null>(null);
  const [splitting, setSplitting] = useState<SourceId | null>(null);
  const [sourceSeek, setSourceSeek] = useState<{ index: number; nonce: number } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const trash = useMemo(() => createTrashService(services.db), [services.db]);

  const drag = usePointerDrag();
  const external = useExternalDrop();
  const exportUi = useExport();
  const latex = useLatexExport();
  const search = useSearch({ sourceId: activeSourceId, outputId: activeOutputId });
  const ocr = useOcr();
  useKeyboardShortcuts({ onSearch: search.open, onCommandPalette: () => setPaletteOpen(true) });

  const paletteActions = useMemo<PaletteAction[]>(
    () => [
      { id: 'undo', label: 'Rueckgaengig', run: () => workspaceStore.getState().undo() },
      { id: 'redo', label: 'Wiederherstellen', run: () => workspaceStore.getState().redo() },
      {
        id: 'createFolder',
        label: 'Ordner anlegen',
        run: () => dispatch({ type: 'createFolder', node: { id: newId(), name: 'Neuer Ordner', parentId: null } }),
      },
      {
        id: 'createOutput',
        label: 'Dokument anlegen',
        run: () => dispatch({ type: 'createOutput', node: { id: newId(), name: 'Neues Dokument', parentId: null } }),
      },
      { id: 'export', label: 'Exportieren', run: () => exportUi.open() },
      { id: 'search', label: 'Suchen', run: () => search.open() },
      { id: 'trash', label: 'Papierkorb oeffnen', run: () => setTrashOpen(true) },
      {
        id: 'ocr',
        label: 'Text erkennen (aktuelle Quelle)',
        run: () => {
          const source = activeSourceId ? workspace.sources[activeSourceId] : undefined;
          if (activeSourceId && source) void ocr.runForSource(activeSourceId, source.blockCount);
        },
      },
      {
        id: 'latexExport',
        label: 'Als LaTeX exportieren (aktuelle Quelle)',
        run: () => {
          if (activeSourceId) void latex.runForSource(activeSourceId);
        },
      },
    ],
    [workspaceStore, dispatch, exportUi, search, ocr, latex, activeSourceId, workspace, setTrashOpen],
  );

  useEffect(() => services.autosave.subscribe(setStatus), [services]);

  useEffect(() => {
    if (search.jumpTarget) {
      setActiveSourceId(search.jumpTarget.sourceId);
      search.clearJump();
    }
  }, [search.jumpTarget]);

  const activeSource = activeSourceId ? workspace.sources[activeSourceId] : undefined;
  const activeOutput = activeOutputId ? workspace.nodes[activeOutputId] : undefined;
  const hasSources = workspace.sourceOrder.length > 0;
  const importFiles = (files: FileList | File[]) =>
    void services.importForFiles(files).then((report) => {
      if (report.sources.length > 0) {
        dispatch({ type: 'importSources', sources: report.sources });
        setActiveSourceId(report.sources[0].id);
      }
    });

  const sourcePane = (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="text-sm font-medium text-ink">{activeSource ? activeSource.name : 'Quelle'}</span>
        {activeSource && (
          <span className="tabular text-xs text-muted">{activeSource.blockCount} Seiten</span>
        )}
        <span className="ml-auto text-xs text-muted">Seiten nach unten ins Dokument ziehen</span>
      </header>
      {activeSource ? (
        <>
          {activeSource.outline && activeSource.outline.length > 0 && (
            <OutlinePanel
              outline={activeSource.outline}
              blockCount={activeSource.blockCount}
              onNavigate={(blockIndex) => {
                selectionStore
                  .getState()
                  .select({ kind: 'source', sourceId: activeSource.id }, String(blockIndex), [String(blockIndex)]);
                setSourceSeek({ index: blockIndex, nonce: Date.now() });
              }}
            />
          )}
          <RangeField sourceId={activeSource.id} blockCount={activeSource.blockCount} />
          <div className="min-h-0 flex-1">
            <SourceGrid
              source={activeSource}
              onCellPointerDown={drag.onCellPointerDown}
              scrollTo={sourceSeek ?? undefined}
            />
          </div>
        </>
      ) : (
        <p className="p-4 text-sm text-muted">Waehlen Sie links eine Quelle, um ihre Seiten zu sehen.</p>
      )}
    </section>
  );

  const outputPane = (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-t border-line px-3 py-2">
        <span className="text-sm font-medium text-ink">
          {activeOutput ? activeOutput.name : 'Ausgabedokument'}
        </span>
        {activeOutput && isOutput(activeOutput) && (
          <span className="tabular text-xs text-muted">{activeOutput.items.length} Seiten</span>
        )}
      </header>
      <div className="min-h-0 flex-1">
        {activeOutputId ? (
          <OutputGrid outputId={activeOutputId} onCellPointerDown={drag.onCellPointerDown} />
        ) : (
          <p className="p-4 text-sm text-muted">
            Waehlen Sie links ein Ausgabedokument oder legen Sie eines an.
          </p>
        )}
      </div>
    </section>
  );

  return (
    <div className="flex h-screen flex-col bg-shell text-ink" {...external.dropHandlers}>
      <Header onImportFiles={importFiles} onExport={() => exportUi.open()} saveStatus={status} />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 flex-col border-r border-line bg-panel">
          <div className="flex min-h-0 flex-1 flex-col border-b border-line">
            <h2 className="px-3 pb-1 pt-3 text-xs font-medium text-muted">Quellen</h2>
            <DuplicatesNotice />
            <div className="min-h-0 flex-1 overflow-auto">
              <SourceList activeSourceId={activeSourceId} onSelect={setActiveSourceId} />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <h2 className="px-3 pb-1 pt-3 text-xs font-medium text-muted">Ausgabestruktur</h2>
            <div className="min-h-0 flex-1 overflow-auto">
              <OutputTree
                activeOutputId={activeOutputId}
                onSelectOutput={setActiveOutputId}
                onExportNode={(nodeId) => exportUi.open({ kind: 'node', nodeId })}
                onDeleteNode={(nodeId) => {
                  const snapshot = buildNodeSnapshot(workspace, nodeId);
                  const node = workspace.nodes[nodeId];
                  void trash
                    .add({
                      id: newId(),
                      kind: 'node',
                      name: node?.name ?? 'Element',
                      deletedAt: Date.now(),
                      snapshot,
                    })
                    .then(() => dispatch({ type: 'deleteNode', nodeId }));
                  if (activeOutputId === nodeId) setActiveOutputId(null);
                }}
              />
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {hasSources ? (
            <SplitPane top={sourcePane} bottom={outputPane} />
          ) : (
            <EmptyWorkspace onImportFiles={importFiles} accept={services.registry.acceptAttribute()} />
          )}
        </main>

        {previewOpen ? (
          <aside className="flex w-96 shrink-0 border-l border-line bg-panel">
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex items-center gap-2 border-b border-line px-3 py-2">
                <span className="text-sm font-medium text-ink">Vorschau</span>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Vorschau einklappen"
                  className="ml-auto rounded p-1 text-muted hover:bg-raised hover:text-ink"
                >
                  <PanelRightClose className="size-4" aria-hidden />
                </button>
              </header>
              <div className="min-h-0 flex-1">
                <PreviewPane
                  activeSourceId={activeSourceId}
                  activeOutputId={activeOutputId}
                  onJumpToSource={(ref) => setActiveSourceId(ref.sourceId)}
                />
              </div>
            </div>
            {search.panel && <div className="w-80 shrink-0 border-l border-line">{search.panel}</div>}
          </aside>
        ) : (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            aria-label="Vorschau ausklappen"
            className="flex w-9 shrink-0 flex-col items-center gap-2 border-l border-line bg-panel pt-3 text-muted hover:text-ink"
          >
            <PanelRightOpen className="size-4" aria-hidden />
            <span className="[writing-mode:vertical-rl] text-xs">Vorschau</span>
          </button>
        )}
      </div>

      <ContextBar onRequestSplit={() => activeSourceId && setSplitting(activeSourceId)} />
      {splitting && <SplitPanel sourceId={splitting} parentId={null} onClose={() => setSplitting(null)} />}
      {drag.preview && <DragPreview state={drag.preview} />}
      {external.rejected.length > 0 && (
        <div role="alert" className="border-t border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
          {external.rejected.join(' · ')}
        </div>
      )}
      {exportUi.dialog}
      {paletteOpen && <CommandPalette actions={paletteActions} onClose={() => setPaletteOpen(false)} />}
      {trashOpen && <TrashPanel onClose={() => setTrashOpen(false)} />}
      {ocr.progress && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-shell px-4 py-2 text-center text-sm text-muted">
          Seite {ocr.progress.done} von {ocr.progress.total} erkannt
        </div>
      )}
    </div>
  );
}

interface EmptyWorkspaceProps {
  onImportFiles(files: FileList | File[]): void;
  accept: string;
}

/** Der erste Bildschirm ohne Quellen: eine grosse, offensichtliche Ablageflaeche. */
function EmptyWorkspace({ onImportFiles, accept }: EmptyWorkspaceProps) {
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-md text-center">
        <FolderUp className="mx-auto size-10 text-accent" aria-hidden />
        <h2 className="mt-4 text-xl font-semibold text-ink">Seiten wie Bausteine ordnen</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Ziehen Sie PDFs oder einen ganzen Ordner hierher. Danach ordnen Sie einzelne Seiten per
          Maus in neue Dokumente und Ordner um &ndash; ganz ohne Zwischenexport.
        </p>
        <input
          ref={input}
          type="file"
          accept={`${accept},application/zip,.zip`}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) onImportFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="mt-6 rounded-md bg-accent px-4 py-2 text-sm font-medium text-shell hover:brightness-110"
        >
          Dateien auswaehlen
        </button>
      </div>
    </div>
  );
}
