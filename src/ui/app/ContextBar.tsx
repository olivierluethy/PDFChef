import { FilePlus2, RotateCw, Scissors, Trash2 } from 'lucide-react';
import { newId } from '../../domain/ids';
import type { CompositionItem } from '../../domain/types';
import { useDispatch, useSelection } from './StoreProvider';

export interface ContextBarProps {
  onRequestSplit(): void;
}

export function ContextBar({ onRequestSplit }: ContextBarProps) {
  const selection = useSelection();
  const dispatch = useDispatch();
  const count = selection.ids.length;
  const scope = selection.scope;
  const inOutput = scope?.kind === 'output';
  const inSource = scope?.kind === 'source';

  if (count === 0) {
    return (
      <div className="flex h-11 items-center gap-4 border-t border-line bg-panel px-4 text-sm text-muted">
        Nichts ausgewaehlt &middot; Seiten anklicken oder mit der Maus aufziehen
      </div>
    );
  }

  function newDocumentFromSelection() {
    if (!inSource || scope?.kind !== 'source') return;
    const outputId = newId();
    const items: CompositionItem[] = selection.ids.map((id) => ({
      id: newId(),
      sourceId: scope.sourceId,
      blockIndex: Number(id),
      rotation: 0,
    }));
    dispatch({
      type: 'batch',
      label: `${count} Seiten in ein neues Dokument`,
      commands: [
        { type: 'createOutput', node: { id: outputId, name: 'Neues Dokument', parentId: null } },
        { type: 'addItems', outputId, index: 0, items },
      ],
    });
  }

  const secondary = 'flex items-center gap-1.5 rounded px-2.5 py-1 hover:bg-raised disabled:opacity-40';

  return (
    <div className="flex h-11 items-center gap-2 border-t border-line bg-panel px-4 text-sm">
      <span className="tabular mr-2 font-medium text-ink">{count} ausgewaehlt</span>

      {inSource && (
        <button
          type="button"
          onClick={newDocumentFromSelection}
          className="flex items-center gap-1.5 rounded bg-accent px-2.5 py-1 font-medium text-shell hover:brightness-110"
        >
          <FilePlus2 className="size-4" aria-hidden /> Neues Dokument aus Auswahl
        </button>
      )}

      <button
        type="button"
        disabled={!inOutput}
        onClick={() => inOutput && dispatch({ type: 'rotateItems', itemIds: selection.ids, delta: 90 })}
        className={secondary}
      >
        <RotateCw className="size-4" aria-hidden /> Drehen
      </button>
      <button
        type="button"
        disabled={!inOutput}
        onClick={() => inOutput && dispatch({ type: 'removeItems', itemIds: selection.ids })}
        className={secondary}
      >
        <Trash2 className="size-4" aria-hidden /> Entfernen
      </button>
      <button type="button" onClick={onRequestSplit} className={secondary}>
        <Scissors className="size-4" aria-hidden /> Aufteilen
      </button>
    </div>
  );
}
