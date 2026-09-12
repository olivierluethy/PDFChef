import type { BlockRef, SourceId, SourceKind } from '../domain/types';
import type { DetectedField, DocumentAdapter, PageText, RenderOpts, RenderedBitmap } from './types';

export interface DispatchDeps {
  sourceKindOf(sourceId: SourceId): SourceKind | undefined;
  byKind: Partial<Record<SourceKind, DocumentAdapter>>;
}

function adapterFor(deps: DispatchDeps, sourceId: SourceId): DocumentAdapter {
  const kind = deps.sourceKindOf(sourceId);
  if (!kind) {
    throw new Error(`No source kind is known for source ${sourceId}.`);
  }
  const adapter = deps.byKind[kind];
  if (!adapter) {
    throw new Error(`No adapter is registered for source kind ${kind}.`);
  }
  return adapter;
}

/**
 * Erfuellt `DocumentAdapter`, indem `renderBlock`/`extractText` anhand der
 * Quellart an den richtigen Unter-Adapter delegiert werden. `accepts`/`probe`
 * werden hierueber nie benutzt -- der Import geht direkt ueber die Registry.
 */
export function createDispatchingAdapter(deps: DispatchDeps): DocumentAdapter {
  return {
    // Nominal ohne Bedeutung: der Dispatcher wird nie in der Registry gefuehrt.
    kind: 'pdf',

    accepts(): boolean {
      throw new Error('The dispatcher is not used for import.');
    },

    probe(): Promise<never> {
      throw new Error('The dispatcher is not used for import.');
    },

    async renderBlock(ref: BlockRef, opts: RenderOpts): Promise<RenderedBitmap> {
      return adapterFor(deps, ref.sourceId).renderBlock(ref, opts);
    },

    async extractText(ref: BlockRef): Promise<PageText> {
      const adapter = adapterFor(deps, ref.sourceId);
      if (!adapter.extractText) {
        throw new Error(`The adapter for ${adapter.kind} does not support text extraction.`);
      }
      return adapter.extractText(ref);
    },

    async detectFields(ref: BlockRef): Promise<DetectedField[]> {
      const adapter = adapterFor(deps, ref.sourceId);
      // Nur PDF-Quellen tragen Formularfelder; alles andere liefert leer.
      return adapter.detectFields ? adapter.detectFields(ref) : [];
    },
  };
}
