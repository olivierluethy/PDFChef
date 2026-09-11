import { useCallback, useRef, useState } from 'react';
import { newId } from '../../domain/ids';
import type { NodeId } from '../../domain/types';
import { useDispatch, useSelectionStore, useWorkspaceStore } from '../app/StoreProvider';
import { buildDropCommand } from './buildDropCommand';
import type { DragState } from './DragPreview';
import type { DragOrigin, DropTarget } from './dragLogic';

const DRAG_THRESHOLD = 4; // Pixel, bevor aus einem Klick ein Drag wird.
const EDGE = 40; // Randzone fuer Auto-Scroll.

/** Sichtbare Einfuege-Marke: in welchem Dokument, an welcher Luecke. */
export interface DropIndicator {
  outputId: NodeId;
  index: number;
}

/**
 * Liest aus dem DOM das Drop-Ziel unter dem Zeiger. Fuer ein Ausgaberaster wird
 * die genaue Einfuegeposition bestimmt: vor der Zelle, wenn der Zeiger in ihrer
 * linken Haelfte liegt, sonst danach -- so zeigt die Linie exakt die Luecke, in
 * die beim Loslassen eingefuegt wird.
 */
function targetAt(x: number, y: number, nodeDrag: boolean): DropTarget | null {
  const element = document.elementFromPoint(x, y);
  const node = element?.closest('[data-node-id]') as HTMLElement | null;
  if (node) {
    const nodeId = node.dataset.nodeId!;
    if (node.dataset.nodeType === 'folder') return { kind: 'folder', nodeId };
    return { kind: 'tree-output', outputId: nodeId };
  }
  const output = element?.closest('[data-output-id]') as HTMLElement | null;
  if (output) {
    const cell = element?.closest('[data-drop-index]') as HTMLElement | null;
    let index = Number(output.dataset.itemCount ?? 0);
    if (cell) {
      const position = Number(cell.dataset.dropIndex);
      const rect = cell.getBoundingClientRect();
      index = x < (rect.left + rect.right) / 2 ? position : position + 1;
    }
    return { kind: 'output', outputId: output.dataset.outputId!, index };
  }
  // Leerer Bereich des Baums = Wurzel. Nur beim Umhaengen eines Knotens ein Ziel.
  if (nodeDrag && element?.closest('[data-tree-root]')) return { kind: 'tree-root' };
  return null;
}

/** Hebt das Element hervor, das gerade Drop-Ziel ist. */
function highlightTarget(
  x: number,
  y: number,
  current: HTMLElement | null,
  nodeDrag: boolean,
): HTMLElement | null {
  const element = document.elementFromPoint(x, y);
  const node = element?.closest('[data-node-id]') as HTMLElement | null;
  const output = element?.closest('[data-output-id]') as HTMLElement | null;
  const root = nodeDrag ? (element?.closest('[data-tree-root]') as HTMLElement | null) : null;
  const next = node ?? output ?? root ?? null;
  if (next === current) return current;
  current?.removeAttribute('data-drop-active');
  next?.setAttribute('data-drop-active', 'true');
  return next;
}

export function usePointerDrag() {
  const dispatch = useDispatch();
  const workspaceStore = useWorkspaceStore();
  const selectionStore = useSelectionStore();
  const [preview, setPreview] = useState<DragState | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const origin = useRef<DragOrigin | null>(null);
  const target = useRef<DropTarget | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const highlighted = useRef<HTMLElement | null>(null);

  const endDrag = () => {
    dragging.current = false;
    origin.current = null;
    target.current = null;
    document.body.classList.remove('is-dragging');
    highlighted.current?.removeAttribute('data-drop-active');
    highlighted.current = null;
    setPreview(null);
    setDropIndicator(null);
  };

  const onCellPointerDown = useCallback(
    (event: React.PointerEvent, dragOrigin: DragOrigin) => {
      origin.current = dragOrigin;
      start.current = { x: event.clientX, y: event.clientY };
      dragging.current = false;

      const move = (e: PointerEvent) => {
        if (!start.current || !origin.current) return;
        const dx = e.clientX - start.current.x;
        const dy = e.clientY - start.current.y;
        if (!dragging.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        if (!dragging.current) {
          dragging.current = true;
          // Kein natives Markieren von Text mehr, waehrend gezogen wird.
          document.body.classList.add('is-dragging');
        }

        const kind = origin.current.kind;
        const nodeDrag = kind === 'node';
        const action = kind === 'source' ? 'add' : nodeDrag || !(e.metaKey || e.ctrlKey) ? 'move' : 'copy';
        const count =
          kind === 'source' ? origin.current.blockIndices.length : kind === 'output' ? origin.current.itemIds.length : 1;
        setPreview({ count, action, x: e.clientX, y: e.clientY });
        highlighted.current = highlightTarget(e.clientX, e.clientY, highlighted.current, nodeDrag);

        // Ziel jetzt bestimmen, damit die sichtbare Einfuege-Linie und der Drop
        // beim Loslassen dieselbe Position benutzen.
        const currentTarget = targetAt(e.clientX, e.clientY, nodeDrag);
        target.current = currentTarget;
        setDropIndicator(
          currentTarget?.kind === 'output'
            ? { outputId: currentTarget.outputId, index: currentTarget.index }
            : null,
        );

        // Auto-Scroll, wenn der Zeiger in die Randzone eines Scrollers faehrt.
        const scroller = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('.overflow-auto');
        if (scroller) {
          const rect = scroller.getBoundingClientRect();
          if (e.clientY - rect.top < EDGE) scroller.scrollBy({ top: -12 });
          else if (rect.bottom - e.clientY < EDGE) scroller.scrollBy({ top: 12 });
        }
      };

      const up = (e: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const wasDragging = dragging.current;
        const dragOriginNow = origin.current;
        // Dasselbe Ziel wie die Linie, statt es beim Loslassen neu zu raten.
        const dropTarget = target.current;
        if (!wasDragging || !dragOriginNow) {
          endDrag();
          return;
        }
        endDrag();
        if (!dropTarget) return;
        const command = buildDropCommand({
          origin: dragOriginNow,
          target:
            // Fuer Seiten-Drags bleibt ein Baum-Dokument ein Seiten-Ziel; ein
            // Knoten-Drag braucht das Baum-Dokument, um dessen Ordner zu treffen.
            dragOriginNow.kind !== 'node' && dropTarget.kind === 'tree-output'
              ? { kind: 'output', outputId: dropTarget.outputId, index: 0 }
              : dropTarget,
          modifier: e.metaKey || e.ctrlKey,
          ws: workspaceStore.getState().workspace,
          newId,
        });
        if (command) dispatch(command, selectionStore.getState().snapshot());
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [dispatch, workspaceStore, selectionStore],
  );

  return { onCellPointerDown, preview, dropIndicator };
}
