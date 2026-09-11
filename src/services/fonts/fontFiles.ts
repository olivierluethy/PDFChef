/**
 * Laedt die Rohbytes einer eingebetteten Overlay-Schrift aus public/fonts, damit
 * pdf-lib sie beim Export einbetten kann. Dieselbe Datei liegt der
 * @font-face-Vorschau zugrunde (siehe ui/text/overlayFontFaces).
 */
const FONTS_URL = `${import.meta.env.BASE_URL}fonts/`;

export async function loadFontBytes(file: string): Promise<Uint8Array> {
  const res = await fetch(`${FONTS_URL}${file}`);
  if (!res.ok) throw new Error(`Schriftdatei ${file} konnte nicht geladen werden.`);
  return new Uint8Array(await res.arrayBuffer());
}
