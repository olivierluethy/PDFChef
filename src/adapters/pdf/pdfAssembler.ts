import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { PDFFont, PDFImage, PDFPage } from 'pdf-lib';
import type { Annotation, SourceId, TextAnnotation } from '../../domain/types';
import { displayBox, signatureDrawParams, textLineDraws, type Quadrant } from '../../domain/annotationBake';
import type { AssembleCtx, BlockAssembler, ImageEmbeddable } from '../types';
import { TEXT_PAGE } from '../text/textLayout';

/** Normalisiert einen Winkel auf den naechsten 90-Grad-Quadranten. */
function toQuadrant(angle: number): Quadrant {
  return ((((Math.round(angle / 90) * 90) % 360) + 360) % 360) as Quadrant;
}

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
          annotations: item.annotations ?? [],
        };
      });

      const out = await PDFDocument.create();
      out.registerFontkit(fontkit);
      const copiedBySource = new Map<SourceId, PDFPage[]>();
      const embeddedBySource = new Map<SourceId, { image: PDFImage; data: ImageEmbeddable }>();
      const textPagesBySource = new Map<SourceId, string[][]>();
      let courierFont: PDFFont | undefined;

      // Einbettungen fuer die Annotationsebene, je Export einmal.
      const fontCache = new Map<string, PDFFont>();
      const signatureCache = new Map<string, PDFImage>();
      let fallbackFont: PDFFont | undefined;

      async function textFont(fontId: string, bold: boolean): Promise<PDFFont> {
        const key = `${fontId}:${bold ? 'b' : 'r'}`;
        const cached = fontCache.get(key);
        if (cached) return cached;
        try {
          const bytes = await ctx.fontBytes(fontId, bold);
          const font = await out.embedFont(bytes, { subset: true });
          fontCache.set(key, font);
          return font;
        } catch (error) {
          console.warn(`Font ${fontId} nicht einbettbar, nutze Helvetica`, error);
          fallbackFont ??= await out.embedFont(StandardFonts.Helvetica);
          fontCache.set(key, fallbackFont);
          return fallbackFont;
        }
      }

      async function signatureImage(blobKey: string): Promise<PDFImage | undefined> {
        const cached = signatureCache.get(blobKey);
        if (cached) return cached;
        try {
          const bytes = await ctx.annotationImageBytes(blobKey);
          const image = await out.embedPng(bytes);
          signatureCache.set(blobKey, image);
          return image;
        } catch (error) {
          console.warn('Unterschrift-Bild nicht einbettbar', error);
          return undefined;
        }
      }

      async function bakeText(page: PDFPage, annotation: TextAnnotation, source: Quadrant): Promise<void> {
        const font = await textFont(annotation.fontId, annotation.bold);
        // Punktgroesse aus dem Bruchteil der Anzeigehoehe -- dieselbe Rechnung
        // wie in textLineDraws, damit Messung und Zeichnung uebereinstimmen.
        const size = annotation.sizeFrac * displayBox(source, page.getWidth(), page.getHeight()).h;
        const measure = (line: string) => font.widthOfTextAtSize(line, size);
        const color = rgb(annotation.color.r / 255, annotation.color.g / 255, annotation.color.b / 255);
        for (const line of textLineDraws(annotation, source, page.getWidth(), page.getHeight(), measure)) {
          if (line.text === '') continue;
          page.drawText(line.text, {
            x: line.x,
            y: line.y,
            size,
            font,
            color,
            rotate: degrees(line.rotateDeg),
          });
        }
      }

      async function bakeAnnotations(page: PDFPage, annotations: Annotation[], source: Quadrant): Promise<void> {
        for (const annotation of annotations) {
          ctx.signal?.throwIfAborted();
          if (annotation.kind === 'text') {
            await bakeText(page, annotation, source);
          } else {
            const image = await signatureImage(annotation.blobKey);
            if (!image) continue;
            const params = signatureDrawParams(annotation, source, page.getWidth(), page.getHeight());
            page.drawImage(image, {
              x: params.x,
              y: params.y,
              width: params.width,
              height: params.height,
              rotate: degrees(params.rotateDeg),
            });
          }
        }
      }

      // Ein Ladevorgang/eine Einbettung pro Quelle: jeder weitere Aufruf
      // wuerde die Objektgraphen bzw. Bilddaten erneut einbetten.
      for (const sourceId of indicesBySource.keys()) {
        ctx.signal?.throwIfAborted();
        if (ctx.sourceKind(sourceId) === 'image') {
          const data = await ctx.imageData(sourceId);
          const image = data.format === 'png' ? await out.embedPng(data.bytes) : await out.embedJpg(data.bytes);
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
          // Bildquellen haben keine eigene /Rotate: die Annotationsebene wird im
          // Ursprungsraster (0 Grad) gebacken, die Item-Rotation dreht die Seite.
          await bakeAnnotations(page, entry.annotations, 0);
          if (entry.rotation !== 0) {
            page.setRotation(degrees(entry.rotation % 360));
          }
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
          await bakeAnnotations(page, entry.annotations, 0);
          if (entry.rotation !== 0) {
            page.setRotation(degrees(entry.rotation % 360));
          }
        } else {
          const page = copiedBySource.get(entry.sourceId)?.[entry.slot];
          if (!page) throw new Error(`Kopierte Seite fehlt: ${entry.sourceId}#${entry.slot}`);
          // Quell-/Rotate der kopierten Seite: der Bezugsrahmen der Annotationen.
          const sourceRotation = toQuadrant(page.getRotation().angle);
          await bakeAnnotations(page, entry.annotations, sourceRotation);
          const finalRotation = (sourceRotation + entry.rotation) % 360;
          if (finalRotation !== sourceRotation) {
            // Additiv zur Rotation der Quellseite, die die Kopie schon mitbringt.
            page.setRotation(degrees(finalRotation));
          }
          out.addPage(page);
        }
        ctx.onProgress?.(position + 1, plan.length);
      }

      return out.save();
    },
  };
}
