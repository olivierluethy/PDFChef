import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { docxXmlToText, extractTextContent } from './extractText';
import { paginateText } from './textLayout';

/** Baut minimales WordprocessingML fuer einen Body aus Absaetzen. */
function body(inner: string): string {
  return `<?xml version="1.0"?><w:document xmlns:w="ns"><w:body>${inner}</w:body></w:document>`;
}

function para(runs: string): string {
  return `<w:p>${runs}</w:p>`;
}

function text(value: string): string {
  return `<w:r><w:t>${value}</w:t></w:r>`;
}

describe('docxXmlToText', () => {
  it('verbindet Absaetze wie mammoth mit Leerzeile und ohne harte Umbrueche', () => {
    const xml = body(para(text('Absatz eins')) + para(text('Absatz zwei')));
    const { text: out, hasBreaks } = docxXmlToText(xml);
    expect(hasBreaks).toBe(false);
    expect(out).toBe('Absatz eins\n\nAbsatz zwei\n\n');
  });

  it('dekodiert XML-Entities im Lauftext', () => {
    const xml = body(para(text('A &amp; B &lt;x&gt;')));
    expect(docxXmlToText(xml).text).toContain('A & B <x>');
  });

  it('setzt bei manuellem Seitenumbruch einen Form-Feed', () => {
    const xml = body(para(text('vor') + '<w:r><w:br w:type="page"/></w:r>' + text('nach')));
    const { text: out, hasBreaks } = docxXmlToText(xml);
    expect(hasBreaks).toBe(true);
    expect(out).toContain('vor\fnach');
    expect(paginateText(out)).toHaveLength(2);
  });

  it('behandelt einen gewoehnlichen Zeilenumbruch nicht als Seitenumbruch', () => {
    const xml = body(para(text('a') + '<w:r><w:br/></w:r>' + text('b')));
    const { text: out, hasBreaks } = docxXmlToText(xml);
    expect(hasBreaks).toBe(false);
    expect(out).toContain('a\nb');
  });

  it('erkennt gerenderte Seitenumbrueche (lastRenderedPageBreak)', () => {
    const xml = body(para(text('eins') + '<w:r><w:lastRenderedPageBreak/></w:r>' + text('zwei')));
    expect(docxXmlToText(xml).hasBreaks).toBe(true);
  });

  it('erkennt einen Abschnittswechsel (sectPr im Absatz) als Seitengrenze', () => {
    const xml = body(
      para('<w:pPr><w:sectPr><w:type w:val="nextPage"/></w:sectPr></w:pPr>' + text('Abschnittsende')) +
        para(text('neuer Abschnitt')),
    );
    const { text: out, hasBreaks } = docxXmlToText(xml);
    expect(hasBreaks).toBe(true);
    expect(paginateText(out).length).toBeGreaterThanOrEqual(2);
  });

  it('ignoriert das abschliessende sectPr auf Body-Ebene', () => {
    const xml =
      `<?xml version="1.0"?><w:document xmlns:w="ns"><w:body>` +
      para(text('nur ein Absatz')) +
      `<w:sectPr><w:type w:val="nextPage"/></w:sectPr></w:body></w:document>`;
    expect(docxXmlToText(xml).hasBreaks).toBe(false);
  });

  it('ergibt bei zwei manuellen Umbruechen drei Quellseiten', () => {
    const xml = body(
      para(text('S1') + '<w:r><w:br w:type="page"/></w:r>' + text('S2') + '<w:r><w:br w:type="page"/></w:r>' + text('S3')),
    );
    expect(paginateText(docxXmlToText(xml).text)).toHaveLength(3);
  });
});

describe('extractTextContent (DOCX-Integration)', () => {
  /** Baut einen echten OOXML-Container (ZIP mit word/document.xml). */
  function buildDocx(documentXml: string): Uint8Array {
    return zipSync({
      '[Content_Types].xml': strToU8(
        '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
      ),
      'word/document.xml': strToU8(documentXml),
    });
  }

  it('erkennt einen manuellen Seitenumbruch in einer echten DOCX-Datei', async () => {
    const xml = body(para(text('Erste Seite') + '<w:r><w:br w:type="page"/></w:r>' + text('Zweite Seite')));
    const bytes = buildDocx(xml);

    const content = await extractTextContent(bytes);
    expect(content).toContain('\f');
    expect(paginateText(content)).toHaveLength(2);
  });
});
