import type { Annotation, RgbColor, SignatureAnnotation, TextAnnotation } from '../../domain/types';

/** Anzeige-Box in Pixeln: die tatsaechliche Bildflaeche, ueber der die Ebene liegt. */
export interface LayerBox {
  width: number;
  height: number;
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  return {
    r: parseInt(value.slice(0, 2), 16) || 0,
    g: parseInt(value.slice(2, 4), 16) || 0,
    b: parseInt(value.slice(4, 6), 16) || 0,
  };
}

/** Standard-Textfeld: gut lesbares Dunkel, oben links, ~1/18 der Seitenhoehe gross. */
export function newTextAnnotation(id: string, fontId: string): TextAnnotation {
  return {
    id,
    kind: 'text',
    x: 0.1,
    y: 0.1,
    width: 0.6,
    text: 'Text',
    fontId,
    bold: false,
    sizeFrac: 0.03,
    color: { r: 24, g: 24, b: 27 },
    align: 'left',
    lineHeight: 1.3,
  };
}

/**
 * Standard-Unterschrift: ~35% der Seitenbreite. Die Hoehe folgt aus dem
 * Seitenverhaeltnis des Bildes (`aspect` = Breite/Hoehe) und dem der Seite.
 */
export function newSignatureAnnotation(
  id: string,
  blobKey: string,
  aspect: number,
  pageAspect: number,
): SignatureAnnotation {
  const width = 0.35;
  const safeAspect = aspect > 0 ? aspect : 1;
  return {
    id,
    kind: 'signature',
    x: 0.1,
    y: 0.6,
    width,
    height: (width * pageAspect) / safeAspect,
    blobKey,
    aspect: safeAspect,
  };
}

/**
 * Alle Annotationen unter einem Punkt (in Bruchteilen), von unten nach oben.
 * Fuer Text zaehlt eine Naeherungshoehe, weil die echte Hoehe erst im DOM steht.
 */
export function hitTest(annotations: Annotation[], fx: number, fy: number): Annotation[] {
  return annotations.filter((annotation) => {
    const height = annotation.kind === 'signature' ? annotation.height : approxTextHeight(annotation);
    return fx >= annotation.x && fx <= annotation.x + annotation.width && fy >= annotation.y && fy <= annotation.y + height;
  });
}

/** Grobe Trefferhoehe eines Textfeldes: eine Zeile Hoehe (nur fuers Anklicken). */
function approxTextHeight(annotation: TextAnnotation): number {
  const lines = Math.max(1, annotation.text.split('\n').length);
  return annotation.sizeFrac * annotation.lineHeight * lines;
}

/** Waehlt beim wiederholten Klick auf dieselbe Stelle das jeweils naechste Feld. */
export function cycleSelection(hits: Annotation[], currentId: string | null): string | null {
  if (hits.length === 0) return null;
  // Von oben (letztes) nach unten durchreichen, damit Ueberlappungen erreichbar sind.
  const reversed = hits.map((h) => h.id).reverse();
  const currentPos = reversed.indexOf(currentId ?? '');
  return currentPos === -1 ? reversed[0] : reversed[(currentPos + 1) % reversed.length];
}
