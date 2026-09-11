import { useMemo } from 'react';
import { isOutput, type BlockRef, type NodeId, type SourceId } from '../../domain/types';
import { useWorkspace } from '../app/StoreProvider';
import type { DragOrigin } from '../workspace/dragLogic';
import { Viewer, type ViewerPage } from './Viewer';

/** Was die Vorschau gerade zeigt -- gezielt gesetzt, unabhaengig von den Mittelpanels. */
export type PreviewTarget = { kind: 'source'; id: SourceId } | { kind: 'output'; id: NodeId };

export interface PreviewPaneProps {
  target: PreviewTarget | null;
  onJumpToSource(ref: BlockRef): void;
  /** Startet einen Seiten-Drag direkt aus dem Betrachter (dieselbe Pipeline wie im Raster). */
  onPagePointerDown?(event: React.PointerEvent, origin: DragOrigin): void;
}

export function PreviewPane({ target, onJumpToSource, onPagePointerDown }: PreviewPaneProps) {
  const workspace = useWorkspace();

  const pages = useMemo<ViewerPage[]>(() => {
    if (target?.kind === 'output') {
      const output = workspace.nodes[target.id];
      if (!output || !isOutput(output)) return [];
      return output.items
        .map((itemId) => ({ itemId, item: workspace.items[itemId] }))
        .filter((entry) => entry.item !== undefined)
        .map(({ itemId, item }) => ({
          ref: { sourceId: item.sourceId, blockIndex: item.blockIndex },
          rotation: item.rotation,
          sourceName: workspace.sources[item.sourceId]?.name ?? 'Quelle',
          pageNumber: item.blockIndex + 1,
          // Eine Ausgabeseite wird beim Ziehen zwischen Dokumenten verschoben/kopiert.
          dragOrigin: { kind: 'output', outputId: target.id, itemIds: [itemId] },
        }));
    }
    if (target?.kind === 'source') {
      const source = workspace.sources[target.id];
      if (!source) return [];
      return Array.from({ length: source.blockCount }, (_, blockIndex) => ({
        ref: { sourceId: source.id, blockIndex },
        rotation: 0 as const,
        sourceName: source.name,
        pageNumber: blockIndex + 1,
        // Eine Quellseite verhaelt sich wie im Quellraster (Ordner -> neues Dokument usw.).
        dragOrigin: { kind: 'source', sourceId: source.id, blockIndices: [blockIndex] },
      }));
    }
    return [];
  }, [workspace, target]);

  return (
    <Viewer
      pages={pages}
      onJumpToSource={onJumpToSource}
      onPagePointerDown={onPagePointerDown}
      emptyLabel="Wähle eine Quelle oder ein Dokument für die Vorschau."
    />
  );
}
