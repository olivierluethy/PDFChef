import { useState } from 'react';
import { ChevronRight, FilePlus2, Folder, FolderPlus, FileText, Trash2 } from 'lucide-react';
import { newId } from '../../domain/ids';
import type { NodeId } from '../../domain/types';
import { useDispatch, useWorkspace } from '../app/StoreProvider';
import { flattenTree } from './treeModel';

export interface OutputTreeProps {
  activeOutputId: NodeId | null;
  onSelectOutput(id: NodeId): void;
  onDeleteNode?(nodeId: NodeId): void;
}

export function OutputTree({ activeOutputId, onSelectOutput, onDeleteNode }: OutputTreeProps) {
  const workspace = useWorkspace();
  const dispatch = useDispatch();
  const [renaming, setRenaming] = useState<NodeId | null>(null);
  const flat = flattenTree(workspace);

  function rename(id: NodeId, name: string) {
    setRenaming(null);
    dispatch({ type: 'renameNode', nodeId: id, name });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          type="button"
          onClick={() => dispatch({ type: 'createFolder', node: { id: newId(), name: 'Neuer Ordner', parentId: null } })}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-panel"
        >
          <FolderPlus className="size-4" aria-hidden /> Ordner anlegen
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'createOutput', node: { id: newId(), name: 'Neues Dokument', parentId: null } })}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-panel"
        >
          <FilePlus2 className="size-4" aria-hidden /> Dokument anlegen
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto">
        {flat.map((node) => {
          const record = workspace.nodes[node.id];
          if (!record) return null;
          const active = node.type === 'output' && node.id === activeOutputId;
          return (
            <li key={node.id} style={{ paddingLeft: node.depth * 16 + 8 }}>
              {renaming === node.id ? (
                <input
                  autoFocus
                  defaultValue={record.name}
                  onBlur={(e) => rename(node.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') rename(node.id, (e.target as HTMLInputElement).value);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  className="w-40 rounded border border-line bg-panel px-1 text-sm"
                  aria-label="Name bearbeiten"
                />
              ) : (
                <div
                  className={`group flex w-full items-center gap-1 rounded pr-1 text-sm ${
                    active ? 'bg-panel' : 'hover:bg-panel/60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => node.type === 'output' && onSelectOutput(node.id)}
                    onDoubleClick={() => setRenaming(node.id)}
                    aria-pressed={active}
                    data-node-id={node.id}
                    data-node-type={node.type}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-left"
                  >
                    {node.type === 'folder' ? (
                      <>
                        <ChevronRight className="size-3 text-neutral-600" aria-hidden />
                        <Folder className="size-4 text-neutral-400" aria-hidden />
                      </>
                    ) : (
                      <FileText className="size-4 text-neutral-400" aria-hidden />
                    )}
                    <span className="truncate">{record.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNode?.(node.id);
                    }}
                    aria-label={`"${record.name}" loeschen`}
                    className="shrink-0 rounded p-1 text-neutral-500 opacity-0 hover:bg-shell hover:text-neutral-300 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {flat.length === 0 && (
          <li className="px-3 py-4 text-sm text-neutral-500">
            Noch keine Ausgabestruktur. Legen Sie einen Ordner oder ein Dokument an.
          </li>
        )}
      </ul>
    </div>
  );
}
