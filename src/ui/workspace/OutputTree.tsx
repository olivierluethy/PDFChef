import { useMemo, useState } from 'react';
import {
  ChevronRight,
  Download,
  Eye,
  FileText,
  Folder,
  MoreVertical,
  Pencil,
  Printer,
  Save,
  Share2,
  Trash2,
} from 'lucide-react';
import { ROOT, isFolder, isOutput, type NodeId, type Workspace } from '../../domain/types';
import { Menu, type MenuItem } from '../common/Menu';
import { cx } from '../common/cx';
import { useDispatch, useWorkspace } from '../app/StoreProvider';
import { useT } from '../i18n';
import type { DragOrigin } from './dragLogic';
import type { FlatNode } from './treeModel';

export interface OutputTreeProps {
  activeOutputId: NodeId | null;
  onSelectOutput(id: NodeId): void;
  onDeleteNode?(nodeId: NodeId): void;
  onExportNode?(nodeId: NodeId): void;
  /** Speichert ein Dokument direkt als einzelne PDF-Datei (Original ersetzen). */
  onSaveNode?(nodeId: NodeId): void;
  onPrintNode?(nodeId: NodeId): void;
  onShareNode?(nodeId: NodeId): void;
  /** Oeffnet ein Dokument in der Detailvorschau (Auge-Icon oder Doppelklick). */
  onOpenPreview?(nodeId: NodeId): void;
  /** Startet einen Drag, der den ganzen Knoten in einen Ordner / die Wurzel umhaengt. */
  onCellPointerDown?(event: React.PointerEvent, origin: DragOrigin): void;
}

/** Sichtbare Zeilen unter Beachtung eingeklappter Ordner (Vorordnung). */
function visibleNodes(ws: Workspace, collapsed: Set<string>): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (parentKey: string, depth: number) => {
    for (const id of ws.childOrder[parentKey] ?? []) {
      const node = ws.nodes[id];
      if (!node) continue;
      const type = isFolder(node) ? 'folder' : 'output';
      out.push({ id, depth, type });
      if (type === 'folder' && !collapsed.has(id)) walk(id, depth + 1);
    }
  };
  walk(ROOT, 0);
  return out;
}

function pageCount(ws: Workspace, id: NodeId): number {
  const node = ws.nodes[id];
  if (!node) return 0;
  if (isOutput(node)) return node.items.length;
  return (ws.childOrder[id] ?? []).reduce((sum, child) => sum + pageCount(ws, child), 0);
}

