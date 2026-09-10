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

async function extractDocxText(bytes: Uint8Array): Promise<string> {
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
    return extractDocxText(bytes);
  }
  if (hasEntryStartingWith(entries, 'xl/')) {
    return extractXlsxText(bytes);
  }
  if (Object.keys(entries).some((name) => /^ppt\/slides\/slide.*\.xml$/.test(name))) {
    return extractPptxText(entries);
  }

  return new TextDecoder().decode(bytes);
}
