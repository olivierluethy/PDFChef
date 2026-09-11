import type { SaveStatus as SaveStatusValue } from '../../services/persistence/autosave';
import { cx } from './cx';

export interface SaveStatusProps {
  status: SaveStatusValue;
}

interface View {
  label: string;
  dot: string;
  pulse?: boolean;
}

function view(status: SaveStatusValue): View | null {
  switch (status.kind) {
    case 'idle':
      return null;
    case 'pending':
    case 'saving':
      return { label: 'Speichern …', dot: 'bg-text-secondary', pulse: true };
    case 'saved':
      return { label: 'Lokal gespeichert', dot: 'bg-success' };
    case 'error':
      return {
        label: status.reason === 'quota' ? 'Nicht gespeichert — Speicher voll' : 'Nicht gespeichert',
        dot: 'bg-danger',
      };
  }
}

/**
 * Speicherstatus als Punkt plus Label. Feste Mindestbreite, damit ein Wechsel
 * des Textes nie den Header verschiebt.
 */
export function SaveStatus({ status }: SaveStatusProps) {
  const v = view(status);
  return (
    <span role="status" aria-live="polite" className="inline-flex min-w-[184px] items-center gap-2 text-[12px]">
      {v && (
        <>
          <span aria-hidden className={cx('size-1.5 rounded-full', v.dot, v.pulse && 'animate-pulse')} />
          <span className={cx(status.kind === 'error' ? 'text-danger' : 'text-text-secondary')}>{v.label}</span>
        </>
      )}
    </span>
  );
}
