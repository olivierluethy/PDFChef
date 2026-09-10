import { useMemo, useState } from 'react';
import { newId } from '../../domain/ids';
import { groupNonBlank } from '../../domain/scanSplit';
import { describeSplitPart, planSplit, type SplitPart, type SplitStrategy } from '../../domain/split';
import type { NodeId, SourceId } from '../../domain/types';
import { useDispatch, useSelection, useServices, useWorkspace } from '../app/StoreProvider';
import { buildSplitCommand } from './buildSplitCommand';
import { detectBlankPages } from './detectBlankPages';

export interface SplitPanelProps {
  sourceId: SourceId;
  parentId: NodeId | null;
  onClose(): void;
}

type StrategyChoice = 'equalHalves' | 'equalThirds' | 'everyN' | 'custom' | 'selection' | 'blankSeparators';

function baseName(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

export function SplitPanel({ sourceId, parentId, onClose }: SplitPanelProps) {
  const workspace = useWorkspace();
  const selection = useSelection();
  const dispatch = useDispatch();
  const services = useServices();
  const source = workspace.sources[sourceId];
  const blockCount = source?.blockCount ?? 0;
  const base = baseName(source?.name ?? 'Dokument');

  const [choice, setChoice] = useState<StrategyChoice>('equalHalves');
  const [everyN, setEveryN] = useState(10);
  const [custom, setCustom] = useState('');
  const [detectedParts, setDetectedParts] = useState<SplitPart[] | null>(null);
  const [detecting, setDetecting] = useState<{ done: number; total: number } | null>(null);
  // Selbst vergebene Part-Namen, per Index; leer = Standardname "Name 1".
  const [names, setNames] = useState<Record<number, string>>({});

  const strategy = useMemo<SplitStrategy>(() => {
    switch (choice) {
      case 'equalHalves':
        return { kind: 'equalParts', parts: 2 };
      case 'equalThirds':
        return { kind: 'equalParts', parts: 3 };
      case 'everyN':
        return { kind: 'everyNBlocks', size: everyN };
      case 'custom':
        return { kind: 'customRanges', input: custom };
      case 'selection': {
        const indices =
          selection.scope?.kind === 'source' && selection.scope.sourceId === sourceId
            ? selection.ids.map(Number)
            : [];
        return { kind: 'selection', indices };
      }
      case 'blankSeparators':
        return { kind: 'selection', indices: [] };
    }
  }, [choice, everyN, custom, selection, sourceId]);

  const plan = planSplit(strategy, blockCount);
  const previewParts = choice === 'blankSeparators' ? detectedParts : plan.ok ? plan.parts : null;
  const partName = (index: number) => names[index] ?? `${base} ${index + 1}`;

  function handleChoiceChange(next: StrategyChoice) {
    setChoice(next);
    setNames({});
    if (next !== 'blankSeparators') {
      setDetectedParts(null);
      setDetecting(null);
    }
  }

  async function runDetection() {
    setDetecting({ done: 0, total: blockCount });
    setNames({});
    try {
      const blank = await detectBlankPages(services.adapter, sourceId, blockCount, {
        onProgress: (done, total) => setDetecting({ done, total }),
      });
      const segments = groupNonBlank(blockCount, blank);
      setDetectedParts(segments.map((indices, index) => ({ label: `Teil ${index + 1}`, indices })));
    } finally {
      setDetecting(null);
    }
  }

  function apply() {
    if (!previewParts || previewParts.length === 0) return;
    const named = previewParts.map((part, index) => ({ ...part, label: partName(index) }));
    dispatch(buildSplitCommand({ sourceId, sourceName: source?.name ?? 'Dokument', parentId, parts: named, newId }));
    onClose();
  }

  const canApply = !!previewParts && previewParts.length > 0;
  const applyLabel = canApply
    ? `${previewParts.length} ${previewParts.length === 1 ? 'Dokument' : 'Dokumente'} erstellen`
    : 'Dokumente erstellen';

  const field = 'rounded border border-line bg-shell px-2 py-1 text-sm focus:border-accent';

  return (
    <div className="flex flex-col gap-3 border-t border-line bg-panel p-4" role="dialog" aria-label="Dokument aufteilen">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{source?.name} aufteilen</h2>
        <select
          value={choice}
          onChange={(e) => handleChoiceChange(e.target.value as StrategyChoice)}
          className={field}
          aria-label="Strategie"
        >
          <option value="equalHalves">Gleiche Haelften</option>
          <option value="equalThirds">Gleiche Drittel</option>
          <option value="everyN">Alle N Seiten</option>
          <option value="custom">Eigene Bereiche</option>
          <option value="selection">Aktuelle Auswahl</option>
          <option value="blankSeparators">An leeren Trennseiten</option>
        </select>
      </div>

      {choice === 'everyN' && (
        <label className="text-sm text-muted">
          Seiten pro Teil:{' '}
          <input
            type="number"
            min={1}
            value={everyN}
            onChange={(e) => setEveryN(Number(e.target.value))}
            className={`tabular w-20 ${field}`}
          />
        </label>
      )}
      {choice === 'custom' && (
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="z. B. 1-51,52-101"
          className={`font-mono ${field}`}
          aria-label="Eigene Bereiche"
        />
      )}
      {choice === 'blankSeparators' && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={runDetection}
            disabled={!!detecting || blockCount === 0}
            className="self-start rounded border border-line px-3 py-1 text-sm hover:bg-raised disabled:opacity-50"
          >
            Trennseiten erkennen
          </button>
          {detecting && (
            <p className="tabular text-sm text-muted">
              Seite {detecting.done} von {detecting.total} geprueft
            </p>
          )}
          {!detecting && detectedParts && detectedParts.length === 1 && (
            <p className="text-sm text-accent">Keine Trennseiten gefunden.</p>
          )}
        </div>
      )}

      <div className="max-h-56 overflow-auto rounded border border-line">
        {previewParts ? (
          previewParts.length > 0 ? (
            <ul className="divide-y divide-line">
              {previewParts.map((part, index) => (
                <li key={index} className="flex items-center gap-2 px-3 py-1.5">
                  <input
                    value={partName(index)}
                    onChange={(e) => setNames((prev) => ({ ...prev, [index]: e.target.value }))}
                    aria-label={`Name fuer Teil ${index + 1}`}
                    className={`min-w-0 flex-1 ${field}`}
                  />
                  <span className="tabular shrink-0 text-xs text-muted">{describeSplitPart(part)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-muted">Keine Teile.</p>
          )
        ) : choice === 'blankSeparators' ? (
          <p className="px-3 py-2 text-sm text-muted">Noch keine Erkennung ausgefuehrt.</p>
        ) : (
          <p className="px-3 py-2 text-sm text-accent">{plan.ok ? '' : plan.error}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded px-3 py-1 text-sm hover:bg-raised">
          Abbrechen
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!canApply}
          className="rounded bg-accent px-3 py-1 text-sm font-medium text-shell hover:brightness-110 disabled:opacity-50"
        >
          {applyLabel}
        </button>
      </div>
    </div>
  );
}
