// Windows ist das strengste der drei Zielsysteme; wer dessen Regeln einhaelt,
// kann auch auf macOS und Linux schreiben. \p{Cc} deckt alle Steuerzeichen ab.
const FORBIDDEN = /[<>:"/\\|?*]|\p{Cc}/gu;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_LENGTH = 120;

export const FALLBACK_NAME = 'Untitled';

export function sanitizeName(name: string): string {
  let out = name.replace(FORBIDDEN, ' ').replace(/\s+/g, ' ');
  // Erst kuerzen, dann die Raender saeubern: der Schnitt kann selbst einen
  // abschliessenden Punkt erzeugen, den Windows wieder verbietet.
  if (out.length > MAX_LENGTH) out = out.slice(0, MAX_LENGTH);
  out = out.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
  if (out === '') return FALLBACK_NAME;

  // Reservierte Namen gelten auch mit Endung: aus CON.pdf wird CON.pdf_.
  const base = out.split('.')[0];
  if (RESERVED.test(base)) return `${out}_`;
  return out;
}

/**
 * Dieselbe Regel wie bei neuen Outputs im UI: `Insurance` -> `Insurance 2`.
 * Der Vergleich ist case-insensitiv, weil Windows und macOS es auch sind.
 */
export function resolveCollision(desired: string, taken: Iterable<string>): string {
  const used = new Set<string>();
  for (const name of taken) used.add(name.toLowerCase());
  if (!used.has(desired.toLowerCase())) return desired;
  for (let counter = 2; ; counter++) {
    const candidate = `${desired} ${counter}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

export function uniqueNames(desired: string[], taken: Iterable<string> = []): string[] {
  const used = new Set<string>();
  for (const name of taken) used.add(name.toLowerCase());
  return desired.map((name) => {
    const resolved = resolveCollision(name, used);
    used.add(resolved.toLowerCase());
    return resolved;
  });
}

export function withPdfExtension(name: string): string {
  return `${name.replace(/\.pdf$/i, '')}.pdf`;
}
