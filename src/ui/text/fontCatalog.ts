/**
 * DOM-Seite des Font-Sets: injiziert @font-face-Regeln fuer die Live-Vorschau
 * und liefert den CSS-Familiennamen je Schnitt. Die Daten/Bytes kommen aus
 * services/fonts/fontManifest -- dieselbe TTF wie beim Export.
 */
import {
  FONTS_URL,
  loadFontCatalog,
  type FontCategory,
  type FontManifestEntry,
} from '../../services/fonts/fontManifest';

export {
  loadFontCatalog,
  defaultFontId,
  firstHandwritingId,
  type FontManifestEntry,
  type FontCategory,
} from '../../services/fonts/fontManifest';

const FALLBACK: Record<FontCategory, string> = {
  sans: 'sans-serif',
  serif: 'serif',
  mono: 'monospace',
  handwriting: 'cursive',
};

let facesInjected = false;

/** Eigener @font-face-Name je fontId/bold -- keine Angewiesenheit auf Weight-Synthese. */
function faceFamily(fontId: string, bold: boolean): string {
  return `PDFM-${fontId}${bold ? '-bold' : ''}`;
}

/** Vollstaendiger font-family-Wert inkl. Fallback fuer Style-Attribute. */
export function cssFamilyFor(entry: FontManifestEntry | undefined, bold: boolean): string {
  if (!entry) return FALLBACK.sans;
  const useBold = Boolean(bold && entry.bold);
  return `"${faceFamily(entry.id, useBold)}", ${FALLBACK[entry.category]}`;
}

function fontFaceRule(family: string, file: string): string {
  return `@font-face{font-family:"${family}";src:url("${FONTS_URL}${file}") format("truetype");font-display:swap;}`;
}

/** Injiziert die @font-face-Regeln fuer alle Schnitte (einmalig pro Seite). */
export async function ensureFontFaces(): Promise<void> {
  if (facesInjected) return;
  facesInjected = true;
  const entries = await loadFontCatalog();
  const rules: string[] = [];
  for (const entry of entries) {
    rules.push(fontFaceRule(faceFamily(entry.id, false), entry.regular));
    if (entry.bold) rules.push(fontFaceRule(faceFamily(entry.id, true), entry.bold));
  }
  if (rules.length === 0) return;
  const style = document.createElement('style');
  style.dataset.pdfmFonts = 'true';
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}
