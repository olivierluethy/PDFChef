import { useCallback, useRef, useState, type ReactNode } from 'react';
import { buildExportPlan, type ExportPlan } from '../../domain/exportPlan';
import { analyzeExport } from '../../domain/exportWarnings';
import type { DirectoryHandleLike } from '../../services/export/fsAccessWriter';
import { createFsAccessWriter } from '../../services/export/fsAccessWriter';
import { createZipWriter } from '../../services/export/zipWriter';
import { runExport, type ExportProgress } from '../../services/export/exportRunner';
import { useServices, useWorkspace } from '../app/StoreProvider';
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

export function useExport(): { open(): void; dialog: ReactNode } {
  const services = useServices();
  const workspace = useWorkspace();
  const [plan, setPlan] = useState<ExportPlan | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const abort = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    setPlan(null);
    setProgress(null);
  }, []);

  const onExport = useCallback(
    async (target: 'directory' | 'zip') => {
      const current = buildExportPlan(workspace);
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
    [services, workspace, close],
  );

  return {
    open: () => setPlan(buildExportPlan(workspace)),
    dialog: plan ? (
      <ExportDialog
        plan={plan}
        warnings={analyzeExport(plan)}
        canWriteDirectory={canWriteDirectory}
        progress={progress}
        onExport={(target) => void onExport(target)}
        onCancel={() => abort.current?.abort()}
        onClose={close}
      />
    ) : null,
  };
}
