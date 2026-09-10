import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import type { OutlineNode } from '../../domain/types';

export interface OutlinePanelProps {
  outline: OutlineNode[];
  blockCount: number;
  onNavigate(blockIndex: number): void;
}

/**
 * Rekursiver, einklappbarer Kapitelbaum fuer Quellen mit Inhaltsverzeichnis.
 * Rein darstellend: kein Store-Zugriff, keine Persistenz.
 */
export function OutlinePanel({ outline, blockCount, onNavigate }: OutlinePanelProps) {
  const [expanded, setExpanded] = useState(true);

  function navigate(blockIndex: number) {
    const clamped = Math.max(0, Math.min(blockIndex, blockCount - 1));
    onNavigate(clamped);
  }

  return (
    <div className="border-b border-line bg-panel">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs uppercase tracking-wide text-neutral-400 hover:text-neutral-200"
      >
        {expanded ? (
          <ChevronDown className="size-3" aria-hidden />
        ) : (
          <ChevronRight className="size-3" aria-hidden />
        )}
        <BookOpen className="size-4" aria-hidden />
        Kapitel
      </button>
      {expanded && (
        <ul className="max-h-48 overflow-auto px-1 pb-2">
          {outline.map((node, index) => (
            <OutlineEntry key={index} node={node} depth={0} onNavigate={navigate} />
          ))}
        </ul>
      )}
    </div>
  );
}

interface OutlineEntryProps {
  node: OutlineNode;
  depth: number;
  onNavigate(blockIndex: number): void;
}

function OutlineEntry({ node, depth, onNavigate }: OutlineEntryProps) {
  const hasTarget = node.blockIndex !== null;
  return (
    <li>
      <button
        type="button"
        disabled={!hasTarget}
        onClick={() => hasTarget && onNavigate(node.blockIndex as number)}
        style={{ paddingLeft: depth * 16 + 8 }}
        className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm text-neutral-300 hover:bg-shell disabled:cursor-default disabled:text-neutral-600 disabled:hover:bg-transparent"
      >
        <span className="truncate">{node.title}</span>
        {hasTarget && (
          <span className="shrink-0 text-xs text-neutral-500">Seite {(node.blockIndex as number) + 1}</span>
        )}
      </button>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child, index) => (
            <OutlineEntry key={index} node={child} depth={depth + 1} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}
