/**
 * Auswaehlbare Schriften fuer Ausfuell-Felder. Der Schluessel ist eine *Familie*
 * (nicht ein einzelner Schnitt); fett/kursiv sind eigene Eigenschaften des
 * Overlays. Der Schluessel ist der Vertrag zwischen Editor und Export:
 *
 *  - Fett: echte Schnitte. Standardfamilien (Helvetica/Times/Courier) ueber die
 *    pdf-lib-Standardschriften, eingebettete Familien ueber die `boldFile`-TTF.
 *  - Kursiv: synthetische Neigung -- in der Vorschau `font-style: italic`, im
 *    Export ein `ySkew`. So funktioniert Kursiv fuer jede Familie ohne eigene
 *    Kursiv-Dateien, und Vorschau und Export sehen gleich schraeg aus.
 *
 * Die eingebetteten Familien liegen als TTF in public/fonts (siehe
 * scripts/sync-fonts.mjs); dieselbe Datei dient der @font-face-Vorschau
 * (family "PDFM-<key>" bzw. "PDFM-<key>-bold") UND der Einbettung im Export.
 */
export type OverlayFontKey =
  | 'helvetica'
  | 'times'
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

export type OverlayFontCategory = 'sans' | 'serif' | 'mono' | 'hand';

export interface OverlayFontSpec {
  key: OverlayFontKey;
  label: string;
  category: OverlayFontCategory;
  /** Generischer Fallback-Stack (auch fuer Standardfamilien der reale System-Stack). */
  fallback: string;
  /** Regular-Schriftgewicht in CSS (aktuell 400 fuer alle Familien). */
  cssWeight: number;
  /** TTF-Dateiname der Regular-Datei in public/fonts (nur eingebettete Familien). */
  file?: string;
  /** TTF-Dateiname der Bold-Datei in public/fonts (falls vorhanden). */
  boldFile?: string;
  /** true = pdf-lib-Standardfamilie: fett kommt aus der Standardschrift, nicht aus einer Datei. */
  standard?: boolean;
}

const SANS = 'Helvetica, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = 'ui-monospace, "Courier New", monospace';

export const OVERLAY_FONTS: OverlayFontSpec[] = [
  { key: 'helvetica', label: 'Helvetica', category: 'sans', fallback: SANS, cssWeight: 400, standard: true },
  { key: 'times', label: 'Times', category: 'serif', fallback: SERIF, cssWeight: 400, standard: true },
  { key: 'courier', label: 'Courier', category: 'mono', fallback: MONO, cssWeight: 400, standard: true },

  // Eingebettete Familien (public/fonts). Regular + Bold-Schnitt vorhanden.
  { key: 'roboto', label: 'Roboto', category: 'sans', fallback: 'sans-serif', cssWeight: 400, file: 'Roboto_400Regular.ttf', boldFile: 'Roboto_700Bold.ttf' },
  { key: 'open-sans', label: 'Open Sans', category: 'sans', fallback: 'sans-serif', cssWeight: 400, file: 'OpenSans_400Regular.ttf', boldFile: 'OpenSans_700Bold.ttf' },
  { key: 'lato', label: 'Lato', category: 'sans', fallback: 'sans-serif', cssWeight: 400, file: 'Lato_400Regular.ttf', boldFile: 'Lato_700Bold.ttf' },
  { key: 'montserrat', label: 'Montserrat', category: 'sans', fallback: 'sans-serif', cssWeight: 400, file: 'Montserrat_400Regular.ttf', boldFile: 'Montserrat_700Bold.ttf' },
  { key: 'merriweather', label: 'Merriweather', category: 'serif', fallback: 'serif', cssWeight: 400, file: 'Merriweather_400Regular.ttf', boldFile: 'Merriweather_700Bold.ttf' },
  { key: 'lora', label: 'Lora', category: 'serif', fallback: 'serif', cssWeight: 400, file: 'Lora_400Regular.ttf', boldFile: 'Lora_700Bold.ttf' },
  { key: 'playfair-display', label: 'Playfair Display', category: 'serif', fallback: 'serif', cssWeight: 400, file: 'PlayfairDisplay_400Regular.ttf', boldFile: 'PlayfairDisplay_700Bold.ttf' },
  { key: 'eb-garamond', label: 'EB Garamond', category: 'serif', fallback: 'serif', cssWeight: 400, file: 'EBGaramond_400Regular.ttf', boldFile: 'EBGaramond_700Bold.ttf' },
  { key: 'roboto-mono', label: 'Roboto Mono', category: 'mono', fallback: 'monospace', cssWeight: 400, file: 'RobotoMono_400Regular.ttf', boldFile: 'RobotoMono_700Bold.ttf' },
  { key: 'caveat', label: 'Caveat', category: 'hand', fallback: 'cursive', cssWeight: 400, file: 'Caveat_400Regular.ttf', boldFile: 'Caveat_700Bold.ttf' },
  { key: 'dancing-script', label: 'Dancing Script', category: 'hand', fallback: 'cursive', cssWeight: 400, file: 'DancingScript_400Regular.ttf', boldFile: 'DancingScript_700Bold.ttf' },
  { key: 'pacifico', label: 'Pacifico', category: 'hand', fallback: 'cursive', cssWeight: 400, file: 'Pacifico_400Regular.ttf' },
];

export const OVERLAY_FONT_CATEGORIES: { category: OverlayFontCategory; label: string }[] = [
  { category: 'sans', label: 'Sans-Serif' },
  { category: 'serif', label: 'Serif' },
  { category: 'mono', label: 'Monospace' },
  { category: 'hand', label: 'Handschrift' },
];

export const DEFAULT_OVERLAY_FONT: OverlayFontKey = 'helvetica';

/** Neigungswinkel des synthetischen Kursivs -- identisch in Vorschau und Export. */
export const OVERLAY_ITALIC_SKEW_DEG = 11;

/** Legacy-Schluessel aus frueheren Versionen (eigene Bold-Familien) auf die Familie abbilden. */
const LEGACY_KEYS: Record<string, OverlayFontKey> = {
  'helvetica-bold': 'helvetica',
  'times-bold': 'times',
};

/** Robuste Aufloesung: unbekannte oder fehlende Schluessel fallen auf Helvetica zurueck. */
export function overlayFontSpec(key: string | undefined): OverlayFontSpec {
  const resolved = key && LEGACY_KEYS[key] ? LEGACY_KEYS[key] : key;
  return OVERLAY_FONTS.find((font) => font.key === resolved) ?? OVERLAY_FONTS[0];
}

/** CSS-Familie fuer die Vorschau -- waehlt bei Fett die eingebettete Bold-Familie. */
export function overlayCssFamily(spec: OverlayFontSpec, bold: boolean): string {
  if (!spec.file) return spec.fallback; // Standardfamilie: System-Stack + Gewicht
  const family = bold && spec.boldFile ? `PDFM-${spec.key}-bold` : `PDFM-${spec.key}`;
  return `"${family}", ${spec.fallback}`;
}

/** true, wenn die Familie einen echten Fett-Schnitt hat (Standard oder Bold-Datei). */
export function overlayHasBold(spec: OverlayFontSpec): boolean {
  return Boolean(spec.standard || spec.boldFile);
}
