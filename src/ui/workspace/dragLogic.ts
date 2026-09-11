import type { ItemId, NodeId, SourceId } from '../../domain/types';

export type DragOrigin =
  | { kind: 'source'; sourceId: SourceId; blockIndices: number[] }
  | { kind: 'output'; outputId: NodeId; itemIds: ItemId[] }
  // Ein ganzer Baum-Knoten (Dokument oder Ordner), der umgehaengt werden soll.
  | { kind: 'node'; nodeId: NodeId };

export type DropTarget =
  | { kind: 'folder'; nodeId: NodeId }
  | { kind: 'output'; outputId: NodeId; index: number }
  | { kind: 'tree-output'; outputId: NodeId }
  // Der leere Bereich des Baums = die Wurzel.
  | { kind: 'tree-root' };

export type DropAction =
  | { kind: 'addFromSource' }
  | { kind: 'moveItems' }
  | { kind: 'copyItems' }
  | { kind: 'createOutputFromFolder' }
  | { kind: 'moveNode' }
  | { kind: 'none' };

/**
 * Die Move/Copy-Regel des Designs, ohne Zeiger und ohne Store:
 * - Knoten -> Ordner / Baum-Dokument / Wurzel: den ganzen Knoten umhaengen.
 * - Quelle -> Ordner: neues Output. Quelle -> Output: hinzufuegen (Modifier egal).
 * - Output -> Ordner: neues Output aus den Items.
 * - Output -> Output: verschieben, mit Modifier kopieren.
 */
export function resolveDropAction(
  origin: DragOrigin,
  target: DropTarget,
  modifier: boolean,
): DropAction {
  if (origin.kind === 'node') {
    // Ein ganzer Knoten kommt nur in einen Ordner, neben ein Baum-Dokument
    // (= in dessen Ordner) oder auf die Wurzel. Modifier spielt keine Rolle.
    if (target.kind === 'folder' || target.kind === 'tree-output' || target.kind === 'tree-root') {
      return { kind: 'moveNode' };
    }
    return { kind: 'none' };
  }
  if (target.kind === 'folder') return { kind: 'createOutputFromFolder' };
  if (origin.kind === 'source') return { kind: 'addFromSource' };
  // origin ist ein Output, target ein Output oder ein Baum-Output.
  return modifier ? { kind: 'copyItems' } : { kind: 'moveItems' };
}

export interface CellRect {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function hitTestMarquee(cells: CellRect[], marquee: Marquee): string[] {
  const left = Math.min(marquee.x0, marquee.x1);
  const right = Math.max(marquee.x0, marquee.x1);
  const top = Math.min(marquee.y0, marquee.y1);
  const bottom = Math.max(marquee.y0, marquee.y1);
  // Echte Ueberlappung, keine blosse Beruehrung: strikte Vergleiche.
  return cells
    .filter((cell) => cell.left < right && cell.right > left && cell.top < bottom && cell.bottom > top)
    .map((cell) => cell.id);
}

/**
 * Einfuegeposition aus der Zeigerposition: vor einer Zelle, wenn der Zeiger in
 * ihrer linken Haelfte liegt, sonst danach. Zeilen werden ueber die vertikale
 * Naehe beruecksichtigt, indem die Zelle mit dem kleinsten Abstand gewinnt.
 */
export function insertionIndex(cells: CellRect[], pointerX: number, pointerY: number): number {
  if (cells.length === 0) return 0;
  let bestIndex = cells.length;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const centerX = (cell.left + cell.right) / 2;
    const centerY = (cell.top + cell.bottom) / 2;
    const distance = Math.hypot(pointerX - centerX, pointerY - centerY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = pointerX < centerX ? i : i + 1;
    }
  }
  return bestIndex;
}
