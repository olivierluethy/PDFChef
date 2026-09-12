import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { formatRanges, parseRanges, rangesToIndices } from '../../domain/ranges';
import type { SourceId } from '../../domain/types';
import { useSelection, useSelectionStore } from '../app/StoreProvider';
import { useT } from '../i18n';

export interface RangeFieldProps {
  sourceId: SourceId;
  blockCount: number;
}

/**
 * Das Seiten-Bereichsfeld: eine Mono-Eingabe mit fester Beschriftung, deren
 * geparstes Ergebnis rechts als Chips samt Zaehler erscheint. Ungueltige Eingabe
 * faerbt den Rahmen und meldet inline, ohne die bestehende Auswahl zu zerstoeren.
 */
export function RangeField({ sourceId, blockCount }: RangeFieldProps) {
  const t = useT();
  const selectionStore = useSelectionStore();
  const selection = useSelection();
  const inputId = useId();
  const errorId = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const editing = useRef(false);

  const inScope = selection.scope?.kind === 'source' && selection.scope.sourceId === sourceId;
  const selectedIndices = useMemo(
    () => (inScope ? selection.ids.map(Number).sort((a, b) => a - b) : []),
    [inScope, selection.ids],
  );

  // Feld spiegelt Auswahl von aussen (Klick, Undo) -- aber nicht waehrend des Tippens.
  useEffect(() => {
    if (editing.current) return;
    setText(formatRanges(selectedIndices));
    setError(null);
  }, [selectedIndices]);

  function commit(value: string) {
    setText(value);
    if (value.trim() === '') {
      setError(null);
      selectionStore.getState().replace({ kind: 'source', sourceId }, [], null, false);
      return;
    }
    const parsed = parseRanges(value, blockCount);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    const ids = rangesToIndices(parsed.ranges).map(String);
    selectionStore.getState().replace({ kind: 'source', sourceId }, ids, ids[0] ?? null, false);
  }

  // Chips aus der Auswahl gruppieren; en-dash fuer die Anzeige.
  const chips = selectedIndices.length ? formatRanges(selectedIndices).split(',').map((c) => c.replace('-', '–')) : [];
  const count = selectedIndices.length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor={inputId} className="t-label shrink-0 text-text-secondary">
          {t('sources.rangeField.pagesLabel')}
        </label>
        <input
          id={inputId}
          value={text}
          onFocus={() => (editing.current = true)}
          onBlur={() => (editing.current = false)}
          onChange={(event) => commit(event.target.value)}
          placeholder="1-3, 50-100"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={`h-8 w-[260px] rounded-md bg-surface-canvas px-2.5 font-mono text-[13px] tabular-nums text-text-primary placeholder:text-text-tertiary ring-1 ${
            error ? 'ring-danger' : 'ring-line-structural focus:ring-accent'
          }`}
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {chips.map((chip, i) => (
            <span
              key={i}
              className="rounded bg-surface-canvas px-1.5 py-0.5 font-mono text-[11.5px] tabular-nums text-text-secondary"
            >
              {chip}
            </span>
          ))}
        </div>
        <span className="ml-auto shrink-0 font-mono text-[12.5px] tabular-nums">
          <span className="text-text-primary">{count}</span>
          <span className="text-text-secondary">{t('sources.rangeField.ofCount', { total: blockCount })}</span>
        </span>
      </div>
      {error && (
        <p id={errorId} role="status" className="t-meta mt-2 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
