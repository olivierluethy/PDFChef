import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { SearchScopeKind } from '../../services/search/searchScope';
import type { DocumentResult } from '../../services/search/searchService';

export interface SearchPanelProps {
  runSearch(query: string, kind: SearchScopeKind): Promise<DocumentResult[]>;
  onJump(sourceId: string, blockIndex: number): void;
  onClose(): void;
}

const SCOPES: { key: SearchScopeKind; label: string }[] = [
  { key: 'source', label: 'Aktuelle Quelle' },
  { key: 'output', label: 'Aktuelles Dokument' },
  { key: 'all', label: 'Alle Quellen' },
];

export function SearchPanel({ runSearch, onJump, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScopeKind>('source');
  const [results, setResults] = useState<DocumentResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim() === '') return;
    setBusy(true);
    try {
      setResults(await runSearch(query, scope));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-line">
      <form onSubmit={submit} className="flex flex-col gap-2 border-b border-line p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Suchen</h2>
          <button type="button" onClick={onClose} aria-label="Suche schliessen" className="rounded p-1 hover:bg-panel">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Text im Dokument suchen"
            className="min-w-0 flex-1 rounded border border-line bg-panel px-2 py-1 text-sm"
          />
          <button type="submit" className="flex items-center gap-1 rounded bg-sky-600 px-3 py-1 text-sm">
            <Search className="size-4" /> Suchen
          </button>
        </div>
        <div className="flex gap-1 text-xs">
          {SCOPES.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setScope(entry.key)}
              aria-pressed={scope === entry.key}
              className={`rounded px-2 py-1 ${scope === entry.key ? 'bg-panel text-neutral-100' : 'text-neutral-400 hover:bg-panel/60'}`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </form>

      <div className="min-h-0 flex-1 overflow-auto p-3 text-sm">
        {busy && <p className="text-neutral-500">Wird durchsucht...</p>}
        {!busy && results && results.every((r) => r.matches.length === 0) && (
          <p className="text-neutral-500">Keine Treffer.</p>
        )}
        {!busy &&
          results?.map((result) => (
            <section key={result.sourceId} className="mb-3">
              <h3 className="mb-1 font-medium">{result.name}</h3>
              {!result.searchable ? (
                <p className="text-neutral-500">Dieses Dokument enthaelt keinen durchsuchbaren Text.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {result.matches.map((match) => (
                    <li key={match.blockIndex}>
                      <button
                        type="button"
                        onClick={() => onJump(result.sourceId, match.blockIndex)}
                        className="w-full rounded px-2 py-1 text-left hover:bg-panel"
                      >
                        <span className="text-neutral-400">Seite {match.blockIndex + 1}</span>{' '}
                        <span className="text-neutral-300">{match.snippet}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
      </div>
    </div>
  );
}
