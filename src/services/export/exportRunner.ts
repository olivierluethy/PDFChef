import type { BlockAssembler, ImageEmbeddable } from '../../adapters/types';
import type { ExportPlan } from '../../domain/exportPlan';
import type { SourceKind } from '../../domain/types';
import type { ExportArtifact, ExportWriter } from './writer';

export interface ExportProgress {
  done: number;
  total: number;
  currentName: string;
}

export interface ExportRunDeps {
  assembler: BlockAssembler;
  readBytes(sourceId: string): Promise<Uint8Array>;
  sourceKind(sourceId: string): SourceKind;
  imageData(sourceId: string): Promise<ImageEmbeddable>;
  textData(sourceId: string): Promise<string[][]>;
  annotationImageBytes(blobKey: string): Promise<Uint8Array>;
  fontBytes(fontId: string, bold: boolean): Promise<Uint8Array>;
  onProgress?(progress: ExportProgress): void;
  signal?: AbortSignal;
}

/**
 * Geht den ExportPlan Eintrag fuer Eintrag durch, baut die Bytes ueber den
 * Assembler und reicht sie an den Writer. Kennt weder Schreibziel noch Struktur
 * -- er orchestriert nur.
 */
export async function runExport(
  plan: ExportPlan,
  writer: ExportWriter,
  deps: ExportRunDeps,
): Promise<ExportArtifact> {
  const total = plan.entries.length;
  for (let i = 0; i < total; i++) {
    deps.signal?.throwIfAborted();
    const entry = plan.entries[i];
    const bytes = await deps.assembler.assemble(entry.items, {
      readBytes: deps.readBytes,
      sourceKind: deps.sourceKind,
      imageData: deps.imageData,
      textData: deps.textData,
      annotationImageBytes: deps.annotationImageBytes,
      fontBytes: deps.fontBytes,
      signal: deps.signal,
    });
    await writer.writeFile(entry.path, entry.fileName, bytes);
    deps.onProgress?.({ done: i + 1, total, currentName: entry.fileName });
  }
  return writer.finalize();
}
