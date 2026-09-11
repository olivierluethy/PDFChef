import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { buildExportPlan, type ExportEntry, type ExportScope } from '../../domain/exportPlan';
import type { NodeId } from '../../domain/types';
import { canAutoPrint, printPdf } from '../../services/print/printJob';
import { useServices, useWorkspace } from '../app/StoreProvider';
import { PrintPanel } from './PrintPanel';

/**
 * Zustand eines einzelnen Druckauftrags. Bewusst gibt es kein "fertig gedruckt":
 * ein Browser kann physisch nicht wissen, wann der Drucker durch ist. Der Status
 * endet ehrlich bei "an Drucker gesendet" bzw. "im Tab geoeffnet".
 */
export type PrintStatus = 'idle' | 'building' | 'sent' | 'tab' | 'error';

export interface PrintController {
  /** Ohne Argument: der ganze Arbeitsbereich. Mit nodeId: nur dieser Ordner / dieses Dokument. */
  open(scope?: ExportScope): void;
  dialog: ReactNode;
}

function download(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function usePrint(): PrintController {
  const services = useServices();
  const workspace = useWorkspace();
  const [scope, setScope] = useState<ExportScope | null>(null);
  const [statuses, setStatuses] = useState<Record<NodeId, PrintStatus>>({});
  const [busy, setBusy] = useState(false);

  // Wie beim Export leiten wir den Plan live aus dem Arbeitsbereich ab: eine
  // Umbenennung wirkt sofort in die Druckliste.
  const plan = useMemo(() => (scope ? buildExportPlan(workspace, scope) : null), [scope, workspace]);

  const close = useCallback(() => {
    setScope(null);
    setStatuses({});
    setBusy(false);
  }, []);

  const assembleBytes = useCallback(
    (entry: ExportEntry) =>
      services.assembler.assemble(entry.items, {
        readBytes: services.readBytesForSource,
        sourceKind: (id) => workspace.sources[id]?.kind ?? 'pdf',
        imageData: services.imageEmbeddable,
        textData: services.textPages,
        fontBytes: services.fontBytes,
      }),
    [services, workspace],
  );

  const printEntry = useCallback(
    async (entry: ExportEntry) => {
      setStatuses((prev) => ({ ...prev, [entry.outputId]: 'building' }));
      try {
        const bytes = await assembleBytes(entry);
        // In Chromium blockiert print() bis der Dialog geschlossen ist -- so
        // laufen mehrere Auftraege beim Reihen-Druck sauber nacheinander.
        const outcome = printPdf(bytes, entry.fileName);
        setStatuses((prev) => ({ ...prev, [entry.outputId]: outcome === 'tab' ? 'tab' : 'sent' }));
      } catch (error) {
        console.error('Drucken fehlgeschlagen', error);
        setStatuses((prev) => ({ ...prev, [entry.outputId]: 'error' }));
      }
    },
    [assembleBytes],
  );

  const printOne = useCallback(
    async (outputId: NodeId) => {
      const current = scope ? buildExportPlan(workspace, scope) : null;
      const entry = current?.entries.find((e) => e.outputId === outputId);
      if (!entry) return;
      setBusy(true);
      await printEntry(entry);
      setBusy(false);
    },
    [scope, workspace, printEntry],
  );

  const printAll = useCallback(async () => {
    const current = scope ? buildExportPlan(workspace, scope) : null;
    if (!current) return;
    setBusy(true);
    for (const entry of current.entries) {
      await printEntry(entry);
    }
    setBusy(false);
  }, [scope, workspace, printEntry]);

  const downloadOne = useCallback(
    async (outputId: NodeId) => {
      const current = scope ? buildExportPlan(workspace, scope) : null;
      const entry = current?.entries.find((e) => e.outputId === outputId);
      if (!entry) return;
      try {
        download(await assembleBytes(entry), entry.fileName);
      } catch (error) {
        console.error('Herunterladen fehlgeschlagen', error);
      }
    },
    [scope, workspace, assembleBytes],
  );

  return {
    open: (next: ExportScope = { kind: 'workspace' }) => {
      setStatuses({});
      setBusy(false);
      setScope(next);
    },
    dialog: plan ? (
      <PrintPanel
        plan={plan}
        statuses={statuses}
        busy={busy}
        autoPrint={canAutoPrint()}
        onPrintOne={(outputId) => void printOne(outputId)}
        onPrintAll={() => void printAll()}
        onDownload={(outputId) => void downloadOne(outputId)}
        onClose={close}
      />
    ) : null,
  };
}
