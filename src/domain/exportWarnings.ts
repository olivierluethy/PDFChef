import type { ExportPlan } from './exportPlan';
import type { NodeId } from './types';

export interface ExportWarning {
  severity: 'warn' | 'info';
  kind: 'empty' | 'renamed';
  message: string;
  outputId?: NodeId;
}

/**
 * Reine Analyse eines `ExportPlan`: liefert Hinweise, keine Blocker. Erst
 * Warnungen (leere Dokumente), dann Hinweise (Umbenennungen wegen Kollision),
 * jeweils stabil in Plan-Reihenfolge.
 */
export function analyzeExport(plan: ExportPlan): ExportWarning[] {
  const warnings: ExportWarning[] = [];
  const infos: ExportWarning[] = [];

  for (const skipped of plan.skipped) {
    warnings.push({
      severity: 'warn',
      kind: 'empty',
      outputId: skipped.outputId,
      message: `"${skipped.name}" is empty and will not be exported.`,
    });
  }

  for (const entry of plan.entries) {
    if (entry.renamedFrom === undefined) continue;
    infos.push({
      severity: 'info',
      kind: 'renamed',
      outputId: entry.outputId,
      message: `"${entry.renamedFrom}" has the same name as another document in the same folder and will be exported as "${entry.fileName}".`,
    });
  }

  return [...warnings, ...infos];
}
