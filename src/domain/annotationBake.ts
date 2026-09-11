import type { SignatureAnnotation, TextAnnotation } from './types';

/**
 * Rechnet Annotationen (in Bruchteilen der ANZEIGE-Flaeche) in konkrete
 * pdf-lib-Zeichenparameter um -- korrekt fuer alle Seitendrehungen.
 *
 * Modell: Die Anzeigeflaeche ist die Seite nach ihrer Gesamtdrehung `rot`
 * (Quellen-/Rotate + additive Item-Rotation), im Uhrzeigersinn. pdf-lib zeichnet
 * dagegen im UNGEDREHTEN Seitenraum (Ursprung unten links, y nach oben); der
 * /Rotate-Eintrag der Seite dreht Inhalt UND Annotation gemeinsam fuer die
 * Anzeige. Wir bilden also Anzeigekoordinaten auf den ungedrehten Raum ab und
 * drehen die gezeichneten Objekte so, dass sie nach dem /Rotate aufrecht stehen.
 */

export type Quadrant = 0 | 90 | 180 | 270;

export interface Pt {
  x: number;
  y: number;
}

/** Groesse der Anzeigeflaeche in Punkten (Breite/Hoehe bei 90/270 vertauscht). */
export function displayBox(rot: Quadrant, pageW: number, pageH: number): { w: number; h: number } {
  return rot === 90 || rot === 270 ? { w: pageH, h: pageW } : { w: pageW, h: pageH };
}

/** Eine Ecke der Anzeigeflaeche (dx von links, dy von oben) -> pdf-Punkt (y nach oben). */
export function cornerToPdf(dx: number, dy: number, rot: Quadrant, pageW: number, pageH: number): Pt {
  let rx: number;
  let ry: number;
  switch (rot) {
    case 90:
      rx = dy;
      ry = pageH - dx;
      break;
    case 180:
      rx = pageW - dx;
      ry = pageH - dy;
      break;
    case 270:
      rx = pageW - dy;
      ry = dx;
      break;
    default:
      rx = dx;
      ry = dy;
  }
  return { x: rx, y: pageH - ry };
}

/** Zeichenwinkel (CCW, Grad), damit ein anzeige-aufrechtes Objekt nach /Rotate aufrecht steht. */
export function drawAngleDeg(rot: Quadrant, pageW: number, pageH: number): number {
  const a = cornerToPdf(0, 0, rot, pageW, pageH);
  const b = cornerToPdf(1, 0, rot, pageW, pageH);
  const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export interface ImageDrawParams {
  x: number;
  y: number;
  width: number;
  height: number;
  rotateDeg: number;
}

/** Zeichenparameter fuer eine Unterschrift (Bild). Anker = untere linke Ecke des Anzeige-Kastens. */
export function signatureDrawParams(
  annotation: SignatureAnnotation,
  rot: Quadrant,
  pageW: number,
  pageH: number,
): ImageDrawParams {
  const box = displayBox(rot, pageW, pageH);
  const dx = annotation.x * box.w;
  const dy = annotation.y * box.h;
  const w = annotation.width * box.w;
  const h = annotation.height * box.h;
  const anchor = cornerToPdf(dx, dy + h, rot, pageW, pageH); // Anzeige-unten-links
  return { x: anchor.x, y: anchor.y, width: w, height: h, rotateDeg: drawAngleDeg(rot, pageW, pageH) };
}

/** Anteil der Schriftgroesse ueber der Grundlinie -- Naeherung fuer die Grundlinienlage. */
const ASCENT_RATIO = 0.8;

export interface TextLineDraw {
  text: string;
  x: number;
  y: number;
  rotateDeg: number;
}

/**
 * Bricht den Text greedy an Wortgrenzen auf die Kastenbreite um -- mit derselben
 * Schrift/Groesse wie die Vorschau, daher optisch nah am Browser-Umbruch.
 */
export function wrapText(text: string, maxWidth: number, measure: (line: string) => number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      out.push('');
      continue;
    }
    const words = paragraph.split(/(\s+)/); // Whitespace behalten, damit Breiten stimmen
    let line = '';
    for (const token of words) {
      const candidate = line + token;
      if (line !== '' && measure(candidate.trimEnd()) > maxWidth) {
        out.push(line.trimEnd());
        line = token.trimStart();
      } else {
        line = candidate;
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

/**
 * Grundlinien-Zeichenparameter je Zeile. `measure` misst die Zeilenbreite in der
 * Zielschrift/-groesse (fuer Ausrichtung und Umbruch).
 */
export function textLineDraws(
  annotation: TextAnnotation,
  rot: Quadrant,
  pageW: number,
  pageH: number,
  measure: (line: string) => number,
): TextLineDraw[] {
  const box = displayBox(rot, pageW, pageH);
  const boxLeft = annotation.x * box.w;
  const boxTop = annotation.y * box.h;
  const boxWidth = annotation.width * box.w;
  const size = annotation.sizeFrac * box.h;
  const lineHeight = size * annotation.lineHeight;
  const rotateDeg = drawAngleDeg(rot, pageW, pageH);

  const lines = wrapText(annotation.text, boxWidth, measure);
  return lines.map((line, index) => {
    const lineBoxTop = boxTop + index * lineHeight;
    const baselineY = lineBoxTop + (lineHeight - size) / 2 + size * ASCENT_RATIO;
    const lineWidth = measure(line);
    let x = boxLeft;
    if (annotation.align === 'center') x = boxLeft + (boxWidth - lineWidth) / 2;
    else if (annotation.align === 'right') x = boxLeft + (boxWidth - lineWidth);
    const anchor = cornerToPdf(x, baselineY, rot, pageW, pageH);
    return { text: line, x: anchor.x, y: anchor.y, rotateDeg };
  });
}
