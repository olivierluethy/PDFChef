import { useCallback, useRef, useState } from 'react';
import { newId } from '../../domain/ids';
import { useDispatch, useSelectionStore, useWorkspaceStore } from '../app/StoreProvider';
import { buildDropCommand } from './buildDropCommand';
import type { DragState } from './DragPreview';
import type { DragOrigin, DropTarget } from './dragLogic';

const DRAG_THRESHOLD = 4; // Pixel, bevor aus einem Klick ein Drag wird.
const EDGE = 40; // Randzone fuer Auto-Scroll.

/** Liest aus dem DOM das Drop-Ziel unter dem Zeiger. */
function targetAt(x: number, y: number): DropTarget | null {
  const element = document.elementFromPoint(x, y);
  const node = element?.closest('[data-node-id]') as HTMLElement | null;
  if (node) {
    const nodeId = node.dataset.nodeId!;
    if (node.dataset.nodeType === 'folder') return { kind: 'folder', nodeId };
    return { kind: 'tree-output', outputId: nodeId };
  }
  const output = element?.closest('[data-output-id]') as HTMLElement | null;
  if (output) {
    // Die Einfuegeposition liefert das Raster selbst ueber data-drop-index am
    // naechstgelegenen Zell-Container; fehlt sie, ans Ende.
    const cell = element?.closest('[data-drop-index]') as HTMLElement | null;
    const index = cell ? Number(cell.dataset.dropIndex) : Number(output.dataset.itemCount ?? 0);
    return { kind: 'output', outputId: output.dataset.outputId!, index };
  }
  return null;
}

/** Hebt das Element hervor, das gerade Drop-Ziel ist. */
function highlightTarget(x: number, y: number, current: HTMLElement | null): HTMLElement | null {
  const element = document.elementFromPoint(x, y);
  const node = element?.closest('[data-node-id]') as HTMLElement | null;
  const output = element?.closest('[data-output-id]') as HTMLElement | null;
  const next = node ?? output ?? null;
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
  const origin = useRef<DragOrigin | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const highlighted = useRef<HTMLElement | null>(null);

  const endDrag = () => {
    dragging.current = false;
    origin.current = null;
    document.body.classList.remove('is-dragging');
    highlighted.current?.removeAttribute('data-drop-active');
    highlighted.current = null;
    setPreview(null);
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

        const action = origin.current.kind === 'source' ? 'add' : e.metaKey || e.ctrlKey ? 'copy' : 'move';
        const count = origin.current.kind === 'source' ? origin.current.blockIndices.length : origin.current.itemIds.length;
        setPreview({ count, action, x: e.clientX, y: e.clientY });
        highlighted.current = highlightTarget(e.clientX, e.clientY, highlighted.current);

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
        if (!wasDragging || !dragOriginNow) {
          endDrag();
          return;
        }
        const target = targetAt(e.clientX, e.clientY);
        endDrag();
        if (!target) return;
        const command = buildDropCommand({
          origin: dragOriginNow,
          target: target.kind === 'tree-output' ? { kind: 'output', outputId: target.outputId, index: 0 } : target,
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

  return { onCellPointerDown, preview };
}
