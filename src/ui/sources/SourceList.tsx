import { FileText, Image, Lock, TriangleAlert } from 'lucide-react';
import type { SourceDocument, SourceId } from '../../domain/types';
import { useWorkspace } from '../app/StoreProvider';

export interface SourceListProps {
  activeSourceId: SourceId | null;
  onSelect(sourceId: SourceId): void;
}

function statusIcon(source: SourceDocument) {
  if (source.status === 'encrypted') return <Lock className="size-4 text-amber-400" aria-label="verschluesselt" />;
  if (source.status === 'error') return <TriangleAlert className="size-4 text-red-400" aria-label="fehlerhaft" />;
  if (source.blockKind === 'image') return <Image className="size-4 text-neutral-400" aria-hidden />;
  return <FileText className="size-4 text-neutral-400" aria-hidden />;
}

export function SourceList({ activeSourceId, onSelect }: SourceListProps) {
  const workspace = useWorkspace();
  const sources = workspace.sourceOrder.map((id) => workspace.sources[id]).filter(Boolean);

  if (sources.length === 0) {
    return <p className="px-3 py-4 text-sm text-neutral-500">Noch keine Dokumente importiert.</p>;
  }

  return (
    <ul className="flex flex-col">
      {sources.map((source) => {
        const usable = source.status === 'ready';
        return (
          <li key={source.id}>
            <button
              type="button"
              disabled={!usable}
              onClick={() => usable && onSelect(source.id)}
              aria-pressed={activeSourceId === source.id}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                activeSourceId === source.id ? 'bg-panel' : 'hover:bg-panel/60'
              } ${usable ? '' : 'cursor-not-allowed opacity-60'}`}
            >
              {statusIcon(source)}
              <span className="min-w-0 flex-1 truncate">{source.name}</span>
              <span className="text-neutral-500">
                {source.status === 'ready'
                  ? source.blockKind === 'image'
                    ? '1 Bild'
                    : source.blockCount === 1
                      ? '1 Seite'
                      : `${source.blockCount} Seiten`
                  : source.status === 'encrypted'
                    ? 'geschuetzt'
                    : 'nicht lesbar'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
