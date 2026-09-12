import { motion } from 'motion/react';
import { Check, Download, FolderInput, FolderTree, Info, TriangleAlert, X } from 'lucide-react';
import type { ExportPlan } from '../../domain/exportPlan';
import type { ExportWarning } from '../../domain/exportWarnings';
import type { NodeId } from '../../domain/types';
import type { ExportProgress } from '../../services/export/exportRunner';
import { Button } from '../common/Button';
import { IconButton } from '../common/IconButton';
import { cx } from '../common/cx';
import { overlayVariants, tween, useMotionPrefs } from '../common/motion';
import { useT } from '../i18n';

export interface ExportDialogProps {
  plan: ExportPlan;
  /** outputId -> aktueller Dokumentname, zum Bearbeiten vor dem Export. */
  names: Record<NodeId, string>;
  warnings: ExportWarning[];
  canWriteDirectory: boolean;
  progress: ExportProgress | null;
  /** Dokumente, die bereits einzeln an ein eigenes Ziel geschrieben wurden. */
  exportedIds: ReadonlySet<NodeId>;
  onRename(outputId: NodeId, name: string): void;
  onExport(target: 'directory' | 'zip'): void;
  /** Ein einzelnes Dokument an einen frei gewählten Ordner speichern. */
  onExportEntry(outputId: NodeId): void;
  onCancel(): void;
  onClose(): void;
}

function pages(count: number, t: ReturnType<typeof useT>): string {
  return count === 1 ? t('export.pageOne') : t('export.pageCount', { count });
}

export function ExportDialog({
  plan,
  names,
  warnings,
  canWriteDirectory,
  progress,
  exportedIds,
  onRename,
  onExport,
  onExportEntry,
  onCancel,
  onClose,
}: ExportDialogProps) {
  const t = useT();
  const prefs = useMotionPrefs();
  const running = progress !== null;
  const remaining = plan.entries.filter((entry) => !exportedIds.has(entry.outputId));
  const nothing = remaining.length === 0;
  const someExported = exportedIds.size > 0;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" role="dialog" aria-label={t('export.title')}>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={overlayVariants}
        transition={prefs.t(tween.overlayIn)}
        className="flex max-h-[85vh] w-[34rem] flex-col rounded-[10px] bg-surface-panel shadow-[var(--float-shadow)] ring-1 ring-line-structural"
      >
        <div className="flex items-center justify-between border-b border-line-structural px-5 py-3.5">
          <h2 className="t-panel-title text-text-primary">{t('export.title')}</h2>
          <IconButton icon={X} label={t('export.close')} onClick={onClose} disabled={running} />
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4 text-[13px]">
          {plan.entries.length === 0 ? (
            <p className="text-text-secondary">{t('export.emptyState')}</p>
          ) : (
            <>
              <p className="mb-4 text-text-secondary">
                {plan.entries.length}{' '}
                {plan.entries.length === 1 ? t('export.documentWordOne') : t('export.documentWordOther')},{' '}
                <span className="font-mono tabular-nums">{pages(plan.totalBlocks, t)}</span>{' '}
                {t('export.summaryTail')}
                {canWriteDirectory && ` ${t('export.perDocHint')}`}
              </p>
              <ul className="flex flex-col gap-1.5">
                {plan.entries.map((entry) => {
                  const isExported = exportedIds.has(entry.outputId);
                  return (
                    <li key={entry.outputId} className="flex items-center gap-2">
                      {entry.path.length > 0 && (
                        <span className="shrink-0 text-[12px] text-text-tertiary">{entry.path.join(' / ')} /</span>
                      )}
                      <input
                        value={names[entry.outputId] ?? entry.fileName.replace(/\.pdf$/i, '')}
                        onChange={(e) => onRename(entry.outputId, e.target.value)}
                        aria-label={t('export.documentNameLabel')}
                        disabled={isExported || running}
                        className="min-w-0 flex-1 rounded-md bg-surface-raised px-2.5 py-1.5 text-[13px] text-text-primary ring-1 ring-line-structural focus:ring-accent disabled:opacity-50"
                      />
                      <span className="shrink-0 text-[12px] text-text-tertiary">.pdf</span>
                      <span className="w-16 shrink-0 text-right font-mono text-[12px] tabular-nums text-text-secondary">
                        {pages(entry.items.length, t)}
                      </span>
                      {canWriteDirectory &&
                        (isExported ? (
                          <span className="flex shrink-0 items-center gap-1 text-[12px] text-success" aria-label={t('export.savedToOwnLocation')}>
                            <Check className="size-3.5" /> {t('export.saved')}
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={FolderInput}
                            onClick={() => onExportEntry(entry.outputId)}
                            disabled={running}
                            title={t('export.saveToOwnFolderTitle')}
                          >
                            {t('export.ownFolder')}
                          </Button>
                        ))}
                    </li>
                  );
                })}
              </ul>
              {someExported && (
                <p className="mt-3 text-[12px] text-text-secondary">
                  {exportedIds.size === 1
                    ? t('export.alreadySavedOne', { count: exportedIds.size })
                    : t('export.alreadySavedOther', { count: exportedIds.size })}
                  {nothing
                    ? t('export.nothingLeftForBatch')
                    : remaining.length === 1
                      ? t('export.batchWritesOne')
                      : t('export.batchWritesOther', { count: remaining.length })}
                </p>
              )}
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

        {warnings.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-line-structural px-5 py-2.5 text-[12px]">
            {warnings.map((warning, index) => (
              <div
                key={`${warning.kind}-${warning.outputId ?? ''}-${index}`}
                className={cx('flex items-start gap-1.5', warning.severity === 'warn' ? 'text-accent' : 'text-text-secondary')}
              >
                {warning.severity === 'warn' ? (
                  <TriangleAlert className="size-3.5 shrink-0 translate-y-0.5" />
                ) : (
                  <Info className="size-3.5 shrink-0 translate-y-0.5" />
                )}
                <span>{warning.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-line-structural px-5 py-3.5">
          {running ? (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] text-text-primary">
                <span className="font-mono tabular-nums">
                  {t('export.progressCount', { done: progress.done, total: progress.total })}
                </span>
                {progress.currentName && <span className="text-text-secondary">{progress.currentName}</span>}
              </span>
              <Button variant="quiet" size="sm" onClick={onCancel}>
                {t('export.cancel')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end gap-2">
                {canWriteDirectory && (
                  <Button variant="primary" icon={FolderTree} disabled={nothing} onClick={() => onExport('directory')}>
                    {t('export.saveToFolder')}
                  </Button>
                )}
                <Button
                  variant={canWriteDirectory ? 'secondary' : 'primary'}
                  icon={Download}
                  disabled={nothing}
                  onClick={() => onExport('zip')}
                >
                  {t('export.downloadZip')}
                </Button>
              </div>
              <p className="text-right text-[12px] text-text-secondary">
                {canWriteDirectory ? t('export.footnoteDirectory') : t('export.footnoteZip')}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
