import { useCallback } from 'react';
import { cx } from './cx';

export interface ResizeHandleProps {
  /** 'col' = senkrechter Griff, veraendert eine Breite; 'row' = waagrechter Griff, veraendert eine Hoehe. */
  orientation: 'col' | 'row';
  value: number;
  min: number;
  max: number;
  onChange(next: number): void;
  ariaLabel: string;
  /** true, wenn das Panel rechts/unten vom Griff liegt (Ziehen zum Griff hin vergroessert). */
  invert?: boolean;
}

const STEP = 16;

/**
 * Sichtbarer, tastaturbedienbarer Groessengriff. Ruhezustand ist eine Strukturlinie,
 * Hover/Fokus faerben sie im Akzent; Pfeiltasten verschieben in 16px-Schritten.
 */
export function ResizeHandle({ orientation, value, min, max, onChange, ariaLabel, invert }: ResizeHandleProps) {
  const isCol = orientation === 'col';
  const sign = invert ? -1 : 1;
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      const startPos = isCol ? event.clientX : event.clientY;
      const startValue = value;
      document.body.classList.add('is-dragging');
      const move = (e: PointerEvent) => {
        const delta = (isCol ? e.clientX : e.clientY) - startPos;
        onChange(clamp(startValue + sign * delta));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.classList.remove('is-dragging');
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [isCol, value, sign, min, max, onChange],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    const grow = isCol ? 'ArrowRight' : 'ArrowDown';
    const shrink = isCol ? 'ArrowLeft' : 'ArrowUp';
    if (event.key === grow) {
      event.preventDefault();
      onChange(clamp(value + STEP * sign));
    } else if (event.key === shrink) {
      event.preventDefault();
      onChange(clamp(value - STEP * sign));
    }
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-orientation={isCol ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={cx(
        'group relative z-10 shrink-0',
        isCol ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize',
      )}
    >
      {/* Ruhelinie */}
      <span
        aria-hidden
        className={cx('absolute bg-line-structural transition-colors', isCol ? 'inset-y-0 left-0 w-px' : 'inset-x-0 top-0 h-px')}
      />
      {/* Verbreiterte Trefferzone plus Hover/Fokus-Faerbung */}
      <span
        aria-hidden
        className={cx(
          'absolute transition-colors group-hover:bg-accent group-focus-visible:bg-accent',
          isCol ? 'inset-y-0 -left-1 w-2' : 'inset-x-0 -top-1 h-2',
        )}
      />
    </div>
  );
}
