import type { BlockRef, SourceId, SourceKind } from '../domain/types';
import type { DetectedField, DocumentAdapter, PageText, RenderOpts, RenderedBitmap } from './types';

export interface DispatchDeps {
  sourceKindOf(sourceId: SourceId): SourceKind | undefined;
  byKind: Partial<Record<SourceKind, DocumentAdapter>>;
}

function adapterFor(deps: DispatchDeps, sourceId: SourceId): DocumentAdapter {
  const kind = deps.sourceKindOf(sourceId);
  if (!kind) {
    throw new Error(`Zur Quelle ${sourceId} ist keine Quellart bekannt.`);
  }
  const adapter = deps.byKind[kind];
  if (!adapter) {
    throw new Error(`Fuer die Quellart ${kind} ist kein Adapter registriert.`);
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
      throw new Error('Der Dispatcher wird nicht fuer den Import benutzt.');
    },

    probe(): Promise<never> {
      throw new Error('Der Dispatcher wird nicht fuer den Import benutzt.');
    },

    async renderBlock(ref: BlockRef, opts: RenderOpts): Promise<RenderedBitmap> {
      return adapterFor(deps, ref.sourceId).renderBlock(ref, opts);
    },

    async extractText(ref: BlockRef): Promise<PageText> {
      const adapter = adapterFor(deps, ref.sourceId);
      if (!adapter.extractText) {
        throw new Error(`Der Adapter fuer ${adapter.kind} unterstuetzt keine Textextraktion.`);
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
