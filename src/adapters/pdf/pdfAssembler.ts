import { PDFDocument, degrees } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { SourceId } from '../../domain/types';
import type { AssembleCtx, BlockAssembler } from '../types';

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
        return { sourceId: item.sourceId, slot: indices.length - 1, rotation: item.rotation };
      });

      const out = await PDFDocument.create();
      const copiedBySource = new Map<SourceId, PDFPage[]>();

      // Ein Ladevorgang und ein gebuendelter copyPages-Aufruf pro Quelle:
      // jeder weitere Aufruf wuerde die Objektgraphen erneut einbetten.
      for (const [sourceId, indices] of indicesBySource) {
        ctx.signal?.throwIfAborted();
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
        const page = copiedBySource.get(entry.sourceId)?.[entry.slot];
        if (!page) throw new Error(`Kopierte Seite fehlt: ${entry.sourceId}#${entry.slot}`);
        if (entry.rotation !== 0) {
          // Additiv zur Rotation der Quellseite, die die Kopie schon mitbringt.
          page.setRotation(degrees((page.getRotation().angle + entry.rotation) % 360));
        }
        out.addPage(page);
        ctx.onProgress?.(position + 1, plan.length);
      }

      return out.save();
    },
  };
}
