import { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  RotateCcw,
  RotateCw,
  Scissors,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { newId } from '../../domain/ids';
import { isOutput, type NodeId, type Overlay, type SourceId } from '../../domain/types';
import type { SelectionScope } from '../../services/store/selection';
import type { DragOrigin } from './dragLogic';
import { buildSplitOutputCommand } from './buildSplitOutputCommand';
import { useMarquee } from './useMarquee';
import { MarqueeBox } from './MarqueeBox';
import { Thumbnail } from '../common/Thumbnail';
import { OverlayThumb } from '../preview/OverlayThumb';
import { VirtualGrid } from '../common/VirtualGrid';
import { Tooltip } from '../common/Tooltip';
import { cx } from '../common/cx';
import { spring, useMotionPrefs } from '../common/motion';
import { useDispatch, useSelection, useSelectionStore, useWorkspace } from '../app/StoreProvider';
import { useT } from '../i18n';

export interface OutputGridProps {
  outputId: NodeId;
  onCellPointerDown?(event: React.PointerEvent, origin: DragOrigin): void;
  dropIndex?: number | null;
}

/** Oberhalb dieser Anzahl bleibt das Raster virtualisiert und ohne Layout-Animation. */
const LAYOUT_LIMIT = 150;

/** Seitenverhaeltnis (Breite/Hoehe) vor dem Laden des Thumbnails -- ~A4 hochkant. */
const DEFAULT_ASPECT = 1 / 1.35;

export function OutputGrid({ outputId, onCellPointerDown, dropIndex = null }: OutputGridProps) {
  const workspace = useWorkspace();
  const selection = useSelection();
  const selectionStore = useSelectionStore();
  const dispatch = useDispatch();
  const prefs = useMotionPrefs();
  const t = useT();
  const node = workspace.nodes[outputId];
  const scope: SelectionScope = { kind: 'output', outputId };
  const itemIds = isOutput(node) ? node.items : [];
  const order = useMemo(() => [...itemIds], [itemIds]);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const marqueeSelect = useCallback(
    (ids: string[], additive: boolean) =>
      selectionStore
        .getState()
        .replace({ kind: 'output', outputId }, ids, ids[0] ?? null, additive),
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

  const handlePointerDown = useCallback(
    (event: React.PointerEvent, id: string) => {
      if (event.shiftKey) selectionStore.getState().extend(scope, id, order);
      else if (event.metaKey || event.ctrlKey) selectionStore.getState().toggle(scope, id);
      else selectionStore.getState().select(scope, id, order);

      const inScope = selection.scope?.kind === 'output' && selection.scope.outputId === outputId;
      const ids = inScope
        ? selection.ids.includes(id)
          ? selection.ids
          : [...selection.ids, id]
        : [id];
      onCellPointerDown?.(event, { kind: 'output', outputId, itemIds: ids });
    },
    [selectionStore, scope, order, selection, outputId, onCellPointerDown],
  );

  if (!isOutput(node)) {
    return <p className="t-meta p-4">{t('workspace.grid.noDocumentSelected')}</p>;
  }

  const count = itemIds.length;

  if (count === 0) {
    // Der Leerzustand traegt die Drop-Attribute, damit genau hier abgelegt werden kann.
    return (
      <div
        className="h-full py-2"
        data-output-id={outputId}
        data-item-count={0}
        data-drop-index={0}
        data-drop-zone
      >
        <div className="grid h-full min-h-[140px] place-items-center rounded-[10px] border-2 border-dashed border-line-structural text-center">
          <p className="t-meta">{t('workspace.grid.dropPagesHere')}</p>
        </div>
      </div>
    );
  }

  const renderCard = (itemId: string, position: number) => {
    const item = workspace.items[itemId];
    if (!item) return null;
    const source = workspace.sources[item.sourceId];
    const selected =
      selection.scope?.kind === 'output' &&
      selection.scope.outputId === outputId &&
      selection.ids.includes(itemId);
    return (
      <OutputCard
        key={itemId}
        itemId={itemId}
        sourceName={source?.name ?? t('workspace.grid.sourceFallback')}
        pageNumber={item.blockIndex + 1}
        sourceId={item.sourceId}
        blockIndex={item.blockIndex}
        rotation={item.rotation}
        overlays={item.overlays ?? []}
        selected={selected}
        position={position}
        total={count}
        dropIndex={dropIndex}
        onPointerDown={(e) => handlePointerDown(e, itemId)}
        onRotate={(delta) => dispatch({ type: 'rotateItems', itemIds: [itemId], delta })}
        onMoveLeft={() =>
          dispatch({ type: 'reorderItems', outputId, itemIds: [itemId], index: position - 1 })
        }
        onMoveRight={() =>
          dispatch({ type: 'reorderItems', outputId, itemIds: [itemId], index: position + 2 })
        }
        onRemove={() => dispatch({ type: 'removeItems', itemIds: [itemId] })}
        onSplit={() => {
          const command = buildSplitOutputCommand({
            output: node,
            atIndex: position,
            parentId: node.parentId,
            newOutputId: newId(),
            t,
          });
          if (command) dispatch(command);
        }}
      />
    );
  };

  // Kleine Dokumente: echtes Raster mit Layout-Animation. Grosse: virtualisiert.
  const enableLayout = count < LAYOUT_LIMIT && !prefs.reduced;
  const virtualize = count >= LAYOUT_LIMIT;

  return (
    <div
      className="relative h-full"
      data-output-id={outputId}
      data-item-count={count}
      data-drop-zone
      ref={gridRef}
      onPointerDown={marquee.onPointerDown}
    >
      {virtualize ? (
        <VirtualGrid
          count={count}
          minCellWidth={180}
          cellAspect={1.7}
          gap={20}
          renderCell={(position) => renderCard(itemIds[position], position)}
        />
      ) : (
        <div className="scroll-fade-y h-full overflow-auto pb-8">
          <LayoutGroup>
            <div
              className="grid gap-5"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
            >
              {itemIds.map((itemId, position) =>
                enableLayout ? (
                  <motion.div
                    key={itemId}
                    layout
                    transition={prefs.t(spring.layout)}
                    className="min-w-0"
                  >
                    {renderCard(itemId, position)}
                  </motion.div>
                ) : (
                  renderCard(itemId, position)
                ),
              )}
            </div>
          </LayoutGroup>
        </div>
      )}
      {marquee.marquee && <MarqueeBox rect={marquee.marquee} />}
    </div>
  );
}

interface OutputCardProps {
  itemId: string;
  sourceName: string;
  pageNumber: number;
  sourceId: SourceId;
  blockIndex: number;
  rotation: number;
  overlays: Overlay[];
  selected: boolean;
  position: number;
  total: number;
  dropIndex: number | null;
  onPointerDown(event: React.PointerEvent): void;
  onRotate(delta: 90 | 180 | 270): void;
  onMoveLeft(): void;
  onMoveRight(): void;
  onRemove(): void;
  onSplit(): void;
}

function OutputCard({
  itemId,
  sourceName,
  pageNumber,
  sourceId,
  blockIndex,
  rotation,
  overlays,
  selected,
  position,
  total,
  dropIndex,
  onPointerDown,
  onRotate,
  onMoveLeft,
  onMoveRight,
  onRemove,
  onSplit,
}: OutputCardProps) {
  const t = useT();
  const lineBefore = dropIndex === position;
  const lineAfter = dropIndex === total && position === total - 1;
  const provenance = t('workspace.grid.provenance', { source: sourceName, n: pageNumber });

  // Das Blatt uebernimmt das echte Seitenverhaeltnis der Seite, sobald es geladen ist --
  // so umschliesst der Auswahl-Rahmen exakt die Seitenkante statt eines festen Kastens.
  const [aspect, setAspect] = useState<number | null>(null);
  const naturalAspect = aspect ?? DEFAULT_ASPECT;
  const rotated = (((rotation % 360) + 360) % 360) % 180 !== 0;
  const sheetAspect = rotated ? 1 / naturalAspect : naturalAspect;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      data-item-id={itemId}
      data-drop-index={position}
      onPointerDown={onPointerDown}
      className="group relative flex w-full cursor-grab flex-col px-1 pb-1 pt-7"
    >
      {lineBefore && <InsertionLine side="left" atEdge={position === 0} />}
      {lineAfter && <InsertionLine side="right" atEdge />}

      {/* Werkzeugstreifen: sitzt oberhalb der Karte, nie ueber dem Blatt. */}
      <div className="pointer-events-none absolute inset-x-1 top-0 z-20 flex h-7 items-center">
        <span
          aria-hidden
          className="grid size-7 place-items-center text-text-secondary opacity-40 transition-opacity group-hover:opacity-0"
        >
          <GripVertical className="size-4" />
        </span>
        <div className="pointer-events-auto absolute inset-0 flex items-center gap-0.5 rounded-md bg-surface-raised px-1 opacity-0 shadow-[var(--float-shadow)] ring-1 ring-line-structural transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <span
            aria-hidden
            className="grid size-6 cursor-grab place-items-center text-text-secondary"
          >
            <GripVertical className="size-4" />
          </span>
          <CardTool
            icon={RotateCcw}
            label={t('workspace.grid.rotateLeft')}
            onClick={() => onRotate(270)}
          />
          <CardTool
            icon={RotateCw}
            label={t('workspace.grid.rotateRight')}
            onClick={() => onRotate(90)}
          />
          <CardTool
            icon={Scissors}
            label={t('workspace.grid.splitHere')}
            disabled={position === 0}
            disabledReason={t('workspace.grid.splitDisabledReason')}
            onClick={onSplit}
          />
          <CardTool
            icon={Trash2}
            label={t('workspace.grid.removePage')}
            danger
            onClick={onRemove}
          />
        </div>
      </div>

      <span
        className={cx(
          'paper-sheet relative block w-full',
          selected && 'outline outline-2 outline-offset-2 outline-accent',
        )}
        style={{ aspectRatio: String(sheetAspect) }}
      >
        <span
          className="absolute left-1/2 top-1/2 grid place-items-center"
          style={{
            width: rotated ? `${(1 / sheetAspect) * 100}%` : '100%',
            height: rotated ? `${sheetAspect * 100}%` : '100%',
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          }}
        >
          <Thumbnail
            blockRef={{ sourceId, blockIndex }}
            alt={provenance}
            onNaturalAspect={setAspect}
          />
          <OverlayThumb overlays={overlays} />
        </span>

        {selected && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[2px] bg-accent-soft"
          />
        )}

        {/* Verschiebe-Pfeile: erscheinen beim Ueberfahren, aber nur dort, wo eine Bewegung
            wirklich moeglich ist -- ganz aussen fehlt der jeweilige Pfeil. */}
        {position > 0 && <MoveArrow side="left" onClick={onMoveLeft} />}
        {position < total - 1 && <MoveArrow side="right" onClick={onMoveRight} />}
      </span>

      {/* Zwei Zeilen, feste Hoehe, damit Reihen bei Umsortierung nicht springen. */}
      <div className="mt-2 h-[38px] px-0.5 text-center leading-tight">
        <span
          className="block truncate text-[13px] font-medium text-text-primary"
          title={sourceName}
        >
          {sourceName}
        </span>
        <span className="mt-0.5 block font-mono text-[11.5px] tabular-nums text-text-secondary">
          {t('workspace.grid.page', { n: pageNumber })}
        </span>
      </div>
    </div>
  );
}

