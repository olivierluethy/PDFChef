/**
 * Auswaehlbare Schriften fuer Ausfuell-Felder. Die Schluessel sind der Vertrag
 * zwischen Editor und Export: die Vorschau nutzt `cssFamily`/`cssWeight`, der
 * PDF-Assembler bildet denselben Schluessel entweder auf eine pdf-lib-
 * Standardschrift ab (ohne `file`) oder bettet die genannte TTF ein (`file`).
 *
 * Standardschriften (Helvetica/Times/Courier) brauchen keine Dateien und
 * funktionieren immer. Die eingebetteten Familien liegen als TTF in
 * public/fonts (siehe scripts/sync-fonts.mjs); dieselbe Datei dient der
 * @font-face-Vorschau (family "PDFM-<key>") UND der Einbettung -- so sieht der
 * Text ueberall gleich aus.
 */
export type OverlayFontKey =
  | 'helvetica'
  | 'helvetica-bold'
  | 'times'
  | 'times-bold'
  | 'courier'
  | 'roboto'
  | 'open-sans'
  | 'lato'
  | 'montserrat'
  | 'merriweather'
  | 'lora'
  | 'playfair-display'
  | 'eb-garamond'
  | 'roboto-mono'
  | 'caveat'
  | 'dancing-script'
  | 'pacifico';

export interface OverlayFontSpec {
  key: OverlayFontKey;
  label: string;
  cssFamily: string;
  cssWeight: number;
  /** TTF-Dateiname in public/fonts. Gesetzt = eingebettete Schrift (kein Standard). */
  file?: string;
}

/** CSS-Familie einer eingebetteten Schrift: das injizierte @font-face plus Fallback. */
function embedded(key: OverlayFontKey, fallback: string): string {
  return `"PDFM-${key}", ${fallback}`;
}

export const OVERLAY_FONTS: OverlayFontSpec[] = [
  { key: 'helvetica', label: 'Helvetica', cssFamily: 'Helvetica, Arial, sans-serif', cssWeight: 400 },
  { key: 'helvetica-bold', label: 'Helvetica Fett', cssFamily: 'Helvetica, Arial, sans-serif', cssWeight: 700 },
  { key: 'times', label: 'Times', cssFamily: 'Georgia, "Times New Roman", serif', cssWeight: 400 },
  { key: 'times-bold', label: 'Times Fett', cssFamily: 'Georgia, "Times New Roman", serif', cssWeight: 700 },
  { key: 'courier', label: 'Courier', cssFamily: 'ui-monospace, "Courier New", monospace', cssWeight: 400 },

  // Eingebettete Familien (public/fonts). Regular-Schnitt, breite Auswahl inkl. Handschrift.
  { key: 'roboto', label: 'Roboto', cssFamily: embedded('roboto', 'sans-serif'), cssWeight: 400, file: 'Roboto_400Regular.ttf' },
  { key: 'open-sans', label: 'Open Sans', cssFamily: embedded('open-sans', 'sans-serif'), cssWeight: 400, file: 'OpenSans_400Regular.ttf' },
  { key: 'lato', label: 'Lato', cssFamily: embedded('lato', 'sans-serif'), cssWeight: 400, file: 'Lato_400Regular.ttf' },
  { key: 'montserrat', label: 'Montserrat', cssFamily: embedded('montserrat', 'sans-serif'), cssWeight: 400, file: 'Montserrat_400Regular.ttf' },
  { key: 'merriweather', label: 'Merriweather', cssFamily: embedded('merriweather', 'serif'), cssWeight: 400, file: 'Merriweather_400Regular.ttf' },
  { key: 'lora', label: 'Lora', cssFamily: embedded('lora', 'serif'), cssWeight: 400, file: 'Lora_400Regular.ttf' },
  { key: 'playfair-display', label: 'Playfair Display', cssFamily: embedded('playfair-display', 'serif'), cssWeight: 400, file: 'PlayfairDisplay_400Regular.ttf' },
  { key: 'eb-garamond', label: 'EB Garamond', cssFamily: embedded('eb-garamond', 'serif'), cssWeight: 400, file: 'EBGaramond_400Regular.ttf' },
  { key: 'roboto-mono', label: 'Roboto Mono', cssFamily: embedded('roboto-mono', 'monospace'), cssWeight: 400, file: 'RobotoMono_400Regular.ttf' },
  { key: 'caveat', label: 'Caveat (Handschrift)', cssFamily: embedded('caveat', 'cursive'), cssWeight: 400, file: 'Caveat_400Regular.ttf' },
  { key: 'dancing-script', label: 'Dancing Script (Handschrift)', cssFamily: embedded('dancing-script', 'cursive'), cssWeight: 400, file: 'DancingScript_400Regular.ttf' },
  { key: 'pacifico', label: 'Pacifico (Handschrift)', cssFamily: embedded('pacifico', 'cursive'), cssWeight: 400, file: 'Pacifico_400Regular.ttf' },
];

export const DEFAULT_OVERLAY_FONT: OverlayFontKey = 'helvetica';

/** Robuste Aufloesung: unbekannte oder fehlende Schluessel fallen auf Helvetica zurueck. */
export function overlayFontSpec(key: string | undefined): OverlayFontSpec {
  return OVERLAY_FONTS.find((font) => font.key === key) ?? OVERLAY_FONTS[0];
}
