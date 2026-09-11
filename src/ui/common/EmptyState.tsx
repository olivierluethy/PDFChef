import type { ReactNode } from 'react';
import { cx } from './cx';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** Optionale Illustration ueber dem Titel (z. B. Blatt-Umrisse). */
  illustration?: ReactNode;
  /** Aktionen unter dem Text. */
  children?: ReactNode;
  /** Zusatzzeile, z. B. "oder Dateien hierher ziehen". */
  footnote?: ReactNode;
  align?: 'center' | 'start';
  maxWidth?: number;
  className?: string;
}

/** Ein leerer Bereich lädt zum Handeln ein -- er ist nie nur Zierde. */
export function EmptyState({
  title,
  description,
  illustration,
  children,
  footnote,
  align = 'center',
  maxWidth = 440,
  className,
}: EmptyStateProps) {
  return (
    <div className={cx('grid h-full place-items-center p-8', className)}>
      <div
        style={{ maxWidth }}
        className={cx('flex flex-col', align === 'center' ? 'items-center text-center' : 'items-start text-left')}
      >
        {illustration && <div className="mb-6">{illustration}</div>}
        <h2 className="t-panel-title text-text-primary">{title}</h2>
        {description && <p className="t-body mt-2 text-text-secondary">{description}</p>}
        {children && <div className={cx('mt-6 flex flex-wrap gap-2', align === 'center' && 'justify-center')}>{children}</div>}
        {footnote && <p className="t-meta mt-3">{footnote}</p>}
      </div>
    </div>
  );
}

/** Drei versetzte Blatt-Umrisse als Geisterbild des Zielzustands. */
export function SheetGhosts() {
  return (
    <div aria-hidden className="flex items-end gap-2 opacity-[0.12]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block rounded-[2px] ring-1 ring-paper"
          style={{ width: 48, height: 64, marginTop: i === 1 ? 0 : 6 }}
        />
      ))}
    </div>
  );
}
