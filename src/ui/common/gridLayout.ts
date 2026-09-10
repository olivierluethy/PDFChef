import type { CellRect } from '../workspace/dragLogic';

export function computeColumns(containerWidth: number, minCellWidth: number, gap: number): number {
  if (containerWidth <= 0) return 1;
  // n Zellen brauchen (n-1) Abstaende: n*w + (n-1)*gap <= width.
  const columns = Math.floor((containerWidth + gap) / (minCellWidth + gap));
  return Math.max(1, columns);
}

export function computeCellRects(
  count: number,
  columns: number,
  cellWidth: number,
  cellHeight: number,
  gap: number,
): CellRect[] {
  const rects: CellRect[] = [];
  for (let index = 0; index < count; index++) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = column * (cellWidth + gap);
    const top = row * (cellHeight + gap);
    rects.push({ id: String(index), left, top, right: left + cellWidth, bottom: top + cellHeight });
  }
  return rects;
}
