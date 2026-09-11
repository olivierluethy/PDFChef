import { useMemo } from 'react';
import {
  isOutput,
  type BlockRef,
  type ItemId,
  type NodeId,
  type Overlay,
  type SourceId,
} from '../../domain/types';
import { newId } from '../../domain/ids';
import type { DetectedField } from '../../adapters/types';
import { useDispatch, useServices, useWorkspace } from '../app/StoreProvider';
import type { DragOrigin } from '../workspace/dragLogic';
import { Viewer, type ViewerPage } from './Viewer';

/** Was die Vorschau gerade zeigt -- gezielt gesetzt, unabhaengig von den Mittelpanels. */
export type PreviewTarget = { kind: 'source'; id: SourceId } | { kind: 'output'; id: NodeId };

/** Ein erkanntes Formularfeld wird zu einem vorplatzierten Overlay. */
function fieldToOverlay(field: DetectedField): Overlay {
  const base: Overlay = {
    id: newId(),
    kind: 'text',
    x: field.x,
    y: field.y,
    w: field.w,
    h: field.h,
    text: '',
    // Schrift ungefaehr auf Feldhoehe, damit der Wert ins Feld passt.
    fontSize: Math.min(0.05, Math.max(0.012, field.h * 0.6)),
  };
  if (field.kind === 'select') {
    return {
      ...base,
      options: field.options && field.options.length > 0 ? ['', ...field.options] : [''],
    };
  }
  if (field.kind === 'checkbox') {
    return { ...base, options: ['', 'X'] };
  }
  return base;
}

export interface PreviewPaneProps {
  target: PreviewTarget | null;
  onJumpToSource(ref: BlockRef): void;
  /** Startet einen Seiten-Drag direkt aus dem Betrachter (dieselbe Pipeline wie im Raster). */
  onPagePointerDown?(event: React.PointerEvent, origin: DragOrigin): void;
}

export function PreviewPane({ target, onJumpToSource, onPagePointerDown }: PreviewPaneProps) {
  const workspace = useWorkspace();
  const dispatch = useDispatch();
  const services = useServices();

  const detectFields = async (itemId: ItemId) => {
    const item = workspace.items[itemId];
    if (!item) return;
    const fields = await services.detectFields(item.sourceId, item.blockIndex);
    if (fields.length === 0) return;
    // Ein Batch, damit die Erkennung als ein einziger Undo-Schritt zaehlt.
    dispatch({
      type: 'batch',
      label: 'Formularfelder erkannt',
      commands: fields.map((field) => ({
        type: 'addOverlay',
        itemId,
        overlay: fieldToOverlay(field),
      })),
    });
  };

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
          itemId,
          overlays: item.overlays ?? [],
          // Ausfuellen nur auf ungedrehten Seiten -- dort sind die Koordinaten eindeutig.
          fillable: item.rotation === 0,
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
      onAddOverlay={(itemId, overlay) => dispatch({ type: 'addOverlay', itemId, overlay })}
      onUpdateOverlay={(itemId, overlayId, patch) =>
        dispatch({ type: 'updateOverlay', itemId, overlayId, patch })
      }
      onRemoveOverlay={(itemId, overlayId) =>
        dispatch({ type: 'removeOverlay', itemId, overlayId })
      }
      onDetectFields={(itemId) => void detectFields(itemId)}
      emptyLabel="Wähle eine Quelle oder ein Dokument für die Vorschau."
    />
  );
}
