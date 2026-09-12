import { useCallback, useMemo, useRef } from 'react';
import type { SelectionScope } from '../../services/store/selection';
import type { SourceDocument } from '../../domain/types';
import type { DragOrigin } from '../workspace/dragLogic';
import { useMarquee } from '../workspace/useMarquee';
import { MarqueeBox } from '../workspace/MarqueeBox';
import { Thumbnail } from '../common/Thumbnail';
import { VirtualGrid } from '../common/VirtualGrid';
import { cx } from '../common/cx';
import { useSelection, useSelectionStore } from '../app/StoreProvider';
import { useT } from '../i18n';

export interface SourceGridProps {
  source: SourceDocument;
  /** Nutzung je Seitenindex (Anzahl Outputs), fuer Badge und Filter. */
  usage: Map<number, number>;
  onlyUnused: boolean;
  onCellPointerDown?(event: React.PointerEvent, origin: DragOrigin): void;
  scrollTo?: { index: number; nonce: number };
}

export function SourceGrid({ source, usage, onlyUnused, onCellPointerDown, scrollTo }: SourceGridProps) {
  const t = useT();
  const selection = useSelection();
  const selectionStore = useSelectionStore();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scope: SelectionScope = { kind: 'source', sourceId: source.id };
  const indices = useMemo(() => {
    const all = Array.from({ length: source.blockCount }, (_, i) => i);
    return onlyUnused ? all.filter((i) => !usage.has(i)) : all;
  }, [source.blockCount, onlyUnused, usage]);
  const order = useMemo(() => indices.map(String), [indices]);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const marqueeSelect = useCallback(
    (ids: string[], additive: boolean) =>
      selectionStore.getState().replace({ kind: 'source', sourceId: source.id }, ids, ids[0] ?? null, additive),
    [selectionStore, source.id],
  );
  const clearSelection = useCallback(() => selectionStore.getState().clear(), [selectionStore]);
  const marquee = useMarquee({
    containerRef: gridRef,
    cellSelector: '[data-block-index]',
    idOf: (el) => el.dataset.blockIndex!,
    onSelect: marqueeSelect,
    onClear: clearSelection,
  });

  function handleCellPointerDown(event: React.PointerEvent, index: number) {
    const id = String(index);
    if (event.shiftKey) selectionStore.getState().extend(scope, id, order);
    else if (event.metaKey || event.ctrlKey) selectionStore.getState().toggle(scope, id);
    else selectionStore.getState().select(scope, id, order);

    const inScope = selection.scope?.kind === 'source' && selection.scope.sourceId === source.id;
    const ids = inScope ? (selection.ids.includes(id) ? selection.ids : [...selection.ids, id]) : [id];
    onCellPointerDown?.(event, { kind: 'source', sourceId: source.id, blockIndices: ids.map(Number) });
  }

  if (indices.length === 0) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <p className="t-meta">{t('sources.grid.allAssigned')}</p>
      </div>
    );
  }

  return (
    <div className="relative h-full" ref={gridRef} onPointerDown={marquee.onPointerDown}>
      <VirtualGrid
        count={indices.length}
        minCellWidth={180}
        cellAspect={1.5}
        gap={20}
        scrollRef={scrollRef}
        scrollTo={scrollTo}
        renderCell={(position) => {
          const blockIndex = indices[position];
          const id = String(blockIndex);
          const selected =
            selection.scope?.kind === 'source' &&
            selection.scope.sourceId === source.id &&
            selection.ids.includes(id);
          const count = usage.get(blockIndex) ?? 0;
          return (
            <button
              type="button"
              data-block-index={blockIndex}
              onPointerDown={(e) => handleCellPointerDown(e, blockIndex)}
              aria-pressed={selected}
              className="group flex w-full cursor-grab flex-col items-center gap-2 rounded p-1"
            >
              <span
                className={cx(
                  'paper-sheet relative block w-full',
                  selected && 'outline outline-2 outline-offset-2 outline-accent',
                )}
                style={{ aspectRatio: '1 / 1.35' }}
              >
                <Thumbnail
                  blockRef={{ sourceId: source.id, blockIndex }}
                  alt={t('sources.grid.pageAlt', { name: source.name, n: blockIndex + 1 })}
                />
                {selected && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[2px] bg-accent-soft" />}
                {count > 0 && (
                  <span
                    className="absolute right-1 top-1 rounded-full bg-info-soft px-1.5 py-px font-mono text-[11px] font-medium tabular-nums text-info"
                    title={count === 1 ? t('sources.grid.usedInSingular', { n: count }) : t('sources.grid.usedInPlural', { n: count })}
                  >
                    {count}
                  </span>
                )}
              </span>
              <span className="font-mono text-[11.5px] tabular-nums text-text-secondary">{blockIndex + 1}</span>
            </button>
          );
        }}
      />
      {marquee.marquee && <MarqueeBox rect={marquee.marquee} />}
    </div>
  );
}
