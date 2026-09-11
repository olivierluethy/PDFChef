import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildExportPlan, type ExportScope } from '../../domain/exportPlan';
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
  }, []);

  const onExport = useCallback(
    async (target: 'directory' | 'zip') => {
      if (!scope) return;
      const current = buildExportPlan(workspace, scope);
      if (current.entries.length === 0) return;
      const controller = new AbortController();
      abort.current = controller;
      setProgress({ done: 0, total: current.entries.length, currentName: '' });
      try {
        const writer =
          target === 'zip'
            ? createZipWriter(`${workspace.name}.zip`)
            : createFsAccessWriter(
                await (
                  globalThis as unknown as { showDirectoryPicker(): Promise<DirectoryHandleLike> }
                ).showDirectoryPicker(),
              );
        const artifact = await runExport(current, writer, {
          assembler: services.assembler,
          readBytes: services.readBytesForSource,
          sourceKind: (id) => workspace.sources[id]?.kind ?? 'pdf',
          imageData: services.imageEmbeddable,
          textData: services.textPages,
          annotationImageBytes: services.annotationImageBytes,
          fontBytes: services.fontBytes,
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
    [services, workspace, scope, close],
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
        onRename={(outputId, name) => dispatch({ type: 'renameNode', nodeId: outputId, name })}
        onExport={(target) => void onExport(target)}
        onCancel={() => abort.current?.abort()}
        onClose={close}
      />
    ) : null,
  };
}
