import { useId, useRef, useState, type ReactNode } from 'react';
import { cx } from './cx';

export interface TooltipProps {
  /** Der Tooltip-Text. Ist er leer, wird nichts angezeigt. */
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * Leichtgewichtiger Tooltip. Die Listener sitzen am Wrapper (nicht am Kind),
 * damit der Hinweis auch ueber einem deaktivierten Button erscheint -- ein
 * disabled-Element feuert selbst keine Pointer-Events.
 */
export function Tooltip({ label, children, side = 'top', className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (!label) return <>{children}</>;

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), 350);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <span
      className={cx('relative inline-flex', className)}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cx(
            'pointer-events-none absolute left-1/2 z-50 w-max max-w-[240px] -translate-x-1/2 rounded-md bg-surface-raised px-2.5 py-1.5 text-[12px] leading-snug text-text-primary shadow-[var(--float-shadow)] ring-1 ring-line-structural',
            side === 'top' ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]',
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
