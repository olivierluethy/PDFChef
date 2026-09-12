import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FilePlus2,
  FolderPlus,
  FolderUp,
  PanelRightClose,
  PanelRightOpen,
  Plus,
} from 'lucide-react';
import { newId } from '../../domain/ids';
import { buildNodeSnapshot } from '../../domain/trash';
import { isOutput, type NodeId, type SourceId } from '../../domain/types';
import { SplitPane } from '../common/SplitPane';
import { IconButton } from '../common/IconButton';
import { Menu } from '../common/Menu';
import { Pill } from '../common/Pill';
import { ResizeHandle } from '../common/ResizeHandle';
import type { SaveStatus } from '../../services/persistence/autosave';
import { createTrashService } from '../../services/persistence/trashService';
import { SourcePanel } from '../sources/SourcePanel';
import { SourceList } from '../sources/SourceList';
import { DuplicatesNotice } from '../sources/DuplicatesNotice';
import { Button } from '../common/Button';
import { EmptyState, SheetGhosts } from '../common/EmptyState';
import { OutputGrid } from '../workspace/OutputGrid';
import { OutputTree } from '../workspace/OutputTree';
import { SplitPanel } from '../workspace/SplitPanel';
import { TrashPanel } from '../workspace/TrashPanel';
import { DragPreview } from '../workspace/DragPreview';
import { usePointerDrag } from '../workspace/usePointerDrag';
import { useExternalDrop } from '../workspace/useExternalDrop';
import { PreviewPane, type PreviewTarget } from '../preview/PreviewPane';
import { useOcr } from '../preview/useOcr';
import { useSearch } from '../preview/useSearch';
import { useExport } from '../export/useExport';
import { usePrint } from '../export/usePrint';
import { useShare } from '../export/useShare';
import { useLatexExport } from '../export/useLatexExport';
import { CommandPalette } from './CommandPalette';
import type { PaletteAction } from './commandFilter';
import { ContextBar } from './ContextBar';
import { Header } from './Header';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { bootstrapWorkspace } from './bootstrap';
import { useT } from '../i18n';
import {
  StoreProvider,
  useDispatch,
  useServices,
  useWorkspace,
  useWorkspaceStore,
  type StoreContextValue,
} from './StoreProvider';
import { cx } from '../common/cx';

export interface AppProps {
  bootstrap?: () => Promise<StoreContextValue>;
}

