import { useMemo, useState } from 'react';
import { newId } from '../../domain/ids';
import { groupNonBlank } from '../../domain/scanSplit';
import { describeSplitPart, planSplit, type SplitPart, type SplitStrategy } from '../../domain/split';
import type { NodeId, SourceId } from '../../domain/types';
import { useDispatch, useSelection, useServices, useWorkspace } from '../app/StoreProvider';
import { useT } from '../i18n';
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
  const t = useT();
  const source = workspace.sources[sourceId];
  const blockCount = source?.blockCount ?? 0;
  const base = baseName(source?.name ?? t('workspace.split.documentFallback'));

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
      setDetectedParts(
        segments.map((indices, index) => ({
          label: t('workspace.split.detectedPart', { n: index + 1 }),
          indices,
        })),
      );
    } finally {
      setDetecting(null);
    }
  }

  function apply() {
    if (!previewParts || previewParts.length === 0) return;
    const named = previewParts.map((part, index) => ({ ...part, label: partName(index) }));
    dispatch(buildSplitCommand({ sourceId, sourceName: source?.name ?? t('workspace.split.documentFallback'), parentId, parts: named, newId }));
    onClose();
  }

  const canApply = !!previewParts && previewParts.length > 0;
  const applyLabel = canApply
    ? previewParts.length === 1
      ? t('workspace.split.createOne', { n: previewParts.length })
      : t('workspace.split.createMany', { n: previewParts.length })
    : t('workspace.split.createDefault');

  const field = 'rounded border border-line bg-shell px-2 py-1 text-sm focus:border-accent';

  return (
    <div className="flex flex-col gap-3 border-t border-line bg-panel p-4" role="dialog" aria-label={t('workspace.split.dialogLabel')}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{t('workspace.split.heading', { name: source?.name ?? '' })}</h2>
        <select
          value={choice}
          onChange={(e) => handleChoiceChange(e.target.value as StrategyChoice)}
          className={field}
          aria-label={t('workspace.split.strategyLabel')}
        >
          <option value="equalHalves">{t('workspace.split.equalHalves')}</option>
          <option value="equalThirds">{t('workspace.split.equalThirds')}</option>
          <option value="everyN">{t('workspace.split.everyN')}</option>
          <option value="custom">{t('workspace.split.custom')}</option>
          <option value="selection">{t('workspace.split.selection')}</option>
          <option value="blankSeparators">{t('workspace.split.blankSeparators')}</option>
        </select>
      </div>

      {choice === 'everyN' && (
        <label className="text-sm text-muted">
          {t('workspace.split.pagesPerPart')}{' '}
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
          placeholder={t('workspace.split.customPlaceholder')}
          className={`font-mono ${field}`}
          aria-label={t('workspace.split.custom')}
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
            {t('workspace.split.detectSeparators')}
          </button>
          {detecting && (
            <p className="tabular text-sm text-muted">
              {t('workspace.split.detectionProgress', { done: detecting.done, total: detecting.total })}
            </p>
          )}
          {!detecting && detectedParts && detectedParts.length === 1 && (
            <p className="text-sm text-text-secondary">{t('workspace.split.noSeparatorsFound')}</p>
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
                    aria-label={t('workspace.split.partNameLabel', { n: index + 1 })}
                    className={`min-w-0 flex-1 ${field}`}
                  />
                  <span className="tabular shrink-0 text-xs text-muted">{describeSplitPart(part)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-muted">{t('workspace.split.noParts')}</p>
          )
        ) : choice === 'blankSeparators' ? (
          <p className="px-3 py-2 text-sm text-muted">{t('workspace.split.noDetectionYet')}</p>
        ) : (
          <p className="px-3 py-2 text-sm text-danger">{plan.ok ? '' : plan.error}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded px-3 py-1 text-sm hover:bg-raised">
          {t('workspace.split.cancel')}
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