export function OutputTree({
  activeOutputId,
  onSelectOutput,
  onDeleteNode,
  onExportNode,
  onSaveNode,
  onPrintNode,
  onShareNode,
  onOpenPreview,
  onCellPointerDown,
}: OutputTreeProps) {
  const workspace = useWorkspace();
  const dispatch = useDispatch();
  const t = useT();
  const [renaming, setRenaming] = useState<NodeId | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const flat = useMemo(() => visibleNodes(workspace, collapsed), [workspace, collapsed]);

  function rename(id: NodeId, name: string) {
    setRenaming(null);
    const trimmed = name.trim();
    if (trimmed) dispatch({ type: 'renameNode', nodeId: id, name: trimmed });
  }

  function toggle(id: NodeId) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (flat.length === 0) {
    return (
      <p className="t-meta px-5 py-4">{t('workspace.tree.empty')}</p>
    );
  }

  return (
    <ul role="tree" aria-label={t('workspace.tree.label')} className="flex flex-col px-2 py-1">
      {flat.map((node) => {
        const record = workspace.nodes[node.id];
        if (!record) return null;
        const isOut = node.type === 'output';
        const active = isOut && node.id === activeOutputId;
        const expanded = !collapsed.has(node.id);
        const count = pageCount(workspace, node.id);
        // Nur Ordner mit mindestens einem Kind sind auf-/zuklappbar. Ein voellig
        // leerer Ordner bekommt keinen Chevron -- es gibt nichts aufzuklappen.
        const hasChildren =
          node.type === 'folder' && (workspace.childOrder[node.id]?.length ?? 0) > 0;

        const menuItems: MenuItem[] = [
          {
            id: 'rename',
            label: t('workspace.tree.rename'),
            icon: Pencil,
            onSelect: () => setRenaming(node.id),
          },
          ...(isOut
            ? [
                {
                  id: 'print',
                  label: t('workspace.tree.print'),
                  icon: Printer,
                  onSelect: () => onPrintNode?.(node.id),
                },
              ]
            : []),
          ...(isOut && onSaveNode
            ? [
                {
                  id: 'save',
                  label: t('workspace.tree.saveAsPdf'),
                  icon: Save,
                  onSelect: () => onSaveNode(node.id),
                },
              ]
            : []),
          {
            id: 'export',
            label: t('workspace.tree.export'),
            icon: Download,
            onSelect: () => onExportNode?.(node.id),
          },
          ...(isOut
            ? [
                {
                  id: 'share',
                  label: t('workspace.tree.share'),
                  icon: Share2,
                  onSelect: () => onShareNode?.(node.id),
                },
              ]
            : []),
          {
            id: 'delete',
            label: t('workspace.tree.delete'),
            icon: Trash2,
            danger: true,
            onSelect: () => onDeleteNode?.(node.id),
          },
        ];

        return (
          <li key={node.id} role="none">
            <div
              role="treeitem"
              aria-level={node.depth + 1}
              aria-selected={active || undefined}
              aria-expanded={hasChildren ? expanded : undefined}
              data-node-id={node.id}
              data-node-type={node.type}
              data-drop-zone
              onPointerDown={(event) => {
                // Waehrend des Umbenennens nicht ziehen -- der Cursor gehoert dem Textfeld.
                if (renaming === node.id) return;
                onCellPointerDown?.(event, { kind: 'node', nodeId: node.id });
              }}
              style={{ paddingLeft: node.depth * 16 }}
              className={cx(
                'group/row relative flex h-7 items-center gap-1 rounded-md pr-1',
                active ? 'bg-surface-raised' : 'hover:bg-surface-hover',
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent"
                />
              )}

              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggle(node.id)}
                  aria-label={expanded ? t('workspace.tree.collapse') : t('workspace.tree.expand')}
                  className="grid size-5 shrink-0 place-items-center text-text-tertiary hover:text-text-secondary"
                >
                  <ChevronRight
                    className={cx(
                      'size-3.5 transition-transform duration-[140ms]',
                      expanded && 'rotate-90',
                    )}
                    aria-hidden
                  />
                </button>
              ) : (
                <span className="w-5 shrink-0" aria-hidden />
              )}

              {renaming === node.id ? (
                <input
                  autoFocus
                  defaultValue={record.name}
                  onBlur={(e) => rename(node.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') rename(node.id, (e.target as HTMLInputElement).value);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  className="h-6 min-w-0 flex-1 rounded bg-surface-canvas px-1.5 text-[13px] text-text-primary ring-1 ring-line-structural"
                  aria-label={t('workspace.tree.editName')}
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => isOut && onSelectOutput(node.id)}
                    onDoubleClick={() => (isOut ? onOpenPreview?.(node.id) : setRenaming(node.id))}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {node.type === 'folder' ? (
                      <Folder className="size-4 shrink-0 text-text-tertiary" aria-hidden />
                    ) : (
                      <FileText className="size-4 shrink-0 text-text-tertiary" aria-hidden />
                    )}
                    <span className="truncate text-[13px] text-text-primary" title={record.name}>
                      {record.name}
                    </span>
                  </button>

                  {count > 0 && (
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-tertiary">
                      {count}
                    </span>
                  )}

                  {isOut && (
                    <button
                      type="button"
                      onClick={() => onOpenPreview?.(node.id)}
                      aria-label={t('workspace.tree.previewFor', { name: record.name })}
                      className="inline-grid size-6 shrink-0 place-items-center rounded text-text-secondary opacity-0 transition-opacity hover:bg-surface-raised hover:text-text-primary focus-visible:opacity-100 group-hover/row:opacity-100"
                    >
                      <Eye className="size-4" aria-hidden />
                    </button>
                  )}

                  <Menu
                    align="end"
                    minWidth={160}
                    items={menuItems}
                    renderTrigger={({ ref, toggle: openMenu, open, ariaProps }) => (
                      <button
                        ref={ref}
                        type="button"
                        onClick={openMenu}
                        aria-label={t('workspace.tree.actionsFor', { name: record.name })}
                        className={cx(
                          'inline-grid size-6 shrink-0 place-items-center rounded text-text-secondary transition-opacity hover:bg-surface-raised hover:text-text-primary focus-visible:opacity-100 group-hover/row:opacity-100',
                          open ? 'opacity-100' : 'opacity-0',
                        )}
                        {...ariaProps}
                      >
                        <MoreVertical className="size-4" aria-hidden />
                      </button>
                    )}
                  />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
