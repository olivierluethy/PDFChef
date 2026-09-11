import { describe, expect, it } from 'vitest';

import { LINES_PER_PAGE, paginateText } from './textLayout';

describe('paginateText', () => {
  it('liefert fuer leeren Text genau eine (leere) Seite', () => {
    expect(paginateText('')).toEqual([['']]);
  });

  it('bricht kurzen Text auf eine Seite', () => {
    expect(paginateText('Hallo\nWelt')).toEqual([['Hallo', 'Welt']]);
  });

  it('beginnt an jedem Form-Feed (\\f) eine neue Seite', () => {
    expect(paginateText('Seite eins\fSeite zwei')).toEqual([['Seite eins'], ['Seite zwei']]);
  });

  it('erzeugt bei N Form-Feeds mindestens N+1 Seiten', () => {
    const pages = paginateText('a\fb\fc');
    expect(pages).toHaveLength(3);
    expect(pages).toEqual([['a'], ['b'], ['c']]);
  });

  it('behandelt einen abschliessenden Form-Feed als zusaetzliche leere Seite', () => {
    expect(paginateText('a\f')).toEqual([['a'], ['']]);
  });

  it('paginiert innerhalb eines Form-Feed-Abschnitts weiter nach LINES_PER_PAGE', () => {
    const longSegment = Array.from({ length: LINES_PER_PAGE + 3 }, (_, i) => `L${i}`).join('\n');
    const pages = paginateText(`${longSegment}\fkurz`);
    // erster Abschnitt: LINES_PER_PAGE + 3 Zeilen -> 2 Seiten; zweiter Abschnitt: 1 Seite
    expect(pages).toHaveLength(3);
    expect(pages[2]).toEqual(['kurz']);
  });
});
