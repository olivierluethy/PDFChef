import { useMemo, useState } from 'react';
import { newId } from '../../domain/ids';
import { describeSplitPart, planSplit, type SplitStrategy } from '../../domain/split';
import type { NodeId, SourceId } from '../../domain/types';
import { useDispatch, useSelection, useWorkspace } from '../app/StoreProvider';
import { buildSplitCommand } from './buildSplitCommand';

export interface SplitPanelProps {
  sourceId: SourceId;
  parentId: NodeId | null;
  onClose(): void;
}

type StrategyChoice = 'equalHalves' | 'equalThirds' | 'everyN' | 'custom' | 'selection';

export function SplitPanel({ sourceId, parentId, onClose }: SplitPanelProps) {
  const workspace = useWorkspace();
  const selection = useSelection();
  const dispatch = useDispatch();
  const source = workspace.sources[sourceId];
  const blockCount = source?.blockCount ?? 0;

  const [choice, setChoice] = useState<StrategyChoice>('equalHalves');
  const [everyN, setEveryN] = useState(10);
  const [custom, setCustom] = useState('');

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
    }
  }, [choice, everyN, custom, selection, sourceId]);

  const plan = planSplit(strategy, blockCount);

  function apply() {
    if (!plan.ok) return;
    dispatch(
      buildSplitCommand({ sourceId, sourceName: source?.name ?? 'Dokument', parentId, parts: plan.parts, newId }),
    );
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 border-t border-line bg-panel p-4" role="dialog" aria-label="Dokument aufteilen">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{source?.name} aufteilen</h2>
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value as StrategyChoice)}
          className="rounded border border-line bg-shell px-2 py-1 text-sm"
          aria-label="Strategie"
        >
          <option value="equalHalves">Gleiche Haelften</option>
          <option value="equalThirds">Gleiche Drittel</option>
          <option value="everyN">Alle N Seiten</option>
          <option value="custom">Eigene Bereiche</option>
          <option value="selection">Aktuelle Selektion</option>
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

      <div className="max-h-48 overflow-auto rounded border border-line">
        {plan.ok ? (
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
          disabled={!plan.ok}
          className="rounded bg-sky-600 px-3 py-1 text-sm disabled:opacity-50"
        >
          {plan.ok ? `${plan.parts.length} Dokumente erstellen` : 'Dokumente erstellen'}
        </button>
      </div>
    </div>
  );
}
