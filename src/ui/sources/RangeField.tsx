import { useEffect, useId, useRef, useState } from 'react';
import { formatRanges, parseRanges, rangesToIndices } from '../../domain/ranges';
import type { SourceId } from '../../domain/types';
import { useSelection, useSelectionStore } from '../app/StoreProvider';

export interface RangeFieldProps {
  sourceId: SourceId;
  blockCount: number;
}

export function RangeField({ sourceId, blockCount }: RangeFieldProps) {
  const selectionStore = useSelectionStore();
  const selection = useSelection();
  const inputId = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const editing = useRef(false);

  // Wenn die Selektion von aussen kommt (Klick im Raster, Undo), spiegelt das
  // Feld sie -- aber nicht, waehrend der Nutzer gerade tippt.
  useEffect(() => {
    if (editing.current) return;
    const inScope = selection.scope?.kind === 'source' && selection.scope.sourceId === sourceId;
    const indices = inScope ? selection.ids.map(Number).sort((a, b) => a - b) : [];
    setText(formatRanges(indices));
    setError(null);
  }, [selection, sourceId]);

  function commit(value: string) {
    setText(value);
    if (value.trim() === '') {
      setError(null);
      selectionStore.getState().replace({ kind: 'source', sourceId }, [], null, false);
      return;
    }
    const parsed = parseRanges(value, blockCount);
    if (!parsed.ok) {
      // Fehler inline, Selektion bleibt unangetastet.
      setError(parsed.error);
      return;
    }
    setError(null);
    const indices = rangesToIndices(parsed.ranges);
    const ids = indices.map(String);
    selectionStore.getState().replace({ kind: 'source', sourceId }, ids, ids[0] ?? null, false);
  }

  const count = selection.scope?.kind === 'source' && selection.scope.sourceId === sourceId
    ? selection.ids.length
    : 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm">
      <label htmlFor={inputId} className="text-neutral-400">
        Seiten
      </label>
      <input
        id={inputId}
        value={text}
        onFocus={() => (editing.current = true)}
        onBlur={() => (editing.current = false)}
        onChange={(event) => commit(event.target.value)}
        placeholder="z. B. 1-3,50-100"
        className="w-48 rounded border border-line bg-panel px-2 py-1 font-mono"
        aria-invalid={error !== null}
      />
      {error ? (
        <span role="status" className="text-amber-400">
          Eingabe ungueltig: {error}
        </span>
      ) : (
        <span role="status" className="text-neutral-400">
          {count === 1 ? '1 Seite ausgewaehlt' : `${count} Seiten ausgewaehlt`}
        </span>
      )}
    </div>
  );
}
