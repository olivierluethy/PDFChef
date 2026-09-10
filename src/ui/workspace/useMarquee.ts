import { useCallback, useRef, useState, type RefObject } from 'react';
import { hitTestMarquee, type Marquee } from './dragLogic';

const THRESHOLD = 4; // Pixel, bevor aus einem Klick ein Aufziehen wird.
const EDGE = 40;

export interface UseMarqueeOptions {
  /** Nur Zellen innerhalb dieses Containers werden getroffen. */
  containerRef: RefObject<HTMLElement | null>;
  /** CSS-Selektor der Zellen, z. B. '[data-block-index]'. */
  cellSelector: string;
  /** Liest die Auswahl-Id einer Zelle (Blockindex oder ItemId). */
  idOf(el: HTMLElement): string;
  /** Ersetzt die Auswahl mit den getroffenen Ids (additive bei Shift). */
  onSelect(ids: string[], additive: boolean): void;
  /** Ein Klick ins Leere ohne Aufziehen; hebt die Auswahl auf. */
  onClear(): void;
}

/**
 * Marquee-Auswahl: im leeren Bereich eines Rasters aufziehen, um Seiten mit der
 * Maus zu waehlen. Zellen selbst behalten ihren Pointerdown (Drag/Klick); das
 * Aufziehen startet nur auf dem Hintergrund. Reine Pointer-Events.
 */
export function useMarquee({ containerRef, cellSelector, idOf, onSelect, onClear }: UseMarqueeOptions) {
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      // Auf einer Zelle oder einem Bedienelement nicht aufziehen.
      if (target.closest(cellSelector) || target.closest('button, input, select, a')) return;

      const container = containerRef.current;
      if (!container) return;
      const start = { x: event.clientX, y: event.clientY };
      const additive = event.shiftKey;
      dragging.current = false;

      const collect = (m: Marquee) => {
        const cells = Array.from(container.querySelectorAll<HTMLElement>(cellSelector)).map((el) => {
          const r = el.getBoundingClientRect();
          return { id: idOf(el), left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        });
        return hitTestMarquee(cells, m);
      };

      const move = (e: PointerEvent) => {
        if (!dragging.current && Math.hypot(e.clientX - start.x, e.clientY - start.y) < THRESHOLD) return;
        dragging.current = true;
        document.body.classList.add('is-dragging');
        const m: Marquee = { x0: start.x, y0: start.y, x1: e.clientX, y1: e.clientY };
        setMarquee(m);
        const hits = collect(m);
        onSelect(hits, additive);

        // Auto-Scroll an den Raendern des Scrollers.
        const scroller = container.querySelector<HTMLElement>('.overflow-auto') ?? container;
        const rect = scroller.getBoundingClientRect();
        if (e.clientY - rect.top < EDGE) scroller.scrollBy({ top: -12 });
        else if (rect.bottom - e.clientY < EDGE) scroller.scrollBy({ top: 12 });
      };

      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.classList.remove('is-dragging');
        setMarquee(null);
        if (!dragging.current) onClear();
        dragging.current = false;
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [containerRef, cellSelector, idOf, onSelect, onClear],
  );

  return { onPointerDown, marquee };
}
