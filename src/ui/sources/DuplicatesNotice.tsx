import { useState } from 'react';
import { Copy, X } from 'lucide-react';
import type { Command } from '../../domain/commands';
import { findDuplicateSourceGroups, removableDuplicateSourceIds } from '../../domain/duplicates';
import { useDispatch, useWorkspace } from '../app/StoreProvider';

export function DuplicatesNotice() {
  const workspace = useWorkspace();
  const dispatch = useDispatch();
  const [dismissed, setDismissed] = useState(false);

  const groups = findDuplicateSourceGroups(workspace);
  const removable = removableDuplicateSourceIds(workspace);
  const removableSet = new Set(removable);

  if (groups.length === 0 || dismissed) return null;

  function removeUnusedDuplicates() {
    const commands: Command[] = removable.map((sourceId) => ({ type: 'removeSource', sourceId }));
    dispatch({ type: 'batch', label: `${removable.length} doppelte Quellen entfernt`, commands });
  }

  return (
    <div className="mx-2 mt-2 rounded border border-amber-500/40 bg-panel p-2 text-sm text-amber-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <Copy className="size-4 shrink-0" aria-hidden />
          <span>{groups.length} doppelt importierte Dateien.</span>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Hinweis ausblenden"
          className="shrink-0 rounded p-0.5 text-amber-300 hover:bg-amber-500/10"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <ul className="mt-2 flex flex-col gap-1 text-xs text-amber-100/90">
        {groups.map((group) => {
          const canonical = workspace.sources[group.sourceIds[0]];
          const extras = group.sourceIds.slice(1);
          const removableExtras = extras.filter((id) => removableSet.has(id));
          const usedExtras = extras.length - removableExtras.length;
          return (
            <li key={group.contentHash}>
              <span className="font-medium">{canonical?.name ?? 'Unbekannte Quelle'}</span>
              {': '}
              {extras.length} {extras.length === 1 ? 'Doppel' : 'Doppel-Kopien'}
              {usedExtras > 0 && (
                <span className="text-amber-300/80"> -- wird verwendet -- nicht automatisch entfernbar</span>
              )}
            </li>
          );
        })}
      </ul>

      {removable.length > 0 && (
        <button
          type="button"
          onClick={removeUnusedDuplicates}
          className="mt-2 rounded border border-amber-500/50 px-2 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/10"
        >
          {removable.length} ungenutzte Doppel entfernen
        </button>
      )}
    </div>
  );
}
