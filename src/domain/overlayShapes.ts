import type { Overlay, ShapeKind } from './types';

/**
 * Katalog, Standardwerte und Geometrie der Zeichenformen. Rein funktional (kein
 * React), damit Editor (`ui/preview/OverlayShape.tsx`) und Export
 * (`adapters/pdf/pdfAssembler.ts`) exakt dieselbe Form erzeugen -- Vorschau ==
 * Export, wie schon bei Text und Unterschrift.
 */

/** Wie eine Form erzeugt und gestylt wird. */
export type ShapeCategory =
  /** Ueber ein aufgezogenes Rechteck definiert (Fuellung + Rand + optional Text). */
  | 'box'
  /** Ueber Stuetzpunkte definiert (Linie/Pfeil/Polygon/Freihand). */
  | 'line'
  /** Fester Pfad in der Box (Haken/Kreuz). */
  | 'mark';

export interface ShapeSpec {
  kind: ShapeKind;
  label: string;
  category: ShapeCategory;
  /** Kann eine Fuellfarbe tragen (Rechteck/Ellipse/Polygon/Highlight). */
  supportsFill: boolean;
  /** Kann zentrierten Text tragen (nur die Kasten-Formen). */
  supportsText: boolean;
}

export const SHAPE_SPECS: ShapeSpec[] = [
  { kind: 'rect', label: 'Rechteck', category: 'box', supportsFill: true, supportsText: true },
  { kind: 'roundRect', label: 'Abgerundet', category: 'box', supportsFill: true, supportsText: true },
  { kind: 'ellipse', label: 'Ellipse', category: 'box', supportsFill: true, supportsText: true },
  { kind: 'line', label: 'Linie', category: 'line', supportsFill: false, supportsText: false },
  { kind: 'arrow', label: 'Pfeil', category: 'line', supportsFill: false, supportsText: false },
  { kind: 'polygon', label: 'Polygon', category: 'line', supportsFill: true, supportsText: false },
  { kind: 'freehand', label: 'Freihand', category: 'line', supportsFill: false, supportsText: false },
  { kind: 'highlight', label: 'Textmarker', category: 'box', supportsFill: true, supportsText: false },
  { kind: 'check', label: 'Haken', category: 'mark', supportsFill: false, supportsText: false },
  { kind: 'cross', label: 'Kreuz', category: 'mark', supportsFill: false, supportsText: false },
];

const SHAPE_BY_KIND = new Map(SHAPE_SPECS.map((spec) => [spec.kind, spec]));

export function shapeSpec(kind: ShapeKind): ShapeSpec {
  return SHAPE_BY_KIND.get(kind) ?? SHAPE_SPECS[0];
}

/** true, wenn die Form dieses Overlays zentrierten Text tragen kann. */
export function overlayShapeSupportsText(overlay: Overlay): boolean {
  return overlay.kind === 'shape' && !!overlay.shape && shapeSpec(overlay.shape).supportsText;
}

// --- Standardwerte ------------------------------------------------------------

export const DEFAULT_STROKE = '#1f6feb';
export const DEFAULT_FILL = 'none';
/** Randstaerke als Bruchteil der Seitenhoehe (~3,4 pt bei A4). */
export const DEFAULT_STROKE_WIDTH = 0.004;
export const HIGHLIGHT_FILL = '#ffe14d';
export const HIGHLIGHT_OPACITY = 0.4;
export const DEFAULT_SHAPE_TEXT_COLOR = '#15181c';

/** Farbpaletten fuer die Auswahl im Editor. */
export const OVERLAY_COLORS = [
  '#15181c',
  '#5b6470',
  '#dc2626',
  '#ea580c',
  '#f59e0b',
  '#16a34a',
  '#0891b2',
  '#1f6feb',
  '#7c3aed',
  '#db2777',
  '#ffffff',
];

export const HIGHLIGHT_COLORS = ['#ffe14d', '#a7f3d0', '#bfdbfe', '#fbcfe8', '#fca5a5', '#ddd6fe'];

// --- Fabrik -------------------------------------------------------------------

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Legt ein Form-Overlay mit sinnvollen Standardwerten an. `points` (nur fuer
 * Linien-Formen) sind relativ zur Box (je 0..1). Die Id wird hereingegeben,
 * damit Commands deterministisch bleiben.
 */
export function makeShapeOverlay(
  id: string,
  kind: ShapeKind,
  box: Box,
  points?: number[],
): Overlay {
  const base: Overlay = {
    id,
    kind: 'shape',
    shape: kind,
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
  };
  if (kind === 'highlight') {
    return { ...base, fill: HIGHLIGHT_FILL, opacity: HIGHLIGHT_OPACITY };
  }
  const spec = shapeSpec(kind);
  const shape: Overlay = {
    ...base,
    stroke: DEFAULT_STROKE,
    strokeWidth: DEFAULT_STROKE_WIDTH,
    fill: spec.supportsFill ? DEFAULT_FILL : undefined,
  };
  if (points) shape.points = points;
  return shape;
}

// --- Geometrie ----------------------------------------------------------------

/** Bruchteil-Punkte in absolute Box-Koordinaten (Einheiten `w`x`h`) skalieren. */
export function scalePoints(points: number[], w: number, h: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    out.push(points[i] * w, points[i + 1] * h);
  }
  return out;
}

/** SVG-Pfad (y nach unten) fuer Polygon/Freihand in einer Box `w`x`h`. */
export function pointsToPath(points: number[], w: number, h: number, close: boolean): string {
  const scaled = scalePoints(points, w, h);
  if (scaled.length < 2) return '';
  let d = `M ${scaled[0]} ${scaled[1]}`;
  for (let i = 2; i + 1 < scaled.length; i += 2) d += ` L ${scaled[i]} ${scaled[i + 1]}`;
  if (close) d += ' Z';
  return d;
}

/** #RRGGBB (oder #RGB) in 0..1-Kanaele; unklare Werte werden zu Schwarz. */
export function hexToRgb01(hex: string | undefined): { r: number; g: number; b: number } {
  if (!hex) return { r: 0, g: 0, b: 0 };
  let value = hex.trim().replace('#', '');
  if (value.length === 3) {
    value = value
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (value.length !== 6) return { r: 0, g: 0, b: 0 };
  const int = Number.parseInt(value, 16);
  if (!Number.isFinite(int)) return { r: 0, g: 0, b: 0 };
  return {
    r: ((int >> 16) & 0xff) / 255,
    g: ((int >> 8) & 0xff) / 255,
    b: (int & 0xff) / 255,
  };
}

/** true, wenn eine Fuellfarbe wirklich gezeichnet werden soll. */
export function hasFill(fill: string | undefined): boolean {
  return !!fill && fill !== 'none' && fill !== 'transparent';
}
