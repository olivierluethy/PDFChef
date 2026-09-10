import { useMemo } from 'react';
import { isOutput, type BlockRef, type NodeId, type SourceId } from '../../domain/types';
import { useWorkspace } from '../app/StoreProvider';
import { Viewer, type ViewerPage } from './Viewer';

export interface PreviewPaneProps {
  activeSourceId: SourceId | null;
  activeOutputId: NodeId | null;
  onJumpToSource(ref: BlockRef): void;
}

export function PreviewPane({ activeSourceId, activeOutputId, onJumpToSource }: PreviewPaneProps) {
  const workspace = useWorkspace();

  const pages = useMemo<ViewerPage[]>(() => {
    // Ein aktives Output geht vor: sein Preview ist der eigentliche Zweck.
    const output = activeOutputId ? workspace.nodes[activeOutputId] : undefined;
    if (output && isOutput(output)) {
      return output.items
        .map((itemId) => workspace.items[itemId])
        .filter((item) => item !== undefined)
        .map((item) => ({
          ref: { sourceId: item.sourceId, blockIndex: item.blockIndex },
          rotation: item.rotation,
          provenance: `${workspace.sources[item.sourceId]?.name ?? 'Quelle'} . Seite ${item.blockIndex + 1}`,
        }));
    }
    const source = activeSourceId ? workspace.sources[activeSourceId] : undefined;
    if (source) {
      return Array.from({ length: source.blockCount }, (_, blockIndex) => ({
        ref: { sourceId: source.id, blockIndex },
        rotation: 0 as const,
        provenance: `${source.name} . Seite ${blockIndex + 1}`,
      }));
    }
    return [];
  }, [workspace, activeSourceId, activeOutputId]);

  return <Viewer pages={pages} onJumpToSource={onJumpToSource} emptyLabel="Waehlen Sie eine Quelle oder ein Dokument fuer die Vorschau." />;
}
