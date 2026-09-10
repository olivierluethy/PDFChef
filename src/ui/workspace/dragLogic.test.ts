import { describe, expect, it } from 'vitest';
import { hitTestMarquee, insertionIndex, type CellRect } from './dragLogic';

const cells: CellRect[] = [
  { id: 'a', left: 0, top: 0, right: 100, bottom: 100 },
  { id: 'b', left: 120, top: 0, right: 220, bottom: 100 },
  { id: 'c', left: 0, top: 120, right: 100, bottom: 220 },
];

describe('hitTestMarquee', () => {
  it('trifft nur Zellen, die das Rechteck wirklich ueberlappen', () => {
    // Rechteck ueber a und c (linke Spalte), nicht b.
    expect(hitTestMarquee(cells, { x0: 10, y0: 10, x1: 90, y1: 210 }).sort()).toEqual(['a', 'c']);
  });

  it('normalisiert ein rueckwaerts aufgezogenes Rechteck', () => {
    expect(hitTestMarquee(cells, { x0: 210, y0: 90, x1: 130, y1: 10 })).toEqual(['b']);
  });

  it('blosses Beruehren der Kante zaehlt nicht als Treffer', () => {
    expect(hitTestMarquee(cells, { x0: 100, y0: 0, x1: 120, y1: 100 })).toEqual([]);
  });
});

describe('insertionIndex', () => {
  it('fuegt vor der Zelle ein, wenn der Zeiger in ihrer linken Haelfte liegt', () => {
    expect(insertionIndex(cells, 10, 50)).toBe(0);
  });

  it('fuegt hinter der Zelle ein, wenn der Zeiger in ihrer rechten Haelfte liegt', () => {
    expect(insertionIndex(cells, 90, 50)).toBe(1);
  });
});
