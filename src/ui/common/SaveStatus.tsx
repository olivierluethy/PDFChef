import type { SaveStatus as SaveStatusValue } from '../../services/persistence/autosave';
import { cx } from './cx';
import { useT } from '../i18n';

export interface SaveStatusProps {
  status: SaveStatusValue;
}

interface View {
  label: string;
  dot: string;
  pulse?: boolean;
}

function view(status: SaveStatusValue, t: ReturnType<typeof useT>): View | null {
  switch (status.kind) {
    case 'idle':
      return null;
    case 'pending':
    case 'saving':
      return { label: t('common.saveStatus.saving'), dot: 'bg-text-secondary', pulse: true };
    case 'saved':
      return { label: t('common.saveStatus.saved'), dot: 'bg-success' };
    case 'error':
      return {
        label: status.reason === 'quota' ? t('common.saveStatus.errorQuota') : t('common.saveStatus.error'),
        dot: 'bg-danger',
      };
  }
}

/**
 * Speicherstatus als Punkt plus Label. Feste Mindestbreite, damit ein Wechsel
 * des Textes nie den Header verschiebt.
 */
export function SaveStatus({ status }: SaveStatusProps) {
  const t = useT();
  const v = view(status, t);
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
