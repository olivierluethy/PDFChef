import { PDFDocument } from 'pdf-lib';

/**
 * Zieht bei jeder Seite die CropBox auf die MediaBox, damit nichts abgeschnitten
 * wird. Hintergrund: pdf.js rendert fuer die Vorschau die CropBox (`page.view`),
 * und pdf-lib kopiert sie beim Export mit. Eine CropBox, die kleiner als die
 * MediaBox ist, wuerde randstaendigen Inhalt (z. B. Formularfelder wie
 * "Vorname"/"Nachname") in Vorschau UND Export wegschneiden -- obwohl das PDF
 * diese Bereiche sehr wohl enthaelt.
 *
 * Der Normalfall (CropBox == MediaBox) bleibt unberuehrt: dann werden die
 * Originalbytes unveraendert zurueckgegeben -- kein Re-Save, kein Fidelity-Risiko
 * und keine Verhaltensaenderung. Nur tatsaechlich beschnittene PDFs werden neu
 * gespeichert. Schlaegt das Parsen fehl (z. B. verschluesselt), gilt ebenfalls
 * das Original, damit kein Import/keine Vorschau daran zerbricht.
 */
export async function normalizePdfBoxes(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    let changed = false;
    for (const page of doc.getPages()) {
      const mb = page.getMediaBox();
      const cb = page.getCropBox();
      if (cb.x !== mb.x || cb.y !== mb.y || cb.width !== mb.width || cb.height !== mb.height) {
        page.setCropBox(mb.x, mb.y, mb.width, mb.height);
        changed = true;
      }
    }
    if (!changed) return bytes;
    return await doc.save();
  } catch (error) {
    console.warn('CropBox konnte nicht normalisiert werden; Originalbytes werden verwendet', error);
    return bytes;
  }
}
