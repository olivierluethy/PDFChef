import { useState } from 'react';
import { BookMarked, Check, Group, PenLine, Pencil, Shapes, Trash2, Type, X } from 'lucide-react';
import type { LibraryItemRecord } from '../../../services/persistence/db';
import { useLibraryItems, useLibraryStore } from '../../app/StoreProvider';
import { cx } from '../../common/cx';
import { useT } from '../../i18n';

const KIND_ICON = {
  signature: PenLine,
  text: Type,
  shape: Shapes,
  group: Group,
} as const;

export interface LibraryPopoverProps {
  onInsert(item: LibraryItemRecord): void;
  onClose(): void;
}

/**
 * Panel mit den gespeicherten Bausteinen. Ein Klick auf einen Eintrag fuegt ihn
 * auf der aktuellen Seite ein; umbenennen und loeschen je Eintrag. Liegt als
 * Overlay ueber der Ausfuell-Schicht (Positionierung uebernimmt der Aufrufer).
 */
export function LibraryPopover({ onInsert, onClose }: LibraryPopoverProps) {
  const t = useT();
  const items = useLibraryItems();
  const store = useLibraryStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  return (
    <div className="pointer-events-auto flex max-h-[min(60vh,420px)] w-64 flex-col rounded-lg bg-surface-panel shadow-[var(--float-shadow)] ring-1 ring-line-structural">
      <div className="flex items-center gap-2 border-b border-line-structural px-3 py-2">
        <BookMarked className="size-4 text-text-secondary" aria-hidden />
        <span className="text-[12.5px] font-medium text-text-primary">{t('preview.library.title')}</span>
        <button
          type="button"
          aria-label={t('preview.library.close')}
          onClick={onClose}
          className="ml-auto grid size-6 place-items-center rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      </div>

      {items.length === 0 ? (
        <p className="px-3 py-6 text-center text-[12px] text-text-tertiary">
          {t('preview.library.empty')}
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-auto p-1.5">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            const signature =
              item.kind === 'signature' ? item.overlays.find((o) => o.dataUrl) : undefined;
            return (
              <li key={item.id} className="group/li">
                <div className="flex items-center gap-2 rounded-md p-1 hover:bg-surface-hover">
                  <button
                    type="button"
                    onClick={() => onInsert(item)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    title={t('preview.library.insert')}
                  >
                    <span
                      className={cx(
                        'grid size-9 shrink-0 place-items-center overflow-hidden rounded ring-1 ring-line-hairline',
                        // Unterschriften nutzen dunkle Tinte auf transparentem PNG: fester
                        // heller Untergrund (theme-unabhaengig), sonst verschwinden sie im
                        // Dark-Mode. Icons bleiben auf der neutralen Canvas-Flaeche.
                        signature?.dataUrl ? 'bg-white p-0.5' : 'bg-surface-canvas',
                      )}
                    >
                      {signature?.dataUrl ? (
                        <img
                          src={signature.dataUrl}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <Icon className="size-4 text-text-secondary" aria-hidden />
                      )}
                    </span>
                    {editing === item.id ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.currentTarget.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void store.getState().rename(item.id, draft);
                            setEditing(null);
                          } else if (e.key === 'Escape') setEditing(null);
                        }}
                        onBlur={() => {
                          void store.getState().rename(item.id, draft);
                          setEditing(null);
                        }}
                        className="min-w-0 flex-1 rounded bg-surface-raised px-1.5 py-0.5 text-[12px] text-text-primary outline-none ring-1 ring-accent"
                      />
                    ) : (
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] text-text-primary">
                          {item.name}
                        </span>
                        <span className="block text-[10.5px] text-text-tertiary">
                          {t('preview.library.kind.' + item.kind)}
                        </span>
                      </span>
                    )}
                  </button>
                  <div
                    className={cx(
                      'flex shrink-0 items-center gap-0.5',
                      editing === item.id ? '' : 'opacity-0 group-hover/li:opacity-100',
                    )}
                  >
                    {editing === item.id ? (
                      <button
                        type="button"
                        aria-label={t('preview.library.saveName')}
                        onClick={() => {
                          void store.getState().rename(item.id, draft);
                          setEditing(null);
                        }}
                        className="grid size-6 place-items-center rounded text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                      >
                        <Check className="size-3.5" aria-hidden />
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label={t('preview.library.rename')}
                        onClick={() => {
                          setEditing(item.id);
                          setDraft(item.name);
                        }}
                        className="grid size-6 place-items-center rounded text-text-secondary hover:bg-surface-raised hover:text-text-primary"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={t('preview.library.remove')}
                      onClick={() => void store.getState().remove(item.id)}
                      className="grid size-6 place-items-center rounded text-text-secondary hover:bg-danger/15 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
