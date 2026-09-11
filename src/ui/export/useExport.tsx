import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildExportPlan, omitExportedEntries, type ExportScope } from '../../domain/exportPlan';
import { analyzeExport } from '../../domain/exportWarnings';
import type { NodeId } from '../../domain/types';
import type { DirectoryHandleLike } from '../../services/export/fsAccessWriter';
import { createFsAccessWriter } from '../../services/export/fsAccessWriter';
import { createZipWriter } from '../../services/export/zipWriter';
import { runExport, type ExportProgress } from '../../services/export/exportRunner';
import { useDispatch, useServices, useWorkspace } from '../app/StoreProvider';
import { ExportDialog } from './ExportDialog';

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const canWriteDirectory = typeof (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';

export interface ExportController {
  /** Ohne Argument: den ganzen Arbeitsbereich. Mit nodeId: nur diesen Ordner/dieses Dokument. */
  open(scope?: ExportScope): void;
  dialog: ReactNode;
}

export function useExport(): ExportController {
  const services = useServices();
  const workspace = useWorkspace();
  const dispatch = useDispatch();
  const [scope, setScope] = useState<ExportScope | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  // Dokumente, die bereits einzeln an ein eigenes Ziel geschrieben wurden; sie
  // werden aus dem anschliessenden Sammel-Export ausgeklammert.
  const [exported, setExported] = useState<ReadonlySet<NodeId>>(() => new Set());
  const abort = useRef<AbortController | null>(null);

  // Der Plan wird live aus dem Arbeitsbereich abgeleitet: benennt der Nutzer im
  // Dialog ein Dokument um, aktualisiert sich die Vorschau sofort mit.
  const plan = useMemo(() => (scope ? buildExportPlan(workspace, scope) : null), [scope, workspace]);
  const names = useMemo(() => {
    const map: Record<NodeId, string> = {};
    if (plan) for (const entry of plan.entries) map[entry.outputId] = workspace.nodes[entry.outputId]?.name ?? '';
    return map;
  }, [plan, workspace]);

  const close = useCallback(() => {
    setScope(null);
    setProgress(null);
    setExported(new Set());
  }, []);

  const runDeps = useMemo(
    () => ({
      assembler: services.assembler,
      readBytes: services.readBytesForSource,
      sourceKind: (id: string) => workspace.sources[id]?.kind ?? 'pdf',
      imageData: services.imageEmbeddable,
      textData: services.textPages,
      fontBytes: services.fontBytes,
    }),
    [services, workspace],
  );

  const pickDirectory = () =>
    (globalThis as unknown as { showDirectoryPicker(): Promise<DirectoryHandleLike> }).showDirectoryPicker();

  const onExport = useCallback(
    async (target: 'directory' | 'zip') => {
      if (!scope) return;
      // Bereits einzeln gespeicherte Dokumente hier ueberspringen.
      const current = omitExportedEntries(buildExportPlan(workspace, scope), exported);
      if (current.entries.length === 0) return;
      const controller = new AbortController();
      abort.current = controller;
      setProgress({ done: 0, total: current.entries.length, currentName: '' });
      try {
        const writer =
          target === 'zip'
            ? createZipWriter(`${workspace.name}.zip`)
            : createFsAccessWriter(await pickDirectory());
        const artifact = await runExport(current, writer, {
          ...runDeps,
          onProgress: setProgress,
          signal: controller.signal,
        });
        if (artifact.kind === 'zip') download(artifact.blob, artifact.fileName);
        close();
      } catch (error) {
        console.error('Export fehlgeschlagen oder abgebrochen', error);
        setProgress(null);
      }
    },
    [workspace, scope, exported, runDeps, close],
  );

  // Ein einzelnes Dokument an einen frei gewaehlten Ordner schreiben. Danach ist
  // es aus dem Sammel-Export ausgeklammert -- so lassen sich verschiedene
  // Dokumente in einer Session an verschiedene Orte speichern.
  const onExportEntry = useCallback(
    async (outputId: NodeId) => {
      const single = buildExportPlan(workspace, { kind: 'node', nodeId: outputId });
      if (single.entries.length === 0) return;
      let directory: DirectoryHandleLike;
      try {
        directory = await pickDirectory();
      } catch {
        return; // Auswahl abgebrochen -- kein Fehler.
      }
      const controller = new AbortController();
      abort.current = controller;
      setProgress({ done: 0, total: single.entries.length, currentName: '' });
      try {
        await runExport(single, createFsAccessWriter(directory), {
          ...runDeps,
          onProgress: setProgress,
          signal: controller.signal,
        });
        setExported((prev) => new Set(prev).add(outputId));
      } catch (error) {
        console.error('Einzel-Export fehlgeschlagen oder abgebrochen', error);
      } finally {
        setProgress(null);
      }
    },
    [workspace, runDeps],
  );

  return {
    open: (next: ExportScope = { kind: 'workspace' }) => setScope(next),
    dialog: plan ? (
      <ExportDialog
        plan={plan}
        names={names}
        warnings={analyzeExport(plan)}
        canWriteDirectory={canWriteDirectory}
        progress={progress}
        exportedIds={exported}
        onRename={(outputId, name) => dispatch({ type: 'renameNode', nodeId: outputId, name })}
        onExport={(target) => void onExport(target)}
        onExportEntry={(outputId) => void onExportEntry(outputId)}
        onCancel={() => abort.current?.abort()}
        onClose={close}
      />
    ) : null,
  };
}
