import { Eye, FileText, Image, Lock, MoreVertical, Trash2, TriangleAlert } from 'lucide-react';
import type { SourceDocument, SourceId } from '../../domain/types';
import { Menu } from '../common/Menu';
import { cx } from '../common/cx';
import { useDispatch, useWorkspace } from '../app/StoreProvider';

export interface SourceListProps {
  activeSourceId: SourceId | null;
  onSelect(sourceId: SourceId): void;
  /** Oeffnet die Quelle in der Detailvorschau (Auge-Icon oder Doppelklick). */
  onOpenPreview?(sourceId: SourceId): void;
  onRemove?(sourceId: SourceId): void;
}

function TypeGlyph({ source }: { source: SourceDocument }) {
  if (source.status === 'encrypted')
    return <Lock className="size-4 text-danger" aria-label="verschlüsselt" />;
  if (source.status === 'error')
    return <TriangleAlert className="size-4 text-danger" aria-label="fehlerhaft" />;
  if (source.blockKind === 'image')
    return <Image className="size-4 text-text-tertiary" aria-hidden />;
  return <FileText className="size-4 text-text-tertiary" aria-hidden />;
}

function metaParts(source: SourceDocument): { count: string; format: string } {
  const format = source.kind.toUpperCase();
  if (source.status === 'encrypted') return { count: 'geschützt', format };
  if (source.status === 'error') return { count: 'nicht lesbar', format };
  if (source.blockKind === 'image') return { count: '1 Bild', format };
  const count = source.blockCount === 1 ? '1 Seite' : `${source.blockCount} Seiten`;
  return { count, format };
}

export function SourceList({ activeSourceId, onSelect, onOpenPreview, onRemove }: SourceListProps) {
  const workspace = useWorkspace();
  const dispatch = useDispatch();
  const sources = workspace.sourceOrder.map((id) => workspace.sources[id]).filter(Boolean);

  if (sources.length === 0) {
    return <p className="t-meta px-5 py-4">Noch keine Dokumente importiert.</p>;
  }

  return (
    <ul className="flex flex-col gap-0.5 px-2 py-1">
      {sources.map((source) => {
        const usable = source.status === 'ready';
        const active = activeSourceId === source.id;
        const meta = metaParts(source);
        return (
          <li key={source.id} className="group/row relative">
            <div
              className={cx(
                'flex items-center gap-2.5 rounded-md py-2 pl-3 pr-1.5 transition-colors',
                active ? 'bg-accent-soft' : 'hover:bg-surface-hover',
                !usable && 'opacity-70',
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-accent"
                />
              )}
              <button
                type="button"
                disabled={!usable}
                onClick={() => usable && onSelect(source.id)}
                onDoubleClick={() => usable && onOpenPreview?.(source.id)}
                aria-current={active ? 'true' : undefined}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-not-allowed"
              >
                <TypeGlyph source={source} />
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[13px] text-text-primary"
                    title={source.name}
                  >
                    {source.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-text-secondary">
                    <span className="tabular-nums">{meta.count}</span>
                    <span className="text-text-tertiary">{meta.format}</span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled={!usable}
                onClick={() => onOpenPreview?.(source.id)}
                aria-label={`Vorschau für ${source.name}`}
                className={cx(
                  'inline-grid size-7 shrink-0 place-items-center rounded-md text-text-secondary transition-opacity hover:bg-surface-raised hover:text-text-primary focus-visible:opacity-100 group-hover/row:opacity-100 disabled:cursor-not-allowed',
                  'opacity-0',
                )}
              >
                <Eye className="size-4" aria-hidden />
              </button>
              <Menu
                align="end"
                minWidth={160}
                items={[
                  {
                    id: 'remove',
                    label: 'Entfernen',
                    icon: Trash2,
                    danger: true,
                    onSelect: () => {
                      dispatch({ type: 'removeSource', sourceId: source.id });
                      onRemove?.(source.id);
                    },
                  },
                ]}
                renderTrigger={({ ref, toggle, open, ariaProps }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={toggle}
                    aria-label={`Aktionen für ${source.name}`}
                    className={cx(
                      'inline-grid size-7 shrink-0 place-items-center rounded-md text-text-secondary transition-opacity hover:bg-surface-raised hover:text-text-primary focus-visible:opacity-100 group-hover/row:opacity-100',
                      open ? 'opacity-100' : 'opacity-0',
                    )}
                    {...ariaProps}
                  >
                    <MoreVertical className="size-4" aria-hidden />
                  </button>
                )}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
