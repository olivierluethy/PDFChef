import { createPortal } from 'react-dom';
import type { Marquee } from './dragLogic';

/** Das Auswahl-Rechteck beim Aufziehen; folgt dem Zeiger in Viewport-Koordinaten. */
export function MarqueeBox({ rect }: { rect: Marquee }) {
  const left = Math.min(rect.x0, rect.x1);
  const top = Math.min(rect.y0, rect.y1);
  const width = Math.abs(rect.x1 - rect.x0);
  const height = Math.abs(rect.y1 - rect.y0);
  return createPortal(
    <div
      className="pointer-events-none fixed z-50 rounded-sm border border-accent"
      style={{ left, top, width, height, backgroundColor: 'color-mix(in srgb, var(--color-accent) 18%, transparent)' }}
    />,
    document.body,
  );
}
