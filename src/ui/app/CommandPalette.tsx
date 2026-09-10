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
        className="mx-auto flex w-[32rem] flex-col rounded-lg border border-line bg-panel shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <Search className="size-4 shrink-0 text-neutral-500" />
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
            className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-500"
          />
        </div>

        <ul className="max-h-80 overflow-auto py-1 text-sm">
          {filtered.length === 0 && <li className="px-3 py-2 text-neutral-500">Keine Treffer</li>}
          {filtered.map((action, index) => (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => runAt(index)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left ${
                  index === clampedIndex ? 'bg-shell' : ''
                }`}
              >
                <span>{action.label}</span>
                {action.hint && <span className="ml-2 shrink-0 text-xs text-neutral-500">{action.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
