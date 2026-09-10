import { useMemo, useRef, useState } from 'react';
import type { SelectionScope } from '../../services/store/selection';
import type { SourceDocument } from '../../domain/types';
import type { DragOrigin } from '../workspace/dragLogic';
import { Thumbnail } from '../common/Thumbnail';
import { VirtualGrid } from '../common/VirtualGrid';
import { useSelection, useSelectionStore, useWorkspace } from '../app/StoreProvider';
import { computeSourceUsage } from './sourceUsage';

export interface SourceGridProps {
  source: SourceDocument;
  onCellPointerDown?(event: React.PointerEvent, origin: DragOrigin): void;
}

export function SourceGrid({ source, onCellPointerDown }: SourceGridProps) {
  const workspace = useWorkspace();
  const selection = useSelection();
  const selectionStore = useSelectionStore();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [onlyUnused, setOnlyUnused] = useState(false);

  const usage = useMemo(() => computeSourceUsage(workspace, source.id), [workspace, source.id]);

  const scope: SelectionScope = { kind: 'source', sourceId: source.id };
  const indices = useMemo(() => {
    const all = Array.from({ length: source.blockCount }, (_, i) => i);
    return onlyUnused ? all.filter((i) => !usage.has(i)) : all;
  }, [source.blockCount, onlyUnused, usage]);
  const order = useMemo(() => indices.map(String), [indices]);

  function handleCellPointerDown(event: React.PointerEvent, index: number) {
    const id = String(index);
    if (event.shiftKey) selectionStore.getState().extend(scope, id, order);
    else if (event.metaKey || event.ctrlKey) selectionStore.getState().toggle(scope, id);
    else selectionStore.getState().select(scope, id, order);

    const inScope = selection.scope?.kind === 'source' && selection.scope.sourceId === source.id;
    const ids = inScope ? (selection.ids.includes(id) ? selection.ids : [...selection.ids, id]) : [id];
    onCellPointerDown?.(event, { kind: 'source', sourceId: source.id, blockIndices: ids.map(Number) });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-1 text-xs text-neutral-500">
        <span>{source.name}</span>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={onlyUnused} onChange={(e) => setOnlyUnused(e.target.checked)} />
          Nur noch nicht verwendete Seiten
        </label>
      </div>
      <div className="min-h-0 flex-1">
        <VirtualGrid
          count={indices.length}
          minCellWidth={180}
          cellAspect={1.35}
          gap={12}
          scrollRef={scrollRef}
          renderCell={(position) => {
            const blockIndex = indices[position];
            const id = String(blockIndex);
            const selected = selection.scope?.kind === 'source' &&
              selection.scope.sourceId === source.id && selection.ids.includes(id);
            const count = usage.get(blockIndex) ?? 0;
            return (
              <button
                type="button"
                onPointerDown={(e) => handleCellPointerDown(e, blockIndex)}
                aria-pressed={selected}
                className={`relative block w-full rounded ring-2 ${
                  selected ? 'ring-sky-400' : 'ring-transparent'
                }`}
                style={{ aspectRatio: '1 / 1.35' }}
              >
                <Thumbnail blockRef={{ sourceId: source.id, blockIndex }} alt={`${source.name} Seite ${blockIndex + 1}`} />
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-xs">{blockIndex + 1}</span>
                {count > 0 && (
                  <span className="absolute right-1 top-1 rounded bg-sky-500/80 px-1 text-xs" aria-label={`in ${count} Dokumenten verwendet`}>
                    {count}
                  </span>
                )}
              </button>
            );
          }}
        />
      </div>
    </div>
  );
}
