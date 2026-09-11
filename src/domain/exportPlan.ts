import { resolveCollision, sanitizeName, withPdfExtension } from './naming';
import type { CompositionItem, NodeId, Workspace } from './types';
import { ROOT } from './types';

/** Eine zu schreibende Datei. `path` ist relativ zum gewaehlten Ziel. */
export interface ExportEntry {
  outputId: NodeId;
  path: string[];
  fileName: string;
  items: CompositionItem[];
  /** Der gewuenschte Dateiname vor Kollisionsaufloesung, falls umbenannt wurde. */
  renamedFrom?: string;
}

export interface SkippedOutput {
  outputId: NodeId;
  name: string;
  reason: 'empty';
}

export interface ExportPlan {
  entries: ExportEntry[];
  skipped: SkippedOutput[];
  totalBlocks: number;
}

export type ExportScope = { kind: 'workspace' } | { kind: 'node'; nodeId: NodeId };

/**
 * Uebersetzt den Workspace in eine flache Liste zu schreibender Dateien.
 * Beide Writer (Verzeichnis und ZIP) konsumieren ausschliesslich dieses
 * Ergebnis -- damit koennen sie sich nur noch im Schreibweg unterscheiden,
 * nicht in Struktur oder Benennung.
 */
export function buildExportPlan(
  ws: Workspace,
  scope: ExportScope = { kind: 'workspace' },
): ExportPlan {
  const plan: ExportPlan = { entries: [], skipped: [], totalBlocks: 0 };

  if (scope.kind === 'workspace') {
    walk(ws, ws.childOrder[ROOT] ?? [], [], plan);
    return plan;
  }

  const node = ws.nodes[scope.nodeId];
  if (!node) return plan;
  // Ein einzelner Ordner wird zum obersten Verzeichnis, ein einzelnes Output
  // zu einer Datei ohne Pfad.
  walk(ws, [node.id], [], plan);
  return plan;
}

/**
 * Liefert einen Plan ohne die Eintraege, deren `outputId` in `exported` steht --
 * fuer den Sammel-Export, nachdem einzelne Dokumente bereits an ein eigenes Ziel
 * geschrieben wurden. `totalBlocks` wird neu berechnet; `skipped` bleibt gleich.
 */
export function omitExportedEntries(plan: ExportPlan, exported: ReadonlySet<NodeId>): ExportPlan {
  if (exported.size === 0) return plan;
  const entries = plan.entries.filter((entry) => !exported.has(entry.outputId));
  return {
    entries,
    skipped: plan.skipped,
    totalBlocks: entries.reduce((sum, entry) => sum + entry.items.length, 0),
  };
}

function walk(ws: Workspace, nodeIds: NodeId[], path: string[], plan: ExportPlan): void {
  // Ordner- und Dateinamen kollidieren nicht miteinander ("Bank" vs. "Bank.pdf"),
  // deshalb zwei getrennte Namensraeume pro Verzeichnis.
  const usedFolderNames = new Set<string>();
  const usedFileNames = new Set<string>();

  for (const nodeId of nodeIds) {
    const node = ws.nodes[nodeId];
    if (!node) continue;

    if (node.type === 'folder') {
      const folderName = claim(sanitizeName(node.name), usedFolderNames);
      walk(ws, ws.childOrder[nodeId] ?? [], [...path, folderName], plan);
      continue;
    }

    if (node.items.length === 0) {
      plan.skipped.push({ outputId: nodeId, name: node.name, reason: 'empty' });
      continue;
    }

    const items = node.items
      .map((itemId) => ws.items[itemId])
      .filter((item): item is CompositionItem => item !== undefined);
    if (items.length === 0) {
      plan.skipped.push({ outputId: nodeId, name: node.name, reason: 'empty' });
      continue;
    }

    const desired = sanitizeName(node.name);
    const base = claim(desired, usedFileNames);
    const entry: ExportEntry = { outputId: nodeId, path, fileName: withPdfExtension(base), items };
    if (base !== desired) entry.renamedFrom = withPdfExtension(desired);
    plan.entries.push(entry);
    plan.totalBlocks += items.length;
  }
}

function claim(name: string, used: Set<string>): string {
  const resolved = resolveCollision(name, used);
  used.add(resolved.toLowerCase());
  return resolved;
}
