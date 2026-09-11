import { useCallback, useMemo, useRef } from 'react';
import { GripVertical, RotateCcw, RotateCw, Scissors, Trash2 } from 'lucide-react';
import { newId } from '../../domain/ids';
import { isOutput, type NodeId } from '../../domain/types';
import type { SelectionScope } from '../../services/store/selection';
import type { DragOrigin } from './dragLogic';
import { buildSplitOutputCommand } from './buildSplitOutputCommand';
import { useMarquee } from './useMarquee';
import { MarqueeBox } from './MarqueeBox';
import { Thumbnail } from '../common/Thumbnail';
import { VirtualGrid } from '../common/VirtualGrid';
import { useDispatch, useSelection, useSelectionStore, useWorkspace } from '../app/StoreProvider';

export interface OutputGridProps {
  outputId: NodeId;
  onCellPointerDown?(event: React.PointerEvent, origin: DragOrigin): void;
  /** Luecke (0..Seitenzahl), an der beim Ziehen die Einfuege-Linie steht; null = keine. */
  dropIndex?: number | null;
}

export function OutputGrid({ outputId, onCellPointerDown, dropIndex = null }: OutputGridProps) {
  const workspace = useWorkspace();
  const selection = useSelection();
  const selectionStore = useSelectionStore();
  const dispatch = useDispatch();
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

  const count = itemIds.length;

  return (
    <div
      className="relative h-full"
      data-output-id={outputId}
      data-item-count={count}
      ref={gridRef}
      onPointerDown={marquee.onPointerDown}
    >
      <VirtualGrid
        count={count}
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
          // Einfuege-Linie: vor dieser Zelle, oder hinter der letzten Zelle.
          const lineBefore = dropIndex === position;
          const lineAfter = dropIndex === count && position === count - 1;
          return (
            <div
              role="button"
              tabIndex={0}
              onPointerDown={(e) => handlePointerDown(e, itemId)}
              aria-pressed={selected}
              data-item-id={itemId}
              data-drop-index={position}
              className={`group relative flex w-full cursor-grab flex-col gap-1 rounded ring-2 transition-shadow ${selected ? 'ring-accent' : 'ring-transparent hover:ring-line'}`}
            >
              {lineBefore && <InsertionLine side="left" atEdge={position === 0} />}
              {lineAfter && <InsertionLine side="right" atEdge />}
              <span className="block w-full" style={{ aspectRatio: '1 / 1.35', transform: `rotate(${item.rotation}deg)` }}>
                <Thumbnail blockRef={{ sourceId: item.sourceId, blockIndex: item.blockIndex }} alt={provenance} />
              </span>
              <span className="truncate px-1 text-[11px] text-muted">{provenance}</span>

              {/* Greif-Hinweis: macht beim Hover sichtbar, dass sich die Kachel ziehen
                  laesst. pointer-events-none, damit der PointerDown zur Kachel durchgeht
                  und der Drag ganz normal startet. */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-1 top-1 grid size-6 place-items-center rounded bg-shell/80 text-muted opacity-0 ring-1 ring-line backdrop-blur transition-opacity group-hover:opacity-100"
              >
                <GripVertical className="size-3.5" />
              </span>

              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <CardButton
                  label="Nach links drehen"
                  onClick={() => dispatch({ type: 'rotateItems', itemIds: [itemId], delta: 270 })}
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                </CardButton>
                <CardButton
                  label="Nach rechts drehen"
                  onClick={() => dispatch({ type: 'rotateItems', itemIds: [itemId], delta: 90 })}
                >
                  <RotateCw className="size-3.5" aria-hidden />
                </CardButton>
                <CardButton
                  label="Dokument hier trennen"
                  disabled={position === 0}
                  onClick={() => {
                    const command = buildSplitOutputCommand({
                      output: node,
                      atIndex: position,
                      parentId: node.parentId,
                      newOutputId: newId(),
                    });
                    if (command) dispatch(command);
                  }}
                >
                  <Scissors className="size-3.5" aria-hidden />
                </CardButton>
                <CardButton
                  label="Seite entfernen"
                  danger
                  onClick={() => dispatch({ type: 'removeItems', itemIds: [itemId] })}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </CardButton>
              </div>
            </div>
          );
        }}
      />
      {marquee.marquee && <MarqueeBox rect={marquee.marquee} />}
    </div>
  );
}

/**
 * Die amberfarbene Einfuege-Marke in der Luecke neben einer Kachel. Am aeusseren
 * Rasterrand (`atEdge`) laege die Linie sonst ausserhalb des Scrollcontainers und
 * wuerde abgeschnitten -- z. B. beim Ziehen vor das erste Dokument. Dort setzen
 * wir sie leicht nach innen, damit die Positions-Vorschau auch ganz vorne (und
 * ganz hinten) sichtbar bleibt.
 */
function InsertionLine({ side, atEdge = false }: { side: 'left' | 'right'; atEdge?: boolean }) {
  const position =
    side === 'left' ? (atEdge ? 'left-[2px]' : '-left-[7px]') : atEdge ? 'right-[2px]' : '-right-[7px]';
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute top-0 ${position} z-10 h-[calc(100%-1.25rem)] w-[3px] rounded-full bg-accent`}
    />
  );
}

interface CardButtonProps {
  label: string;
  onClick(): void;
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

/**
 * Ein Kachel-Aktionsknopf. Er stoppt den PointerDown, damit weder ein Drag
 * beginnt noch die Auswahl wechselt, wenn man ihn drueckt.
 */
function CardButton({ label, onClick, children, disabled, danger }: CardButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`grid size-6 place-items-center rounded bg-shell/80 text-muted ring-1 ring-line backdrop-blur transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 ${danger ? 'hover:bg-danger/20 hover:text-danger hover:ring-danger/50' : 'hover:ring-accent/60'}`}
    >
      {children}
    </button>
  );
}
