import { Download, FolderTree, Info, TriangleAlert, X } from 'lucide-react';
import type { ExportPlan } from '../../domain/exportPlan';
import type { ExportWarning } from '../../domain/exportWarnings';
import type { ExportProgress } from '../../services/export/exportRunner';

export interface ExportDialogProps {
  plan: ExportPlan;
  warnings: ExportWarning[];
  canWriteDirectory: boolean;
  progress: ExportProgress | null;
  onExport(target: 'directory' | 'zip'): void;
  onCancel(): void;
  onClose(): void;
}

function pages(count: number): string {
  return count === 1 ? '1 Seite' : `${count} Seiten`;
}

export function ExportDialog({ plan, warnings, canWriteDirectory, progress, onExport, onCancel, onClose }: ExportDialogProps) {
  const running = progress !== null;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50" role="dialog" aria-label="Exportieren">
      <div className="flex max-h-[80vh] w-[32rem] flex-col rounded-lg border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h2 className="text-sm font-medium">Exportieren</h2>
          <button type="button" onClick={onClose} aria-label="Schliessen" disabled={running} className="rounded p-1 hover:bg-shell disabled:opacity-40">
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-sm">
          <p className="mb-2 text-neutral-400">{plan.entries.length} Dokumente, {pages(plan.totalBlocks)} insgesamt.</p>
          <ul className="flex flex-col gap-1">
            {plan.entries.map((entry) => (
              <li key={entry.outputId} className="flex justify-between">
                <span className="truncate">{[...entry.path, entry.fileName].join(' . ')}</span>
                <span className="ml-2 shrink-0 text-neutral-500">{pages(entry.items.length)}</span>
              </li>
            ))}
          </ul>
        </div>

        {warnings.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-line px-4 py-2 text-xs">
            {warnings.map((warning, index) => (
              <div
                key={`${warning.kind}-${warning.outputId ?? ''}-${index}`}
                className={`flex items-start gap-1.5 ${warning.severity === 'warn' ? 'text-amber-400' : 'text-neutral-500'}`}
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

        <div className="border-t border-line px-4 py-3">
          {running ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-300">
                {progress.currentName} · {progress.done} von {progress.total}
              </span>
              <button type="button" onClick={onCancel} className="rounded px-3 py-1 text-sm hover:bg-shell">
                Abbrechen
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={!canWriteDirectory}
                  onClick={() => onExport('directory')}
                  className="flex items-center gap-1 rounded bg-shell px-3 py-1 text-sm disabled:opacity-40"
                >
                  <FolderTree className="size-4" /> In Ordner exportieren
                </button>
                <button type="button" onClick={() => onExport('zip')} className="flex items-center gap-1 rounded bg-sky-600 px-3 py-1 text-sm">
                  <Download className="size-4" /> Als ZIP herunterladen
                </button>
              </div>
              {!canWriteDirectory && (
                <p className="text-right text-xs text-neutral-500">
                  Dieser Browser kann nicht direkt in einen Ordner schreiben; nutzen Sie den ZIP-Export.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
