import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { PDFDocument as PDFDoc, PDFFont, PDFImage, PDFPage } from 'pdf-lib';
import type { Overlay, SourceId } from '../../domain/types';
import { OVERLAY_ITALIC_SKEW_DEG, overlayFontSpec } from '../../domain/overlayFonts';
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
      // Fuer eingebettete (Nicht-Standard-)Overlay-Schriften noetig.
      out.registerFontkit(fontkit);
      const copiedBySource = new Map<SourceId, PDFPage[]>();
      const embeddedBySource = new Map<SourceId, { image: PDFImage; data: ImageEmbeddable }>();
      const textPagesBySource = new Map<SourceId, string[][]>();
      let courierFont: PDFFont | undefined;
      // Overlay-Schriften werden je Schluessel genau einmal eingebettet.
      const overlayFonts = new Map<string, PDFFont>();
      let overlayFallback: PDFFont | undefined;
      const getOverlayFont = async (key: string | undefined, bold: boolean) => {
        const spec = overlayFontSpec(key);
        const cacheKey = `${spec.key}:${bold ? 'b' : 'r'}`;
        const cached = overlayFonts.get(cacheKey);
        if (cached) return cached;
        // Eingebettete Familie: passenden Schnitt (Regular/Bold) holen und einbetten.
        const file = bold && spec.boldFile ? spec.boldFile : spec.file;
        if (file) {
          try {
            const bytes = await ctx.fontBytes(file);
            const font = await out.embedFont(bytes, { subset: true });
            overlayFonts.set(cacheKey, font);
            return font;
          } catch (error) {
            console.warn(`Overlay-Font ${spec.key} nicht einbettbar, nutze Helvetica`, error);
            overlayFallback ??= await out.embedFont(StandardFonts.Helvetica);
            overlayFonts.set(cacheKey, overlayFallback);
            return overlayFallback;
          }
        }
        const font = await out.embedFont(standardFontFor(spec.key, bold));
        overlayFonts.set(cacheKey, font);
        return font;
      };

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
/** Bildet einen Overlay-Schriftschluessel auf eine pdf-lib-Standardschrift ab. */
function standardFontFor(key: string | undefined, bold: boolean): StandardFonts {
  switch (key) {
    case 'times':
      return bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman;
    case 'courier':
      return bold ? StandardFonts.CourierBold : StandardFonts.Courier;
    default:
      return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
  }
}

async function drawOverlays(
  out: PDFDoc,
  page: PDFPage,
  overlays: Overlay[] | undefined,
  getFont: (key: string | undefined, bold: boolean) => Promise<PDFFont>,
): Promise<void> {
  if (!overlays || overlays.length === 0) return;
  const { width: w, height: h } = page.getSize();
  for (const overlay of overlays) {
    if (overlay.kind === 'text') {
      const text = overlay.text ?? '';
      if (text.trim() === '') continue;
      const font = await getFont(overlay.font, overlay.bold ?? false);
      const size = (overlay.fontSize ?? 0.02) * h;
      page.drawText(text, {
        x: overlay.x * w,
        // y ist die Grundlinie der ersten Zeile: obere Kante minus eine Zeilenhoehe.
        y: h - overlay.y * h - size,
        size,
        font,
        color: rgb(0.09, 0.11, 0.13),
        lineHeight: size * 1.25,
        // Kursiv: synthetische Neigung (dieselbe wie in der Vorschau).
        ...(overlay.italic ? { ySkew: degrees(OVERLAY_ITALIC_SKEW_DEG) } : {}),
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
