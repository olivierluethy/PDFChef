import type { Command } from '../../domain/commands';
import type { NodeId, OutputDocument } from '../../domain/types';
import type { Translate } from '../i18n/I18nProvider';

export interface BuildSplitOutputParams {
  /** Das Dokument, das an einer Seite getrennt wird. */
  output: OutputDocument;
  /** Position, ab der getrennt wird: diese Seite und alle danach wandern ins neue Dokument. */
  atIndex: number;
  parentId: NodeId | null;
  newOutputId: NodeId;
  /** Uebersetzer fuer das Undo-Label des Batches. */
  t: Translate;
}

/**
 * Trennt ein Ausgabedokument an einer Seite in zwei Dokumente: die Seiten vor
 * `atIndex` bleiben, die ab `atIndex` wandern in ein neues Dokument. Gebaut aus
 * vorhandenen Primitiven (createOutput + moveItems) als ein Batch, damit ein
 * einziges Rueckgaengig alles zuruecknimmt.
 *
 * Gibt null zurueck, wenn nichts sinnvoll zu trennen ist (an der ersten Seite
 * oder ohne nachfolgende Seiten wuerde nur ein leeres Dokument entstehen).
 */
export function buildSplitOutputCommand({
  output,
  atIndex,
  parentId,
  newOutputId,
  t,
}: BuildSplitOutputParams): Command | null {
  const tail = output.items.slice(atIndex);
  if (atIndex <= 0 || tail.length === 0) return null;
  return {
    type: 'batch',
    label: t('workspace.split.outputSplitLabel', { name: output.name }),
    commands: [
      { type: 'createOutput', node: { id: newOutputId, name: `${output.name} (2)`, parentId } },
      { type: 'moveItems', itemIds: tail, outputId: newOutputId, index: 0 },
    ],
  };
}
