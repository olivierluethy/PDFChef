import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { buildExportPlan, type ExportEntry, type ExportScope } from '../../domain/exportPlan';
import type { NodeId } from '../../domain/types';
import { useServices, useWorkspace } from '../app/StoreProvider';
import { SharePanel } from './SharePanel';

/**
 * Status eines Teilen-/E-Mail-Vorgangs. "cancelled" trennt den bewussten Abbruch
 * im nativen Teilen-Dialog vom echten Fehler.
 */
export type ShareStatus = 'idle' | 'building' | 'shared' | 'emailed' | 'cancelled' | 'error';

export interface ShareController {
  /** Ohne Argument: der ganze Arbeitsbereich. Mit nodeId: nur dieser Ordner / dieses Dokument. */
  open(scope?: ExportScope): void;
  dialog: ReactNode;
}

/** Kann der Browser Dateien ueber den nativen Teilen-Dialog weitergeben? */
export function canShareFiles(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  );
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

/**
 * `mailto:` kann keinen Anhang tragen. Deshalb wird das PDF vorher heruntergeladen
 * und die Mail mit einem Hinweis vorbereitet, es anzuhaengen.
 */
function openMail(fileName: string): void {
  const subject = encodeURIComponent(fileName);
  const body = encodeURIComponent(
    `Anbei das Dokument "${fileName}".\n\n` +
      'Hinweis: Das PDF wurde soeben heruntergeladen -- bitte haenge es dieser E-Mail an.',
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

export function useShare(): ShareController {
  const services = useServices();
  const workspace = useWorkspace();
  const [scope, setScope] = useState<ExportScope | null>(null);
  const [statuses, setStatuses] = useState<Record<NodeId, ShareStatus>>({});
  const [busy, setBusy] = useState(false);

  // Wie bei Export/Druck wird der Plan live aus dem Arbeitsbereich abgeleitet.
  const plan = useMemo(
    () => (scope ? buildExportPlan(workspace, scope) : null),
    [scope, workspace],
  );

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
      }),
    [services, workspace],
  );

  const entryFor = useCallback(
    (outputId: NodeId) => {
      const current = scope ? buildExportPlan(workspace, scope) : null;
      return current?.entries.find((entry) => entry.outputId === outputId);
    },
    [scope, workspace],
  );

  const shareOne = useCallback(
    async (outputId: NodeId) => {
      const entry = entryFor(outputId);
      if (!entry) return;
      setBusy(true);
      setStatuses((prev) => ({ ...prev, [outputId]: 'building' }));
      try {
        const bytes = await assembleBytes(entry);
        const file = new File([bytes as BlobPart], entry.fileName, { type: 'application/pdf' });
        if (canShareFiles() && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: entry.fileName });
          setStatuses((prev) => ({ ...prev, [outputId]: 'shared' }));
        } else {
          // Ohne Datei-Teilen: herunterladen und Mail vorbereiten.
          download(bytes, entry.fileName);
          openMail(entry.fileName);
          setStatuses((prev) => ({ ...prev, [outputId]: 'emailed' }));
        }
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          setStatuses((prev) => ({ ...prev, [outputId]: 'cancelled' }));
        } else {
          console.error('Teilen fehlgeschlagen', error);
          setStatuses((prev) => ({ ...prev, [outputId]: 'error' }));
        }
      } finally {
        setBusy(false);
      }
    },
    [entryFor, assembleBytes],
  );

  const emailOne = useCallback(
    async (outputId: NodeId) => {
      const entry = entryFor(outputId);
      if (!entry) return;
      setBusy(true);
      setStatuses((prev) => ({ ...prev, [outputId]: 'building' }));
      try {
        const bytes = await assembleBytes(entry);
        download(bytes, entry.fileName);
        openMail(entry.fileName);
        setStatuses((prev) => ({ ...prev, [outputId]: 'emailed' }));
      } catch (error) {
        console.error('E-Mail vorbereiten fehlgeschlagen', error);
        setStatuses((prev) => ({ ...prev, [outputId]: 'error' }));
      } finally {
        setBusy(false);
      }
    },
    [entryFor, assembleBytes],
  );

  return {
    open: (next: ExportScope = { kind: 'workspace' }) => {
      setStatuses({});
      setBusy(false);
      setScope(next);
    },
    dialog: plan ? (
      <SharePanel
        plan={plan}
        statuses={statuses}
        busy={busy}
        canShare={canShareFiles()}
        onShare={(outputId) => void shareOne(outputId)}
        onEmail={(outputId) => void emailOne(outputId)}
        onClose={close}
      />
    ) : null,
  };
}
