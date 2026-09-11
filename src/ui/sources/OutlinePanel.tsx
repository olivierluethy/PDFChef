import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import type { OutlineNode } from '../../domain/types';

export interface OutlinePanelProps {
  outline: OutlineNode[];
  blockCount: number;
  onNavigate(blockIndex: number): void;
}

/**
 * Rekursiver, einklappbarer Kapitelbaum für Quellen mit Inhaltsverzeichnis.
 * Rein darstellend: kein Store-Zugriff, keine Persistenz.
 */
export function OutlinePanel({ outline, blockCount, onNavigate }: OutlinePanelProps) {
  const [expanded, setExpanded] = useState(true);

  function navigate(blockIndex: number) {
    const clamped = Math.max(0, Math.min(blockIndex, blockCount - 1));
    onNavigate(clamped);
  }

  return (
    <div className="mb-3 mt-1 rounded-[10px] bg-surface-raised">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        {expanded ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
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
        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[13px] text-text-primary hover:bg-surface-hover disabled:cursor-default disabled:text-text-tertiary disabled:hover:bg-transparent"
      >
        <span className="truncate">{node.title}</span>
        {hasTarget && (
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-secondary">
            {(node.blockIndex as number) + 1}
          </span>
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
