import type { Overlay } from './types';
import { newId } from './ids';

/**
 * Wandelt eine Auswahl von Overlays in eine wiederverwendbare Vorlage: die
 * obere linke Ecke der gemeinsamen Bounding-Box wird auf (0,0) verschoben, die
 * Groessen (Bruchteile der Seite) bleiben unveraendert. So laesst sich die
 * Vorlage spaeter an einer beliebigen Stelle wieder einsetzen und behaelt
 * Groesse und relative Anordnung. Ids und Gruppierung werden hier entfernt --
 * sie entstehen erst beim Einfuegen neu.
 */

/** Grobe Hoehe eines Overlays in Bruchteilen der Seite (Text waechst selbst). */
function overlayHeight(overlay: Overlay): number {
  if (overlay.h && overlay.h > 0) return overlay.h;
  if (overlay.kind === 'text' || overlay.kind === 'shape') {
    return (overlay.fontSize ?? 0.024) * 1.4;
  }
  return 0.05;
}

export interface NormalizedOverlays {
  overlays: Overlay[];
  /** Seitenverhaeltnis (Breite/Hoehe) der Bounding-Box, fuer die Vorschau. */
  aspect: number;
}

export function normalizeOverlays(overlays: Overlay[]): NormalizedOverlays {
  if (overlays.length === 0) return { overlays: [], aspect: 1 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of overlays) {
    minX = Math.min(minX, o.x);
    minY = Math.min(minY, o.y);
    maxX = Math.max(maxX, o.x + (o.w || 0));
    maxY = Math.max(maxY, o.y + overlayHeight(o));
  }
  const width = Math.max(1e-4, maxX - minX);
  const height = Math.max(1e-4, maxY - minY);
  // Ohne Ids/Gruppen ablegen -- beim Einfuegen wird beides neu erzeugt.
  const normalized = overlays.map((o) => {
    const { id: _id, groupId: _groupId, ...rest } = o;
    void _id;
    void _groupId;
    return { ...rest, id: '', x: o.x - minX, y: o.y - minY } as Overlay;
  });
  return { overlays: normalized, aspect: width / height };
}

/**
 * Erzeugt einfuegefertige Overlays aus einer Vorlage: frische Ids, an `target`
 * (linke obere Ecke, Bruchteile der Seite) verschoben. Bei mehr als einem
 * Overlay bekommen alle dieselbe frische `groupId`, bleiben also eine Gruppe.
 */
export function instantiateOverlays(
  template: Overlay[],
  target: { x: number; y: number },
): Overlay[] {
  const groupId = template.length > 1 ? newId() : undefined;
  return template.map((o) => ({
    ...o,
    id: newId(),
    x: Math.min(0.99, Math.max(0, o.x + target.x)),
    y: Math.min(0.99, Math.max(0, o.y + target.y)),
    ...(groupId ? { groupId } : {}),
  }));
}