export function App({ bootstrap = bootstrapWorkspace }: AppProps = {}) {
  const t = useT();
  const [store, setStore] = useState<StoreContextValue | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    bootstrap()
      .then((value) => active && setStore(value))
      .catch((cause) => {
        console.error('Failed to load workspace', cause);
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [bootstrap]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-canvas text-text-secondary">
        <p>{t('app.workspaceLoadError')}</p>
      </div>
    );
  }
  if (!store) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface-canvas text-text-tertiary">
        <p>{t('app.loading')}</p>
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
  const t = useT();
  const workspace = useWorkspace();
  const services = useServices();
  const dispatch = useDispatch();
  const workspaceStore = useWorkspaceStore();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [activeSourceId, setActiveSourceId] = useState<SourceId | null>(null);
  const [activeOutputId, setActiveOutputId] = useState<NodeId | null>(null);
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  const [splitting, setSplitting] = useState<SourceId | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [previewWidth, setPreviewWidth] = useState(380);
  const trash = useMemo(() => createTrashService(services.db), [services.db]);

  const drag = usePointerDrag();

  // Waehrend eines internen Seiten-Drags treten gueltige Ablageziele hervor und
  // alles andere tritt zurueck. Ein einziges Body-Attribut steuert die CSS-Regeln.
  useEffect(() => {
    const active = drag.preview != null;
    document.body.toggleAttribute('data-page-drag', active);
    return () => document.body.removeAttribute('data-page-drag');
  }, [drag.preview]);
  const external = useExternalDrop();
  const exportUi = useExport();
  const printUi = usePrint();
  const shareUi = useShare();
  const latex = useLatexExport();
  const search = useSearch({ sourceId: activeSourceId, outputId: activeOutputId });
  const ocr = useOcr();
  useKeyboardShortcuts({ onSearch: search.open, onCommandPalette: () => setPaletteOpen(true) });

  const paletteActions = useMemo<PaletteAction[]>(
    () => [
      { id: 'undo', label: t('app.palette.undo'), run: () => workspaceStore.getState().undo() },
      { id: 'redo', label: t('app.palette.redo'), run: () => workspaceStore.getState().redo() },
      {
        id: 'createFolder',
        label: t('app.palette.createFolder'),
        run: () =>
          dispatch({
            type: 'createFolder',
            node: { id: newId(), name: t('app.defaultFolderName'), parentId: null },
          }),
      },
      {
        id: 'createOutput',
        label: t('app.palette.createOutput'),
        run: () =>
          dispatch({
            type: 'createOutput',
            node: { id: newId(), name: t('app.defaultDocumentName'), parentId: null },
          }),
      },
      { id: 'export', label: t('app.palette.export'), run: () => exportUi.open() },
      { id: 'print', label: t('app.palette.print'), run: () => printUi.open() },
      { id: 'share', label: t('app.palette.share'), run: () => shareUi.open() },
      { id: 'search', label: t('app.palette.search'), run: () => search.open() },
      { id: 'trash', label: t('app.palette.openTrash'), run: () => setTrashOpen(true) },
      {
        id: 'ocr',
        label: t('app.palette.ocr'),
        run: () => {
          const source = activeSourceId ? workspace.sources[activeSourceId] : undefined;
          if (activeSourceId && source) void ocr.runForSource(activeSourceId, source.blockCount);
        },
      },
      {
        id: 'latexExport',
        label: t('app.palette.latex'),
        run: () => {
          if (activeSourceId) void latex.runForSource(activeSourceId);
        },
      },
    ],
    [
      t,
      workspaceStore,
      dispatch,
      exportUi,
      printUi,
      shareUi,
      search,
      ocr,
      latex,
      activeSourceId,
      workspace,
      setTrashOpen,
    ],
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

  // Einfachauswahl setzt zugleich die Vorschau; Auge/Doppelklick oeffnet zusaetzlich das Panel.
  const focusSource = (id: SourceId) => {
    setActiveSourceId(id);
    setPreviewTarget({ kind: 'source', id });
  };
  const focusOutput = (id: NodeId) => {
    setActiveOutputId(id);
    setPreviewTarget({ kind: 'output', id });
  };
  const openInPreview = (nextTarget: PreviewTarget) => {
    setPreviewTarget(nextTarget);
    setPreviewOpen(true);
  };
  const hasSources = workspace.sourceOrder.length > 0;
  const importFiles = (files: FileList | File[]) =>
    void services.importForFiles(files).then((report) => {
      if (report.sources.length > 0) {
        dispatch({ type: 'importSources', sources: report.sources });
        focusSource(report.sources[0].id);
      }
    });

  const createOutputAndSelect = () => {
    const id = newId();
    dispatch({ type: 'createOutput', node: { id, name: t('app.defaultDocumentName'), parentId: null } });
    setActiveOutputId(id);
  };

  const sourcePane = activeSource ? (
    <SourcePanel
      source={activeSource}
      onCellPointerDown={drag.onCellPointerDown}
      onLatex={(id) => void latex.runForSource(id)}
      latexBusy={latex.busy}
      onOcr={(src) => void ocr.runForSource(src.id, src.blockCount)}
    />
  ) : (
    <div className="grid h-full place-items-center p-8">
      <p className="t-meta">{t('app.selectSourceHint')}</p>
    </div>
  );

  const outputPane = (
    <section className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 px-5">
        <h2 className="t-panel-title min-w-0 truncate text-text-primary" title={activeOutput?.name}>
          {activeOutput ? activeOutput.name : t('app.outputFallback')}
        </h2>
        {activeOutput && isOutput(activeOutput) && (
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-text-secondary">
            {activeOutput.items.length}{' '}
            {activeOutput.items.length === 1 ? t('app.pageSingular') : t('app.pagePlural')}
          </span>
        )}
      </header>
      <div className="min-h-0 flex-1 px-5 pb-2">
        {activeOutputId ? (
          <OutputGrid
            outputId={activeOutputId}
            onCellPointerDown={drag.onCellPointerDown}
            dropIndex={
              drag.dropIndicator?.outputId === activeOutputId ? drag.dropIndicator.index : null
            }
          />
        ) : (
          <EmptyState
            title={t('app.noDocumentTitle')}
            description={t('app.noDocumentDesc')}
            illustration={<SheetGhosts />}
          >
            <Button variant="secondary" icon={FilePlus2} onClick={createOutputAndSelect}>
              {t('app.createDocument')}
            </Button>
          </EmptyState>
        )}
      </div>
    </section>
  );

  return (
    <div
      className="flex h-screen flex-col bg-surface-canvas text-text-primary"
      {...external.dropHandlers}
    >
      <Header
        onImportFiles={importFiles}
        onExport={() => exportUi.open()}
        onPrint={() => printUi.open()}
        onShare={() => shareUi.open()}
        saveStatus={status}
      />

      <div className="flex min-h-0 flex-1">
        <aside
          style={{ width: sidebarWidth }}
          className="flex shrink-0 flex-col border-r border-line-structural bg-surface-panel"
        >
          <SplitPane
            label={t('app.resizeSourcesOutput')}
            initial={0.5}
            top={
              /* Quellen -- keine Ablageziele, also treten sie beim Drag zurueck. */
              <section data-dim-on-drag className="flex h-full min-h-0 flex-col">
                <div className="flex items-center gap-2 px-5 pb-2 pt-4">
                  <h2 className="t-panel-title text-text-primary">{t('app.sources')}</h2>
                  <Pill>{workspace.sourceOrder.length}</Pill>
                </div>
                <DuplicatesNotice />
                <div className="scroll-fade-y min-h-0 flex-1 overflow-auto pb-4">
                  <SourceList
                    activeSourceId={activeSourceId}
                    onSelect={focusSource}
                    onOpenPreview={(id) => openInPreview({ kind: 'source', id })}
                    onRemove={(id) => {
                      if (activeSourceId === id) setActiveSourceId(null);
                      setPreviewTarget((t) => (t?.kind === 'source' && t.id === id ? null : t));
                    }}
                  />
                </div>
              </section>
            }
            bottom={
              /* Ausgabestruktur -- Ordner und Dokumente sind Ablageziele. */
              <section className="flex h-full min-h-0 flex-col">
                <div className="flex items-center gap-2 px-5 pb-2 pt-4">
                  <h2 className="t-panel-title text-text-primary">{t('app.outputStructure')}</h2>
                  <Pill>{Object.keys(workspace.nodes).length}</Pill>
                  <div className="ml-auto">
                    <Menu
                      align="end"
                      minWidth={176}
                      items={[
                        {
                          id: 'folder',
                          label: t('app.folder'),
                          icon: FolderPlus,
                          onSelect: () =>
                            dispatch({
                              type: 'createFolder',
                              node: { id: newId(), name: t('app.defaultFolderName'), parentId: null },
                            }),
                        },
                        {
                          id: 'output',
                          label: t('app.document'),
                          icon: FilePlus2,
                          onSelect: () =>
                            dispatch({
                              type: 'createOutput',
                              node: { id: newId(), name: t('app.defaultDocumentName'), parentId: null },
                            }),
                        },
                      ]}
                      renderTrigger={({ ref, toggle, ariaProps }) => (
                        <button
                          ref={ref}
                          type="button"
                          onClick={toggle}
                          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                          {...ariaProps}
                        >
                          <Plus className="size-4" aria-hidden /> {t('app.new')}
                        </button>
                      )}
                    />
                  </div>
                </div>
                <div className="scroll-fade-y min-h-0 flex-1 overflow-auto pb-4" data-tree-root>
                  <OutputTree
                    activeOutputId={activeOutputId}
                    onSelectOutput={focusOutput}
                    onOpenPreview={(id) => openInPreview({ kind: 'output', id })}
                    onCellPointerDown={drag.onCellPointerDown}
                    onExportNode={(nodeId) => exportUi.open({ kind: 'node', nodeId })}
                    onPrintNode={(nodeId) => printUi.open({ kind: 'node', nodeId })}
                    onShareNode={(nodeId) => shareUi.open({ kind: 'node', nodeId })}
                    onDeleteNode={(nodeId) => {
                      const snapshot = buildNodeSnapshot(workspace, nodeId);
                      const node = workspace.nodes[nodeId];
                      void trash
                        .add({
                          id: newId(),
                          kind: 'node',
                          name: node?.name ?? t('app.elementFallback'),
                          deletedAt: Date.now(),
                          snapshot,
                        })
                        .then(() => dispatch({ type: 'deleteNode', nodeId }));
                      if (activeOutputId === nodeId) setActiveOutputId(null);
                      setPreviewTarget((t) => (t?.kind === 'output' && t.id === nodeId ? null : t));
                    }}
                  />
                </div>
              </section>
            }
          />
        </aside>

        <ResizeHandle
          orientation="col"
          value={sidebarWidth}
          min={240}
          max={400}
          onChange={setSidebarWidth}
          ariaLabel={t('app.resizeSidebar')}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {hasSources ? (
            <SplitPane top={sourcePane} bottom={outputPane} />
          ) : (
            <EmptyWorkspace
              onImportFiles={importFiles}
              accept={services.registry.acceptAttribute()}
              active={external.isOver}
            />
          )}
        </main>

        {previewOpen ? (
          <>
            <ResizeHandle
              orientation="col"
              value={previewWidth}
              min={320}
              max={640}
              onChange={setPreviewWidth}
              ariaLabel={t('app.resizePreview')}
              invert
            />
            <aside
              data-dim-on-drag
              style={{ width: previewWidth }}
              className="flex shrink-0 border-l border-line-structural bg-surface-panel"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <header className="flex h-11 items-center gap-2 border-b border-line-structural px-4">
                  <span className="t-panel-title text-text-primary">{t('app.preview')}</span>
                  <IconButton
                    icon={PanelRightClose}
                    label={t('app.collapsePreview')}
                    onClick={() => setPreviewOpen(false)}
                    className="ml-auto"
                  />
                </header>
                <div className="min-h-0 flex-1">
                  <PreviewPane
                    target={previewTarget}
                    onJumpToSource={(ref) => focusSource(ref.sourceId)}
                    onPagePointerDown={drag.onCellPointerDown}
                  />
                </div>
              </div>
              {search.panel && (
                <div className="w-80 shrink-0 border-l border-line-structural">{search.panel}</div>
              )}
            </aside>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            aria-label={t('app.expandPreview')}
            className="flex w-10 shrink-0 flex-col items-center gap-2 border-l border-line-structural bg-surface-panel pt-3 text-text-secondary hover:text-text-primary"
          >
            <PanelRightOpen className="size-4" aria-hidden />
            <span className="text-[12px] [writing-mode:vertical-rl]">{t('app.preview')}</span>
          </button>
        )}
      </div>

      <ContextBar onRequestSplit={() => activeSourceId && setSplitting(activeSourceId)} />
      {splitting && (
        <SplitPanel sourceId={splitting} parentId={null} onClose={() => setSplitting(null)} />
      )}
      {drag.preview && <DragPreview state={drag.preview} />}
      {external.rejected.length > 0 && (
        <div
          role="alert"
          className="fixed left-1/2 top-4 z-50 max-w-[90vw] -translate-x-1/2 rounded-[10px] bg-surface-raised px-4 py-2.5 text-[12.5px] text-danger shadow-[var(--float-shadow)] ring-1 ring-danger/30"
        >
          {external.rejected.join(' · ')}
        </div>
      )}
      {exportUi.dialog}
      {printUi.dialog}
      {shareUi.dialog}
      {paletteOpen && (
        <CommandPalette actions={paletteActions} onClose={() => setPaletteOpen(false)} />
      )}
      {trashOpen && <TrashPanel onClose={() => setTrashOpen(false)} />}
      {ocr.progress && (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-surface-raised px-3.5 py-1.5 text-[12.5px] text-text-secondary shadow-[var(--float-shadow)] ring-1 ring-line-structural"
        >
          {t('app.ocrPage')}{' '}
          <span className="font-mono tabular-nums text-text-primary">{ocr.progress.done}</span>{' '}
          {t('app.ocrOf')} <span className="font-mono tabular-nums">{ocr.progress.total}</span>{' '}
          {t('app.ocrRecognized')}
        </div>
      )}
    </div>
  );
}

interface EmptyWorkspaceProps {
  onImportFiles(files: FileList | File[]): void;
  accept: string;
  /** true, wenn gerade Dateien aus dem Betriebssystem ueber dem Fenster schweben. */
  active: boolean;
}

/** Der erste Bildschirm ohne Quellen: die ganze Mitte ist Ablageflaeche. */
function EmptyWorkspace({ onImportFiles, accept, active }: EmptyWorkspaceProps) {
  const t = useT();
  const input = useRef<HTMLInputElement | null>(null);
  return (
    <div
      className={cx(
        'h-full rounded-xl transition-colors',
        active && 'outline-2 outline-dashed -outline-offset-8 outline-accent',
      )}
    >
      <EmptyState
        title={t('app.importTitle')}
        description={t('app.importDesc')}
        footnote={t('app.importFootnote')}
      >
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
        <Button variant="primary" size="lg" icon={FolderUp} onClick={() => input.current?.click()}>
          {t('app.chooseFiles')}
        </Button>
      </EmptyState>
    </div>
  );
}
