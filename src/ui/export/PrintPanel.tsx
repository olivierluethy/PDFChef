import { motion } from 'motion/react';
import { Check, Download, ExternalLink, Loader2, Printer, TriangleAlert, X } from 'lucide-react';
import type { ExportPlan } from '../../domain/exportPlan';
import type { NodeId } from '../../domain/types';
import { Button } from '../common/Button';
import { IconButton } from '../common/IconButton';
import { overlayVariants, tween, useMotionPrefs } from '../common/motion';
import { useT } from '../i18n';
import type { PrintStatus } from './usePrint';

export interface PrintPanelProps {
  plan: ExportPlan;
  statuses: Record<NodeId, PrintStatus>;
  /** Ein Auftrag läuft gerade (einzeln oder im Reihen-Druck) -- Knöpfe sperren. */
  busy: boolean;
  /** Kann der Browser den Druckdialog direkt öffnen? Steuert nur den Erklärtext. */
  autoPrint: boolean;
  onPrintOne(outputId: NodeId): void;
  onPrintAll(): void;
  onDownload(outputId: NodeId): void;
  onClose(): void;
}

function pages(count: number, t: ReturnType<typeof useT>): string {
  return count === 1 ? t('export.pageOne') : t('export.pageCount', { count });
}

function StatusBadge({ status }: { status: PrintStatus }) {
  const t = useT();
  switch (status) {
    case 'building':
      return (
        <span className="flex items-center gap-1 text-[12px] text-text-secondary">
          <Loader2 className="size-3.5 animate-spin" /> {t('export.preparing')}
        </span>
      );
    case 'sent':
      return (
        <span className="flex items-center gap-1 text-[12px] text-success">
          <Check className="size-3.5" /> {t('export.print.sent')}
        </span>
      );
    case 'tab':
      return (
        <span className="flex items-center gap-1 text-[12px] text-info">
          <ExternalLink className="size-3.5" /> {t('export.print.openedInTab')}
        </span>
      );
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

export function PrintPanel({
  plan,
  statuses,
  busy,
  autoPrint,
  onPrintOne,
  onPrintAll,
  onDownload,
  onClose,
}: PrintPanelProps) {
  const t = useT();
  const prefs = useMotionPrefs();
  const nothing = plan.entries.length === 0;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" role="dialog" aria-label={t('export.print.title')}>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={overlayVariants}
        transition={prefs.t(tween.overlayIn)}
        className="flex max-h-[85vh] w-[34rem] flex-col rounded-[10px] bg-surface-panel shadow-[var(--float-shadow)] ring-1 ring-line-structural"
      >
        <div className="flex items-center justify-between border-b border-line-structural px-5 py-3.5">
          <h2 className="t-panel-title flex items-center gap-2 text-text-primary">
            <Printer className="size-4" aria-hidden /> {t('export.print.title')}
          </h2>
          <IconButton icon={X} label={t('export.close')} onClick={onClose} />
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4 text-[13px]">
          {nothing ? (
            <p className="text-text-secondary">{t('export.print.emptyState')}</p>
          ) : (
            <>
              <p className="mb-4 text-text-secondary">
                {plan.entries.length}{' '}
                {plan.entries.length === 1 ? t('export.documentWordOne') : t('export.documentWordOther')}
                {t('export.print.introTail')}{' '}
                {autoPrint ? t('export.print.autoPrintHint') : t('export.print.tabHint')}
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
                      <IconButton
                        icon={Download}
                        label={t('export.print.downloadLabel', { name: entry.fileName })}
                        onClick={() => onDownload(entry.outputId)}
                        disabled={busy}
                      />
                      <Button variant="secondary" size="sm" icon={Printer} onClick={() => onPrintOne(entry.outputId)} disabled={busy}>
                        {t('export.print.print')}
                      </Button>
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

        {!nothing && (
          <div className="flex items-center justify-between border-t border-line-structural px-5 py-3.5">
            <p className="text-[12px] text-text-secondary">
              {plan.entries.length > 1 ? t('export.print.batchHint') : t('export.print.singleHint')}
            </p>
            <Button variant="primary" icon={Printer} onClick={onPrintAll} disabled={busy}>
              {plan.entries.length > 1 ? t('export.print.printAll') : t('export.print.print')}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
