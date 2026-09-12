import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n';

export interface SplitPaneProps {
  top: ReactNode;
  bottom: ReactNode;
  /** Anteil des oberen Bereichs [0..1], Startwert. */
  initial?: number;
  min?: number;
  max?: number;
  label?: string;
}

const STEP = 16;

/**
 * Vertikaler Splitter mit ziehbarem, tastaturbedienbarem Griff. Quell- und
 * Ausgaberaster teilen sich die Hoehe; der Nutzer bestimmt das Verhaeltnis per
 * Maus oder Pfeiltasten (16px-Schritte). role=separator mit aria-valuenow.
 */
export function SplitPane({
  top,
  bottom,
  initial = 0.6,
  min = 0.2,
  max = 0.85,
  label,
}: SplitPaneProps) {
  const t = useT();
  const resolvedLabel = label ?? t('common.splitPane.label');
  const [fraction, setFraction] = useState(initial);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const clampFraction = (f: number) => Math.min(max, Math.max(min, f));

  const onHandleDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      document.body.classList.add('is-dragging');
      const move = (e: PointerEvent) => {
        const rect = container.getBoundingClientRect();
        setFraction(clampFraction((e.clientY - rect.top) / rect.height));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.classList.remove('is-dragging');
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [min, max],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const stepFraction = STEP / container.getBoundingClientRect().height;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFraction((f) => clampFraction(f - stepFraction));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFraction((f) => clampFraction(f + stepFraction));
    }
  };

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0" style={{ flex: `${fraction} 1 0%` }}>
        {top}
      </div>
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="horizontal"
        aria-label={resolvedLabel}
        aria-valuenow={Math.round(fraction * 100)}
        aria-valuemin={Math.round(min * 100)}
        aria-valuemax={Math.round(max * 100)}
        onPointerDown={onHandleDown}
        onKeyDown={onKeyDown}
        className="group relative flex h-2 shrink-0 cursor-row-resize items-center justify-center"
      >
        <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-structural" />
        <span
          aria-hidden
          className="relative h-1 w-10 rounded-full bg-line-structural transition-colors group-hover:bg-accent group-focus-visible:bg-accent"
        />
      </div>
      <div className="min-h-0" style={{ flex: `${1 - fraction} 1 0%` }}>
        {bottom}
      </div>
    </div>
  );
}
