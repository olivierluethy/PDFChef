import { motion } from 'motion/react';
import { Check, Loader2, Mail, Share2, TriangleAlert, X } from 'lucide-react';
import type { ExportPlan } from '../../domain/exportPlan';
import type { NodeId } from '../../domain/types';
import { Button } from '../common/Button';
import { IconButton } from '../common/IconButton';
import { overlayVariants, tween, useMotionPrefs } from '../common/motion';
import { useT } from '../i18n';
import type { ShareStatus } from './useShare';

export interface SharePanelProps {
  plan: ExportPlan;
  statuses: Record<NodeId, ShareStatus>;
  busy: boolean;
  /** Kann der Browser Dateien nativ teilen? Steuert Sichtbarkeit des Teilen-Knopfs. */
  canShare: boolean;
  onShare(outputId: NodeId): void;
  onEmail(outputId: NodeId): void;
  onClose(): void;
}

function pages(count: number, t: ReturnType<typeof useT>): string {
  return count === 1 ? t('export.pageOne') : t('export.pageCount', { count });
}

function StatusBadge({ status }: { status: ShareStatus }) {
  const t = useT();
  switch (status) {
    case 'building':
      return (
        <span className="flex items-center gap-1 text-[12px] text-text-secondary">
          <Loader2 className="size-3.5 animate-spin" /> {t('export.preparing')}
        </span>
      );
    case 'shared':
      return (
        <span className="flex items-center gap-1 text-[12px] text-success">
          <Check className="size-3.5" /> {t('export.share.shared')}
        </span>
      );
    case 'emailed':
      return (
        <span className="flex items-center gap-1 text-[12px] text-info">
          <Mail className="size-3.5" /> {t('export.share.emailed')}
        </span>
      );
    case 'cancelled':
      return <span className="text-[12px] text-text-tertiary">{t('export.share.cancelled')}</span>;
    case 'error':
      return (
        <span className="flex items-center gap-1 text-[12px] text-danger">
          <TriangleAlert className="size-3.5" /> {t('export.error')}
        </span>
      );
    default:
      return <span className="text-[12px] text-text-tertiary">{t('export.ready')}</span>;
  }
}

export function SharePanel({
  plan,
  statuses,
  busy,
  canShare,
  onShare,
  onEmail,
  onClose,
}: SharePanelProps) {
  const t = useT();
  const prefs = useMotionPrefs();
  const nothing = plan.entries.length === 0;

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4"
      role="dialog"
      aria-label={t('export.share.title')}
    >
      <motion.div
        initial="hidden"
        animate="visible"
        variants={overlayVariants}
        transition={prefs.t(tween.overlayIn)}
        className="flex max-h-[85vh] w-[34rem] flex-col rounded-[10px] bg-surface-panel shadow-[var(--float-shadow)] ring-1 ring-line-structural"
      >
        <div className="flex items-center justify-between border-b border-line-structural px-5 py-3.5">
          <h2 className="t-panel-title flex items-center gap-2 text-text-primary">
            <Share2 className="size-4" aria-hidden /> {t('export.share.heading')}
          </h2>
          <IconButton icon={X} label={t('export.close')} onClick={onClose} />
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4 text-[13px]">
          {nothing ? (
            <p className="text-text-secondary">{t('export.share.emptyState')}</p>
          ) : (
            <>
              <p className="mb-4 text-text-secondary">
                {canShare ? t('export.share.introCanShare') : t('export.share.introNoShare')}
              </p>
              <ul className="flex flex-col gap-1.5">
                {plan.entries.map((entry) => {
                  const status = statuses[entry.outputId] ?? 'idle';
                  return (
                    <li
                      key={entry.outputId}
                      className="flex items-center gap-2 rounded-md bg-surface-raised px-2.5 py-2"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] text-text-primary">
                          {entry.path.length > 0 && (
                            <span className="text-text-tertiary">{entry.path.join(' / ')} / </span>
                          )}
                          {entry.fileName}
                        </span>
                        <span className="font-mono text-[12px] tabular-nums text-text-secondary">
                          {pages(entry.items.length, t)}
                        </span>
                      </div>
                      <StatusBadge status={status} />
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Mail}
                        onClick={() => onEmail(entry.outputId)}
                        disabled={busy}
                      >
                        {t('export.share.email')}
                      </Button>
                      {canShare && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Share2}
                          onClick={() => onShare(entry.outputId)}
                          disabled={busy}
                        >
                          {t('export.share.share')}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {plan.skipped.length > 0 && (
                <p className="mt-3 text-[12px] text-text-secondary">
                  {plan.skipped.length === 1
                    ? t('export.skippedOne', { count: plan.skipped.length })
                    : t('export.skippedOther', { count: plan.skipped.length })}
                </p>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
