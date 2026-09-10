import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { computeColumns } from './gridLayout';

export interface VirtualGridProps {
  count: number;
  minCellWidth: number;
  /** Hoehe = Breite * cellAspect. PDF-Seiten sind hoch, also > 1. */
  cellAspect: number;
  gap: number;
  renderCell(index: number, cellWidth: number): ReactNode;
  /** Der Scrollcontainer; das interne Drag misst darueber Positionen. */
  scrollRef?: RefObject<HTMLDivElement | null>;
  overscan?: number;
}

export function VirtualGrid({
  count,
  minCellWidth,
  cellAspect,
  gap,
  renderCell,
  scrollRef,
  overscan = 2,
}: VirtualGridProps) {
  const ownRef = useRef<HTMLDivElement | null>(null);
  const ref = scrollRef ?? ownRef;
  const [width, setWidth] = useState(0);

  // Die Containerbreite bestimmt die Spaltenzahl. In jsdom ist clientWidth 0;
  // dann faellt die Spaltenzahl auf 1 und es wird trotzdem gerendert.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  const columns = computeColumns(width, minCellWidth, gap);
  const cellWidth = columns > 0 ? (width - gap * (columns - 1)) / columns || minCellWidth : minCellWidth;
  const cellHeight = cellWidth * cellAspect;
  const rowCount = Math.ceil(count / columns);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => ref.current,
    estimateSize: () => cellHeight + gap,
    overscan,
  });

  return (
    <div ref={ref} className="h-full overflow-auto" data-testid="virtual-grid">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const start = virtualRow.index * columns;
          const indices = Array.from({ length: columns }, (_, i) => start + i).filter((i) => i < count);
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'flex',
                gap,
                width: '100%',
              }}
            >
              {indices.map((index) => (
                <div key={index} style={{ width: cellWidth }}>
                  {renderCell(index, cellWidth)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
