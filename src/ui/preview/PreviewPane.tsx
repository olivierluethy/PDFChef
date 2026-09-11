import { useEffect, useMemo, useState } from 'react';
import { isOutput, type BlockRef, type NodeId, type SourceId } from '../../domain/types';
import { useDispatch, useWorkspace } from '../app/StoreProvider';
import { ensureFontFaces, loadFontCatalog, type FontManifestEntry } from '../text/fontCatalog';
import { Viewer, type ViewerPage } from './Viewer';

export interface PreviewPaneProps {
  activeSourceId: SourceId | null;
  activeOutputId: NodeId | null;
  onJumpToSource(ref: BlockRef): void;
}

export function PreviewPane({ activeSourceId, activeOutputId, onJumpToSource }: PreviewPaneProps) {
  const workspace = useWorkspace();
  const dispatch = useDispatch();
  const [fontEntries, setFontEntries] = useState<FontManifestEntry[]>([]);

  // Fonts einmalig laden und ihre @font-face-Regeln injizieren -- damit die
  // Vorschau exakt so aussieht wie der spaetere Export.
  useEffect(() => {
    let active = true;
    loadFontCatalog().then((entries) => {
      if (active) setFontEntries(entries);
    });
    void ensureFontFaces();
    return () => {
      active = false;
    };
  }, []);

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
          itemId: item.id,
          annotations: item.annotations,
        }));
    }
    const source = activeSourceId ? workspace.sources[activeSourceId] : undefined;
    if (source) {
      // Quellseiten sind unveraenderlich -- hier keine Annotationen (nur Anzeige).
      return Array.from({ length: source.blockCount }, (_, blockIndex) => ({
        ref: { sourceId: source.id, blockIndex },
        rotation: 0 as const,
        provenance: `${source.name} . Seite ${blockIndex + 1}`,
      }));
    }
    return [];
  }, [workspace, activeSourceId, activeOutputId]);

  return (
    <Viewer
      pages={pages}
      onJumpToSource={onJumpToSource}
      emptyLabel="Waehlen Sie eine Quelle oder ein Dokument fuer die Vorschau."
      fontEntries={fontEntries}
      onAnnotationAdd={(itemId, annotation) => dispatch({ type: 'addAnnotation', itemId, annotation })}
      onAnnotationChange={(itemId, annotationId, patch) => dispatch({ type: 'updateAnnotation', itemId, annotationId, patch })}
      onAnnotationRemove={(itemId, annotationId) => dispatch({ type: 'removeAnnotation', itemId, annotationId })}
    />
  );
}
