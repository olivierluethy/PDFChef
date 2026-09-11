import * as mammoth from 'mammoth';
import { useCallback, useState } from 'react';
import { buildLatexDocument, htmlToLatex } from '../../domain/latex';
import type { SourceId } from '../../domain/types';
import { createPageTextStore } from '../../services/search/pageTextStore';
import { useServices, useWorkspace } from '../app/StoreProvider';

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function texFileName(sourceName: string): string {
  return `${sourceName.replace(/\.[^.]+$/, '')}.tex`;
}

/**
 * Baut fuer eine DOCX-Quelle ein strukturiertes LaTeX (Ueberschriften, Listen,
 * Fett/Kursiv) ueber mammoth-HTML. Liefert `null`, wenn die Struktur leer bleibt
 * oder die Konvertierung scheitert -- dann greift der Fliesstext-Weg.
 */
async function buildStructuredDocxLatex(bytes: Uint8Array, title: string): Promise<string | null> {
  try {
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer: bytes.slice().buffer });
    const body = htmlToLatex(html);
    if (!body.trim()) return null;
    return buildLatexDocument(title, [], body);
  } catch (error) {
    console.debug('Strukturierte DOCX-LaTeX-Konvertierung fehlgeschlagen', error);
    return null;
  }
}

export function useLatexExport(): { runForSource(sourceId: SourceId): Promise<void>; busy: boolean } {
  const services = useServices();
  const workspace = useWorkspace();
  const [busy, setBusy] = useState(false);

  const runForSource = useCallback(
    async (sourceId: SourceId) => {
      const source = workspace.sources[sourceId];
      if (!source) return;

      setBusy(true);
      try {
        // DOCX bevorzugt strukturiert rekonstruieren (Ueberschriften/Listen),
        // sonst wie bisher Fliesstext (PDF/Plaintext/uebrige Text-Quellen).
        if (source.kind === 'text' && /\.docx$/i.test(source.name)) {
          const bytes = await services.readBytesForSource(sourceId);
          const structured = await buildStructuredDocxLatex(bytes, source.name);
          if (structured) {
            const blob = new Blob([structured], { type: 'application/x-tex' });
            download(blob, texFileName(source.name));
            return;
          }
        }

        let pages: string[];
        if (source.kind === 'text') {
          const pageLines = await services.textPages(sourceId);
          pages = pageLines.map((lines) => lines.join('\n'));
        } else {
          // Text bei Bedarf aus dem Dokument ziehen -- nicht nur aus dem Cache,
          // sonst waere die LaTeX-Ausgabe leer, solange keine Suche/OCR lief.
          const store = createPageTextStore(services.db);
          pages = [];
          for (let blockIndex = 0; blockIndex < source.blockCount; blockIndex++) {
            const cached = await store.get(sourceId, blockIndex);
            if (cached) {
              pages.push(cached.text);
              continue;
            }
            try {
              if (!services.adapter.extractText) throw new Error('keine Textextraktion');
              const extracted = await services.adapter.extractText({ sourceId, blockIndex });
              await store.put(sourceId, extracted);
              pages.push(extracted.text);
            } catch (error) {
              console.debug('Kein extrahierbarer Text auf Seite', blockIndex, error);
              pages.push('');
            }
          }
        }

        const tex = buildLatexDocument(source.name, pages);
        const blob = new Blob([tex], { type: 'application/x-tex' });
        download(blob, texFileName(source.name));
      } catch (error) {
        console.error('LaTeX-Export fehlgeschlagen', error);
      } finally {
        setBusy(false);
      }
    },
    [services, workspace],
  );

  return { runForSource, busy };
}
