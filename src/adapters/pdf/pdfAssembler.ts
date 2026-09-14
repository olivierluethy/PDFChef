import {
  BlendMode,
  PDFDocument,
  StandardFonts,
  concatTransformationMatrix,
  degrees,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { PDFDocument as PDFDoc, PDFFont, PDFForm, PDFImage, PDFPage } from 'pdf-lib';
import type { Overlay, SourceId } from '../../domain/types';
import { OVERLAY_ITALIC_SKEW_DEG, overlayFontSpec } from '../../domain/overlayFonts';
import {
  DEFAULT_STROKE_WIDTH,
  hasFill,
  hexToRgb01,
  isTransparentColor,
  overlayShapeSupportsText,
  pointsToPath,
} from '../../domain/overlayShapes';
import type { AssembleCtx, BlockAssembler, ImageEmbeddable } from '../types';
import { TEXT_PAGE } from '../text/textLayout';

/** Alles, was `drawOverlays` fuer eine Seite braucht -- einmal je Export gebaut. */
interface OverlayDrawCtx {
  out: PDFDoc;
  getFont(key: string | undefined, bold: boolean): Promise<PDFFont>;
  /** Standardschrift fuer die Optik interaktiver Felder (lazy eingebettet). */
  interactiveFont(): Promise<PDFFont>;
  form: PDFForm;
  /** Bereits vergebene AcroForm-Feldnamen -- sie muessen eindeutig sein. */
  usedFieldNames: Set<string>;
}

export function createPdfAssembler(): BlockAssembler {
  return {
    targetFormat: 'pdf',
    async assemble(items, ctx: AssembleCtx) {
      if (items.length === 0) throw new Error('This document contains no pages.');
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
            console.warn(`Overlay font ${spec.key} could not be embedded, using Helvetica`, error);
            overlayFallback ??= await out.embedFont(StandardFonts.Helvetica);
            overlayFonts.set(cacheKey, overlayFallback);
            return overlayFallback;
          }
        }
        const font = await out.embedFont(standardFontFor(spec.key, bold));
        overlayFonts.set(cacheKey, font);
        return font;
      };

      // Kontext fuers Zeichnen/Einbetten der Overlays -- einmal je Export.
      let interactiveFontCache: PDFFont | undefined;
      const overlayCtx: OverlayDrawCtx = {
        out,
        getFont: getOverlayFont,
        interactiveFont: async () =>
          (interactiveFontCache ??= await out.embedFont(StandardFonts.Helvetica)),
        form: out.getForm(),
        usedFieldNames: new Set<string>(),
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
            throw new Error(`Page ${index + 1} does not exist in source ${sourceId}.`);
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
          await drawOverlays(page, entry.overlays, overlayCtx);
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
          await drawOverlays(page, entry.overlays, overlayCtx);
        } else {
          const page = copiedBySource.get(entry.sourceId)?.[entry.slot];
          if (!page) throw new Error(`Copied page missing: ${entry.sourceId}#${entry.slot}`);
          if (entry.rotation !== 0) {
            // Additiv zur Rotation der Quellseite, die die Kopie schon mitbringt.
            page.setRotation(degrees((page.getRotation().angle + entry.rotation) % 360));
          }
          out.addPage(page);
          await drawOverlays(page, entry.overlays, overlayCtx);
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
  page: PDFPage,
  overlays: Overlay[] | undefined,
  ctx: OverlayDrawCtx,
): Promise<void> {
  if (!overlays || overlays.length === 0) return;
  const { width: w, height: h } = page.getSize();

  // Dreht/spiegelt das Zeichnen eines Overlays um seinen Mittelpunkt -- deckungs-
  // gleich zur CSS-Vorschau (erst drehen, dann spiegeln). boxHpx ist die Boxhoehe
  // in PDF-Punkten (bei Text ggf. aus der Zeilenzahl geschaetzt). Ohne Drehung und
  // ohne Spiegelung wird direkt gezeichnet.
  const drawWithTransform = async (
    overlay: Overlay,
    boxHpx: number,
    sx: number,
    sy: number,
    drawFn: () => Promise<void> | void,
  ): Promise<void> => {
    const rotation = overlay.rotation ?? 0;
    const flipped = sx !== 1 || sy !== 1;
    if (!rotation && !flipped) {
      await drawFn();
      return;
    }
    const boxW = overlay.w * w;
    const cx = overlay.x * w + boxW / 2;
    const cy = h - overlay.y * h - boxHpx / 2;
    // CSS dreht im Uhrzeigersinn (y nach unten); in PDF (y nach oben) ist das -Winkel.
    const phi = (-rotation * Math.PI) / 180;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    // CTM = T(c) * R(phi) * S(sx,sy) * T(-c).
    const a = cos * sx;
    const b = sin * sx;
    const c = -sin * sy;
    const d = cos * sy;
    const e = cx - (a * cx + c * cy);
    const f = cy - (b * cx + d * cy);
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(a, b, c, d, e, f));
    await drawFn();
    page.pushOperators(popGraphicsState());
  };

  for (const overlay of overlays) {
    // Interaktive Felder werden als echte AcroForm-Felder gebaut, nicht gezeichnet.
    if (overlay.kind === 'text' && overlay.interactive) {
      await addInteractiveField(page, overlay, ctx, w, h);
      continue;
    }
    if (overlay.kind === 'text') {
      const text = overlay.text ?? '';
      if (text.trim() === '') continue;
      const font = await ctx.getFont(overlay.font, overlay.bold ?? false);
      const size = (overlay.fontSize ?? 0.02) * h;
      const lineHeight = size * 1.25;
      const lines = text.split(/\r?\n/);
      // Vertikale Ausrichtung nur bei fester Feldhoehe; sonst waechst Text von oben.
      const blockH = lines.length * lineHeight;
      const boxH = overlay.h > 0 ? overlay.h * h : blockH;
      let vOffset = 0;
      if (overlay.h > 0 && boxH > blockH) {
        vOffset =
          overlay.valign === 'middle'
            ? (boxH - blockH) / 2
            : overlay.valign === 'bottom'
              ? boxH - blockH
              : 0;
      }
      const sx = overlay.flipX ? -1 : 1;
      const sy = overlay.flipY ? -1 : 1;
      await drawWithTransform(overlay, boxH, sx, sy, () => {
        // Zeilenweise Hintergrund-/Hervorhebungsfarbe (wie Words Texthervorhebung),
        // vor dem Text gezeichnet, damit der Text darueber liegt.
        if (hasFill(overlay.textBg)) {
          const { r, g, b } = hexToRgb01(overlay.textBg!);
          const baseY0 = h - overlay.y * h - size - vOffset;
          const padX = size * 0.15;
          lines.forEach((line, i) => {
            if (line.trim() === '') return;
            const lineW = font.widthOfTextAtSize(line, size);
            page.drawRectangle({
              x: overlay.x * w - padX,
              y: baseY0 - i * lineHeight - size * 0.24,
              width: lineW + 2 * padX,
              height: size * 1.14,
              color: rgb(r, g, b),
            });
          });
        }
        page.drawText(text, {
          x: overlay.x * w,
          // y ist die Grundlinie der ersten Zeile: obere Kante minus eine Zeilenhoehe.
          y: h - overlay.y * h - size - vOffset,
          size,
          font,
          color: colorOf(overlay.color, rgb(0.09, 0.11, 0.13)),
          // Ausdruecklich transparente Textfarbe: unsichtbar zeichnen.
          ...(isTransparentColor(overlay.color) ? { opacity: 0 } : {}),
          lineHeight,
          // Kursiv: synthetische Neigung (dieselbe wie in der Vorschau).
          ...(overlay.italic ? { ySkew: degrees(OVERLAY_ITALIC_SKEW_DEG) } : {}),
        });
      });
    } else if (overlay.kind === 'shape') {
      await drawWithTransform(overlay, overlay.h * h, 1, 1, () =>
        drawShape(page, overlay, ctx, w, h),
      );
    } else if (overlay.kind === 'image' && overlay.dataUrl) {
      const image = await ctx.out.embedPng(dataUrlToBytes(overlay.dataUrl));
      await drawWithTransform(overlay, overlay.h * h, 1, 1, () => {
        page.drawImage(image, {
          x: overlay.x * w,
          y: h - overlay.y * h - overlay.h * h,
          width: overlay.w * w,
          height: overlay.h * h,
        });
      });
    }
  }
}

