import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { BlockRef, NodeId, SourceId } from '../../domain/types';
import { createPageTextStore } from '../../services/search/pageTextStore';
import { createSearchService } from '../../services/search/searchService';
import { targetsForScope, type SearchScopeKind } from '../../services/search/searchScope';
import { createWorkerExtractor } from '../../services/search/workerExtractor';
import { useServices, useWorkspace } from '../app/StoreProvider';
import { SearchPanel } from './SearchPanel';

export function useSearch(active: { sourceId: SourceId | null; outputId: NodeId | null }): {
  open(): void;
  panel: ReactNode;
  jumpTarget: BlockRef | null;
  clearJump(): void;
} {
  const services = useServices();
  const workspace = useWorkspace();
  const [visible, setVisible] = useState(false);
  const [jumpTarget, setJumpTarget] = useState<BlockRef | null>(null);
  const serviceRef = useRef<ReturnType<typeof createSearchService> | null>(null);

  // Der Worker wird erst beim ersten Suchlauf erzeugt -- App-Tests, die nie
  // suchen, brauchen so keinen Worker.
  const getService = useCallback(() => {
    if (!serviceRef.current) {
      const worker = new Worker(new URL('../../workers/pdfText.worker.ts', import.meta.url), { type: 'module' });
      serviceRef.current = createSearchService({
        store: createPageTextStore(services.db),
        extractUncached: createWorkerExtractor({ worker, readBytes: services.readBytesForSource }),
      });
    }
    return serviceRef.current;
  }, [services]);

  const runSearch = useCallback(
    (query: string, kind: SearchScopeKind) =>
      getService().search(query, targetsForScope(workspace, kind, active.sourceId, active.outputId)),
    [getService, workspace, active.sourceId, active.outputId],
  );

  return {
    open: () => setVisible(true),
    jumpTarget,
    clearJump: () => setJumpTarget(null),
    panel: visible ? (
      <SearchPanel
        runSearch={runSearch}
        onJump={(sourceId, blockIndex) => setJumpTarget({ sourceId, blockIndex })}
        onClose={() => setVisible(false)}
      />
    ) : null,
  };
}
