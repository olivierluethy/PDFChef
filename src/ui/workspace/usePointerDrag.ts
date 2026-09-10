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

export function usePointerDrag() {
  const dispatch = useDispatch();
  const workspaceStore = useWorkspaceStore();
  const selectionStore = useSelectionStore();
  const [preview, setPreview] = useState<DragState | null>(null);
  const origin = useRef<DragOrigin | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

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
        dragging.current = true;

        const action = origin.current.kind === 'source' ? 'add' : e.metaKey || e.ctrlKey ? 'copy' : 'move';
        const count = origin.current.kind === 'source' ? origin.current.blockIndices.length : origin.current.itemIds.length;
        setPreview({ count, action, x: e.clientX, y: e.clientY });

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
        setPreview(null);
        if (!dragging.current || !origin.current) return;
        const target = targetAt(e.clientX, e.clientY);
        if (!target) return;
        const command = buildDropCommand({
          origin: origin.current,
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
