import { useCallback, useRef, useState, type ReactNode } from 'react';

export interface SplitPaneProps {
  /** Inhalt oben und unten; der Griff dazwischen ist ziehbar. */
  top: ReactNode;
  bottom: ReactNode;
  /** Anteil des oberen Bereichs [0..1], Startwert. */
  initial?: number;
  min?: number;
  max?: number;
  topLabel?: string;
}

/**
 * Vertikaler Splitter mit ziehbarem Griff. Loest das Kernproblem der alten
 * 50/50-Aufteilung: Quell- und Ausgaberaster teilen sich die Hoehe, aber der
 * Nutzer bestimmt das Verhaeltnis. Reine Pointer-Events, kein Fremdpaket.
 */
export function SplitPane({ top, bottom, initial = 0.62, min = 0.2, max = 0.85, topLabel = 'Groesse anpassen' }: SplitPaneProps) {
  const [fraction, setFraction] = useState(initial);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onHandleDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    document.body.classList.add('is-dragging');

    const move = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const next = (e.clientY - rect.top) / rect.height;
      setFraction(Math.min(max, Math.max(min, next)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('is-dragging');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [min, max]);

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0" style={{ flex: `${fraction} 1 0%` }}>
        {top}
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={topLabel}
        onPointerDown={onHandleDown}
        className="group relative flex h-2 shrink-0 cursor-row-resize items-center justify-center"
      >
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
        <span className="relative h-1 w-10 rounded-full bg-line transition-colors group-hover:bg-accent" />
      </div>
      <div className="min-h-0" style={{ flex: `${1 - fraction} 1 0%` }}>
        {bottom}
      </div>
    </div>
  );
}
