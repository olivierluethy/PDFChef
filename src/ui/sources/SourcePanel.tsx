import { useMemo, useState } from 'react';
import { FileCode, ListOrdered, MoreHorizontal, PenLine, ScanText } from 'lucide-react';
import type { SourceDocument, SourceId } from '../../domain/types';
import type { DragOrigin } from '../workspace/dragLogic';
import { Button } from '../common/Button';
import { Menu } from '../common/Menu';
import { SegmentedControl } from '../common/SegmentedControl';
import { useSelection, useSelectionStore, useWorkspace } from '../app/StoreProvider';
import { OutlinePanel } from './OutlinePanel';
import { RangeField } from './RangeField';
import { SourceGrid } from './SourceGrid';
import { computeSourceUsage } from './sourceUsage';
import { useT } from '../i18n';

export interface SourcePanelProps {
  source: SourceDocument;
  onCellPointerDown?(event: React.PointerEvent, origin: DragOrigin): void;
  /** Legt aus dieser Quelle ein Dokument mit allen Seiten an und oeffnet den Ausfuell-Modus. */
  onFill(source: SourceDocument): void;
  /** Legt aus dieser Quelle ein Dokument mit allen Seiten an, zum Sortieren im Seitenraster. */
  onEditPages(source: SourceDocument): void;
  onLatex(sourceId: SourceId): void;
  latexBusy: boolean;
  onOcr(source: SourceDocument): void;
}

export function SourcePanel({
  source,
  onCellPointerDown,
  onFill,
  onEditPages,
  onLatex,
  latexBusy,
  onOcr,
}: SourcePanelProps) {
  const t = useT();
  const workspace = useWorkspace();
  const selection = useSelection();
  const selectionStore = useSelectionStore();
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [seek, setSeek] = useState<{ index: number; nonce: number } | null>(null);

  const usage = useMemo(() => computeSourceUsage(workspace, source.id), [workspace, source.id]);
  const usedCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < source.blockCount; i++) if (usage.has(i)) n++;
    return n;
  }, [usage, source.blockCount]);

  const selectionCount =
    selection.scope?.kind === 'source' && selection.scope.sourceId === source.id ? selection.ids.length : 0;

  return (
    <section data-dim-on-drag className="flex h-full min-h-0 flex-col">
      {/* Kopf: Name einmal, plus Seitenzahl und Panel-Aktionen. */}
      <header className="flex h-12 shrink-0 items-center gap-3 px-5">
        <h2 className="t-panel-title min-w-0 truncate text-text-primary" title={source.name}>
          {source.name}
        </h2>
        <span className="shrink-0 font-mono text-[12px] tabular-nums text-text-secondary">
          {source.blockCount} {source.blockCount === 1 ? t('sources.page') : t('sources.pages')}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Button variant="primary" size="sm" icon={PenLine} onClick={() => onFill(source)}>
            {t('sources.panel.fill')}
          </Button>
          <Button variant="secondary" size="sm" icon={FileCode} disabled={latexBusy} onClick={() => onLatex(source.id)}>
            {latexBusy ? 'LaTeX …' : 'LaTeX'}
          </Button>
          <Menu
            align="end"
            minWidth={196}
            items={[
              {
                id: 'editPages',
                label: t('sources.panel.editPages'),
                icon: ListOrdered,
                onSelect: () => onEditPages(source),
              },
              { id: 'ocr', label: t('sources.panel.ocr'), icon: ScanText, onSelect: () => onOcr(source) },
            ]}
            renderTrigger={({ ref, toggle, ariaProps }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                aria-label={t('sources.panel.moreActions')}
                className="inline-grid size-8 place-items-center rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                {...ariaProps}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </button>
            )}
          />
        </div>
      </header>

      {source.outline && source.outline.length > 0 && (
        <div className="px-5">
          <OutlinePanel
            outline={source.outline}
            blockCount={source.blockCount}
            onNavigate={(blockIndex) => {
              selectionStore
                .getState()
                .select({ kind: 'source', sourceId: source.id }, String(blockIndex), [String(blockIndex)]);
              setSeek({ index: blockIndex, nonce: Date.now() });
            }}
          />
        </div>
      )}

      {/* Selektionsleiste: eigene Flaeche, klar vom Kopf abgesetzt. */}
      <div className="mx-5 mb-4 mt-2 shrink-0 rounded-[10px] bg-surface-raised p-3">
        <RangeField sourceId={source.id} blockCount={source.blockCount} />
        <div className="mt-3 flex items-center gap-3">
          <SegmentedControl
            ariaLabel={t('sources.panel.visiblePages')}
            value={onlyUnused ? 'unused' : 'all'}
            onChange={(v) => setOnlyUnused(v === 'unused')}
            options={[
              { value: 'all', label: t('sources.panel.allPages') },
              { value: 'unused', label: t('sources.panel.onlyUnused'), count: usedCount || undefined },
            ]}
          />
          <button
            type="button"
            disabled={selectionCount === 0}
            onClick={() => selectionStore.getState().clear()}
            className="ml-auto text-[12.5px] font-medium text-text-secondary hover:text-text-primary disabled:opacity-40"
          >
            {t('sources.panel.clearSelection')}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-5 pb-2">
        <SourceGrid
          source={source}
          usage={usage}
          onlyUnused={onlyUnused}
          onCellPointerDown={onCellPointerDown}
          scrollTo={seek ?? undefined}
        />
      </div>
    </section>
  );
}
