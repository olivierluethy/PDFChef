/**
 * Reine Hilfsfunktionen fuer die Trennseiten-Erkennung (siehe
 * docs/superpowers/specs/2026-09-10-scan-detection-design.md). Kein Adapter-,
 * kein Framework-Bezug.
 */

/** Seite gilt als leer, wenn der dunkle Pixelanteil unter der Schwelle liegt. */
export function isBlank(darkFraction: number, threshold: number): boolean {
  return darkFraction < threshold;
}

/**
 * Liefert die Segmente aufeinanderfolgender NICHT-leerer Seitenindizes
 * (0..blockCount-1); leere Trennseiten werden verworfen, leere Segmente
 * entfallen.
 *
 * Beispiel: blockCount 6, blank {2} -> [[0,1],[3,4,5]].
 */
export function groupNonBlank(blockCount: number, blankIndices: Iterable<number>): number[][] {
  const blank = new Set(blankIndices);
  const segments: number[][] = [];
  let current: number[] = [];
  for (let index = 0; index < blockCount; index++) {
    if (blank.has(index)) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
      continue;
    }
    current.push(index);
  }
  if (current.length > 0) segments.push(current);
  return segments;
}
