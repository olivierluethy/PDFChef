import { Check, Download, ExternalLink, Loader2, Printer, TriangleAlert, X } from 'lucide-react';
import type { ExportPlan } from '../../domain/exportPlan';
import type { NodeId } from '../../domain/types';
import type { PrintStatus } from './usePrint';

export interface PrintPanelProps {
  plan: ExportPlan;
  statuses: Record<NodeId, PrintStatus>;
  /** Ein Auftrag laeuft gerade (einzeln oder im Reihen-Druck) -- Knoepfe sperren. */
  busy: boolean;
  /** Kann der Browser den Druckdialog direkt oeffnen? Steuert nur den Erklaertext. */
  autoPrint: boolean;
  onPrintOne(outputId: NodeId): void;
  onPrintAll(): void;
  onDownload(outputId: NodeId): void;
  onClose(): void;
}

function pages(count: number): string {
  return count === 1 ? '1 Seite' : `${count} Seiten`;
}

function StatusBadge({ status }: { status: PrintStatus }) {
  switch (status) {
    case 'building':
      return (
        <span className="flex items-center gap-1 text-xs text-muted">
          <Loader2 className="size-3.5 animate-spin" /> wird vorbereitet…
        </span>
      );
    case 'sent':
      return (
        <span className="flex items-center gap-1 text-xs text-accent">
          <Check className="size-3.5" /> an Drucker gesendet
        </span>
      );
    case 'tab':
      return (
        <span className="flex items-center gap-1 text-xs text-accent">
          <ExternalLink className="size-3.5" /> im Tab geoeffnet — dort drucken
        </span>
      );
    case 'error':
      return (
        <span className="flex items-center gap-1 text-xs text-danger">
          <TriangleAlert className="size-3.5" /> Fehler
        </span>
      );
    default:
      return <span className="text-xs text-muted">bereit</span>;
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
  const nothing = plan.entries.length === 0;

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" role="dialog" aria-label="Drucken">
      <div className="flex max-h-[85vh] w-[34rem] flex-col rounded-lg border border-line bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Printer className="size-4" aria-hidden /> Drucken
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            className="rounded p-1 text-muted hover:bg-raised hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-sm">
          {nothing ? (
            <p className="text-muted">
              Es gibt noch keine gefuellten Dokumente zum Drucken. Ziehen Sie erst Seiten in ein
              Dokument.
            </p>
          ) : (
            <>
              <p className="mb-3 text-muted">
                {plan.entries.length} {plan.entries.length === 1 ? 'Dokument' : 'Dokumente'} — jedes wird
                ein eigener Druckauftrag.{' '}
                {autoPrint
                  ? 'Beim Drucken oeffnet sich der Druckdialog Ihres Browsers; nichts wird heruntergeladen.'
                  : 'Ihr Browser oeffnet das PDF zum Drucken in einem neuen Tab. Ueber „Herunterladen“ speichern Sie es bei Bedarf zusaetzlich.'}
              </p>
              <ul className="flex flex-col gap-1.5">
                {plan.entries.map((entry) => {
                  const status = statuses[entry.outputId] ?? 'idle';
                  return (
                    <li
                      key={entry.outputId}
                      className="flex items-center gap-2 rounded border border-line bg-shell px-2 py-1.5"
                    >
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm text-ink">
                          {entry.path.length > 0 && (
                            <span className="text-muted">{entry.path.join(' / ')} / </span>
                          )}
                          {entry.fileName}
                        </span>
                        <span className="tabular text-xs text-muted">{pages(entry.items.length)}</span>
                      </div>
                      <StatusBadge status={status} />
                      <button
                        type="button"
                        onClick={() => onDownload(entry.outputId)}
                        disabled={busy}
                        title="Dieses Dokument als PDF herunterladen"
                        aria-label={`${entry.fileName} herunterladen`}
                        className="shrink-0 rounded p-1 text-muted hover:bg-raised hover:text-ink disabled:opacity-40"
                      >
                        <Download className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onPrintOne(entry.outputId)}
                        disabled={busy}
                        className="flex shrink-0 items-center gap-1 rounded border border-line px-2 py-1 text-xs hover:border-accent/60 hover:text-ink disabled:opacity-40"
                      >
                        <Printer className="size-3.5" /> Drucken
                      </button>
                    </li>
                  );
                })}
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

        {!nothing && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <p className="text-xs text-muted">
              {plan.entries.length > 1
                ? 'Reihen-Druck geht die Dokumente einzeln nacheinander durch.'
                : 'Der Druckdialog oeffnet sich fuer dieses Dokument.'}
            </p>
            <button
              type="button"
              onClick={onPrintAll}
              disabled={busy}
              className="flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-sm font-medium text-shell hover:brightness-110 disabled:opacity-40"
            >
              <Printer className="size-4" />{' '}
              {plan.entries.length > 1 ? 'Alle nacheinander drucken' : 'Drucken'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
