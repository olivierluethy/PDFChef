/**
 * Daten- und Byte-Seite des kuratierten Font-Sets (ohne DOM). Quelle ist
 * public/fonts/manifest.json, das der Sync-Schritt schreibt. Dieselbe TTF dient
 * der Vorschau (@font-face, siehe ui/text/fontCatalog) UND dem Export
 * (Einbettung durch pdf-lib) -- so sieht Text ueberall gleich aus.
 */

export type FontCategory = 'sans' | 'serif' | 'mono' | 'handwriting';

export interface FontManifestEntry {
  id: string;
  label: string;
  category: FontCategory;
  /** Dateiname der Regular-TTF in public/fonts. */
  regular: string;
  /** Dateiname der Bold-TTF, falls vorhanden. */
  bold?: string;
}

const base = import.meta.env.BASE_URL;
export const FONTS_URL = `${base}fonts/`;

let catalogPromise: Promise<FontManifestEntry[]> | undefined;

/** Laedt (einmalig) das Manifest der tatsaechlich ausgelieferten Schriften. */
export function loadFontCatalog(): Promise<FontManifestEntry[]> {
  if (!catalogPromise) {
    catalogPromise = fetch(`${FONTS_URL}manifest.json`)
      .then((res) => (res.ok ? (res.json() as Promise<FontManifestEntry[]>) : []))
      .catch((error) => {
        console.warn('Font-Manifest konnte nicht geladen werden', error);
        return [];
      });
  }
  return catalogPromise;
}

/** Dateiname der einzubettenden TTF (Bold nur, wenn vorhanden). */
export function fontFileName(entry: FontManifestEntry, bold: boolean): string {
  return bold && entry.bold ? entry.bold : entry.regular;
}

/** Rohbytes einer TTF fuer die Einbettung durch pdf-lib. */
export async function loadFontBytes(file: string): Promise<Uint8Array> {
  const res = await fetch(`${FONTS_URL}${file}`);
  if (!res.ok) throw new Error(`Schriftdatei ${file} konnte nicht geladen werden.`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Default-Font fuer neue Textfelder: erstes Sans, sonst das erste ueberhaupt. */
export function defaultFontId(entries: FontManifestEntry[]): string {
  return (entries.find((entry) => entry.category === 'sans') ?? entries[0])?.id ?? 'roboto';
}

/** Erste Handschrift -- fuer "Unterschrift tippen". */
export function firstHandwritingId(entries: FontManifestEntry[]): string | undefined {
  return entries.find((entry) => entry.category === 'handwriting')?.id;
}

/**
 * Byte-Resolver fuer den Export: fontId + bold -> TTF-Bytes, ueber das Manifest.
 * Faellt auf den ersten Katalogeintrag zurueck, falls die fontId fehlt.
 */
export async function resolveFontBytes(fontId: string, bold: boolean): Promise<Uint8Array> {
  const entries = await loadFontCatalog();
  const entry = entries.find((candidate) => candidate.id === fontId) ?? entries[0];
  if (!entry) throw new Error('Kein Font im Katalog verfuegbar.');
  return loadFontBytes(fontFileName(entry, bold));
}
