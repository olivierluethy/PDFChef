import { Search } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { filterActions, type PaletteAction } from './commandFilter';

export interface CommandPaletteProps {
  actions: PaletteAction[];
  onClose(): void;
}

export function CommandPalette({ actions, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => filterActions(actions, query), [actions, query]);
  const clampedIndex = filtered.length === 0 ? 0 : Math.min(selectedIndex, filtered.length - 1);

  function runAt(index: number): void {
    const action = filtered[index];
    if (!action) return;
    action.run();
    onClose();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (filtered.length > 0) setSelectedIndex((clampedIndex + 1) % filtered.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (filtered.length > 0) setSelectedIndex((clampedIndex - 1 + filtered.length) % filtered.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      runAt(clampedIndex);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/50 pt-32" role="dialog" aria-label="Befehlspalette" onClick={onClose}>
      <div
        className="mx-auto flex w-[32rem] flex-col rounded-[10px] bg-surface-raised shadow-[var(--float-shadow)] ring-1 ring-line-structural"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line-structural px-3 py-2.5">
          <Search className="size-4 shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            autoFocus
            aria-label="Aktion suchen"
            placeholder="Aktion suchen…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent text-sm outline-none placeholder:text-text-tertiary"
          />
        </div>

        <ul className="max-h-80 overflow-auto py-1 text-sm">
          {filtered.length === 0 && <li className="px-3 py-2 text-text-tertiary">Keine Treffer</li>}
          {filtered.map((action, index) => (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => runAt(index)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left ${
                  index === clampedIndex ? 'bg-surface-hover' : ''
                }`}
              >
                <span>{action.label}</span>
                {action.hint && <span className="ml-2 shrink-0 text-xs text-text-tertiary">{action.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
