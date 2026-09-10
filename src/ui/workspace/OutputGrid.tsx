import { useCallback, useMemo, useRef } from 'react';
import { isOutput, type NodeId } from '../../domain/types';
import type { SelectionScope } from '../../services/store/selection';
import type { DragOrigin } from './dragLogic';
import { useMarquee } from './useMarquee';
import { MarqueeBox } from './MarqueeBox';
import { Thumbnail } from '../common/Thumbnail';
import { VirtualGrid } from '../common/VirtualGrid';
import { useSelection, useSelectionStore, useWorkspace } from '../app/StoreProvider';

export interface OutputGridProps {
  outputId: NodeId;
  onCellPointerDown?(event: React.PointerEvent, origin: DragOrigin): void;
}

export function OutputGrid({ outputId, onCellPointerDown }: OutputGridProps) {
  const workspace = useWorkspace();
  const selection = useSelection();
  const selectionStore = useSelectionStore();
  const node = workspace.nodes[outputId];
  const scope: SelectionScope = { kind: 'output', outputId };
  const itemIds = isOutput(node) ? node.items : [];
  const order = useMemo(() => [...itemIds], [itemIds]);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const marqueeSelect = useCallback(
    (ids: string[], additive: boolean) =>
      selectionStore.getState().replace({ kind: 'output', outputId }, ids, ids[0] ?? null, additive),
    [selectionStore, outputId],
  );
  const clearSelection = useCallback(() => selectionStore.getState().clear(), [selectionStore]);
  const marquee = useMarquee({
    containerRef: gridRef,
    cellSelector: '[data-item-id]',
    idOf: (el) => el.dataset.itemId!,
    onSelect: marqueeSelect,
    onClear: clearSelection,
  });

  if (!isOutput(node)) {
    return <p className="px-3 py-4 text-sm text-muted">Kein Dokument gewaehlt.</p>;
  }
  if (itemIds.length === 0) {
    // Wichtig: auch der Leerzustand traegt data-output-id, sonst gibt es genau
    // dort, wo der Text zum Ziehen auffordert, kein Drop-Ziel.
    return (
      <div className="h-full p-3" data-output-id={outputId} data-item-count={0} data-drop-index={0}>
        <div className="grid h-full place-items-center rounded-lg border-2 border-dashed border-line text-center text-sm text-muted">
          <span>
            Dieses Dokument ist noch leer.
            <br />
            Ziehen Sie Seiten aus einer Quelle hierher.
          </span>
        </div>
      </div>
    );
  }

  function handlePointerDown(event: React.PointerEvent, id: string) {
    if (event.shiftKey) selectionStore.getState().extend(scope, id, order);
    else if (event.metaKey || event.ctrlKey) selectionStore.getState().toggle(scope, id);
    else selectionStore.getState().select(scope, id, order);

    const inScope = selection.scope?.kind === 'output' && selection.scope.outputId === outputId;
    const ids = inScope ? (selection.ids.includes(id) ? selection.ids : [...selection.ids, id]) : [id];
    onCellPointerDown?.(event, { kind: 'output', outputId, itemIds: ids });
  }

  return (
    <div
      className="relative h-full"
      data-output-id={outputId}
      data-item-count={itemIds.length}
      ref={gridRef}
      onPointerDown={marquee.onPointerDown}
    >
      <VirtualGrid
        count={itemIds.length}
        minCellWidth={180}
        cellAspect={1.45}
        gap={12}
        renderCell={(position) => {
          const itemId = itemIds[position];
          const item = workspace.items[itemId];
          if (!item) return null;
          const source = workspace.sources[item.sourceId];
          const provenance = `${source?.name ?? 'Quelle'} . Seite ${item.blockIndex + 1}`;
          const selected = selection.scope?.kind === 'output' &&
            selection.scope.outputId === outputId && selection.ids.includes(itemId);
          return (
            <button
              type="button"
              onPointerDown={(e) => handlePointerDown(e, itemId)}
              aria-pressed={selected}
              data-item-id={itemId}
              data-drop-index={position}
              className={`flex w-full flex-col gap-1 rounded ring-2 transition-shadow ${selected ? 'ring-accent' : 'ring-transparent hover:ring-line'}`}
            >
              <span className="block w-full" style={{ aspectRatio: '1 / 1.35', transform: `rotate(${item.rotation}deg)` }}>
                <Thumbnail blockRef={{ sourceId: item.sourceId, blockIndex: item.blockIndex }} alt={provenance} />
              </span>
              <span className="truncate px-1 text-[11px] text-muted">{provenance}</span>
            </button>
          );
        }}
      />
      {marquee.marquee && <MarqueeBox rect={marquee.marquee} />}
    </div>
  );
}
