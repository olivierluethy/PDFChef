import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { PDFDocument as PDFDoc, PDFFont, PDFImage, PDFPage } from 'pdf-lib';
import type { Overlay, SourceId } from '../../domain/types';
import type { AssembleCtx, BlockAssembler, ImageEmbeddable } from '../types';
import { TEXT_PAGE } from '../text/textLayout';

export function createPdfAssembler(): BlockAssembler {
  return {
    targetFormat: 'pdf',
    async assemble(items, ctx: AssembleCtx) {
      if (items.length === 0) throw new Error('Dieses Dokument enthaelt keine Seiten.');
      ctx.signal?.throwIfAborted();

      // Erst planen: pro Quelle die Liste der zu kopierenden Blockindizes --
      // mit Wiederholungen, denn eine mehrfach verwendete Quellseite braucht
      // mehrere eigene Kopien. Jeder Item merkt sich seinen Platz in dieser Liste.
      const indicesBySource = new Map<SourceId, number[]>();
      const plan = items.map((item) => {
        const indices = indicesBySource.get(item.sourceId) ?? [];
        indices.push(item.blockIndex);
        indicesBySource.set(item.sourceId, indices);
        return {
          sourceId: item.sourceId,
          slot: indices.length - 1,
          rotation: item.rotation,
          blockIndex: item.blockIndex,
          overlays: item.overlays,
        };
      });

      const out = await PDFDocument.create();
      const copiedBySource = new Map<SourceId, PDFPage[]>();
      const embeddedBySource = new Map<SourceId, { image: PDFImage; data: ImageEmbeddable }>();
      const textPagesBySource = new Map<SourceId, string[][]>();
      let courierFont: PDFFont | undefined;
      let overlayFont: PDFFont | undefined;
      const getOverlayFont = async () =>
        (overlayFont ??= await out.embedFont(StandardFonts.Helvetica));

      // Ein Ladevorgang/eine Einbettung pro Quelle: jeder weitere Aufruf
      // wuerde die Objektgraphen bzw. Bilddaten erneut einbetten.
      for (const sourceId of indicesBySource.keys()) {
        ctx.signal?.throwIfAborted();
        if (ctx.sourceKind(sourceId) === 'image') {
          const data = await ctx.imageData(sourceId);
          const image =
            data.format === 'png' ? await out.embedPng(data.bytes) : await out.embedJpg(data.bytes);
          embeddedBySource.set(sourceId, { image, data });
          continue;
        }
        if (ctx.sourceKind(sourceId) === 'text') {
          textPagesBySource.set(sourceId, await ctx.textData(sourceId));
          continue;
        }

        const indices = indicesBySource.get(sourceId) ?? [];
        const bytes = await ctx.readBytes(sourceId);
        const source = await PDFDocument.load(bytes);
        const pageCount = source.getPageCount();
        for (const index of indices) {
          if (index < 0 || index >= pageCount) {
            throw new Error(`Seite ${index + 1} existiert in der Quelle ${sourceId} nicht.`);
          }
        }
        copiedBySource.set(sourceId, await out.copyPages(source, indices));
      }

      for (const [position, entry] of plan.entries()) {
        ctx.signal?.throwIfAborted();
        const embedded = embeddedBySource.get(entry.sourceId);
        const textPages = textPagesBySource.get(entry.sourceId);
        if (embedded) {
          const { image, data } = embedded;
          const page = out.addPage([data.width, data.height]);
          page.drawImage(image, { x: 0, y: 0, width: data.width, height: data.height });
          if (entry.rotation !== 0) {
            page.setRotation(degrees(entry.rotation % 360));
          }
          await drawOverlays(out, page, entry.overlays, getOverlayFont);
        } else if (textPages) {
          courierFont ??= await out.embedFont(StandardFonts.Courier);
          const lines = textPages[entry.blockIndex] ?? [];
          const page = out.addPage([TEXT_PAGE.width, TEXT_PAGE.height]);
          lines.forEach((line, i) => {
            page.drawText(line, {
              x: TEXT_PAGE.margin,
              y: TEXT_PAGE.height - TEXT_PAGE.margin - (i + 1) * TEXT_PAGE.lineHeight,
              size: TEXT_PAGE.fontSize,
              font: courierFont,
            });
          });
          if (entry.rotation !== 0) {
            page.setRotation(degrees(entry.rotation % 360));
          }
          await drawOverlays(out, page, entry.overlays, getOverlayFont);
        } else {
          const page = copiedBySource.get(entry.sourceId)?.[entry.slot];
          if (!page) throw new Error(`Kopierte Seite fehlt: ${entry.sourceId}#${entry.slot}`);
          if (entry.rotation !== 0) {
            // Additiv zur Rotation der Quellseite, die die Kopie schon mitbringt.
            page.setRotation(degrees((page.getRotation().angle + entry.rotation) % 360));
          }
          out.addPage(page);
          await drawOverlays(out, page, entry.overlays, getOverlayFont);
        }
        ctx.onProgress?.(position + 1, plan.length);
      }

      return out.save();
    },
  };
}

/**
 * Zeichnet ausgefuellte Felder und Unterschriften auf eine Seite. Die Overlay-Masse
 * sind Bruchteile der Seite (Ursprung oben links); PDF rechnet von unten links,
 * daher die y-Spiegelung. Auf gedrehten Seiten koennen Positionen abweichen --
 * das Ausfuellen ist bewusst auf ungedrehte Seiten beschraenkt.
 */
async function drawOverlays(
  out: PDFDoc,
  page: PDFPage,
  overlays: Overlay[] | undefined,
  getFont: () => Promise<PDFFont>,
): Promise<void> {
  if (!overlays || overlays.length === 0) return;
  const { width: w, height: h } = page.getSize();
  for (const overlay of overlays) {
    if (overlay.kind === 'text') {
      const text = overlay.text ?? '';
      if (text.trim() === '') continue;
      const font = await getFont();
      const size = (overlay.fontSize ?? 0.02) * h;
      page.drawText(text, {
        x: overlay.x * w,
        // y ist die Grundlinie der ersten Zeile: obere Kante minus eine Zeilenhoehe.
        y: h - overlay.y * h - size,
        size,
        font,
        color: rgb(0.09, 0.11, 0.13),
        lineHeight: size * 1.25,
      });
    } else if (overlay.kind === 'image' && overlay.dataUrl) {
      const image = await out.embedPng(dataUrlToBytes(overlay.dataUrl));
      page.drawImage(image, {
        x: overlay.x * w,
        y: h - overlay.y * h - overlay.h * h,
        width: overlay.w * w,
        height: overlay.h * h,
      });
    }
  }
}

/** Wandelt eine `data:image/png;base64,...`-URL in rohe Bytes fuer pdf-lib. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
