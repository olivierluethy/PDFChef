import { OVERLAY_FONTS } from '../../domain/overlayFonts';

/**
 * Injiziert die @font-face-Regeln der eingebetteten Overlay-Schriften (einmalig
 * pro Seite). Familie "PDFM-<key>" -> TTF in public/fonts. Dieselbe Datei wird
 * beim Export von pdf-lib eingebettet, damit Vorschau und Export gleich aussehen.
 */
const FONTS_URL = `${import.meta.env.BASE_URL}fonts/`;
let injected = false;

export function ensureOverlayFontFaces(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const rules = OVERLAY_FONTS.filter((font) => font.file).map(
    (font) =>
      `@font-face{font-family:"PDFM-${font.key}";src:url("${FONTS_URL}${font.file}") format("truetype");font-display:swap;}`,
  );
  if (rules.length === 0) return;
  const style = document.createElement('style');
  style.dataset.pdfmOverlayFonts = 'true';
  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}