/** #RRGGBB in eine pdf-lib-Farbe; ohne Wert die Ersatzfarbe. */
function colorOf(hex: string | undefined, fallback: ReturnType<typeof rgb>) {
  if (!hex || hex === 'none') return fallback;
  const { r, g, b } = hexToRgb01(hex);
  return rgb(r, g, b);
}

/**
 * Zeichnet eine Form (Rechteck/Ellipse/Linie/Pfeil/Polygon/Freihand/Highlight/
 * Haken/Kreuz) samt optionalem, zentriertem Text. Box in Seitenkoordinaten:
 * links/oben aus den Bruchteilen, y von unten gerechnet.
 */
async function drawShape(
  page: PDFPage,
  overlay: Overlay,
  ctx: OverlayDrawCtx,
  w: number,
  h: number,
): Promise<void> {
  const kind = overlay.shape;
  if (!kind) return;
  const left = overlay.x * w;
  const topPdf = h - overlay.y * h; // obere Kante in PDF-Koordinaten (y von unten)
  const boxW = overlay.w * w;
  const boxH = overlay.h * h;
  const bottom = topPdf - boxH;
  const stroke = overlay.stroke ? hexToRgb01(overlay.stroke) : undefined;
  const strokeC = stroke ? rgb(stroke.r, stroke.g, stroke.b) : undefined;
  const strokeW = (overlay.strokeWidth ?? DEFAULT_STROKE_WIDTH) * h;
  const fillC = hasFill(overlay.fill) ? colorOf(overlay.fill, rgb(0, 0, 0)) : undefined;
  const opacity = overlay.opacity ?? 1;
  // Punkte relativ zur Box in PDF-Koordinaten (y von unten).
  const pdfPoint = (px: number, py: number) => ({ x: left + px * boxW, y: topPdf - py * boxH });

  switch (kind) {
    case 'rect':
    case 'roundRect': {
      if (kind === 'roundRect') {
        // Abgerundetes Rechteck als SVG-Pfad (drawRectangle kennt keinen Radius).
        const r = Math.min(boxW, boxH) * 0.12;
        const path = roundedRectPath(boxW, boxH, r);
        page.drawSvgPath(path, {
          x: left,
          y: topPdf,
          color: fillC,
          opacity: fillC ? opacity : undefined,
          borderColor: strokeC,
          borderWidth: strokeC ? strokeW : undefined,
          borderOpacity: strokeC ? opacity : undefined,
        });
      } else {
        page.drawRectangle({
          x: left,
          y: bottom,
          width: boxW,
          height: boxH,
          color: fillC,
          opacity: fillC ? opacity : undefined,
          borderColor: strokeC,
          borderWidth: strokeC ? strokeW : undefined,
          borderOpacity: strokeC ? opacity : undefined,
        });
      }
      break;
    }
    case 'highlight': {
      page.drawRectangle({
        x: left,
        y: bottom,
        width: boxW,
        height: boxH,
        color: fillC ?? rgb(1, 0.88, 0.3),
        opacity,
        blendMode: BlendMode.Multiply,
      });
      break;
    }
    case 'ellipse': {
      page.drawEllipse({
        x: left + boxW / 2,
        y: bottom + boxH / 2,
        xScale: boxW / 2,
        yScale: boxH / 2,
        color: fillC,
        opacity: fillC ? opacity : undefined,
        borderColor: strokeC,
        borderWidth: strokeC ? strokeW : undefined,
        borderOpacity: strokeC ? opacity : undefined,
      });
      break;
    }
    case 'line':
    case 'arrow': {
      const pts = overlay.points ?? [0, 0, 1, 1];
      const start = pdfPoint(pts[0] ?? 0, pts[1] ?? 0);
      const end = pdfPoint(pts[2] ?? 1, pts[3] ?? 1);
      const color = strokeC ?? rgb(0, 0, 0);
      page.drawLine({ start, end, thickness: strokeW, color, opacity });
      if (kind === 'arrow') {
        // Zwei kurze Linien als Pfeilspitze, im Pixelraum berechnet.
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLen = Math.max(strokeW * 3.2, Math.min(boxW, boxH) * 0.28);
        const spread = Math.PI / 7;
        for (const sign of [1, -1]) {
          const a = angle + Math.PI - sign * spread;
          page.drawLine({
            start: end,
            end: { x: end.x + Math.cos(a) * headLen, y: end.y + Math.sin(a) * headLen },
            thickness: strokeW,
            color,
            opacity,
          });
        }
      }
      break;
    }
    case 'polygon':
    case 'freehand': {
      const path = pointsToPath(overlay.points ?? [], boxW, boxH, kind === 'polygon');
      if (!path) break;
      page.drawSvgPath(path, {
        x: left,
        y: topPdf,
        color: kind === 'polygon' ? fillC : undefined,
        opacity: kind === 'polygon' && fillC ? opacity : undefined,
        borderColor: strokeC ?? rgb(0, 0, 0),
        borderWidth: strokeW,
        borderOpacity: opacity,
      });
      break;
    }
    case 'check':
    case 'cross': {
      const path =
        kind === 'check'
          ? pointsToPath([0.18, 0.55, 0.42, 0.8, 0.84, 0.22], boxW, boxH, false)
          : `M ${0.22 * boxW} ${0.22 * boxH} L ${0.78 * boxW} ${0.78 * boxH} ` +
            `M ${0.78 * boxW} ${0.22 * boxH} L ${0.22 * boxW} ${0.78 * boxH}`;
      page.drawSvgPath(path, {
        x: left,
        y: topPdf,
        borderColor: strokeC ?? rgb(0, 0, 0),
        borderWidth: strokeW,
        borderOpacity: opacity,
      });
      break;
    }
  }

  // Zentrierter Text in der Form (nur Kasten-Formen).
  const text = overlay.text ?? '';
  if (text.trim() !== '' && overlayShapeSupportsText(overlay)) {
    const font = await ctx.getFont(overlay.font, overlay.bold ?? false);
    const size = (overlay.fontSize ?? 0.024) * h;
    const lineH = size * 1.25;
    const lines = text.split('\n');
    const blockH = lines.length * lineH;
    let baseline = bottom + boxH / 2 + blockH / 2 - size;
    for (const line of lines) {
      const tw = font.widthOfTextAtSize(line, size);
      page.drawText(line, {
        x: left + boxW / 2 - tw / 2,
        y: baseline,
        size,
        font,
        color: colorOf(overlay.color, rgb(0.09, 0.11, 0.13)),
        ...(isTransparentColor(overlay.color) ? { opacity: 0 } : {}),
        ...(overlay.italic ? { ySkew: degrees(OVERLAY_ITALIC_SKEW_DEG) } : {}),
      });
      baseline -= lineH;
    }
  }
}

