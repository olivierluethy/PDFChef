/**
 * Auswaehlbare Schriften fuer Ausfuell-Felder. Die Schluessel sind der Vertrag
 * zwischen Editor und Export: die Vorschau nutzt `cssFamily`/`cssWeight`, der
 * PDF-Assembler bildet denselben Schluessel auf eine pdf-lib-Standardschrift ab.
 * Standardschriften brauchen keine eingebetteten Font-Dateien.
 */
export type OverlayFontKey = 'helvetica' | 'helvetica-bold' | 'times' | 'times-bold' | 'courier';

export interface OverlayFontSpec {
  key: OverlayFontKey;
  label: string;
  cssFamily: string;
  cssWeight: number;
}

export const OVERLAY_FONTS: OverlayFontSpec[] = [
  {
    key: 'helvetica',
    label: 'Helvetica',
    cssFamily: 'Helvetica, Arial, sans-serif',
    cssWeight: 400,
  },
  {
    key: 'helvetica-bold',
    label: 'Helvetica Fett',
    cssFamily: 'Helvetica, Arial, sans-serif',
    cssWeight: 700,
  },
  { key: 'times', label: 'Times', cssFamily: 'Georgia, "Times New Roman", serif', cssWeight: 400 },
  {
    key: 'times-bold',
    label: 'Times Fett',
    cssFamily: 'Georgia, "Times New Roman", serif',
    cssWeight: 700,
  },
  {
    key: 'courier',
    label: 'Courier',
    cssFamily: 'ui-monospace, "Courier New", monospace',
    cssWeight: 400,
  },
];

export const DEFAULT_OVERLAY_FONT: OverlayFontKey = 'helvetica';

/** Robuste Aufloesung: unbekannte oder fehlende Schluessel fallen auf Helvetica zurueck. */
export function overlayFontSpec(key: string | undefined): OverlayFontSpec {
  return OVERLAY_FONTS.find((font) => font.key === key) ?? OVERLAY_FONTS[0];
}
