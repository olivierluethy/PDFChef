import { RotateCw, Scissors, Trash2 } from 'lucide-react';
import { useDispatch, useSelection } from './StoreProvider';

export interface ContextBarProps {
  onRequestSplit(): void;
}

export function ContextBar({ onRequestSplit }: ContextBarProps) {
  const selection = useSelection();
  const dispatch = useDispatch();
  const count = selection.ids.length;
  const inOutput = selection.scope?.kind === 'output';

  if (count === 0) {
    return (
      <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-sm text-neutral-500">
        Nichts ausgewaehlt
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-sm">
      <span className="text-neutral-300">{count} ausgewaehlt</span>
      <button
        type="button"
        disabled={!inOutput}
        onClick={() => inOutput && dispatch({ type: 'rotateItems', itemIds: selection.ids, delta: 90 })}
        className="flex items-center gap-1 rounded px-2 py-1 hover:bg-panel disabled:opacity-40"
      >
        <RotateCw className="size-4" aria-hidden /> Drehen
      </button>
      <button
        type="button"
        disabled={!inOutput}
        onClick={() => inOutput && dispatch({ type: 'removeItems', itemIds: selection.ids })}
        className="flex items-center gap-1 rounded px-2 py-1 hover:bg-panel disabled:opacity-40"
      >
        <Trash2 className="size-4" aria-hidden /> Entfernen
      </button>
      <button type="button" onClick={onRequestSplit} className="flex items-center gap-1 rounded px-2 py-1 hover:bg-panel">
        <Scissors className="size-4" aria-hidden /> Split
      </button>
    </div>
  );
}
