/**
 * Formatbewusste Textextraktion fuer die `text`-Quellart. Erkennt am
 * ZIP-Magic-Byte, ob eine OOXML-Datei (DOCX/PPTX/XLSX) vorliegt, und liest
 * andernfalls einfachen Text (TXT/MD). Reine Adapter-Ebene -- keine
 * Services/UI/React-Importe.
 */

import { unzipSync, type Unzipped } from 'fflate';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

function decodeXmlEntities(value: string): string {
  return value.replace(/&amp;|&lt;|&gt;|&quot;|&apos;/g, (entity) => XML_ENTITIES[entity] ?? entity);
}

function isZip(bytes: Uint8Array): boolean {
  return ZIP_MAGIC.every((byte, index) => bytes[index] === byte);
}

function hasEntryStartingWith(entries: Unzipped, prefix: string): boolean {
  return Object.keys(entries).some((name) => name.startsWith(prefix));
}

/** Form-Feed (U+000C) als harte Seitengrenze -- von `paginateText` ausgewertet. */
const PAGE_BREAK = '\f';

/**
 * Baut den sichtbaren Text eines einzelnen `<w:p>`-Absatzes aus seinen Runs
 * zusammen und uebersetzt Umbruch-Elemente: manuelle Seitenumbrueche
 * (`<w:br w:type="page"/>`) und gerenderte Umbrueche (`<w:lastRenderedPageBreak/>`)
 * werden zu `\f`, gewoehnliche Zeilenumbrueche (`<w:br/>`, `<w:cr/>`) zu `\n`,
 * Tabs zu `\t`.
 */
function paragraphText(paragraphXml: string): string {
  const token =
    /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*?\/?>|<w:cr\b[^>]*?\/?>|<w:lastRenderedPageBreak\b[^>]*?\/?>|<w:br\b[^>]*?\/?>/g;
  let out = '';
  let match: RegExpExecArray | null;
  while ((match = token.exec(paragraphXml)) !== null) {
    const raw = match[0];
    if (match[1] !== undefined) {
      out += decodeXmlEntities(match[1]);
    } else if (raw.startsWith('<w:tab')) {
      out += '\t';
    } else if (raw.startsWith('<w:cr')) {
      out += '\n';
    } else if (raw.startsWith('<w:lastRenderedPageBreak')) {
      out += PAGE_BREAK;
    } else {
      // <w:br ...>: nur mit w:type="page" ein Seitenumbruch, sonst Zeilenumbruch.
      out += /w:type\s*=\s*"page"/.test(raw) ? PAGE_BREAK : '\n';
    }
  }
  return out;
}

/**
 * Rekonstruiert den Text aus `word/document.xml` absatzweise und fuegt an
 * echten Word-Seitengrenzen ein `\f` ein: manuelle/gerenderte Umbrueche in den
 * Runs sowie Abschnittswechsel (ein `<w:sectPr>` innerhalb eines Absatzes).
 * Das abschliessende `<w:sectPr>` auf Body-Ebene liegt ausserhalb jedes
 * `<w:p>` und wird daher korrekt ignoriert. Absaetze werden -- wie mammoth --
 * mit einer Leerzeile getrennt. `hasBreaks` zeigt an, ob echte Seitengrenzen
 * gefunden wurden; nur dann lohnt der Vorzug vor dem mammoth-Rohtext.
 */
export function docxXmlToText(documentXml: string): { text: string; hasBreaks: boolean } {
  const paragraphPattern = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  const paragraphs: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = paragraphPattern.exec(documentXml)) !== null) {
    const inner = match[1];
    let text = paragraphText(inner);
    if (/<w:sectPr[\s>]/.test(inner)) {
      text += PAGE_BREAK;
    }
    paragraphs.push(text);
  }

  const text = paragraphs.length > 0 ? paragraphs.join('\n\n') + '\n\n' : '';
  return { text, hasBreaks: text.includes(PAGE_BREAK) };
}

async function extractDocxText(bytes: Uint8Array, entries: Unzipped): Promise<string> {
  // Bevorzugter Pfad: eigene, umbruch-bewusste Rekonstruktion aus document.xml.
  // Nur wenn dort echte Seitengrenzen erkannt werden, hat sie Vorrang -- sonst
  // bleibt der bewaehrte mammoth-Rohtext das Ergebnis.
  const documentXml = entries['word/document.xml'];
  if (documentXml) {
    try {
      const { text, hasBreaks } = docxXmlToText(new TextDecoder().decode(documentXml));
      if (hasBreaks) return text;
    } catch (error) {
      console.warn('DOCX-Seitenumbrueche konnten nicht ausgewertet werden', error);
    }
  }

  try {
    const { value } = await mammoth.extractRawText({ arrayBuffer: bytes.slice().buffer });
    return value;
  } catch (error) {
    console.warn('DOCX konnte nicht gelesen werden', error);
    throw new Error('Diese Datei konnte nicht als Text gelesen werden.');
  }
}

function extractXlsxText(bytes: Uint8Array): string {
  try {
    const workbook = XLSX.read(bytes, { type: 'array' });
    return workbook.SheetNames.map(
      (name) => `# ${name}\n` + XLSX.utils.sheet_to_csv(workbook.Sheets[name]),
    ).join('\n\n');
  } catch (error) {
    console.warn('XLSX konnte nicht gelesen werden', error);
    throw new Error('Diese Datei konnte nicht als Text gelesen werden.');
  }
}

function extractPptxText(entries: Unzipped): string {
  try {
    const slideNames = Object.keys(entries)
      .filter((name) => /^ppt\/slides\/slide[^/]*\.xml$/.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const decoder = new TextDecoder();
    const slideTexts = slideNames.map((name) => {
      const xml = decoder.decode(entries[name]);
      const runs: string[] = [];
      const runPattern = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
      let match: RegExpExecArray | null;
      while ((match = runPattern.exec(xml)) !== null) {
        runs.push(decodeXmlEntities(match[1]));
      }
      return runs.join(' ');
    });

    return slideTexts.join('\n\n');
  } catch (error) {
    console.warn('PPTX konnte nicht gelesen werden', error);
    throw new Error('Diese Datei konnte nicht als Text gelesen werden.');
  }
}

/**
 * Extrahiert reinen Text aus TXT/MD (direkt) oder DOCX/PPTX/XLSX (via
 * OOXML-Erkennung ueber das ZIP-Magic-Byte). v1-Scope: nur Text, kein
 * Layout, keine Bilder.
 */
export async function extractTextContent(bytes: Uint8Array): Promise<string> {
  if (!isZip(bytes)) {
    return new TextDecoder().decode(bytes);
  }

  let entries: Unzipped;
  try {
    entries = unzipSync(bytes);
  } catch (error) {
    console.warn('ZIP-Container konnte nicht gelesen werden', error);
    return new TextDecoder().decode(bytes);
  }

  if (hasEntryStartingWith(entries, 'word/')) {
    return extractDocxText(bytes, entries);
  }
  if (hasEntryStartingWith(entries, 'xl/')) {
    return extractXlsxText(bytes);
  }
  if (Object.keys(entries).some((name) => /^ppt\/slides\/slide.*\.xml$/.test(name))) {
    return extractPptxText(entries);
  }

  return new TextDecoder().decode(bytes);
}
