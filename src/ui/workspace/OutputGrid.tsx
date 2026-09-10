import { useMemo } from 'react';
import { isOutput, type NodeId } from '../../domain/types';
import type { SelectionScope } from '../../services/store/selection';
import { Thumbnail } from '../common/Thumbnail';
import { VirtualGrid } from '../common/VirtualGrid';
import { useSelection, useSelectionStore, useWorkspace } from '../app/StoreProvider';

export interface OutputGridProps {
  outputId: NodeId;
}

export function OutputGrid({ outputId }: OutputGridProps) {
  const workspace = useWorkspace();
  const selection = useSelection();
  const selectionStore = useSelectionStore();
  const node = workspace.nodes[outputId];
  const scope: SelectionScope = { kind: 'output', outputId };
  const itemIds = isOutput(node) ? node.items : [];
  const order = useMemo(() => [...itemIds], [itemIds]);

  if (!isOutput(node)) {
    return <p className="px-3 py-4 text-sm text-neutral-500">Kein Dokument gewaehlt.</p>;
  }
  if (itemIds.length === 0) {
    return <p className="px-3 py-4 text-sm text-neutral-500">Dieses Dokument ist noch leer. Ziehen Sie Seiten hierher.</p>;
  }

  function onPointerDown(event: React.PointerEvent, id: string) {
    if (event.shiftKey) selectionStore.getState().extend(scope, id, order);
    else if (event.metaKey || event.ctrlKey) selectionStore.getState().toggle(scope, id);
    else selectionStore.getState().select(scope, id, order);
  }

  return (
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
            onPointerDown={(e) => onPointerDown(e, itemId)}
            aria-pressed={selected}
            data-item-id={itemId}
            className={`flex w-full flex-col gap-1 rounded ring-2 ${selected ? 'ring-sky-400' : 'ring-transparent'}`}
          >
            <span className="block w-full" style={{ aspectRatio: '1 / 1.35', transform: `rotate(${item.rotation}deg)` }}>
              <Thumbnail blockRef={{ sourceId: item.sourceId, blockIndex: item.blockIndex }} alt={provenance} />
            </span>
            <span className="truncate px-1 text-[11px] text-neutral-500">{provenance}</span>
          </button>
        );
      }}
    />
  );
}
