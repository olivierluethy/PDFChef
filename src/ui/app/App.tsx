import { useEffect, useState } from 'react';
import type { NodeId, SourceId } from '../../domain/types';
import type { SaveStatus } from '../../services/persistence/autosave';
import { SourceGrid } from '../sources/SourceGrid';
import { SourceList } from '../sources/SourceList';
import { DuplicatesNotice } from '../sources/DuplicatesNotice';
import { RangeField } from '../sources/RangeField';
import { OutlinePanel } from '../sources/OutlinePanel';
import { OutputGrid } from '../workspace/OutputGrid';
import { OutputTree } from '../workspace/OutputTree';
import { SplitPanel } from '../workspace/SplitPanel';
import { DragPreview } from '../workspace/DragPreview';
import { usePointerDrag } from '../workspace/usePointerDrag';
import { useExternalDrop } from '../workspace/useExternalDrop';
import { PreviewPane } from '../preview/PreviewPane';
import { useSearch } from '../preview/useSearch';
import { useExport } from '../export/useExport';
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
  const selectionStore = useSelectionStore();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [activeSourceId, setActiveSourceId] = useState<SourceId | null>(null);
  const [activeOutputId, setActiveOutputId] = useState<NodeId | null>(null);
  const [splitting, setSplitting] = useState<SourceId | null>(null);
  const [sourceSeek, setSourceSeek] = useState<{ index: number; nonce: number } | null>(null);

  const drag = usePointerDrag();
  const external = useExternalDrop();
  const exportUi = useExport();
  const search = useSearch({ sourceId: activeSourceId, outputId: activeOutputId });
  useKeyboardShortcuts({ onSearch: search.open });

  useEffect(() => services.autosave.subscribe(setStatus), [services]);

  useEffect(() => {
    if (search.jumpTarget) {
      setActiveSourceId(search.jumpTarget.sourceId);
      search.clearJump();
    }
  }, [search.jumpTarget]);

  const activeSource = activeSourceId ? workspace.sources[activeSourceId] : undefined;

  return (
    <div className="flex h-screen flex-col bg-shell text-neutral-200" {...external.dropHandlers}>
      <Header
        onImportFiles={(files) =>
          void services.importForFiles(files).then((report) => {
            if (report.sources.length > 0) {
              dispatch({ type: 'importSources', sources: report.sources });
              setActiveSourceId(report.sources[0].id);
            }
          })
        }
        onExport={exportUi.open}
        saveStatus={status}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 flex-col border-r border-line">
          <div className="flex-1 overflow-auto border-b border-line">
            <h2 className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500">Quellen</h2>
            <DuplicatesNotice />
            <SourceList activeSourceId={activeSourceId} onSelect={setActiveSourceId} />
          </div>
          <div className="flex-1 overflow-auto">
            <h2 className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500">Ausgabe</h2>
            <OutputTree activeOutputId={activeOutputId} onSelectOutput={setActiveOutputId} />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <section className="flex min-h-0 flex-1 flex-col border-b border-line">
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
              <p className="p-4 text-sm text-neutral-500">Waehlen Sie links eine Quelle.</p>
            )}
          </section>
          <section className="min-h-0 flex-1">
            {activeOutputId ? (
              <OutputGrid outputId={activeOutputId} onCellPointerDown={drag.onCellPointerDown} />
            ) : (
              <p className="p-4 text-sm text-neutral-500">Waehlen Sie ein Ausgabedokument.</p>
            )}
          </section>
        </main>

        <aside className="flex w-96 border-l border-line">
          <div className="min-w-0 flex-1">
            <PreviewPane
              activeSourceId={activeSourceId}
              activeOutputId={activeOutputId}
              onJumpToSource={(ref) => setActiveSourceId(ref.sourceId)}
            />
          </div>
          {search.panel && <div className="w-80 shrink-0">{search.panel}</div>}
        </aside>
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
    </div>
  );
}
