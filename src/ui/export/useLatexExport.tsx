import { useCallback, useState } from 'react';
import { buildLatexDocument } from '../../domain/latex';
import type { SourceId } from '../../domain/types';
import { createPageTextStore } from '../../services/search/pageTextStore';
import { useServices, useWorkspace } from '../app/StoreProvider';

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

function texFileName(sourceName: string): string {
  return `${sourceName.replace(/\.[^.]+$/, '')}.tex`;
}

export function useLatexExport(): { runForSource(sourceId: SourceId): Promise<void>; busy: boolean } {
  const services = useServices();
  const workspace = useWorkspace();
  const [busy, setBusy] = useState(false);

  const runForSource = useCallback(
    async (sourceId: SourceId) => {
      const source = workspace.sources[sourceId];
      if (!source) return;

      setBusy(true);
      try {
        let pages: string[];
        if (source.kind === 'text') {
          const pageLines = await services.textPages(sourceId);
          pages = pageLines.map((lines) => lines.join('\n'));
        } else {
          const store = createPageTextStore(services.db);
          pages = [];
          for (let blockIndex = 0; blockIndex < source.blockCount; blockIndex++) {
            const page = await store.get(sourceId, blockIndex);
            pages.push(page?.text ?? '');
          }
        }

        const tex = buildLatexDocument(source.name, pages);
        const blob = new Blob([tex], { type: 'application/x-tex' });
        download(blob, texFileName(source.name));
      } catch (error) {
        console.error('LaTeX-Export fehlgeschlagen', error);
      } finally {
        setBusy(false);
      }
    },
    [services, workspace],
  );

  return { runForSource, busy };
}
