import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { SearchScopeKind } from '../../services/search/searchScope';
import type { DocumentResult } from '../../services/search/searchService';
import { Button } from '../common/Button';
import { IconButton } from '../common/IconButton';
import { SegmentedControl } from '../common/SegmentedControl';

export interface SearchPanelProps {
  runSearch(query: string, kind: SearchScopeKind): Promise<DocumentResult[]>;
  onJump(sourceId: string, blockIndex: number): void;
  onClose(): void;
}

const SCOPES: { value: SearchScopeKind; label: string }[] = [
  { value: 'source', label: 'Quelle' },
  { value: 'output', label: 'Dokument' },
  { value: 'all', label: 'Alle' },
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
    <div className="flex h-full flex-col">
      <form onSubmit={submit} className="flex flex-col gap-2.5 border-b border-line-structural p-3">
        <div className="flex items-center justify-between">
          <h2 className="t-panel-title text-text-primary">Suchen</h2>
          <IconButton icon={X} label="Suche schliessen" onClick={onClose} />
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Text im Dokument suchen"
            className="min-w-0 flex-1 rounded-md bg-surface-raised px-2.5 py-1.5 text-[13px] text-text-primary ring-1 ring-line-structural focus:ring-accent"
          />
          <Button type="submit" variant="secondary" icon={Search}>
            Suchen
          </Button>
        </div>
        <SegmentedControl<SearchScopeKind> ariaLabel="Suchbereich" value={scope} onChange={setScope} options={SCOPES} />
      </form>

      <div className="scroll-fade-y min-h-0 flex-1 overflow-auto p-3 text-[13px]">
        {busy && <p className="text-text-tertiary">Wird durchsucht …</p>}
        {!busy && results && results.every((r) => r.matches.length === 0) && (
          <p className="text-text-tertiary">Keine Treffer.</p>
        )}
        {!busy &&
          results?.map((result) => (
            <section key={result.sourceId} className="mb-4">
              <h3 className="mb-1.5 text-[13px] font-medium text-text-primary">{result.name}</h3>
              {!result.searchable ? (
                <p className="text-text-tertiary">Dieses Dokument enthält keinen durchsuchbaren Text.</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {result.matches.map((match) => (
                    <li key={match.blockIndex}>
                      <button
                        type="button"
                        onClick={() => onJump(result.sourceId, match.blockIndex)}
                        className="w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-hover"
                      >
                        <span className="font-mono text-[11.5px] tabular-nums text-info">Seite {match.blockIndex + 1}</span>{' '}
                        <span className="text-text-secondary">{match.snippet}</span>
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
