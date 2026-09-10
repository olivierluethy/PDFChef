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

export function SplitPanel({ sourceId, parentId, onClose }: SplitPanelProps) {
  const workspace = useWorkspace();
  const selection = useSelection();
  const dispatch = useDispatch();
  const services = useServices();
  const source = workspace.sources[sourceId];
  const blockCount = source?.blockCount ?? 0;

  const [choice, setChoice] = useState<StrategyChoice>('equalHalves');
  const [everyN, setEveryN] = useState(10);
  const [custom, setCustom] = useState('');
  const [detectedParts, setDetectedParts] = useState<SplitPart[] | null>(null);
  const [detecting, setDetecting] = useState<{ done: number; total: number } | null>(null);

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
        const indices = selection.scope?.kind === 'source' && selection.scope.sourceId === sourceId
          ? selection.ids.map(Number)
          : [];
        return { kind: 'selection', indices };
      }
      case 'blankSeparators':
        // Wird fuer diese Strategie nicht zur Vorschau genutzt (siehe detectedParts unten).
        return { kind: 'selection', indices: [] };
    }
  }, [choice, everyN, custom, selection, sourceId]);

  const plan = planSplit(strategy, blockCount);

  function handleChoiceChange(next: StrategyChoice) {
    setChoice(next);
    if (next !== 'blankSeparators') {
      setDetectedParts(null);
      setDetecting(null);
    }
  }

  async function runDetection() {
    setDetecting({ done: 0, total: blockCount });
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
    const parts = choice === 'blankSeparators' ? detectedParts : plan.ok ? plan.parts : null;
    if (!parts || parts.length === 0) return;
    dispatch(buildSplitCommand({ sourceId, sourceName: source?.name ?? 'Dokument', parentId, parts, newId }));
    onClose();
  }

  const canApply = choice === 'blankSeparators' ? !!detectedParts && detectedParts.length > 0 : plan.ok;
  const applyLabel =
    choice === 'blankSeparators'
      ? detectedParts
        ? `${detectedParts.length} Dokumente erstellen`
        : 'Dokumente erstellen'
      : plan.ok
        ? `${plan.parts.length} Dokumente erstellen`
        : 'Dokumente erstellen';

  return (
    <div className="flex flex-col gap-3 border-t border-line bg-panel p-4" role="dialog" aria-label="Dokument aufteilen">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{source?.name} aufteilen</h2>
        <select
          value={choice}
          onChange={(e) => handleChoiceChange(e.target.value as StrategyChoice)}
          className="rounded border border-line bg-shell px-2 py-1 text-sm"
          aria-label="Strategie"
        >
          <option value="equalHalves">Gleiche Haelften</option>
          <option value="equalThirds">Gleiche Drittel</option>
          <option value="everyN">Alle N Seiten</option>
          <option value="custom">Eigene Bereiche</option>
          <option value="selection">Aktuelle Selektion</option>
          <option value="blankSeparators">An leeren Trennseiten</option>
        </select>
      </div>

      {choice === 'everyN' && (
        <label className="text-sm">
          Seiten pro Teil:{' '}
          <input
            type="number"
            min={1}
            value={everyN}
            onChange={(e) => setEveryN(Number(e.target.value))}
            className="w-20 rounded border border-line bg-shell px-2 py-1"
          />
        </label>
      )}
      {choice === 'custom' && (
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="z. B. 1-51,52-101"
          className="rounded border border-line bg-shell px-2 py-1 font-mono text-sm"
          aria-label="Eigene Bereiche"
        />
      )}

      {choice === 'blankSeparators' && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={runDetection}
            disabled={!!detecting || blockCount === 0}
            className="self-start rounded border border-line px-3 py-1 text-sm hover:bg-shell disabled:opacity-50"
          >
            Trennseiten erkennen
          </button>
          {detecting && (
            <p className="text-sm text-neutral-400">
              Seite {detecting.done} von {detecting.total} geprueft
            </p>
          )}
          {!detecting && detectedParts && detectedParts.length === 1 && (
            <p className="text-sm text-amber-400">Keine Trennseiten gefunden.</p>
          )}
        </div>
      )}

      <div className="max-h-48 overflow-auto rounded border border-line">
        {choice === 'blankSeparators' ? (
          detectedParts ? (
            <ul className="divide-y divide-line text-sm">
              {detectedParts.map((part, index) => (
                <li key={index} className="flex justify-between px-3 py-1">
                  <span>{part.label}</span>
                  <span className="text-neutral-400">{describeSplitPart(part)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-neutral-400">
              Noch keine Erkennung ausgefuehrt.
            </p>
          )
        ) : plan.ok ? (
          <ul className="divide-y divide-line text-sm">
            {plan.parts.map((part, index) => (
              <li key={index} className="flex justify-between px-3 py-1">
                <span>{part.label}</span>
                <span className="text-neutral-400">{describeSplitPart(part)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-2 text-sm text-amber-400">{plan.error}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded px-3 py-1 text-sm hover:bg-shell">
          Abbrechen
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!canApply}
          className="rounded bg-sky-600 px-3 py-1 text-sm disabled:opacity-50"
        >
          {applyLabel}
        </button>
      </div>
    </div>
  );
}
