import { useState } from 'react';
import { Copy, X } from 'lucide-react';
import type { Command } from '../../domain/commands';
import { findDuplicateSourceGroups, removableDuplicateSourceIds } from '../../domain/duplicates';
import { Button } from '../common/Button';
import { useDispatch, useWorkspace } from '../app/StoreProvider';
import { useT } from '../i18n';

export function DuplicatesNotice() {
  const t = useT();
  const workspace = useWorkspace();
  const dispatch = useDispatch();
  const [dismissed, setDismissed] = useState(false);

  const groups = findDuplicateSourceGroups(workspace);
  const removable = removableDuplicateSourceIds(workspace);
  const removableSet = new Set(removable);

  if (groups.length === 0 || dismissed) return null;

  function removeUnusedDuplicates() {
    const commands: Command[] = removable.map((sourceId) => ({ type: 'removeSource', sourceId }));
    dispatch({ type: 'batch', label: t('sources.duplicates.removedLabel', { n: removable.length }), commands });
  }

  return (
    <div className="mx-3 mt-2 rounded-[10px] bg-info-soft p-3 text-[13px] ring-1 ring-info/25">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-medium text-info">
          <Copy className="size-4 shrink-0" aria-hidden />
          <span>{t('sources.duplicates.heading', { n: groups.length })}</span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t('sources.duplicates.dismiss')}
          className="shrink-0 rounded p-0.5 text-info hover:bg-info/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <ul className="mt-2 flex flex-col gap-1 text-[12px] text-text-secondary">
        {groups.map((group) => {
          const canonical = workspace.sources[group.sourceIds[0]];
          const extras = group.sourceIds.slice(1);
          const removableExtras = extras.filter((id) => removableSet.has(id));
          const usedExtras = extras.length - removableExtras.length;
          return (
            <li key={group.contentHash}>
              <span className="font-medium text-text-primary">{canonical?.name ?? t('sources.duplicates.unknownSource')}</span>
              {': '}
              {extras.length} {extras.length === 1 ? t('sources.duplicates.copySingular') : t('sources.duplicates.copyPlural')}
              {usedExtras > 0 && (
                <span className="text-text-tertiary">{t('sources.duplicates.inUse')}</span>
              )}
            </li>
          );
        })}
      </ul>

      {removable.length > 0 && (
        <div className="mt-2.5">
          <Button variant="secondary" size="sm" icon={Copy} onClick={removeUnusedDuplicates}>
            {t('sources.duplicates.removeUnused', { n: removable.length })}
          </Button>
        </div>
      )}
    </div>
  );
}