/**
 * Runder Pfeil-Knopf an der Blattkante, der die Seite eine Position nach links oder
 * rechts schiebt. Er unterbricht den Zeiger, damit ein Klick nicht als Drag zaehlt.
 */
function MoveArrow({ side, onClick }: { side: 'left' | 'right'; onClick(): void }) {
  const t = useT();
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={
        side === 'left' ? t('workspace.grid.movePageLeft') : t('workspace.grid.movePageRight')
      }
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cx(
        'absolute top-1/2 z-20 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-surface-raised text-text-secondary opacity-0 shadow-[var(--float-shadow)] ring-1 ring-line-structural transition-opacity hover:text-text-primary focus-visible:opacity-100 group-hover:opacity-100',
        side === 'left' ? 'left-1' : 'right-1',
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

interface CardToolProps {
  icon: LucideIcon;
  label: string;
  onClick(): void;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
}

function CardTool({ icon: Icon, label, onClick, disabled, disabledReason, danger }: CardToolProps) {
  const button = (
    <button
      type="button"
      aria-label={label}
      title={disabled ? disabledReason : label}
      disabled={disabled}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cx(
        'grid size-6 place-items-center rounded text-text-secondary transition-colors hover:text-text-primary disabled:opacity-[0.38]',
        danger ? 'hover:bg-danger/15 hover:text-danger' : 'hover:bg-surface-hover',
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
  // Ein deaktivierter Button erklaert im Tooltip, warum -- der title tut das schon,
  // der Tooltip macht es fuer die Maus sichtbar.
  return disabled && disabledReason ? <Tooltip label={disabledReason}>{button}</Tooltip> : button;
}

/**
 * Die Einfuege-Marke in der Luecke neben einer Kachel. Am aeusseren Rasterrand
 * (`atEdge`) laege die Linie ausserhalb des Scrollcontainers und wuerde
 * abgeschnitten -- dort setzen wir sie leicht nach innen.
 */
function InsertionLine({ side, atEdge = false }: { side: 'left' | 'right'; atEdge?: boolean }) {
  const position =
    side === 'left'
      ? atEdge
        ? 'left-[3px]'
        : '-left-[10px]'
      : atEdge
        ? 'right-[3px]'
        : '-right-[10px]';
  return (
    <span
      aria-hidden
      className={cx(
        'pointer-events-none absolute top-7 z-30 w-[3px] rounded-full bg-accent',
        position,
      )}
      style={{ height: 'calc(100% - 2.75rem)' }}
    />
  );
}
