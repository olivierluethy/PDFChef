/**
 * Reine, framework-freie Pagination fuer Textquellen. Wird sowohl vom
 * Text-Adapter (Rendern von Thumbnails) als auch vom PDF-Assembler
 * (Komposition der finalen Seiten) benutzt -- beide muessen exakt dieselben
 * Seitengrenzen sehen.
 */

export const TEXT_PAGE = { width: 595, height: 842, margin: 48, fontSize: 11, lineHeight: 15 } as const;

/** Aus Seitenbreite/Monospace-Zeichenbreite abgeleitet, fest. */
export const CHARS_PER_LINE = 90;

export const LINES_PER_PAGE = Math.floor((TEXT_PAGE.height - 2 * TEXT_PAGE.margin) / TEXT_PAGE.lineHeight);

function wrapLine(line: string): string[] {
  if (line.length === 0) return [''];
  const chunks: string[] = [];
  for (let index = 0; index < line.length; index += CHARS_PER_LINE) {
    chunks.push(line.slice(index, index + CHARS_PER_LINE));
  }
  return chunks;
}

/**
 * Normalisiert Zeilenenden, bricht jede Quellzeile hart bei `CHARS_PER_LINE`
 * um und verteilt das Ergebnis auf Seiten zu `LINES_PER_PAGE` Zeilen. Liefert
 * immer mindestens eine (ggf. leere) Seite.
 */
export function paginateText(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const sourceLines = normalized.split('\n');

  const lines: string[] = [];
  for (const line of sourceLines) {
    lines.push(...wrapLine(line));
  }

  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += LINES_PER_PAGE) {
    pages.push(lines.slice(index, index + LINES_PER_PAGE));
  }

  return pages.length > 0 ? pages : [['']];
}
