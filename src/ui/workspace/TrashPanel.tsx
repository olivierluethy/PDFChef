import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { buildRestoreCommand } from '../../domain/trash';
import { createTrashService } from '../../services/persistence/trashService';
import type { TrashRecord } from '../../services/persistence/db';
import { useDispatch, useServices, useWorkspace } from '../app/StoreProvider';

export interface TrashPanelProps {
  onClose(): void;
}

function formatDeletedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString('de-CH');
}

export function TrashPanel({ onClose }: TrashPanelProps) {
  const services = useServices();
  const dispatch = useDispatch();
  const workspace = useWorkspace();
  const trash = useMemo(() => createTrashService(services.db), [services.db]);
  const [entries, setEntries] = useState<TrashRecord[]>([]);

  async function reload() {
    setEntries(await trash.list());
  }

  useEffect(() => {
    void reload();
  }, [trash]);

  async function restore(entry: TrashRecord) {
    dispatch(buildRestoreCommand(entry.snapshot, workspace));
    await trash.remove(entry.id);
    void reload();
  }

  async function purge(entry: TrashRecord) {
    await trash.remove(entry.id);
    void reload();
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/50" role="dialog" aria-label="Papierkorb">
      <div className="flex max-h-[80vh] w-[32rem] flex-col rounded-lg border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h2 className="text-sm font-medium">Papierkorb</h2>
          <button type="button" onClick={onClose} aria-label="Schliessen" className="rounded p-1 hover:bg-shell">
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-sm">
          {entries.length === 0 ? (
            <p className="text-text-tertiary">Der Papierkorb ist leer.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-shell">
                  <div className="min-w-0">
                    <p className="truncate">{entry.name}</p>
                    <p className="text-xs text-text-tertiary">{formatDeletedAt(entry.deletedAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void restore(entry)}
                      className="rounded border border-line px-2 py-1 text-xs hover:bg-panel"
                    >
                      Wiederherstellen
                    </button>
                    <button
                      type="button"
                      onClick={() => void purge(entry)}
                      className="rounded border border-line px-2 py-1 text-xs text-danger hover:bg-panel"
                    >
                      Endgültig löschen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