/** SVG-Pfad eines abgerundeten Rechtecks (y nach unten, Ursprung oben links). */
function roundedRectPath(w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return (
    `M ${rr} 0 L ${w - rr} 0 Q ${w} 0 ${w} ${rr} L ${w} ${h - rr} ` +
    `Q ${w} ${h} ${w - rr} ${h} L ${rr} ${h} Q 0 ${h} 0 ${h - rr} ` +
    `L 0 ${rr} Q 0 0 ${rr} 0 Z`
  );
}

/**
 * Baut aus einem Overlay ein echtes, im Reader ausfuellbares AcroForm-Feld:
 * Textfeld, Ankreuzfeld (Optionen ['','X']) oder Auswahlliste (weitere Optionen).
 */
async function addInteractiveField(
  page: PDFPage,
  overlay: Overlay,
  ctx: OverlayDrawCtx,
  w: number,
  h: number,
): Promise<void> {
  const hFrac = overlay.h && overlay.h > 0 ? overlay.h : (overlay.fontSize ?? 0.024) * 1.7;
  const heightPx = hFrac * h;
  const rect = {
    x: overlay.x * w,
    y: h - overlay.y * h - heightPx,
    width: overlay.w * w,
    height: heightPx,
  };
  const name = uniqueFieldName(overlay, ctx.usedFieldNames);
  const font = await ctx.interactiveFont();
  const options = overlay.options;
  const isCheckbox = !!options && options.length === 2 && options[0] === '' && options[1] === 'X';

  try {
    if (isCheckbox) {
      const box = ctx.form.createCheckBox(name);
      box.addToPage(page, { ...rect });
      if ((overlay.text ?? '') === 'X') box.check();
      else box.uncheck();
    } else if (options && options.length > 0) {
      const dropdown = ctx.form.createDropdown(name);
      const values = options.filter((o) => o !== '');
      dropdown.addOptions(values);
      if (overlay.text && values.includes(overlay.text)) dropdown.select(overlay.text);
      dropdown.addToPage(page, { ...rect, font });
    } else {
      const field = ctx.form.createTextField(name);
      if (overlay.text) field.setText(overlay.text);
      field.setFontSize((overlay.fontSize ?? 0.024) * h);
      field.addToPage(page, {
        ...rect,
        font,
        textColor: colorOf(overlay.color, rgb(0.09, 0.11, 0.13)),
        borderColor: rgb(0.75, 0.78, 0.82),
        borderWidth: 0.75,
      });
    }
  } catch (error) {
    console.warn(`Interactive field ${name} could not be created`, error);
  }
}

/** Eindeutiger, dateisicherer AcroForm-Feldname; Kollisionen werden nummeriert. */
function uniqueFieldName(overlay: Overlay, used: Set<string>): string {
  const raw = (overlay.fieldName ?? '').trim();
  // Punkte trennen in AcroForm die Feldhierarchie -- deshalb entfernen.
  const base = (raw !== '' ? raw : `feld_${overlay.id}`).replace(/[.\s]+/g, '_');
  let name = base;
  let n = 2;
  while (used.has(name)) name = `${base}_${n++}`;
  used.add(name);
  return name;
}

/** Wandelt eine `data:image/png;base64,...`-URL in rohe Bytes fuer pdf-lib. */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
