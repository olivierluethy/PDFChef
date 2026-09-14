// Die Schriftgroesse wird als Bruchteil der Seitenhoehe gespeichert (zoomunabhaengig).
// Fuers Eingeben rechnen wir in Punkt um -- Bezug ist die A4-Hoehe (842 pt), die
// Grundgroesse dieser App. So kann der Nutzer vertraute Werte wie 14,5 pt tippen.
export const PT_BASIS = 842;
export const DEFAULT_FONT_SIZE = 0.024;
export const MIN_FONT_SIZE = 0.01;
export const MAX_FONT_SIZE = 0.08;

export const clampFontSize = (n: number) => Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, n));
export const fractionToPt = (fraction: number) => Math.round(fraction * PT_BASIS * 10) / 10;
export const ptToFraction = (pt: number) => clampFontSize(pt / PT_BASIS);

// Drehwinkel stets als 0..359 Grad normalisieren (negatives modulo einbezogen).
export const normalizeAngle = (deg: number) => (((Math.round(deg) % 360) + 360) % 360);

// Randstaerke in der Leiste ebenfalls in Punkt anzeigen.
export const strokeToPt = (fraction: number) => Math.round(fraction * PT_BASIS * 10) / 10;
export const ptToStroke = (pt: number) => Math.min(0.02, Math.max(0.0005, pt / PT_BASIS));
