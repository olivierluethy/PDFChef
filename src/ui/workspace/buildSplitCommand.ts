import type { Command, SplitOutputSpec } from '../../domain/commands';
import type { SplitPart } from '../../domain/split';

export interface BuildSplitParams {
  sourceId: string;
  sourceName: string;
  parentId: string | null;
  parts: SplitPart[];
  newId(): string;
}

/** Aus dem Dateinamen wird die Endung entfernt; die Teile heissen "Name 1", "Name 2". */
function baseName(sourceName: string): string {
  return sourceName.replace(/\.pdf$/i, '');
}

export function buildSplitCommand({ sourceId, sourceName, parentId, parts, newId }: BuildSplitParams): Command {
  const base = baseName(sourceName);
  const specs: SplitOutputSpec[] = parts.map((part, index) => ({
    outputId: newId(),
    name: `${base} ${index + 1}`,
    items: part.indices.map((blockIndex) => ({ id: newId(), sourceId, blockIndex, rotation: 0 })),
  }));
  return { type: 'splitSource', sourceId, parentId, parts: specs };
}
