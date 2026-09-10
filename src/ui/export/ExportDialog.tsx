import { Download, FolderTree, Info, TriangleAlert, X } from 'lucide-react';
import type { ExportPlan } from '../../domain/exportPlan';
import type { ExportWarning } from '../../domain/exportWarnings';
import type { NodeId } from '../../domain/types';
import type { ExportProgress } from '../../services/export/exportRunner';

export interface ExportDialogProps {
  plan: ExportPlan;
  /** outputId -> aktueller Dokumentname, zum Bearbeiten vor dem Export. */
  names: Record<NodeId, string>;
  warnings: ExportWarning[];
  canWriteDirectory: boolean;
  progress: ExportProgress | null;
  onRename(outputId: NodeId, name: string): void;
  onExport(target: 'directory' | 'zip'): void;
  onCancel(): void;
  onClose(): void;
}

function pages(count: number): string {
  return count === 1 ? '1 Seite' : `${count} Seiten`;
}

export function ExportDialog({
  plan,
  names,
  warnings,
  canWriteDirectory,
  progress,
  onRename,
  onExport,
  onCancel,
  onClose,
}: ExportDialogProps) {
  const running = progress !== null;
  const nothing = plan.entries.length === 0;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" role="dialog" aria-label="Exportieren">
      <div className="flex max-h-[85vh] w-[34rem] flex-col rounded-lg border border-line bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Exportieren</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            disabled={running}
            className="rounded p-1 text-muted hover:bg-raised hover:text-ink disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-sm">
          {nothing ? (
            <p className="text-muted">
              Es gibt noch keine gefuellten Dokumente zum Exportieren. Ziehen Sie erst Seiten in ein
              Dokument.
            </p>
          ) : (
            <>
              <p className="mb-3 text-muted">
                {plan.entries.length} {plan.entries.length === 1 ? 'Dokument' : 'Dokumente'},{' '}
                <span className="tabular">{pages(plan.totalBlocks)}</span> insgesamt. Namen sind vor dem
                Export bearbeitbar.
              </p>
              <ul className="flex flex-col gap-1.5">
                {plan.entries.map((entry) => (
                  <li key={entry.outputId} className="flex items-center gap-2">
                    {entry.path.length > 0 && (
                      <span className="shrink-0 text-xs text-muted">{entry.path.join(' / ')} /</span>
                    )}
                    <input
                      value={names[entry.outputId] ?? entry.fileName.replace(/\.pdf$/i, '')}
                      onChange={(e) => onRename(entry.outputId, e.target.value)}
                      aria-label="Dokumentname"
                      className="min-w-0 flex-1 rounded border border-line bg-shell px-2 py-1 text-sm focus:border-accent"
                    />
                    <span className="shrink-0 text-xs text-muted">.pdf</span>
                    <span className="tabular w-16 shrink-0 text-right text-xs text-muted">
                      {pages(entry.items.length)}
                    </span>
                  </li>
                ))}
              </ul>
              {plan.skipped.length > 0 && (
                <p className="mt-3 text-xs text-muted">
                  {plan.skipped.length} leere{plan.skipped.length === 1 ? 's Dokument wird' : ' Dokumente werden'}{' '}
                  uebersprungen.
                </p>
              )}
            </>
          )}
        </div>

        {warnings.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-line px-4 py-2 text-xs">
            {warnings.map((warning, index) => (
              <div
                key={`${warning.kind}-${warning.outputId ?? ''}-${index}`}
                className={`flex items-start gap-1.5 ${warning.severity === 'warn' ? 'text-accent' : 'text-muted'}`}
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
              <span className="text-sm text-ink">
                <span className="tabular">
                  {progress.done} von {progress.total}
                </span>
                {progress.currentName ? ` · ${progress.currentName}` : ''}
              </span>
              <button type="button" onClick={onCancel} className="rounded px-3 py-1 text-sm hover:bg-raised">
                Abbrechen
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end gap-2">
                {canWriteDirectory && (
                  <button
                    type="button"
                    disabled={nothing}
                    onClick={() => onExport('directory')}
                    className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-sm font-medium text-shell hover:brightness-110 disabled:opacity-40"
                  >
                    <FolderTree className="size-4" /> In Ordner speichern
                  </button>
                )}
                <button
                  type="button"
                  disabled={nothing}
                  onClick={() => onExport('zip')}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm disabled:opacity-40 ${
                    canWriteDirectory
                      ? 'border border-line hover:bg-raised'
                      : 'bg-accent font-medium text-shell hover:brightness-110'
                  }`}
                >
                  <Download className="size-4" /> Als ZIP herunterladen
                </button>
              </div>
              <p className="text-right text-xs text-muted">
                {canWriteDirectory
                  ? 'In Ordner speichern schreibt die ganze Struktur an einen frei gewaehlten Ort.'
                  : 'Dieser Browser kann nicht direkt in einen Ordner schreiben; der ZIP-Export enthaelt die vollstaendige Struktur.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
