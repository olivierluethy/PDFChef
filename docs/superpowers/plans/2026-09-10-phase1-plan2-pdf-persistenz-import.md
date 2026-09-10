# Phase 1 / Plan 2: PDF-Engine, Persistenz und Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aus der getesteten Domain von Plan 1 wird eine App, die echte PDFs importiert, ihre Seiten als Thumbnails zeigt, die Quell-Bytes lokal behaelt und nach einem Neustart alles wiederfindet -- inklusive des Assemblers, der aus einer Komposition fertige PDF-Bytes baut.

**Architecture:** Zwischen pdf.js und der Anwendung liegt eine schmale Fassade (`PdfEngine`), damit die Formatlogik des Adapters ohne Browser unit-getestet werden kann und pdf.js an genau einer Stelle konfiguriert wird. Alle Dienste erhalten ihre Abhaengigkeiten als Parameter (Blob-Store, Hash-Funktion, Id-Erzeugung, Uhr), sodass jede Einheit in Node testbar ist; das echte Zusammenspiel aus pdf.js, IndexedDB und OffscreenCanvas prueft ein Playwright-Test in Chromium.

**Tech Stack:** `pdfjs-dist` (lesen, rendern, Text), `pdf-lib` (schreiben), `idb` (IndexedDB), `fake-indexeddb` (Tests), `@playwright/test` (Integration), Vitest, React 19, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-09-10-document-workspace-design.md`

**Vorheriger Plan:** `docs/superpowers/plans/2026-09-10-phase1-plan1-fundament-domain.md` (muss vollstaendig umgesetzt und gruen sein)

## Global Constraints

- Local-first: kein Netzwerkverkehr mit Dokumentinhalten, kein Analytics, keine externen Laufzeit-Requests. pdf.js-Worker, cMaps und Standardschriften werden **mit dem Bundle** ausgeliefert, nie von einem CDN geladen.
- pdf.js wird ausschliesslich mit `isEvalSupported: false` betrieben. Importierte Dateien landen nie in `<iframe>`, `<embed>` oder `innerHTML`.
- Schichtregel (aus Plan 1, per ESLint erzwungen): `adapters` importiert nur `domain`; `services` nur `domain` und `adapters`; `ui` darf alles. Kein Modul unter `adapters` oder `services` importiert React.
- Abhaengigkeiten werden hereingegeben, nicht importiert: jeder Dienst dieses Plans wird von einer `create...`-Funktion mit einem Abhaengigkeitsobjekt gebaut. Kein Modul greift auf ein Singleton oder direkt auf `window` zu -- ausser den ausdruecklich benannten Browser-Fassaden (`pdfjsEngine.ts`, `db.ts`, `storage.ts`, `fileSources.ts`).
- Zeit und Ids kommen von aussen (`now()`, `newId()`), damit Tests ohne Mocks der Standardbibliothek auskommen.
- TypeScript `strict`, `verbatimModuleSyntax` (Typimporte als `import type`).
- Alle nutzersichtbaren Texte sind deutsch, verwenden nie das scharfe s (immer `ss`) und erklaeren die Lage in ganzen Saetzen. Stacktraces gehen in die Konsole, nie in die Oberflaeche.
- Fehlerhafte oder verschluesselte Dateien blockieren den Import der uebrigen Dateien nicht.
- Jeder Task endet mit gruenen Tests (`npm run test`), gruenem `typecheck`, gruenem `lint` und einem Commit.

## Teststrategie dieses Plans

Der Grund fuer die Aufteilung: pdf.js braucht zum Rendern ein Canvas und IndexedDB braucht einen Browser. Beides in Node zu simulieren waere aufwaendig und wuerde am Ende nicht das pruefen, was in Produktion laeuft.

| Ebene | Werkzeug | Was hier geprueft wird |
| --- | --- | --- |
| Unit (Node) | Vitest | Alle Entscheidungen: Registry-Auswahl, Pool-Verdraengung, Warteschlangen-Reihenfolge, Cache-Lebenszyklus, Namens- und Statuslogik, Autosave-Zeitverhalten, Quota-Ablehnung |
| Unit (Node, echte Bibliothek) | Vitest + `pdf-lib` | Der Assembler gegen im Test erzeugte PDFs: Reihenfolge, Rotation, Mehrfachverwendung, ein Ladevorgang pro Quelle |
| Unit (Node, Fake-Backend) | Vitest + `fake-indexeddb` | Schema, Blob-Store, Workspace-Repository, Garbage Collection |
| Integration (Chromium) | Playwright | Das echte Zusammenspiel: pdf.js liest eine Datei, OffscreenCanvas rendert ein Thumbnail, IndexedDB haelt es ueber einen Reload |

## Dateistruktur dieses Plans

| Datei | Verantwortung |
| --- | --- |
| `scripts/sync-pdf-assets.mjs` | kopiert Worker, cMaps und Standardschriften von pdf.js nach `public/pdfjs` |
| `src/adapters/types.ts` | `DocumentAdapter`, `BlockAssembler`, Probe- und Render-Typen |
| `src/adapters/registry.ts` | Registry: Datei -> Adapter, Zielformat -> Assembler |
| `src/adapters/pdf/pdfEngine.ts` | Fassade `PdfEngine` (Typen, kein pdf.js) |
| `src/adapters/pdf/pdfjsEngine.ts` | die einzige Datei, die pdf.js kennt und konfiguriert |
| `src/adapters/pdf/pdfPool.ts` | LRU-Pool offener Dokumente mit Leihzaehlern |
| `src/adapters/pdf/pdfAdapter.ts` | probe, renderBlock, extractText auf der Fassade |
| `src/adapters/pdf/pdfAssembler.ts` | Komposition -> PDF-Bytes (pdf-lib) |
| `src/services/persistence/db.ts` | IndexedDB-Schema `pdf-master`, vier Object Stores |
| `src/services/persistence/sourceBlobStore.ts` | Quell-Bytes, Garbage Collection ueber `contentHash` |
| `src/services/persistence/workspaceRepo.ts` | Workspace laden/speichern, Migrationsnaht |
| `src/services/persistence/autosave.ts` | 400 ms Debounce, Flush, Statusmodell |
| `src/services/persistence/storage.ts` | `persist()`, `estimate()`, Kontingentpruefung |
| `src/services/import/fileSources.ts` | Dateien und Ordner aus Drop, Dateidialog, Verzeichniswahl |
| `src/services/import/importSources.ts` | Erkennung, Hash, Blob ablegen, `SourceDocument` bauen |
| `src/services/thumbnails/renderQueue.ts` | Prioritaet, Abbruch, maximal drei parallele Renders |
| `src/services/thumbnails/thumbnailCache.ts` | Speicher-LRU ueber dem `thumbs`-Store, Blob-URL-Lebenszyklus |
| `src/services/thumbnails/thumbnailService.ts` | verbindet Queue, Cache, Store und Adapter |
| `src/ui/dev/ImportProbe.tsx` | provisorische Oberflaeche, die Plan 3 ersetzt |
| `playwright.config.ts`, `tests/e2e/import.spec.ts` | Integrationstest in Chromium |

---

### Task 1: Adapter-Interfaces, Registry und pdf.js-Assets

**Files:**
- Create: `src/adapters/types.ts`, `src/adapters/registry.ts`, `scripts/sync-pdf-assets.mjs`
- Test: `src/adapters/registry.test.ts`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Consumes: Typen aus `src/domain/types.ts` (Plan 1)
- Produces:
  - `interface FileDescriptor { name: string; type: string; size: number }`
  - `interface SourceProbeResult { kind; blockKind; blockCount; blockRotations; outline?; status; statusDetail? }`
  - `interface RenderOpts { targetWidth: number; dpr?: number; signal?: AbortSignal }`
  - `interface RenderedBitmap { blob: Blob; width: number; height: number }`
  - `interface TextSpan { text: string; rect: [number, number, number, number] }`
  - `interface PageText { blockIndex: number; text: string; spans: TextSpan[] }`
  - `interface DocumentAdapter { kind; accepts(file); probe(blob); renderBlock(ref, opts); extractText?(ref) }`
  - `interface AssembleCtx { readBytes(sourceId): Promise<Uint8Array>; signal?: AbortSignal; onProgress?(done, total): void }`
  - `interface BlockAssembler { targetFormat; assemble(items, ctx): Promise<Uint8Array> }`
  - `createRegistry(): AdapterRegistry` mit `register`, `registerAssembler`, `adapterFor`, `adapterOfKind`, `assemblerFor`

- [ ] **Step 1: Laufzeit-Abhaengigkeiten installieren**

```bash
npm install pdfjs-dist pdf-lib idb
```

- [ ] **Step 2: Die tatsaechlichen Dateinamen von pdf.js pruefen**

Die Pfade zu Worker und Assets aendern sich zwischen den Hauptversionen von pdf.js. Deshalb werden sie nicht geraten, sondern nachgesehen:

```bash
node -p "require('pdfjs-dist/package.json').version"
ls node_modules/pdfjs-dist/build/ | grep worker
ls -d node_modules/pdfjs-dist/cmaps node_modules/pdfjs-dist/standard_fonts
```

Expected: eine Worker-Datei mit der Endung `.mjs` (bei pdf.js 4 und 5 `pdf.worker.min.mjs`) sowie die beiden Asset-Verzeichnisse. Der in Step 3 und in Task 4 verwendete Worker-Dateiname muss mit der Ausgabe uebereinstimmen.

- [ ] **Step 3: Asset-Kopierskript anlegen**

Worker und Assets werden lokal ausgeliefert, weil die App keine externen Laufzeit-Requests machen darf. `scripts/sync-pdf-assets.mjs`:

```js
// Kopiert die Laufzeit-Assets von pdf.js nach public/pdfjs, damit sie mit dem
// Bundle ausgeliefert werden. Ohne cMaps und Standardschriften zeigen manche
// PDFs falsche oder keine Glyphen -- und ein CDN-Fallback ist ausgeschlossen.
import { cp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'));
const target = join(process.cwd(), 'public', 'pdfjs');

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

for (const entry of ['cmaps', 'standard_fonts']) {
  await cp(join(pdfjsRoot, entry), join(target, entry), { recursive: true });
}
await cp(
  join(pdfjsRoot, 'build', 'pdf.worker.min.mjs'),
  join(target, 'pdf.worker.min.mjs'),
);

console.log(`pdf.js-Assets nach ${target} kopiert`);
```

In `package.json` ergaenzen (die `pre`-Hooks sorgen dafuer, dass niemand die Kopie vergisst):

```json
{
  "sync:pdf-assets": "node scripts/sync-pdf-assets.mjs",
  "predev": "npm run sync:pdf-assets",
  "prebuild": "npm run sync:pdf-assets",
  "pretest": "npm run sync:pdf-assets"
}
```

`.gitignore` um `public/pdfjs/` ergaenzen -- die Assets sind abgeleitet und gehoeren nicht ins Repository.

- [ ] **Step 4: Kopierskript ausfuehren und pruefen**

Run: `npm run sync:pdf-assets && ls public/pdfjs`
Expected: `cmaps`, `standard_fonts`, `pdf.worker.min.mjs`.

- [ ] **Step 5: Den fehlschlagenden Test fuer die Registry schreiben**

`src/adapters/registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createRegistry } from './registry';
import type { BlockAssembler, DocumentAdapter, FileDescriptor } from './types';

function fakeAdapter(overrides: Partial<DocumentAdapter> = {}): DocumentAdapter {
  return {
    kind: 'pdf',
    accepts: (file: FileDescriptor) => file.name.toLowerCase().endsWith('.pdf'),
    probe: () => Promise.reject(new Error('im Test nicht benutzt')),
    renderBlock: () => Promise.reject(new Error('im Test nicht benutzt')),
    ...overrides,
  };
}

function fakeAssembler(): BlockAssembler {
  return {
    targetFormat: 'pdf',
    assemble: () => Promise.resolve(new Uint8Array()),
  };
}

const file = (name: string, type = 'application/pdf'): FileDescriptor => ({ name, type, size: 10 });

describe('createRegistry', () => {
  it('findet den Adapter fuer eine Datei', () => {
    const registry = createRegistry();
    registry.register(fakeAdapter());
    expect(registry.adapterFor(file('Bank.pdf'))?.kind).toBe('pdf');
  });

  it('liefert undefined fuer ein unbekanntes Format', () => {
    const registry = createRegistry();
    registry.register(fakeAdapter());
    expect(registry.adapterFor(file('Notizen.docx', ''))).toBeUndefined();
  });

  it('findet den Adapter ueber seine Art', () => {
    const registry = createRegistry();
    registry.register(fakeAdapter());
    expect(registry.adapterOfKind('pdf')).toBeDefined();
  });

  it('nimmt den ersten passenden Adapter in Registrierungsreihenfolge', () => {
    const registry = createRegistry();
    const first = fakeAdapter({ accepts: () => true });
    const second = fakeAdapter({ accepts: () => true });
    registry.register(first);
    registry.register(second);
    expect(registry.adapterFor(file('Bank.pdf'))).toBe(first);
  });

  it('wirft, wenn eine Art zweimal registriert wird', () => {
    const registry = createRegistry();
    registry.register(fakeAdapter());
    expect(() => registry.register(fakeAdapter())).toThrow(/bereits registriert/);
  });

  it('findet den Assembler fuer ein Zielformat', () => {
    const registry = createRegistry();
    registry.registerAssembler(fakeAssembler());
    expect(registry.assemblerFor('pdf')).toBeDefined();
  });

  it('kennt alle registrierten Dateiendungen fuer den Dateidialog', () => {
    const registry = createRegistry();
    registry.register(fakeAdapter());
    expect(registry.acceptAttribute()).toBe('application/pdf,.pdf');
  });
});
```

- [ ] **Step 6: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/adapters/registry.test.ts`
Expected: FAIL, `Failed to resolve import "./registry"`.

- [ ] **Step 7: types.ts implementieren**

`src/adapters/types.ts`:

```ts
import type {
  BlockKind,
  BlockRef,
  CompositionItem,
  OutlineNode,
  SourceId,
  SourceKind,
  SourceStatus,
  TargetFormat,
} from '../domain/types';

/** Was ein Adapter ueber eine Datei wissen muss, ohne sie zu lesen. */
export interface FileDescriptor {
  name: string;
  type: string;
  size: number;
}

export interface SourceProbeResult {
  kind: SourceKind;
  blockKind: BlockKind;
  blockCount: number;
  blockRotations: number[];
  outline?: OutlineNode[];
  status: SourceStatus;
  statusDetail?: string;
}

export interface RenderOpts {
  /** Zielbreite in CSS-Pixeln; die Hoehe folgt dem Seitenverhaeltnis. */
  targetWidth: number;
  /** Geraeteaufloesung, vom Aufrufer bereits gedeckelt. */
  dpr?: number;
  signal?: AbortSignal;
}

export interface RenderedBitmap {
  blob: Blob;
  width: number;
  height: number;
}

export interface TextSpan {
  text: string;
  /** [x, y, breite, hoehe] in Seitenkoordinaten bei Skalierung 1. */
  rect: [number, number, number, number];
}

export interface PageText {
  blockIndex: number;
  text: string;
  spans: TextSpan[];
}

export interface DocumentAdapter {
  readonly kind: SourceKind;
  accepts(file: FileDescriptor): boolean;
  probe(blob: Blob): Promise<SourceProbeResult>;
  renderBlock(ref: BlockRef, opts: RenderOpts): Promise<RenderedBitmap>;
  extractText?(ref: BlockRef): Promise<PageText>;
}

export interface AssembleCtx {
  /** Liefert die Original-Bytes einer Quelle; der Assembler ruft das je Quelle einmal. */
  readBytes(sourceId: SourceId): Promise<Uint8Array>;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/** Ein Assembler haengt am ZIEL-Format, nicht am Quellformat. */
export interface BlockAssembler {
  readonly targetFormat: TargetFormat;
  assemble(items: CompositionItem[], ctx: AssembleCtx): Promise<Uint8Array>;
}

export interface AdapterRegistry {
  register(adapter: DocumentAdapter): void;
  registerAssembler(assembler: BlockAssembler): void;
  adapterFor(file: FileDescriptor): DocumentAdapter | undefined;
  adapterOfKind(kind: SourceKind): DocumentAdapter | undefined;
  assemblerFor(format: TargetFormat): BlockAssembler | undefined;
  /** Wert fuer das `accept`-Attribut des Dateidialogs. */
  acceptAttribute(): string;
}
```

- [ ] **Step 8: registry.ts implementieren**

`src/adapters/registry.ts`:

```ts
import type { SourceKind, TargetFormat } from '../domain/types';
import type { AdapterRegistry, BlockAssembler, DocumentAdapter, FileDescriptor } from './types';

/** Phase 1 registriert genau einen Adapter -- aber das UI fragt nie nach PDF. */
const ACCEPT_BY_KIND: Record<SourceKind, string> = {
  pdf: 'application/pdf,.pdf',
};

export function createRegistry(): AdapterRegistry {
  const adapters: DocumentAdapter[] = [];
  const assemblers = new Map<TargetFormat, BlockAssembler>();

  return {
    register(adapter) {
      if (adapters.some((known) => known.kind === adapter.kind)) {
        throw new Error(`Adapter fuer ${adapter.kind} ist bereits registriert.`);
      }
      adapters.push(adapter);
    },
    registerAssembler(assembler) {
      assemblers.set(assembler.targetFormat, assembler);
    },
    adapterFor(file: FileDescriptor) {
      return adapters.find((adapter) => adapter.accepts(file));
    },
    adapterOfKind(kind) {
      return adapters.find((adapter) => adapter.kind === kind);
    },
    assemblerFor(format) {
      return assemblers.get(format);
    },
    acceptAttribute() {
      return adapters.map((adapter) => ACCEPT_BY_KIND[adapter.kind]).join(',');
    },
  };
}
```

- [ ] **Step 9: Tests pruefen**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: alle Tests PASS.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Adapter-Interfaces, Registry und lokal ausgelieferte pdf.js-Assets

Die Registry macht das Format zu Daten: das UI fragt nie nach PDF, sondern
nach einem Adapter. Worker, cMaps und Standardschriften werden ins public-
Verzeichnis kopiert, weil die App keine externen Laufzeit-Requests machen darf.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 2: PDF-Assembler (`pdfAssembler.ts`)

**Files:**
- Create: `src/adapters/pdf/pdfAssembler.ts`
- Test: `src/adapters/pdf/pdfAssembler.test.ts`

**Interfaces:**
- Consumes: `BlockAssembler`, `AssembleCtx` aus `../types`; `CompositionItem` aus `../../domain/types`; `pdf-lib`
- Produces: `createPdfAssembler(): BlockAssembler`

Zwei Anforderungen aus dem Design stecken in diesem Modul: Seiten werden **objektweise kopiert, nicht gerastert**, und jedes Quell-PDF wird beim Export **einmal** geladen, wobei `copyPages` gebuendelt pro Quelle laeuft -- jeder Aufruf bettet die referenzierten Objektgraphen erneut ein.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/adapters/pdf/pdfAssembler.test.ts`:

```ts
import { PDFDocument, degrees } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { createPdfAssembler } from './pdfAssembler';
import type { CompositionItem, Rotation, SourceId } from '../../domain/types';

/**
 * Jede Seite bekommt eine eindeutige Breite. Damit ist die Reihenfolge im
 * Ergebnis pruefbar, ohne Text aus dem PDF lesen zu muessen.
 */
async function makeSourcePdf(widths: number[], rotation = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const width of widths) {
    const page = doc.addPage([width, 400]);
    if (rotation !== 0) page.setRotation(degrees(rotation));
  }
  return doc.save();
}

function item(id: string, sourceId: SourceId, blockIndex: number, rotation: Rotation = 0): CompositionItem {
  return { id, sourceId, blockIndex, rotation };
}

async function widthsOf(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => Math.round(page.getWidth()));
}

async function rotationsOf(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((page) => page.getRotation().angle);
}

describe('createPdfAssembler', () => {
  it('setzt Seiten aus mehreren Quellen in der Reihenfolge der Items zusammen', async () => {
    const alpha = await makeSourcePdf([101, 102, 103]);
    const beta = await makeSourcePdf([201, 202]);
    const readBytes = vi.fn(async (sourceId: SourceId) => (sourceId === 'a' ? alpha : beta));

    const bytes = await createPdfAssembler().assemble(
      [item('i1', 'a', 2), item('i2', 'b', 0), item('i3', 'a', 0)],
      { readBytes },
    );

    expect(await widthsOf(bytes)).toEqual([103, 201, 101]);
  });

  it('laedt jede Quelle genau einmal, auch bei vielen Seiten daraus', async () => {
    const alpha = await makeSourcePdf([101, 102, 103]);
    const readBytes = vi.fn(async () => alpha);

    await createPdfAssembler().assemble(
      [item('i1', 'a', 0), item('i2', 'a', 1), item('i3', 'a', 2)],
      { readBytes },
    );

    expect(readBytes).toHaveBeenCalledTimes(1);
  });

  it('kopiert eine mehrfach verwendete Quellseite mehrfach', async () => {
    const alpha = await makeSourcePdf([101, 102]);
    const bytes = await createPdfAssembler().assemble(
      [item('i1', 'a', 0), item('i2', 'a', 0), item('i3', 'a', 1)],
      { readBytes: async () => alpha },
    );
    expect(await widthsOf(bytes)).toEqual([101, 101, 102]);
  });

  it('rechnet die Item-Rotation zur Rotation der Quellseite hinzu', async () => {
    const alpha = await makeSourcePdf([101, 102], 90);
    const bytes = await createPdfAssembler().assemble(
      [item('i1', 'a', 0, 0), item('i2', 'a', 1, 180)],
      { readBytes: async () => alpha },
    );
    expect(await rotationsOf(bytes)).toEqual([90, 270]);
  });

  it('normalisiert eine Rotation ueber 360 Grad hinaus', async () => {
    const alpha = await makeSourcePdf([101], 270);
    const bytes = await createPdfAssembler().assemble([item('i1', 'a', 0, 180)], {
      readBytes: async () => alpha,
    });
    expect(await rotationsOf(bytes)).toEqual([90]);
  });

  it('meldet Fortschritt je eingefuegter Seite', async () => {
    const alpha = await makeSourcePdf([101, 102]);
    const onProgress = vi.fn();
    await createPdfAssembler().assemble([item('i1', 'a', 0), item('i2', 'a', 1)], {
      readBytes: async () => alpha,
      onProgress,
    });
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it('bricht ab, wenn das Signal ausgeloest wurde', async () => {
    const alpha = await makeSourcePdf([101, 102]);
    const controller = new AbortController();
    controller.abort();
    await expect(
      createPdfAssembler().assemble([item('i1', 'a', 0)], {
        readBytes: async () => alpha,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });

  it('lehnt eine leere Komposition ab, statt ein PDF ohne Seiten zu schreiben', async () => {
    await expect(
      createPdfAssembler().assemble([], { readBytes: async () => new Uint8Array() }),
    ).rejects.toThrow(/keine Seiten/);
  });

  it('nennt die Quelle, wenn ein Blockindex nicht existiert', async () => {
    const alpha = await makeSourcePdf([101]);
    await expect(
      createPdfAssembler().assemble([item('i1', 'a', 7)], { readBytes: async () => alpha }),
    ).rejects.toThrow(/Seite 8/);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/adapters/pdf/pdfAssembler.test.ts`
Expected: FAIL, `Failed to resolve import "./pdfAssembler"`.

- [ ] **Step 3: pdfAssembler.ts implementieren**

`src/adapters/pdf/pdfAssembler.ts`:

```ts
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
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/adapters/pdf/pdfAssembler.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: PDF-Assembler baut Ergebnis-Bytes aus der Komposition

Seiten werden objektweise kopiert statt gerastert. Pro Quelle genau ein
Ladevorgang und ein gebuendelter copyPages-Aufruf, weil jeder weitere Aufruf
die referenzierten Objektgraphen erneut einbetten wuerde. Mehrfach verwendete
Quellseiten erhalten mehrere eigene Kopien, Item-Rotationen kommen additiv
zur Rotation der Quellseite.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 3: Dokument-Pool (`pdfPool.ts`)

**Files:**
- Create: `src/adapters/pdf/pdfPool.ts`
- Test: `src/adapters/pdf/pdfPool.test.ts`

**Interfaces:**
- Consumes: nichts (generisch, kennt pdf.js nicht)
- Produces:
  - `interface PoolOptions<T> { load(key: string): Promise<T>; destroy(doc: T): Promise<void> | void; maxOpen?: number; now?(): number }`
  - `interface DocumentPool<T> { use<R>(key, fn): Promise<R>; drop(key): Promise<void>; clear(): Promise<void>; readonly openKeys: string[] }`
  - `createDocumentPool<T>(options: PoolOptions<T>): DocumentPool<T>`

Der Pool ist bewusst generisch: sein einziges Thema ist Verdraengung, nicht PDF. Das Design begruendet ihn damit, dass sonst bei acht importierten Scans acht geparste PDFs samt internen Caches im Speicher bleiben.

Die Ausleihe (`use` statt `acquire`) existiert, weil ein Dokument nicht verdraengt werden darf, waehrend gerade daraus gerendert wird. `use` zaehlt die Leihe hoch, gibt sie am Ende frei und verdraengt erst danach.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/adapters/pdf/pdfPool.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createDocumentPool } from './pdfPool';

interface FakeDoc {
  key: string;
}

function fakePool(maxOpen = 2) {
  let clock = 0;
  const destroyed: string[] = [];
  const load = vi.fn(async (key: string): Promise<FakeDoc> => ({ key }));
  const pool = createDocumentPool<FakeDoc>({
    load,
    destroy: (doc) => {
      destroyed.push(doc.key);
    },
    maxOpen,
    now: () => ++clock,
  });
  return { pool, load, destroyed };
}

describe('createDocumentPool', () => {
  it('laedt ein Dokument einmal und verwendet es wieder', async () => {
    const { pool, load } = fakePool();
    await pool.use('a', async (doc) => doc.key);
    await pool.use('a', async (doc) => doc.key);
    expect(load).toHaveBeenCalledTimes(1);
    expect(pool.openKeys).toEqual(['a']);
  });

  it('laedt bei gleichzeitigem Zugriff nur einmal', async () => {
    const { pool, load } = fakePool();
    await Promise.all([
      pool.use('a', async (doc) => doc.key),
      pool.use('a', async (doc) => doc.key),
    ]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('gibt das Ergebnis der Funktion zurueck', async () => {
    const { pool } = fakePool();
    await expect(pool.use('a', async (doc) => `${doc.key}!`)).resolves.toBe('a!');
  });

  it('verdraengt das am laengsten unbenutzte Dokument', async () => {
    const { pool, destroyed } = fakePool(2);
    await pool.use('a', async () => 0);
    await pool.use('b', async () => 0);
    await pool.use('a', async () => 0);
    await pool.use('c', async () => 0);
    expect(destroyed).toEqual(['b']);
    expect(pool.openKeys.sort()).toEqual(['a', 'c']);
  });

  it('verdraengt kein Dokument, das gerade benutzt wird', async () => {
    const { pool, destroyed } = fakePool(1);
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = pool.use('a', async () => {
      await held;
      return 0;
    });
    await pool.use('b', async () => 0);
    expect(destroyed).toEqual([]);

    release();
    await first;
    expect(pool.openKeys).toEqual(['b']);
    expect(destroyed).toEqual(['a']);
  });

  it('merkt sich ein fehlgeschlagenes Laden nicht', async () => {
    const load = vi
      .fn<(key: string) => Promise<{ key: string }>>()
      .mockRejectedValueOnce(new Error('kaputt'))
      .mockResolvedValueOnce({ key: 'a' });
    const pool = createDocumentPool({ load, destroy: () => {} });

    await expect(pool.use('a', async () => 0)).rejects.toThrow('kaputt');
    expect(pool.openKeys).toEqual([]);
    await expect(pool.use('a', async (doc) => doc.key)).resolves.toBe('a');
  });

  it('behaelt das Dokument, wenn nur die Aufgabe fehlschlaegt', async () => {
    const { pool, load } = fakePool();
    await expect(
      pool.use('a', async () => {
        throw new Error('Render fehlgeschlagen');
      }),
    ).rejects.toThrow('Render fehlgeschlagen');
    await pool.use('a', async () => 0);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('schliesst ein Dokument auf Anforderung', async () => {
    const { pool, destroyed } = fakePool();
    await pool.use('a', async () => 0);
    await pool.drop('a');
    expect(destroyed).toEqual(['a']);
    expect(pool.openKeys).toEqual([]);
  });

  it('schliesst alle Dokumente', async () => {
    const { pool, destroyed } = fakePool(4);
    await pool.use('a', async () => 0);
    await pool.use('b', async () => 0);
    await pool.clear();
    expect(destroyed.sort()).toEqual(['a', 'b']);
    expect(pool.openKeys).toEqual([]);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/adapters/pdf/pdfPool.test.ts`
Expected: FAIL, `Failed to resolve import "./pdfPool"`.

- [ ] **Step 3: pdfPool.ts implementieren**

`src/adapters/pdf/pdfPool.ts`:

```ts
export interface PoolOptions<T> {
  load(key: string): Promise<T>;
  destroy(doc: T): Promise<void> | void;
  /** Mehr offene Dokumente bringen keinen Nutzen, kosten aber Speicher. */
  maxOpen?: number;
  now?(): number;
}

export interface DocumentPool<T> {
  /**
   * Fuehrt `fn` mit dem Dokument aus und haelt es solange gegen Verdraengung.
   * Bewusst kein `acquire`: eine vergessene Rueckgabe wuerde den Pool
   * dauerhaft blockieren.
   */
  use<R>(key: string, fn: (doc: T) => Promise<R>): Promise<R>;
  drop(key: string): Promise<void>;
  clear(): Promise<void>;
  readonly openKeys: string[];
}

interface PoolEntry<T> {
  value: Promise<T>;
  leases: number;
  usedAt: number;
}

export function createDocumentPool<T>({
  load,
  destroy,
  maxOpen = 4,
  now = () => Date.now(),
}: PoolOptions<T>): DocumentPool<T> {
  const entries = new Map<string, PoolEntry<T>>();

  async function close(key: string): Promise<void> {
    const entry = entries.get(key);
    if (!entry) return;
    entries.delete(key);
    try {
      await destroy(await entry.value);
    } catch (error) {
      // Ein bereits kaputtes Dokument muss sich nicht sauber schliessen lassen.
      console.warn('Dokument konnte nicht geschlossen werden', error);
    }
  }

  async function evict(): Promise<void> {
    while (entries.size > maxOpen) {
      let victim: string | undefined;
      let oldest = Number.POSITIVE_INFINITY;
      for (const [key, entry] of entries) {
        if (entry.leases > 0) continue;
        if (entry.usedAt < oldest) {
          oldest = entry.usedAt;
          victim = key;
        }
      }
      // Sind alle Dokumente in Benutzung, bleibt der Pool vorlaeufig zu gross.
      if (victim === undefined) return;
      await close(victim);
    }
  }

  return {
    async use<R>(key: string, fn: (doc: T) => Promise<R>): Promise<R> {
      let entry = entries.get(key);
      if (!entry) {
        // Das Promise selbst wird gespeichert, damit gleichzeitige Zugriffe
        // dasselbe Dokument bekommen statt zwei zu laden.
        entry = { value: load(key), leases: 0, usedAt: now() };
        entries.set(key, entry);
      }
      entry.leases += 1;
      entry.usedAt = now();

      let doc: T;
      try {
        doc = await entry.value;
      } catch (error) {
        entry.leases -= 1;
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      }

      try {
        return await fn(doc);
      } finally {
        entry.leases -= 1;
        entry.usedAt = now();
        await evict();
      }
    },
    drop: close,
    async clear() {
      for (const key of [...entries.keys()]) await close(key);
    },
    get openKeys() {
      return [...entries.keys()];
    },
  };
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/adapters/pdf/pdfPool.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: generischer LRU-Pool fuer offene Dokumente

Maximal vier geparste Dokumente gleichzeitig, Verdraengung schliesst das am
laengsten unbenutzte. use() leiht das Dokument fuer die Dauer einer Aufgabe
aus, damit nichts verdraengt wird, waehrend daraus gerendert wird; ein
fehlgeschlagenes Laden bleibt nicht als kaputter Eintrag zurueck.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 4: PDF-Adapter auf einer Engine-Fassade

**Files:**
- Create: `src/adapters/pdf/pdfEngine.ts` (nur Typen), `src/adapters/pdf/pdfAdapter.ts`, `src/adapters/pdf/pdfjsEngine.ts`
- Test: `src/adapters/pdf/pdfAdapter.test.ts`

**Interfaces:**
- Consumes: `DocumentAdapter`, `SourceProbeResult`, `RenderOpts`, `RenderedBitmap`, `PageText`, `TextSpan` aus `../types`; `DocumentPool` aus `./pdfPool`; `OutlineNode`, `BlockRef` aus `../../domain/types`
- Produces:
  - `pdfEngine.ts`: `RenderSurface`, `CreateSurface`, `PdfPageHandle`, `PdfDocumentHandle`, `PdfEngine`
  - `pdfAdapter.ts`: `computeRenderScale(pageWidth, targetWidth, dpr?, maxDpr?): number`, `createPdfAdapter(deps: PdfAdapterDeps): DocumentAdapter`
  - `pdfjsEngine.ts`: `createPdfjsEngine(): PdfEngine`, `createOffscreenSurface: CreateSurface`

Warum eine Fassade zwischen pdf.js und dem Adapter: die Entscheidungen des Adapters (welcher Massstab, welcher Status bei welchem Fehler, wie Rotationen gelesen werden) sind Logik und gehoeren unit-getestet. pdf.js braucht dafuer aber einen Browser mit Canvas. Die Fassade trennt beides -- `pdfAdapter.ts` ist in Node vollstaendig testbar, und `pdfjsEngine.ts` ist die einzige Datei im Projekt, die pdf.js kennt und konfiguriert. Sie wird vom Playwright-Test in Task 12 abgedeckt.

- [ ] **Step 1: Die Fassadentypen schreiben**

`src/adapters/pdf/pdfEngine.ts`:

```ts
import type { OutlineNode } from '../../domain/types';
import type { TextSpan } from '../types';

/** Zielflaeche eines Renders. In Produktion ein OffscreenCanvas. */
export interface RenderSurface {
  readonly width: number;
  readonly height: number;
  readonly context: OffscreenCanvasRenderingContext2D;
  toBlob(type: string, quality: number): Promise<Blob>;
}

export type CreateSurface = (width: number, height: number) => RenderSurface;

export interface PdfPageHandle {
  /** Rotation der Quellseite laut /Rotate, in Grad. */
  readonly rotation: number;
  size(scale: number): { width: number; height: number };
  render(surface: RenderSurface, scale: number, signal?: AbortSignal): Promise<void>;
  text(): Promise<TextSpan[]>;
  /** Gibt Seiten-interne Caches frei; das Dokument bleibt offen. */
  release(): void;
}

export interface PdfDocumentHandle {
  readonly pageCount: number;
  /** 0-basiert, wie ueberall im Projekt -- pdf.js selbst ist 1-basiert. */
  page(blockIndex: number): Promise<PdfPageHandle>;
  outline(): Promise<OutlineNode[] | undefined>;
  destroy(): Promise<void>;
}

export interface PdfEngine {
  open(bytes: Uint8Array): Promise<PdfDocumentHandle>;
  /** Trennt "passwortgeschuetzt" von "kaputt" -- die Meldungen sind verschieden. */
  isPasswordError(error: unknown): boolean;
}
```

- [ ] **Step 2: Den fehlschlagenden Test fuer den Adapter schreiben**

`src/adapters/pdf/pdfAdapter.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { computeRenderScale, createPdfAdapter } from './pdfAdapter';
import { createDocumentPool } from './pdfPool';
import type { PdfDocumentHandle, PdfEngine, PdfPageHandle, RenderSurface } from './pdfEngine';

function fakePage(rotation = 0, width = 200, height = 400): PdfPageHandle {
  return {
    rotation,
    size: (scale) => ({ width: width * scale, height: height * scale }),
    render: vi.fn(async () => undefined),
    text: vi.fn(async () => [
      { text: 'Konto', rect: [10, 20, 40, 12] as [number, number, number, number] },
      { text: 'Saldo', rect: [60, 20, 40, 12] as [number, number, number, number] },
    ]),
    release: vi.fn(),
  };
}

function fakeDocument(pages: PdfPageHandle[]): PdfDocumentHandle {
  return {
    pageCount: pages.length,
    page: async (index) => {
      const page = pages[index];
      if (!page) throw new Error(`Seite ${index} gibt es nicht`);
      return page;
    },
    outline: async () => [{ title: 'Kapitel 1', blockIndex: 0, children: [] }],
    destroy: vi.fn(async () => undefined),
  };
}

function fakeSurface(width: number, height: number): RenderSurface {
  return {
    width,
    height,
    context: {} as OffscreenCanvasRenderingContext2D,
    toBlob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }),
  };
}

function setup(document: PdfDocumentHandle = fakeDocument([fakePage(), fakePage(90)])) {
  const engine: PdfEngine = {
    open: vi.fn(async () => document),
    isPasswordError: (error) => (error as { name?: string })?.name === 'PasswordException',
  };
  const pool = createDocumentPool<PdfDocumentHandle>({
    load: async () => document,
    destroy: async (doc) => doc.destroy(),
  });
  const createSurface = vi.fn(fakeSurface);
  const adapter = createPdfAdapter({ engine, pool, createSurface });
  return { adapter, engine, pool, createSurface, document };
}

const blob = () => new Blob([new Uint8Array([37, 80, 68, 70])], { type: 'application/pdf' });

describe('computeRenderScale', () => {
  it('rechnet die Zielbreite in einen Massstab um', () => {
    expect(computeRenderScale(200, 180, 1)).toBeCloseTo(0.9);
  });

  it('beruecksichtigt die Geraeteaufloesung', () => {
    expect(computeRenderScale(200, 180, 2)).toBeCloseTo(1.8);
  });

  it('deckelt die Geraeteaufloesung bei 2', () => {
    expect(computeRenderScale(200, 180, 4)).toBeCloseTo(1.8);
  });

  it('faellt bei unbrauchbarer Seitenbreite auf 1 zurueck', () => {
    expect(computeRenderScale(0, 180, 1)).toBe(1);
  });
});

describe('createPdfAdapter / accepts', () => {
  it('nimmt PDFs nach Medientyp und nach Endung an', () => {
    const { adapter } = setup();
    expect(adapter.accepts({ name: 'Bank.pdf', type: 'application/pdf', size: 1 })).toBe(true);
    expect(adapter.accepts({ name: 'BANK.PDF', type: '', size: 1 })).toBe(true);
  });

  it('lehnt andere Formate ab', () => {
    const { adapter } = setup();
    expect(adapter.accepts({ name: 'Notiz.docx', type: '', size: 1 })).toBe(false);
    expect(adapter.accepts({ name: 'Bild.png', type: 'image/png', size: 1 })).toBe(false);
  });
});

describe('createPdfAdapter / probe', () => {
  it('liest Seitenzahl, Rotationen und Outline', async () => {
    const { adapter } = setup();
    await expect(adapter.probe(blob())).resolves.toEqual({
      kind: 'pdf',
      blockKind: 'page',
      blockCount: 2,
      blockRotations: [0, 90],
      outline: [{ title: 'Kapitel 1', blockIndex: 0, children: [] }],
      status: 'ready',
    });
  });

  it('schliesst das Dokument nach dem Pruefen wieder', async () => {
    const { adapter, document } = setup();
    await adapter.probe(blob());
    expect(document.destroy).toHaveBeenCalledTimes(1);
  });

  it('meldet eine passwortgeschuetzte Datei verstaendlich', async () => {
    const { adapter, engine } = setup();
    const error = Object.assign(new Error('No password'), { name: 'PasswordException' });
    vi.mocked(engine.open).mockRejectedValueOnce(error);

    const result = await adapter.probe(blob());
    expect(result.status).toBe('encrypted');
    expect(result.blockCount).toBe(0);
    expect(result.statusDetail).toMatch(/Passwort/);
  });

  it('meldet eine beschaedigte Datei verstaendlich', async () => {
    const { adapter, engine } = setup();
    vi.mocked(engine.open).mockRejectedValueOnce(new Error('Invalid PDF structure'));

    const result = await adapter.probe(blob());
    expect(result.status).toBe('error');
    expect(result.statusDetail).toMatch(/konnte nicht gelesen werden/);
    expect(result.statusDetail).not.toMatch(/Invalid PDF structure/);
  });
});

describe('createPdfAdapter / renderBlock', () => {
  it('rendert in eine Flaeche der berechneten Groesse und liefert einen Blob', async () => {
    const { adapter, createSurface } = setup();
    const bitmap = await adapter.renderBlock(
      { sourceId: 'src-a', blockIndex: 0 },
      { targetWidth: 180, dpr: 1 },
    );

    expect(createSurface).toHaveBeenCalledWith(180, 360);
    expect(bitmap.width).toBe(180);
    expect(bitmap.height).toBe(360);
    expect(bitmap.blob.type).toBe('image/webp');
  });

  it('gibt die Seite nach dem Rendern wieder frei', async () => {
    const page = fakePage();
    const { adapter } = setup(fakeDocument([page]));
    await adapter.renderBlock({ sourceId: 'src-a', blockIndex: 0 }, { targetWidth: 180 });
    expect(page.release).toHaveBeenCalledTimes(1);
  });

  it('reicht das Abbruchsignal an den Render weiter', async () => {
    const page = fakePage();
    const { adapter } = setup(fakeDocument([page]));
    const controller = new AbortController();
    await adapter.renderBlock(
      { sourceId: 'src-a', blockIndex: 0 },
      { targetWidth: 180, signal: controller.signal },
    );
    expect(vi.mocked(page.render).mock.calls[0]?.[2]).toBe(controller.signal);
  });

  it('bricht vor dem Rendern ab, wenn bereits abgebrochen wurde', async () => {
    const { adapter } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(
      adapter.renderBlock(
        { sourceId: 'src-a', blockIndex: 0 },
        { targetWidth: 180, signal: controller.signal },
      ),
    ).rejects.toThrow();
  });
});

describe('createPdfAdapter / extractText', () => {
  it('setzt den Seitentext aus den Textstuecken zusammen', async () => {
    const { adapter } = setup();
    const text = await adapter.extractText?.({ sourceId: 'src-a', blockIndex: 1 });
    expect(text).toEqual({
      blockIndex: 1,
      text: 'Konto Saldo',
      spans: [
        { text: 'Konto', rect: [10, 20, 40, 12] },
        { text: 'Saldo', rect: [60, 20, 40, 12] },
      ],
    });
  });
});
```

- [ ] **Step 3: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/adapters/pdf/pdfAdapter.test.ts`
Expected: FAIL, `Failed to resolve import "./pdfAdapter"`.

- [ ] **Step 4: pdfAdapter.ts implementieren**

`src/adapters/pdf/pdfAdapter.ts`:

```ts
import type { BlockRef } from '../../domain/types';
import type {
  DocumentAdapter,
  FileDescriptor,
  PageText,
  RenderOpts,
  RenderedBitmap,
  SourceProbeResult,
} from '../types';
import type { CreateSurface, PdfDocumentHandle, PdfEngine } from './pdfEngine';
import type { DocumentPool } from './pdfPool';

export interface PdfAdapterDeps {
  engine: PdfEngine;
  /** Der Pool wird von aussen gebaut, weil nur dort bekannt ist, wie Bytes zu einer Quelle kommen. */
  pool: DocumentPool<PdfDocumentHandle>;
  createSurface: CreateSurface;
  imageType?: string;
  imageQuality?: number;
}

/** Thumbnails werden nie in Originalaufloesung gerendert, die Geraeteaufloesung wird gedeckelt. */
const MAX_DPR = 2;

export function computeRenderScale(
  pageWidth: number,
  targetWidth: number,
  dpr = 1,
  maxDpr = MAX_DPR,
): number {
  if (!Number.isFinite(pageWidth) || pageWidth <= 0) return 1;
  return (targetWidth * Math.min(dpr, maxDpr)) / pageWidth;
}

const EMPTY_PROBE = {
  kind: 'pdf',
  blockKind: 'page',
  blockCount: 0,
  blockRotations: [],
} as const;

export function createPdfAdapter({
  engine,
  pool,
  createSurface,
  imageType = 'image/webp',
  imageQuality = 0.8,
}: PdfAdapterDeps): DocumentAdapter {
  return {
    kind: 'pdf',

    accepts(file: FileDescriptor) {
      return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    },

    async probe(blob: Blob): Promise<SourceProbeResult> {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let document: PdfDocumentHandle;
      try {
        document = await engine.open(bytes);
      } catch (error) {
        // Der Stacktrace gehoert in die Konsole, nicht in die Oberflaeche.
        console.warn('PDF konnte nicht geoeffnet werden', error);
        if (engine.isPasswordError(error)) {
          return {
            ...EMPTY_PROBE,
            status: 'encrypted',
            statusDetail: 'Diese PDF ist mit einem Passwort geschuetzt.',
          };
        }
        return {
          ...EMPTY_PROBE,
          status: 'error',
          statusDetail:
            'Diese PDF konnte nicht gelesen werden. Sie ist moeglicherweise beschaedigt oder verschluesselt.',
        };
      }

      try {
        // Einmalig beim Import: die Rotation jeder Quellseite merken, damit das
        // Raster spaeter nicht jede Seite dafuer oeffnen muss.
        const blockRotations: number[] = [];
        for (let index = 0; index < document.pageCount; index++) {
          const page = await document.page(index);
          blockRotations.push(page.rotation);
          page.release();
        }
        const outline = await document.outline();
        return {
          ...EMPTY_PROBE,
          blockCount: document.pageCount,
          blockRotations,
          ...(outline ? { outline } : {}),
          status: 'ready',
        };
      } finally {
        await document.destroy();
      }
    },

    async renderBlock(ref: BlockRef, opts: RenderOpts): Promise<RenderedBitmap> {
      opts.signal?.throwIfAborted();
      return pool.use(ref.sourceId, async (document) => {
        const page = await document.page(ref.blockIndex);
        try {
          const unscaled = page.size(1);
          const scale = computeRenderScale(unscaled.width, opts.targetWidth, opts.dpr ?? 1);
          const { width, height } = page.size(scale);
          const surface = createSurface(Math.round(width), Math.round(height));
          await page.render(surface, scale, opts.signal);
          return {
            blob: await surface.toBlob(imageType, imageQuality),
            width: surface.width,
            height: surface.height,
          };
        } finally {
          page.release();
        }
      });
    },

    async extractText(ref: BlockRef): Promise<PageText> {
      return pool.use(ref.sourceId, async (document) => {
        const page = await document.page(ref.blockIndex);
        try {
          const spans = await page.text();
          return {
            blockIndex: ref.blockIndex,
            text: spans.map((span) => span.text).join(' '),
            spans,
          };
        } finally {
          page.release();
        }
      });
    },
  };
}
```

- [ ] **Step 5: Tests pruefen**

Run: `npm run test -- src/adapters/pdf/pdfAdapter.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: pdfjsEngine.ts implementieren**

Diese Datei hat keine Unit-Tests -- sie ist reine Verdrahtung mit pdf.js und wird vom Playwright-Test in Task 12 abgedeckt. Der Worker-Dateiname muss mit der Ausgabe aus Task 1 Step 2 uebereinstimmen.

`src/adapters/pdf/pdfjsEngine.ts`:

```ts
import * as pdfjs from 'pdfjs-dist';
import type { OutlineNode } from '../../domain/types';
import type { TextSpan } from '../types';
import type {
  CreateSurface,
  PdfDocumentHandle,
  PdfEngine,
  PdfPageHandle,
  RenderSurface,
} from './pdfEngine';

// Alle Assets kommen aus dem eigenen Bundle (siehe scripts/sync-pdf-assets.mjs).
// BASE_URL statt eines fuehrenden Schraegstrichs, damit die App auch unter
// einem Unterpfad ausgeliefert werden kann.
const base = import.meta.env.BASE_URL;
pdfjs.GlobalWorkerOptions.workerSrc = `${base}pdfjs/pdf.worker.min.mjs`;
const CMAP_URL = `${base}pdfjs/cmaps/`;
const STANDARD_FONT_URL = `${base}pdfjs/standard_fonts/`;

type RawOutline = Awaited<ReturnType<pdfjs.PDFDocumentProxy['getOutline']>>[number];

export const createOffscreenSurface: CreateSurface = (width, height) => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Der Browser stellt keinen 2D-Kontext bereit.');
  return {
    width,
    height,
    context,
    async toBlob(type, quality) {
      return canvas.convertToBlob({ type, quality });
    },
  } satisfies RenderSurface;
};

export function createPdfjsEngine(): PdfEngine {
  return {
    async open(bytes) {
      // pdf.js uebernimmt den Puffer und leert ihn dabei; deshalb eine Kopie.
      const task = pdfjs.getDocument({
        data: bytes.slice(),
        isEvalSupported: false,
        cMapUrl: CMAP_URL,
        cMapPacked: true,
        standardFontDataUrl: STANDARD_FONT_URL,
        disableAutoFetch: true,
      });
      return wrapDocument(await task.promise);
    },
    isPasswordError(error) {
      return (
        typeof error === 'object' &&
        error !== null &&
        (error as { name?: string }).name === 'PasswordException'
      );
    },
  };
}

function wrapDocument(doc: pdfjs.PDFDocumentProxy): PdfDocumentHandle {
  return {
    pageCount: doc.numPages,
    async page(blockIndex) {
      return wrapPage(await doc.getPage(blockIndex + 1));
    },
    async outline() {
      const raw = await doc.getOutline();
      if (!raw || raw.length === 0) return undefined;
      return Promise.all(raw.map((entry) => toOutlineNode(doc, entry)));
    },
    async destroy() {
      await doc.destroy();
    },
  };
}

async function toOutlineNode(doc: pdfjs.PDFDocumentProxy, entry: RawOutline): Promise<OutlineNode> {
  return {
    title: entry.title,
    blockIndex: await resolveDestination(doc, entry.dest),
    children: await Promise.all((entry.items ?? []).map((child) => toOutlineNode(doc, child))),
  };
}

async function resolveDestination(
  doc: pdfjs.PDFDocumentProxy,
  dest: RawOutline['dest'],
): Promise<number | null> {
  try {
    const explicit = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
    const target = Array.isArray(explicit) ? explicit[0] : null;
    if (!target || typeof target !== 'object') return null;
    return await doc.getPageIndex(target as Parameters<typeof doc.getPageIndex>[0]);
  } catch (error) {
    // Ein Bookmark ohne aufloesbares Ziel ist kein Grund, den Import abzubrechen.
    console.warn('Bookmark-Ziel konnte nicht aufgeloest werden', error);
    return null;
  }
}

function wrapPage(page: pdfjs.PDFPageProxy): PdfPageHandle {
  return {
    rotation: page.rotate,
    size(scale) {
      const viewport = page.getViewport({ scale });
      return { width: viewport.width, height: viewport.height };
    },
    async render(surface, scale, signal) {
      const viewport = page.getViewport({ scale });
      const task = page.render({ canvasContext: surface.context, viewport });
      const cancel = () => task.cancel();
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        await task.promise;
      } finally {
        signal?.removeEventListener('abort', cancel);
      }
    },
    async text(): Promise<TextSpan[]> {
      const content = await page.getTextContent();
      const spans: TextSpan[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        spans.push({
          text: item.str,
          rect: [item.transform[4], item.transform[5], item.width, item.height],
        });
      }
      return spans;
    },
    release() {
      page.cleanup();
    },
  };
}
```

Falls `page.render` in der installierten pdf.js-Version eine andere Signatur verlangt (ab pdf.js 5 wird teils zusaetzlich `canvas` erwartet), zeigt `npm run typecheck` das sofort an; dann den Aufruf um das geforderte Feld ergaenzen und die Fassade unveraendert lassen.

- [ ] **Step 7: Typen und Lint pruefen**

Run: `npm run test && npm run typecheck && npm run lint && npm run build`
Expected: alles gruen.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: PDF-Adapter mit testbarer Engine-Fassade

pdfAdapter.ts trifft die Entscheidungen (Massstab, Status bei welchem Fehler,
Rotationen, Textzusammenbau) und ist in Node vollstaendig unit-getestet.
pdfjsEngine.ts ist die einzige Datei, die pdf.js kennt: Worker, cMaps und
Schriften aus dem eigenen Bundle, isEvalSupported false, und eine Kopie der
Bytes, weil pdf.js den uebergebenen Puffer leert.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 5: IndexedDB-Schema und Quell-Blob-Store

**Files:**
- Create: `src/services/persistence/db.ts`, `src/services/persistence/sourceBlobStore.ts`
- Test: `src/services/persistence/sourceBlobStore.test.ts`
- Modify: `package.json` (Testabhaengigkeit)

**Interfaces:**
- Consumes: `Workspace` aus `../../domain/types`; `idb`
- Produces:
  - `DB_NAME`, `DB_VERSION`, `openWorkspaceDb(name?): Promise<Database>`
  - `type Database = IDBPDatabase<PdfMasterDb>`
  - `SourceBlobRecord`, `ThumbRecord`, `PageTextRecord`
  - `thumbKey(sourceId, blockIndex, width): string`, `pageTextKey(sourceId, blockIndex): string`
  - `createSourceBlobStore(db, now?): SourceBlobStore` mit `put`, `has`, `read`, `readBytes`, `collectGarbage`, `totalBytes`

Die vier Object Stores stehen so im Design. Zwei Entscheidungen begruenden sich gegenseitig: Composition-State und Blobs liegen getrennt, weil der State bei jeder Bewegung geschrieben wird und die grossen Blobs genau einmal. Und die Lebensdauer eines Blobs wird **nicht** ueber einen gespeicherten Zaehler bestimmt, sondern aus der Menge der tatsaechlich verwendeten `contentHash`-Werte abgeleitet -- ein Zaehler kann von der Wahrheit abdriften, eine Ableitung nicht.

- [ ] **Step 1: Testabhaengigkeit installieren**

```bash
npm install -D fake-indexeddb
```

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

`src/services/persistence/sourceBlobStore.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openWorkspaceDb, thumbKey, pageTextKey, type Database } from './db';
import { createSourceBlobStore } from './sourceBlobStore';

let db: Database;
let dbName: string;
let counter = 0;

beforeEach(async () => {
  dbName = `pdf-master-test-${++counter}`;
  db = await openWorkspaceDb(dbName);
});

afterEach(() => {
  db.close();
});

const bytes = (values: number[]) => new Blob([new Uint8Array(values)], { type: 'application/pdf' });

describe('openWorkspaceDb', () => {
  it('legt die vier Object Stores an', () => {
    expect([...db.objectStoreNames].sort()).toEqual([
      'pageText',
      'sourceBlobs',
      'thumbs',
      'workspaces',
    ]);
  });
});

describe('Cache-Schluessel', () => {
  it('setzt den Thumbnail-Schluessel aus Quelle, Index und Breite zusammen', () => {
    expect(thumbKey('src-a', 16, 180)).toBe('src-a:16:180');
  });

  it('setzt den Textschluessel aus Quelle und Index zusammen', () => {
    expect(pageTextKey('src-a', 16)).toBe('src-a:16');
  });
});

describe('createSourceBlobStore', () => {
  it('legt einen Blob ab und liest ihn zurueck', async () => {
    const store = createSourceBlobStore(db);
    await store.put('hash-a', bytes([1, 2, 3]));

    expect(await store.has('hash-a')).toBe(true);
    expect(await (await store.read('hash-a')).size).toBe(3);
    expect(await store.readBytes('hash-a')).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('schreibt denselben Inhalt nicht zweimal', async () => {
    const store = createSourceBlobStore(db, () => 111);
    await store.put('hash-a', bytes([1, 2, 3]));
    await store.put('hash-a', bytes([1, 2, 3]));

    expect(await db.count('sourceBlobs')).toBe(1);
    expect((await db.get('sourceBlobs', 'hash-a'))?.importedAt).toBe(111);
  });

  it('meldet einen fehlenden Blob mit dem Schluessel', async () => {
    const store = createSourceBlobStore(db);
    await expect(store.read('hash-weg')).rejects.toThrow(/hash-weg/);
  });

  it('summiert die belegten Bytes', async () => {
    const store = createSourceBlobStore(db);
    await store.put('hash-a', bytes([1, 2, 3]));
    await store.put('hash-b', bytes([1, 2]));
    expect(await store.totalBytes()).toBe(5);
  });

  it('loescht Blobs, die keine Quelle mehr verwendet', async () => {
    const store = createSourceBlobStore(db);
    await store.put('hash-a', bytes([1]));
    await store.put('hash-b', bytes([2]));
    await store.put('hash-c', bytes([3]));

    const removed = await store.collectGarbage(['hash-b']);

    expect(removed.sort()).toEqual(['hash-a', 'hash-c']);
    expect(await store.has('hash-b')).toBe(true);
    expect(await store.has('hash-a')).toBe(false);
  });

  it('loescht nichts, wenn alle Blobs verwendet werden', async () => {
    const store = createSourceBlobStore(db);
    await store.put('hash-a', bytes([1]));
    expect(await store.collectGarbage(['hash-a'])).toEqual([]);
  });
});
```

- [ ] **Step 3: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/persistence/sourceBlobStore.test.ts`
Expected: FAIL, `Failed to resolve import "./db"`.

- [ ] **Step 4: db.ts implementieren**

`src/services/persistence/db.ts`:

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Workspace } from '../../domain/types';

export const DB_NAME = 'pdf-master';
export const DB_VERSION = 1;

export interface SourceBlobRecord {
  contentHash: string;
  blob: Blob;
  byteSize: number;
  importedAt: number;
}

export interface ThumbRecord {
  key: string;
  blob: Blob;
  width: number;
  createdAt: number;
}

export interface PageTextRecord {
  key: string;
  sourceId: string;
  blockIndex: number;
  text: string;
  createdAt: number;
}

export interface PdfMasterDb extends DBSchema {
  /** Permanent: der komplette Workspace-Record. */
  workspaces: { key: string; value: Workspace };
  /** Referenziert ueber contentHash, geloescht wenn keine Quelle mehr darauf zeigt. */
  sourceBlobs: { key: string; value: SourceBlobRecord };
  /** Verwerfbarer Cache. */
  thumbs: { key: string; value: ThumbRecord };
  /** Verwerfbarer Cache. */
  pageText: { key: string; value: PageTextRecord };
}

export type Database = IDBPDatabase<PdfMasterDb>;

/** `name` ist parametrisiert, damit Tests sich nicht gegenseitig sehen. */
export function openWorkspaceDb(name: string = DB_NAME): Promise<Database> {
  return openDB<PdfMasterDb>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('workspaces', { keyPath: 'id' });
        db.createObjectStore('sourceBlobs', { keyPath: 'contentHash' });
        db.createObjectStore('thumbs', { keyPath: 'key' });
        db.createObjectStore('pageText', { keyPath: 'key' });
      }
    },
    blocked() {
      console.warn('Eine andere Registerkarte blockiert die Aktualisierung der Datenbank.');
    },
  });
}

export function thumbKey(sourceId: string, blockIndex: number, width: number): string {
  return `${sourceId}:${blockIndex}:${width}`;
}

export function pageTextKey(sourceId: string, blockIndex: number): string {
  return `${sourceId}:${blockIndex}`;
}
```

- [ ] **Step 5: sourceBlobStore.ts implementieren**

`src/services/persistence/sourceBlobStore.ts`:

```ts
import type { Database } from './db';

export interface SourceBlobStore {
  /** Legt die Bytes ab; ein bereits vorhandener Inhalt wird nicht neu geschrieben. */
  put(contentHash: string, blob: Blob): Promise<void>;
  has(contentHash: string): Promise<boolean>;
  read(contentHash: string): Promise<Blob>;
  readBytes(contentHash: string): Promise<Uint8Array>;
  /** Loescht alle Blobs, deren Hash nicht in `inUse` steht, und liefert die geloeschten. */
  collectGarbage(inUse: Iterable<string>): Promise<string[]>;
  totalBytes(): Promise<number>;
}

export function createSourceBlobStore(
  db: Database,
  now: () => number = () => Date.now(),
): SourceBlobStore {
  // Freie Funktion statt `this`, damit einzelne Methoden herausgeloest
  // uebergeben werden koennen, ohne ihren Empfaenger zu verlieren.
  async function read(contentHash: string): Promise<Blob> {
    const record = await db.get('sourceBlobs', contentHash);
    if (!record) throw new Error(`Die Bytes zu ${contentHash} sind nicht gespeichert.`);
    return record.blob;
  }

  return {
    async put(contentHash, blob) {
      // Gleicher Hash bedeutet gleicher Inhalt: der Doppelimport derselben
      // Datei kostet keinen zweiten Speicherplatz.
      const existing = await db.get('sourceBlobs', contentHash);
      if (existing) return;
      await db.put('sourceBlobs', {
        contentHash,
        blob,
        byteSize: blob.size,
        importedAt: now(),
      });
    },

    async has(contentHash) {
      return (await db.getKey('sourceBlobs', contentHash)) !== undefined;
    },

    read,

    async readBytes(contentHash) {
      return new Uint8Array(await (await read(contentHash)).arrayBuffer());
    },

    async collectGarbage(inUse) {
      const keep = new Set(inUse);
      const removed: string[] = [];
      const tx = db.transaction('sourceBlobs', 'readwrite');
      for (const key of await tx.store.getAllKeys()) {
        if (keep.has(key)) continue;
        await tx.store.delete(key);
        removed.push(key);
      }
      await tx.done;
      return removed;
    },

    async totalBytes() {
      const records = await db.getAll('sourceBlobs');
      return records.reduce((sum, record) => sum + record.byteSize, 0);
    },
  };
}
```

- [ ] **Step 6: Tests pruefen**

Run: `npm run test -- src/services/persistence/sourceBlobStore.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: IndexedDB-Schema und Quell-Blob-Store

Vier Object Stores wie im Design; Composition-State und Blobs getrennt, weil
der State bei jeder Bewegung geschrieben wird und die Blobs genau einmal. Die
Lebensdauer eines Blobs wird aus den tatsaechlich verwendeten contentHash-
Werten abgeleitet statt in einem Zaehler gefuehrt, der abdriften kann.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 6: Workspace-Repository und Migrationsnaht

**Files:**
- Create: `src/services/persistence/workspaceRepo.ts`
- Test: `src/services/persistence/workspaceRepo.test.ts`

**Interfaces:**
- Consumes: `Database` aus `./db`; `Workspace` aus `../../domain/types`; Fixture aus `../../domain/__fixtures__/workspace`
- Produces:
  - `interface WorkspaceSummary { id: string; name: string; updatedAt: number }`
  - `migrateWorkspaceRecord(raw: unknown): Workspace`
  - `createWorkspaceRepo(db): WorkspaceRepo` mit `save`, `load`, `loadMostRecent`, `list`, `remove`, `usedContentHashes`

`schemaVersion` steht von Anfang an im Record, damit spaetere Phasen migrieren koennen statt Workspaces zu verlieren. Diese Naht wird hier gebaut und getestet, obwohl es in Phase 1 nur Version 1 gibt -- sonst gibt es sie beim ersten Modellwechsel nicht.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/services/persistence/workspaceRepo.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openWorkspaceDb, type Database } from './db';
import { createWorkspaceRepo, migrateWorkspaceRecord } from './workspaceRepo';
import { makeWorkspace } from '../../domain/__fixtures__/workspace';

let db: Database;
let counter = 0;

beforeEach(async () => {
  db = await openWorkspaceDb(`pdf-master-repo-${++counter}`);
});

afterEach(() => {
  db.close();
});

describe('createWorkspaceRepo', () => {
  it('speichert und laedt einen Workspace unveraendert', async () => {
    const repo = createWorkspaceRepo(db);
    const ws = makeWorkspace();
    await repo.save(ws);
    expect(await repo.load(ws.id)).toEqual(ws);
  });

  it('liefert undefined fuer eine unbekannte Id', async () => {
    expect(await createWorkspaceRepo(db).load('gibt-es-nicht')).toBeUndefined();
  });

  it('listet die Workspaces nach Aenderungszeit, neueste zuerst', async () => {
    const repo = createWorkspaceRepo(db);
    await repo.save({ ...makeWorkspace(), id: 'ws-alt', name: 'Alt', updatedAt: 1000 });
    await repo.save({ ...makeWorkspace(), id: 'ws-neu', name: 'Neu', updatedAt: 5000 });

    expect(await repo.list()).toEqual([
      { id: 'ws-neu', name: 'Neu', updatedAt: 5000 },
      { id: 'ws-alt', name: 'Alt', updatedAt: 1000 },
    ]);
  });

  it('laedt den zuletzt geaenderten Workspace', async () => {
    const repo = createWorkspaceRepo(db);
    await repo.save({ ...makeWorkspace(), id: 'ws-alt', updatedAt: 1000 });
    await repo.save({ ...makeWorkspace(), id: 'ws-neu', updatedAt: 5000 });
    expect((await repo.loadMostRecent())?.id).toBe('ws-neu');
  });

  it('liefert undefined, wenn noch nichts gespeichert wurde', async () => {
    expect(await createWorkspaceRepo(db).loadMostRecent()).toBeUndefined();
  });

  it('entfernt einen Workspace', async () => {
    const repo = createWorkspaceRepo(db);
    const ws = makeWorkspace();
    await repo.save(ws);
    await repo.remove(ws.id);
    expect(await repo.load(ws.id)).toBeUndefined();
  });

  it('sammelt die verwendeten contentHash-Werte ueber alle Workspaces', async () => {
    const repo = createWorkspaceRepo(db);
    await repo.save(makeWorkspace());
    expect((await repo.usedContentHashes()).sort()).toEqual([
      'hash-src-bank',
      'hash-src-contract',
      'hash-src-insurance',
    ]);
  });
});

describe('migrateWorkspaceRecord', () => {
  it('laesst einen Record der aktuellen Version durch', () => {
    const ws = makeWorkspace();
    expect(migrateWorkspaceRecord(ws)).toEqual(ws);
  });

  it('ergaenzt eine fehlende Wurzelliste', () => {
    const ws = makeWorkspace();
    const broken = { ...ws, childOrder: {} };
    expect(migrateWorkspaceRecord(broken).childOrder.root).toEqual([]);
  });

  it('lehnt eine neuere Schemaversion mit klarer Meldung ab', () => {
    const ws = { ...makeWorkspace(), schemaVersion: 2 };
    expect(() => migrateWorkspaceRecord(ws)).toThrow(/neueren Version/);
  });

  it('lehnt ab, was gar kein Workspace ist', () => {
    expect(() => migrateWorkspaceRecord(null)).toThrow(/kein Workspace/);
    expect(() => migrateWorkspaceRecord({ id: 'x' })).toThrow(/kein Workspace/);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/persistence/workspaceRepo.test.ts`
Expected: FAIL, `Failed to resolve import "./workspaceRepo"`.

- [ ] **Step 3: workspaceRepo.ts implementieren**

`src/services/persistence/workspaceRepo.ts`:

```ts
import type { Workspace } from '../../domain/types';
import type { Database } from './db';

export const CURRENT_SCHEMA_VERSION = 1;

export interface WorkspaceSummary {
  id: string;
  name: string;
  updatedAt: number;
}

export interface WorkspaceRepo {
  save(ws: Workspace): Promise<void>;
  load(id: string): Promise<Workspace | undefined>;
  loadMostRecent(): Promise<Workspace | undefined>;
  list(): Promise<WorkspaceSummary[]>;
  remove(id: string): Promise<void>;
  /** Alle contentHash-Werte, die noch von irgendeinem Workspace gebraucht werden. */
  usedContentHashes(): Promise<string[]>;
}

/**
 * Die Migrationsnaht. In Phase 1 gibt es nur Version 1, aber der Weg von einem
 * gespeicherten Record zum Modell fuehrt ab jetzt immer hier durch -- sonst
 * gibt es diese Stelle beim ersten Modellwechsel nicht.
 */
export function migrateWorkspaceRecord(raw: unknown): Workspace {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Dieser Eintrag ist kein Workspace.');
  }
  const record = raw as Partial<Workspace>;
  if (
    typeof record.id !== 'string' ||
    typeof record.schemaVersion !== 'number' ||
    typeof record.sources !== 'object' ||
    typeof record.nodes !== 'object'
  ) {
    throw new Error('Dieser Eintrag ist kein Workspace.');
  }
  if (record.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      'Dieser Workspace wurde mit einer neueren Version von PDF-Master erstellt und kann hier nicht geoeffnet werden.',
    );
  }
  return {
    ...(record as Workspace),
    childOrder: { root: [], ...record.childOrder },
  };
}

export function createWorkspaceRepo(db: Database): WorkspaceRepo {
  async function all(): Promise<Workspace[]> {
    return db.getAll('workspaces');
  }

  return {
    async save(ws) {
      await db.put('workspaces', ws);
    },

    async load(id) {
      const raw = await db.get('workspaces', id);
      return raw === undefined ? undefined : migrateWorkspaceRecord(raw);
    },

    async loadMostRecent() {
      const records = await all();
      if (records.length === 0) return undefined;
      const newest = records.reduce((best, current) =>
        current.updatedAt > best.updatedAt ? current : best,
      );
      return migrateWorkspaceRecord(newest);
    },

    async list() {
      const records = await all();
      return records
        .map((ws) => ({ id: ws.id, name: ws.name, updatedAt: ws.updatedAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async remove(id) {
      await db.delete('workspaces', id);
    },

    async usedContentHashes() {
      const hashes = new Set<string>();
      for (const ws of await all()) {
        for (const source of Object.values(ws.sources)) hashes.add(source.contentHash);
      }
      return [...hashes];
    },
  };
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/services/persistence/workspaceRepo.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Workspace-Repository mit Migrationsnaht

Jeder gespeicherte Record laeuft beim Laden durch migrateWorkspaceRecord.
In Phase 1 prueft das nur die Schemaversion und ergaenzt die Wurzelliste, aber
die Stelle existiert damit, bevor sie gebraucht wird; ein Workspace aus einer
neueren Version wird abgelehnt statt halb geladen.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 7: Autosave

**Files:**
- Create: `src/services/persistence/autosave.ts`
- Test: `src/services/persistence/autosave.test.ts`

**Interfaces:**
- Consumes: `Workspace` aus `../../domain/types`
- Produces:
  - `type SaveStatus = { kind: 'idle' } | { kind: 'pending' } | { kind: 'saving' } | { kind: 'saved'; at: number } | { kind: 'error'; reason: 'quota' | 'unknown'; message: string }`
  - `createAutosave(deps: AutosaveDeps): Autosave` mit `schedule`, `flush`, `getStatus`, `subscribe`, `dispose`
  - `describeSaveStatus(status: SaveStatus): string`
  - `isQuotaError(error: unknown): boolean`

Kein Save-Button: 400 ms nach der letzten Aenderung wird geschrieben, und bei `visibilitychange` sofort. Das Anhaengen des Browser-Ereignisses passiert im UI (Plan 3), nicht hier -- dieser Dienst kennt kein `document`, damit er in Node testbar bleibt.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/services/persistence/autosave.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosave, describeSaveStatus, type SaveStatus } from './autosave';
import { makeWorkspace } from '../../domain/__fixtures__/workspace';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createAutosave', () => {
  it('schreibt erst nach der Ruhezeit', async () => {
    const save = vi.fn(async () => undefined);
    const autosave = createAutosave({ save });

    autosave.schedule(makeWorkspace());
    await vi.advanceTimersByTimeAsync(399);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('fasst mehrere Aenderungen zu einem Schreibvorgang zusammen', async () => {
    const save = vi.fn(async () => undefined);
    const autosave = createAutosave({ save });

    autosave.schedule({ ...makeWorkspace(), name: 'Erst' });
    await vi.advanceTimersByTimeAsync(200);
    autosave.schedule({ ...makeWorkspace(), name: 'Dann' });
    await vi.advanceTimersByTimeAsync(400);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0]).toMatchObject({ name: 'Dann' });
  });

  it('schreibt bei flush sofort', async () => {
    const save = vi.fn(async () => undefined);
    const autosave = createAutosave({ save });

    autosave.schedule(makeWorkspace());
    await autosave.flush();

    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.getStatus().kind).toBe('saved');
  });

  it('tut bei flush ohne Aenderung nichts', async () => {
    const save = vi.fn(async () => undefined);
    await createAutosave({ save }).flush();
    expect(save).not.toHaveBeenCalled();
  });

  it('durchlaeuft die Zustaende pending, saving, saved', async () => {
    const seen: SaveStatus['kind'][] = [];
    const autosave = createAutosave({ save: async () => undefined, now: () => 4242 });
    autosave.subscribe((status) => seen.push(status.kind));

    autosave.schedule(makeWorkspace());
    await vi.advanceTimersByTimeAsync(400);

    expect(seen).toEqual(['pending', 'saving', 'saved']);
    expect(autosave.getStatus()).toEqual({ kind: 'saved', at: 4242 });
  });

  it('schreibt eine waehrend des Speicherns aufgelaufene Aenderung nach', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const save = vi.fn(async () => {
      if (save.mock.calls.length === 1) await gate;
    });
    const autosave = createAutosave({ save });

    autosave.schedule({ ...makeWorkspace(), name: 'Erst' });
    await vi.advanceTimersByTimeAsync(400);
    autosave.schedule({ ...makeWorkspace(), name: 'Dann' });

    release();
    await autosave.flush();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0]).toMatchObject({ name: 'Dann' });
  });

  it('meldet einen vollen Speicher als eigenen Fehlergrund', async () => {
    const quotaError = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    const autosave = createAutosave({
      save: async () => {
        throw quotaError;
      },
    });

    autosave.schedule(makeWorkspace());
    await vi.advanceTimersByTimeAsync(400);

    expect(autosave.getStatus()).toEqual({
      kind: 'error',
      reason: 'quota',
      message: 'Nicht gespeichert -- Speicher voll',
    });
  });

  it('meldet andere Fehler als unbekannt, ohne die App anzuhalten', async () => {
    const autosave = createAutosave({
      save: async () => {
        throw new Error('irgendwas');
      },
    });

    autosave.schedule(makeWorkspace());
    await vi.advanceTimersByTimeAsync(400);

    expect(autosave.getStatus()).toMatchObject({ kind: 'error', reason: 'unknown' });
  });

  it('schreibt nach dispose nicht mehr', async () => {
    const save = vi.fn(async () => undefined);
    const autosave = createAutosave({ save });
    autosave.schedule(makeWorkspace());
    autosave.dispose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).not.toHaveBeenCalled();
  });
});

describe('describeSaveStatus', () => {
  it('benennt die Zustaende so, wie sie im Header stehen', () => {
    expect(describeSaveStatus({ kind: 'idle' })).toBe('');
    expect(describeSaveStatus({ kind: 'pending' })).toBe('Speichern...');
    expect(describeSaveStatus({ kind: 'saving' })).toBe('Speichern...');
    expect(describeSaveStatus({ kind: 'saved', at: 1 })).toBe('Lokal gespeichert');
    expect(
      describeSaveStatus({ kind: 'error', reason: 'quota', message: 'Nicht gespeichert -- Speicher voll' }),
    ).toBe('Nicht gespeichert -- Speicher voll');
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/persistence/autosave.test.ts`
Expected: FAIL, `Failed to resolve import "./autosave"`.

- [ ] **Step 3: autosave.ts implementieren**

`src/services/persistence/autosave.ts`:

```ts
import type { Workspace } from '../../domain/types';

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; reason: 'quota' | 'unknown'; message: string };

export interface AutosaveDeps {
  save(ws: Workspace): Promise<void>;
  /** Ruhezeit nach der letzten Aenderung. */
  delayMs?: number;
  now?(): number;
}

export interface Autosave {
  schedule(ws: Workspace): void;
  /** Schreibt sofort; das UI ruft dies bei visibilitychange. */
  flush(): Promise<void>;
  getStatus(): SaveStatus;
  subscribe(listener: (status: SaveStatus) => void): () => void;
  dispose(): void;
}

export function isQuotaError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'QuotaExceededError'
  );
}

export function describeSaveStatus(status: SaveStatus): string {
  switch (status.kind) {
    case 'idle':
      return '';
    case 'pending':
    case 'saving':
      return 'Speichern...';
    case 'saved':
      return 'Lokal gespeichert';
    case 'error':
      return status.message;
  }
}

export function createAutosave({
  save,
  delayMs = 400,
  now = () => Date.now(),
}: AutosaveDeps): Autosave {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Workspace | undefined;
  let draining: Promise<void> | undefined;
  let disposed = false;
  let status: SaveStatus = { kind: 'idle' };
  const listeners = new Set<(status: SaveStatus) => void>();

  function setStatus(next: SaveStatus): void {
    status = next;
    for (const listener of listeners) listener(next);
  }

  async function loop(): Promise<void> {
    // Solange schreiben, bis nichts mehr aufgelaufen ist: waehrend eines
    // Schreibvorgangs kann eine neuere Fassung eingetroffen sein.
    while (pending && !disposed) {
      const ws = pending;
      pending = undefined;
      setStatus({ kind: 'saving' });
      try {
        await save(ws);
        setStatus({ kind: 'saved', at: now() });
      } catch (error) {
        console.error('Autosave fehlgeschlagen', error);
        setStatus(
          isQuotaError(error)
            ? { kind: 'error', reason: 'quota', message: 'Nicht gespeichert -- Speicher voll' }
            : {
                kind: 'error',
                reason: 'unknown',
                message: 'Nicht gespeichert -- ein Fehler ist aufgetreten',
              },
        );
      }
    }
  }

  function drain(): Promise<void> {
    if (!draining) {
      draining = loop().finally(() => {
        draining = undefined;
      });
    }
    return draining;
  }

  return {
    schedule(ws) {
      if (disposed) return;
      pending = ws;
      setStatus({ kind: 'pending' });
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void drain();
      }, delayMs);
    },

    async flush() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      await drain();
    },

    getStatus() {
      return status;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
      listeners.clear();
    },
  };
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/services/persistence/autosave.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Autosave mit Ruhezeit, Nachschreiben und Statusmodell

400 ms nach der letzten Aenderung wird geschrieben, mehrere Aenderungen
werden zu einem Schreibvorgang zusammengefasst, und eine waehrend des
Schreibens aufgelaufene Fassung wird danach nachgezogen. Der Dienst kennt
kein document: das visibilitychange-Ereignis haengt Plan 3 an flush().

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 8: Speicherkontingent und dauerhafte Ablage

**Files:**
- Create: `src/services/persistence/storage.ts`
- Test: `src/services/persistence/storage.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `interface StorageManagerLike { persist?(): Promise<boolean>; persisted?(): Promise<boolean>; estimate?(): Promise<{ usage?: number; quota?: number }> }`
  - `type RoomCheck = { ok: true } | { ok: false; message: string }`
  - `createStorageGuard(storage?: StorageManagerLike, safetyMarginBytes?: number): StorageGuard` mit `requestPersistence`, `estimate`, `ensureRoom`
  - `formatBytes(bytes: number): string`

Das Design verlangt: beim Import `navigator.storage.persist()` anfragen und `estimate()` pruefen; reicht das Kontingent nicht, wird der Import **mit klarer Meldung abgelehnt**, statt in einen `QuotaExceededError` zu laufen. Fehlt die API, darf das kein Bruch sein -- dann wird der Import zugelassen und der Fehlerfall bleibt dem Autosave-Status ueberlassen.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/services/persistence/storage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createStorageGuard, formatBytes } from './storage';

const MB = 1024 * 1024;

describe('formatBytes', () => {
  it('schreibt Groessen lesbar und mit Komma', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(formatBytes(5 * MB)).toBe('5 MB');
    expect(formatBytes(2.5 * 1024 * MB)).toBe('2,5 GB');
  });
});

describe('createStorageGuard / requestPersistence', () => {
  it('fragt dauerhafte Ablage an', async () => {
    const persist = vi.fn(async () => true);
    const guard = createStorageGuard({ persist, persisted: async () => false });
    expect(await guard.requestPersistence()).toBe(true);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('fragt nicht erneut an, wenn die Ablage bereits dauerhaft ist', async () => {
    const persist = vi.fn(async () => true);
    const guard = createStorageGuard({ persist, persisted: async () => true });
    expect(await guard.requestPersistence()).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('kommt ohne die API aus', async () => {
    expect(await createStorageGuard(undefined).requestPersistence()).toBe(false);
  });
});

describe('createStorageGuard / ensureRoom', () => {
  it('laesst einen Import durch, der bequem passt', async () => {
    const guard = createStorageGuard({
      estimate: async () => ({ usage: 100 * MB, quota: 1000 * MB }),
    });
    expect(await guard.ensureRoom(50 * MB)).toEqual({ ok: true });
  });

  it('lehnt einen Import ab, der das Kontingent sprengt, und sagt wie viel fehlt', async () => {
    const guard = createStorageGuard(
      { estimate: async () => ({ usage: 900 * MB, quota: 1000 * MB }) },
      0,
    );
    const result = await guard.ensureRoom(300 * MB);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unerwartet');
    expect(result.message).toContain('200 MB');
    expect(result.message).toMatch(/Speicher/);
  });

  it('rechnet den Sicherheitsabstand mit ein', async () => {
    const guard = createStorageGuard(
      { estimate: async () => ({ usage: 0, quota: 100 * MB }) },
      50 * MB,
    );
    expect((await guard.ensureRoom(60 * MB)).ok).toBe(false);
    expect((await guard.ensureRoom(40 * MB)).ok).toBe(true);
  });

  it('laesst den Import durch, wenn der Browser keine Schaetzung liefert', async () => {
    expect(await createStorageGuard({}).ensureRoom(1000 * MB)).toEqual({ ok: true });
    expect(await createStorageGuard(undefined).ensureRoom(1000 * MB)).toEqual({ ok: true });
  });

  it('laesst den Import durch, wenn die Schaetzung unvollstaendig ist', async () => {
    const guard = createStorageGuard({ estimate: async () => ({ usage: 5 }) });
    expect(await guard.ensureRoom(1000 * MB)).toEqual({ ok: true });
  });

  it('verschluckt einen Fehler der Schaetzung', async () => {
    const guard = createStorageGuard({
      estimate: async () => {
        throw new Error('nicht verfuegbar');
      },
    });
    expect(await guard.ensureRoom(10 * MB)).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/persistence/storage.test.ts`
Expected: FAIL, `Failed to resolve import "./storage"`.

- [ ] **Step 3: storage.ts implementieren**

`src/services/persistence/storage.ts`:

```ts
/** Der Teil von navigator.storage, den dieser Dienst braucht. */
export interface StorageManagerLike {
  persist?(): Promise<boolean>;
  persisted?(): Promise<boolean>;
  estimate?(): Promise<{ usage?: number; quota?: number }>;
}

export type RoomCheck = { ok: true } | { ok: false; message: string };

export interface StorageGuard {
  /** Schuetzt den Workspace vor Verdraengung unter Speicherdruck. */
  requestPersistence(): Promise<boolean>;
  estimate(): Promise<{ usage: number; quota: number } | undefined>;
  ensureRoom(bytes: number): Promise<RoomCheck>;
}

const DEFAULT_MARGIN = 50 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace('.', ',')} ${units[unit]}`;
}

export function createStorageGuard(
  storage: StorageManagerLike | undefined,
  safetyMarginBytes: number = DEFAULT_MARGIN,
): StorageGuard {
  async function estimate(): Promise<{ usage: number; quota: number } | undefined> {
    if (!storage?.estimate) return undefined;
    try {
      const { usage, quota } = await storage.estimate();
      if (typeof usage !== 'number' || typeof quota !== 'number') return undefined;
      return { usage, quota };
    } catch (error) {
      console.warn('Speicherschaetzung nicht verfuegbar', error);
      return undefined;
    }
  }

  return {
    async requestPersistence() {
      if (!storage?.persist) return false;
      try {
        if (storage.persisted && (await storage.persisted())) return true;
        return await storage.persist();
      } catch (error) {
        console.warn('Dauerhafte Ablage konnte nicht angefragt werden', error);
        return false;
      }
    },

    estimate,

    async ensureRoom(bytes) {
      const current = await estimate();
      // Ohne Schaetzung wird nicht geraten: lieber importieren und im
      // Fehlerfall den Autosave-Status sprechen lassen.
      if (!current) return { ok: true };

      const free = current.quota - current.usage - safetyMarginBytes;
      if (bytes <= free) return { ok: true };

      return {
        ok: false,
        message:
          `Fuer diesen Import fehlen rund ${formatBytes(bytes - free)} Speicher im Browser. ` +
          'Loeschen Sie nicht mehr benoetigte Workspaces oder leeren Sie die Vorschau-Caches.',
      };
    },
  };
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/services/persistence/storage.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Kontingentpruefung und dauerhafte Ablage

Vor dem Import wird persist() angefragt und das Kontingent geprueft; reicht es
nicht, wird der Import mit einer Meldung abgelehnt, die die fehlende Menge
nennt, statt spaeter in einen QuotaExceededError zu laufen. Fehlt die API,
wird nicht geraten -- der Import laeuft, der Fehlerfall bleibt dem
Autosave-Status ueberlassen.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 9: Dateien und Ordner einsammeln (`fileSources.ts`)

**Files:**
- Create: `src/services/import/fileSources.ts`
- Test: `src/services/import/fileSources.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `interface ImportCandidate { file: File; importPath?: string }`
  - `interface FileEntryLike`, `interface DirectoryEntryLike`, `type EntryLike`
  - `interface DirectoryHandleLike`
  - `collectFromEntries(entries: EntryLike[], maxDepth?): Promise<ImportCandidate[]>`
  - `collectFromDataTransfer(items: DataTransferItemLike[]): Promise<ImportCandidate[]>`
  - `collectFromFileList(files: Iterable<File>): ImportCandidate[]`
  - `collectFromDirectoryHandle(handle: DirectoryHandleLike): Promise<ImportCandidate[]>`

Die drei Importwege des Designs (Drop, Dateidialog, Verzeichniswahl) muenden hier in **eine** Liste von Kandidaten mit relativem Pfad. Der Pfad wird nur als `importPath` gespeichert und nicht in die Ausgabestruktur uebernommen -- Quell- und Ausgabestruktur sind getrennt.

Die Typen sind absichtlich eigene, minimale `...Like`-Schnittstellen statt der DOM-Typen: `FileSystemEntry` ist in Node nicht vorhanden, und die echten Objekte erfuellen diese Formen ohnehin.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/services/import/fileSources.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  collectFromDataTransfer,
  collectFromDirectoryHandle,
  collectFromEntries,
  collectFromFileList,
  type DirectoryHandleLike,
  type EntryLike,
} from './fileSources';

const pdf = (name: string) => new File([new Uint8Array([37, 80, 68, 70])], name, { type: 'application/pdf' });

function fileEntry(name: string): EntryLike {
  return {
    isFile: true,
    isDirectory: false,
    name,
    file: (resolve) => resolve(pdf(name)),
  };
}

/** Bildet nach, dass readEntries hoechstens einen Schwung auf einmal liefert. */
function directoryEntry(name: string, children: EntryLike[], batchSize = 2): EntryLike {
  let offset = 0;
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => ({
      readEntries: (resolve) => {
        const batch = children.slice(offset, offset + batchSize);
        offset += batch.length;
        resolve(batch);
      },
    }),
  };
}

describe('collectFromEntries', () => {
  it('sammelt einzelne Dateien ohne Pfad', async () => {
    const candidates = await collectFromEntries([fileEntry('Bank.pdf')]);
    expect(candidates).toEqual([{ file: expect.any(File), importPath: undefined }]);
    expect(candidates[0]?.file.name).toBe('Bank.pdf');
  });

  it('steigt in Ordner ab und merkt sich den relativen Pfad', async () => {
    const tree = directoryEntry('2026', [
      directoryEntry('Bank', [fileEntry('UBS.pdf')]),
      fileEntry('Uebersicht.pdf'),
    ]);

    const candidates = await collectFromEntries([tree]);

    expect(candidates.map((candidate) => candidate.importPath).sort()).toEqual([
      '2026/Bank/UBS.pdf',
      '2026/Uebersicht.pdf',
    ]);
  });

  it('liest ein Verzeichnis vollstaendig aus, auch ueber mehrere Schwuenge', async () => {
    const many = Array.from({ length: 7 }, (_, index) => fileEntry(`Datei-${index}.pdf`));
    const candidates = await collectFromEntries([directoryEntry('Viele', many, 2)]);
    expect(candidates).toHaveLength(7);
  });

  it('bricht bei zu tiefer Verschachtelung ab, statt sich zu verlaufen', async () => {
    const deep: EntryLike = { isFile: false, isDirectory: true, name: 'a', createReader: () => ({ readEntries: (resolve) => resolve([deep]) }) };
    await expect(collectFromEntries([deep], 3)).resolves.toEqual([]);
  });

  it('ueberspringt eine Datei, die sich nicht lesen laesst', async () => {
    const broken: EntryLike = {
      isFile: true,
      isDirectory: false,
      name: 'Kaputt.pdf',
      file: (_resolve, reject) => reject?.(new Error('nicht lesbar')),
    };
    await expect(collectFromEntries([broken, fileEntry('Gut.pdf')])).resolves.toHaveLength(1);
  });
});

describe('collectFromDataTransfer', () => {
  it('nimmt nur Eintraege, die ein Dateisystemobjekt liefern', async () => {
    const candidates = await collectFromDataTransfer([
      { kind: 'file', webkitGetAsEntry: () => fileEntry('Bank.pdf') },
      { kind: 'string', webkitGetAsEntry: () => null },
    ]);
    expect(candidates).toHaveLength(1);
  });
});

describe('collectFromFileList', () => {
  it('uebernimmt den relativen Pfad der Ordnerauswahl', () => {
    const file = pdf('UBS.pdf');
    Object.defineProperty(file, 'webkitRelativePath', { value: '2026/Bank/UBS.pdf' });
    expect(collectFromFileList([file])[0]?.importPath).toBe('2026/Bank/UBS.pdf');
  });

  it('laesst den Pfad bei einer einzelnen Datei weg', () => {
    expect(collectFromFileList([pdf('Bank.pdf')])[0]?.importPath).toBeUndefined();
  });
});

describe('collectFromDirectoryHandle', () => {
  it('steigt rekursiv ab und baut den Pfad aus den Verzeichnisnamen', async () => {
    const handle: DirectoryHandleLike = {
      kind: 'directory',
      name: '2026',
      async *values() {
        yield {
          kind: 'directory',
          name: 'Bank',
          async *values() {
            yield { kind: 'file', name: 'UBS.pdf', getFile: async () => pdf('UBS.pdf') };
          },
        } as DirectoryHandleLike;
        yield { kind: 'file', name: 'Uebersicht.pdf', getFile: async () => pdf('Uebersicht.pdf') };
      },
    };

    const candidates = await collectFromDirectoryHandle(handle);

    expect(candidates.map((candidate) => candidate.importPath).sort()).toEqual([
      '2026/Bank/UBS.pdf',
      '2026/Uebersicht.pdf',
    ]);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/import/fileSources.test.ts`
Expected: FAIL, `Failed to resolve import "./fileSources"`.

- [ ] **Step 3: fileSources.ts implementieren**

`src/services/import/fileSources.ts`:

```ts
/** Eine importierbare Datei samt ihres relativen Pfads im gezogenen Ordner. */
export interface ImportCandidate {
  file: File;
  importPath?: string;
}

export interface FileEntryLike {
  readonly isFile: true;
  readonly isDirectory: false;
  readonly name: string;
  file(resolve: (file: File) => void, reject?: (error: unknown) => void): void;
}

export interface DirectoryEntryLike {
  readonly isFile: false;
  readonly isDirectory: true;
  readonly name: string;
  createReader(): {
    readEntries(resolve: (entries: EntryLike[]) => void, reject?: (error: unknown) => void): void;
  };
}

export type EntryLike = FileEntryLike | DirectoryEntryLike;

export interface DataTransferItemLike {
  readonly kind: string;
  webkitGetAsEntry(): EntryLike | null;
}

export interface FileHandleLike {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
}

export interface DirectoryHandleLike {
  readonly kind: 'directory';
  readonly name: string;
  values(): AsyncIterable<FileHandleLike | DirectoryHandleLike>;
}

const MAX_DEPTH = 8;

function joinPath(prefix: string[], name: string): string {
  return [...prefix, name].join('/');
}

function readFile(entry: FileEntryLike): Promise<File | undefined> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      (error) => {
        // Eine einzelne unlesbare Datei darf den ganzen Import nicht kippen.
        console.warn(`Datei ${entry.name} konnte nicht gelesen werden`, error);
        resolve(undefined);
      },
    );
  });
}

/** readEntries liefert nur einen Schwung pro Aufruf und muss bis zur Leere wiederholt werden. */
function readBatch(reader: ReturnType<DirectoryEntryLike['createReader']>): Promise<EntryLike[]> {
  return new Promise((resolve) => {
    reader.readEntries(
      (entries) => resolve(entries),
      (error) => {
        console.warn('Verzeichnis konnte nicht gelesen werden', error);
        resolve([]);
      },
    );
  });
}

export async function collectFromEntries(
  entries: EntryLike[],
  maxDepth: number = MAX_DEPTH,
): Promise<ImportCandidate[]> {
  const candidates: ImportCandidate[] = [];

  async function walk(entry: EntryLike, prefix: string[], depth: number): Promise<void> {
    if (depth > maxDepth) {
      console.warn(`Verzeichnis ${entry.name} ist tiefer als ${maxDepth} Ebenen und wird uebersprungen.`);
      return;
    }

    if (entry.isFile) {
      const file = await readFile(entry);
      if (!file) return;
      candidates.push({
        file,
        importPath: prefix.length > 0 ? joinPath(prefix, entry.name) : undefined,
      });
      return;
    }

    const reader = entry.createReader();
    for (;;) {
      const batch = await readBatch(reader);
      if (batch.length === 0) break;
      for (const child of batch) await walk(child, [...prefix, entry.name], depth + 1);
    }
  }

  for (const entry of entries) await walk(entry, [], 0);
  return candidates;
}

export async function collectFromDataTransfer(
  items: DataTransferItemLike[],
): Promise<ImportCandidate[]> {
  const entries: EntryLike[] = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry();
    if (entry) entries.push(entry);
  }
  return collectFromEntries(entries);
}

export function collectFromFileList(files: Iterable<File>): ImportCandidate[] {
  return [...files].map((file) => {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    return { file, importPath: relative ? relative : undefined };
  });
}

export async function collectFromDirectoryHandle(
  handle: DirectoryHandleLike,
  maxDepth: number = MAX_DEPTH,
): Promise<ImportCandidate[]> {
  const candidates: ImportCandidate[] = [];

  async function walk(directory: DirectoryHandleLike, prefix: string[], depth: number): Promise<void> {
    if (depth > maxDepth) return;
    for await (const child of directory.values()) {
      if (child.kind === 'file') {
        candidates.push({ file: await child.getFile(), importPath: joinPath(prefix, child.name) });
      } else {
        await walk(child, [...prefix, child.name], depth + 1);
      }
    }
  }

  await walk(handle, [handle.name], 0);
  return candidates;
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/services/import/fileSources.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Dateien und Ordner aus allen drei Importwegen einsammeln

Drop, Dateidialog und Verzeichniswahl muenden in eine Liste von Kandidaten
mit relativem Pfad. readEntries wird bis zur Leere wiederholt, weil es nur
einen Schwung pro Aufruf liefert; eine unlesbare Datei oder ein zu tiefer
Baum kippt den Import nicht.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 10: Import-Dienst (`importSources.ts`)

**Files:**
- Create: `src/services/import/importSources.ts`
- Test: `src/services/import/importSources.test.ts`

**Interfaces:**
- Consumes: `AdapterRegistry` aus `../../adapters/registry`/`types`, `SourceBlobStore`, `StorageGuard`, `ImportCandidate`, `SourceDocument` aus `../../domain/types`
- Produces:
  - `sha256Hex(bytes: Uint8Array): Promise<string>`
  - `interface ImportDeps { registry; blobStore; storage; hash; newId }`
  - `interface ImportReport { sources: SourceDocument[]; rejected: Array<{ name: string; message: string }> }`
  - `importCandidates(candidates: ImportCandidate[], deps: ImportDeps): Promise<ImportReport>`

Das Ergebnis ist bewusst nur ein Bericht, kein Zustandswechsel: die Sourcen wandern ueber den Command `importSources` in den Workspace (Plan 3). So bleibt der Dienst frei vom Store.

Zwei Festlegungen aus dem Design: der Doppelimport derselben Datei spart den **Blob**, erzeugt aber trotzdem eine zweite Quelle (Duplikaterkennung ist ausdruecklich Phase 2, `contentHash` ist nur der Anknuepfungspunkt). Und eine verschluesselte oder defekte Datei wird als Quelle mit Status `encrypted`/`error` aufgenommen, statt den Import der uebrigen Dateien zu blockieren.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/services/import/importSources.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { importCandidates, sha256Hex, type ImportDeps } from './importSources';
import { createRegistry } from '../../adapters/registry';
import type { DocumentAdapter, SourceProbeResult } from '../../adapters/types';
import type { SourceBlobStore } from '../persistence/sourceBlobStore';
import type { StorageGuard } from '../persistence/storage';

const ready: SourceProbeResult = {
  kind: 'pdf',
  blockKind: 'page',
  blockCount: 3,
  blockRotations: [0, 0, 90],
  status: 'ready',
};

function pdfFile(name: string, bytes = [37, 80, 68, 70]): File {
  return new File([new Uint8Array(bytes)], name, { type: 'application/pdf' });
}

function fakeBlobStore(): SourceBlobStore & { stored: Map<string, Blob> } {
  const stored = new Map<string, Blob>();
  return {
    stored,
    put: vi.fn(async (hash: string, blob: Blob) => {
      if (!stored.has(hash)) stored.set(hash, blob);
    }),
    has: async (hash: string) => stored.has(hash),
    read: async (hash: string) => {
      const blob = stored.get(hash);
      if (!blob) throw new Error(hash);
      return blob;
    },
    readBytes: async () => new Uint8Array(),
    collectGarbage: async () => [],
    totalBytes: async () => 0,
  };
}

function fakeStorage(room = true): StorageGuard {
  return {
    requestPersistence: vi.fn(async () => true),
    estimate: async () => undefined,
    ensureRoom: async () =>
      room ? { ok: true } : { ok: false, message: 'Fuer diesen Import fehlen rund 200 MB Speicher im Browser.' },
  };
}

function setup(probe: () => Promise<SourceProbeResult> = async () => ready, room = true) {
  const adapter: DocumentAdapter = {
    kind: 'pdf',
    accepts: (file) => file.name.toLowerCase().endsWith('.pdf'),
    probe: vi.fn(probe),
    renderBlock: () => Promise.reject(new Error('im Test nicht benutzt')),
  };
  const registry = createRegistry();
  registry.register(adapter);

  const blobStore = fakeBlobStore();
  let counter = 0;
  const deps: ImportDeps = {
    registry,
    blobStore,
    storage: fakeStorage(room),
    hash: async (bytes) => `hash-${bytes.length}-${bytes[0] ?? 0}`,
    newId: () => `src-${++counter}`,
  };
  return { deps, blobStore, adapter };
}

describe('sha256Hex', () => {
  it('bildet den bekannten Hash der leeren Eingabe', async () => {
    await expect(sha256Hex(new Uint8Array())).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('liefert fuer gleiche Bytes denselben Wert', async () => {
    const a = await sha256Hex(new Uint8Array([1, 2, 3]));
    const b = await sha256Hex(new Uint8Array([1, 2, 3]));
    expect(a).toBe(b);
  });
});

describe('importCandidates', () => {
  it('baut aus einer Datei eine vollstaendige Quelle', async () => {
    const { deps } = setup();
    const report = await importCandidates([{ file: pdfFile('Bank.pdf') }], deps);

    expect(report.rejected).toEqual([]);
    expect(report.sources).toEqual([
      {
        id: 'src-1',
        kind: 'pdf',
        name: 'Bank.pdf',
        blobKey: 'hash-4-37',
        byteSize: 4,
        contentHash: 'hash-4-37',
        blockKind: 'page',
        blockCount: 3,
        blockRotations: [0, 0, 90],
        status: 'ready',
      },
    ]);
  });

  it('merkt sich den relativen Pfad aus dem Ordnerimport', async () => {
    const { deps } = setup();
    const report = await importCandidates(
      [{ file: pdfFile('UBS.pdf'), importPath: '2026/Bank/UBS.pdf' }],
      deps,
    );
    expect(report.sources[0]?.importPath).toBe('2026/Bank/UBS.pdf');
  });

  it('legt die Bytes genau einmal ab, wenn dieselbe Datei zweimal kommt', async () => {
    const { deps, blobStore } = setup();
    const report = await importCandidates(
      [{ file: pdfFile('Bank.pdf') }, { file: pdfFile('Bank-Kopie.pdf') }],
      deps,
    );

    expect(report.sources).toHaveLength(2);
    expect(report.sources[0]?.contentHash).toBe(report.sources[1]?.contentHash);
    expect(blobStore.stored.size).toBe(1);
  });

  it('nimmt eine passwortgeschuetzte Datei mit Status auf, statt sie zu verwerfen', async () => {
    const { deps } = setup(async () => ({
      kind: 'pdf',
      blockKind: 'page',
      blockCount: 0,
      blockRotations: [],
      status: 'encrypted',
      statusDetail: 'Diese PDF ist mit einem Passwort geschuetzt.',
    }));

    const report = await importCandidates([{ file: pdfFile('Safe.pdf') }], deps);

    expect(report.sources[0]?.status).toBe('encrypted');
    expect(report.sources[0]?.statusDetail).toMatch(/Passwort/);
    expect(report.rejected).toEqual([]);
  });

  it('speichert die Bytes einer unlesbaren Datei nicht', async () => {
    const { deps, blobStore } = setup(async () => ({
      kind: 'pdf',
      blockKind: 'page',
      blockCount: 0,
      blockRotations: [],
      status: 'error',
      statusDetail: 'Diese PDF konnte nicht gelesen werden.',
    }));

    await importCandidates([{ file: pdfFile('Kaputt.pdf') }], deps);
    expect(blobStore.stored.size).toBe(0);
  });

  it('laesst eine defekte Datei die uebrigen nicht blockieren', async () => {
    const probe = vi
      .fn<() => Promise<SourceProbeResult>>()
      .mockRejectedValueOnce(new Error('Adapter abgestuerzt'))
      .mockResolvedValue(ready);
    const { deps } = setup(probe);

    const report = await importCandidates(
      [{ file: pdfFile('Kaputt.pdf') }, { file: pdfFile('Gut.pdf', [37, 80, 68, 70, 1]) }],
      deps,
    );

    expect(report.sources.map((source) => source.name)).toEqual(['Gut.pdf']);
    expect(report.rejected).toEqual([
      { name: 'Kaputt.pdf', message: 'Diese Datei konnte nicht gelesen werden.' },
    ]);
  });

  it('weist ein unbekanntes Format mit Begruendung ab', async () => {
    const { deps } = setup();
    const report = await importCandidates(
      [{ file: new File([new Uint8Array([1])], 'Notiz.docx', { type: '' }) }],
      deps,
    );

    expect(report.sources).toEqual([]);
    expect(report.rejected).toEqual([
      { name: 'Notiz.docx', message: 'Dieses Dateiformat wird noch nicht unterstuetzt.' },
    ]);
  });

  it('lehnt den ganzen Import ab, wenn das Kontingent nicht reicht', async () => {
    const { deps, blobStore } = setup(undefined, false);
    const report = await importCandidates([{ file: pdfFile('Bank.pdf') }], deps);

    expect(report.sources).toEqual([]);
    expect(report.rejected[0]?.message).toMatch(/fehlen rund 200 MB/);
    expect(blobStore.stored.size).toBe(0);
  });

  it('fragt dauerhafte Ablage genau einmal an', async () => {
    const { deps } = setup();
    await importCandidates([{ file: pdfFile('A.pdf') }, { file: pdfFile('B.pdf', [37, 1]) }], deps);
    expect(deps.storage.requestPersistence).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/import/importSources.test.ts`
Expected: FAIL, `Failed to resolve import "./importSources"`.

- [ ] **Step 3: importSources.ts implementieren**

`src/services/import/importSources.ts`:

```ts
import type { AdapterRegistry } from '../../adapters/types';
import type { SourceDocument, SourceId } from '../../domain/types';
import type { SourceBlobStore } from '../persistence/sourceBlobStore';
import type { StorageGuard } from '../persistence/storage';
import type { ImportCandidate } from './fileSources';

export interface ImportDeps {
  registry: AdapterRegistry;
  blobStore: SourceBlobStore;
  storage: StorageGuard;
  hash(bytes: Uint8Array): Promise<string>;
  newId(): SourceId;
}

export interface ImportRejection {
  name: string;
  message: string;
}

export interface ImportReport {
  sources: SourceDocument[];
  rejected: ImportRejection[];
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Liest die Kandidaten ein und liefert fertige SourceDocuments. Der Workspace
 * wird hier nicht angefasst -- das erledigt der Command `importSources`.
 */
export async function importCandidates(
  candidates: ImportCandidate[],
  deps: ImportDeps,
): Promise<ImportReport> {
  const report: ImportReport = { sources: [], rejected: [] };
  if (candidates.length === 0) return report;

  const totalBytes = candidates.reduce((sum, candidate) => sum + candidate.file.size, 0);
  const room = await deps.storage.ensureRoom(totalBytes);
  if (!room.ok) {
    // Lieber vorher klar ablehnen als spaeter in einen QuotaExceededError laufen.
    return {
      sources: [],
      rejected: candidates.map((candidate) => ({ name: candidate.file.name, message: room.message })),
    };
  }

  // Schuetzt den Workspace vor Verdraengung unter Speicherdruck; einmal pro Import genuegt.
  await deps.storage.requestPersistence();

  for (const candidate of candidates) {
    const { file } = candidate;
    const adapter = deps.registry.adapterFor({ name: file.name, type: file.type, size: file.size });
    if (!adapter) {
      report.rejected.push({
        name: file.name,
        message: 'Dieses Dateiformat wird noch nicht unterstuetzt.',
      });
      continue;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const contentHash = await deps.hash(bytes);
      const probe = await adapter.probe(file);

      // Gleicher Inhalt, ein Blob: der Doppelimport derselben Datei kostet
      // keinen zweiten Speicherplatz. Eine zweite Quelle entsteht trotzdem --
      // Duplikaterkennung ist ausdruecklich Phase 2.
      if (probe.status === 'ready') {
        await deps.blobStore.put(contentHash, file);
      }

      report.sources.push({
        id: deps.newId(),
        kind: adapter.kind,
        name: file.name,
        ...(candidate.importPath ? { importPath: candidate.importPath } : {}),
        blobKey: contentHash,
        byteSize: file.size,
        contentHash,
        blockKind: probe.blockKind,
        blockCount: probe.blockCount,
        blockRotations: probe.blockRotations,
        ...(probe.outline ? { outline: probe.outline } : {}),
        status: probe.status,
        ...(probe.statusDetail ? { statusDetail: probe.statusDetail } : {}),
      });
    } catch (error) {
      console.error(`Import von ${file.name} fehlgeschlagen`, error);
      report.rejected.push({ name: file.name, message: 'Diese Datei konnte nicht gelesen werden.' });
    }
  }

  return report;
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/services/import/importSources.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Import-Dienst baut Quellen aus Dateikandidaten

Der Dienst liefert nur einen Bericht; in den Workspace wandern die Quellen
ueber den Command importSources. Gleicher Inhalt teilt sich einen Blob,
erzeugt aber weiterhin eine eigene Quelle, weil Duplikaterkennung Phase 2 ist.
Verschluesselte und defekte Dateien werden mit Status aufgenommen statt den
Import der uebrigen Dateien zu blockieren.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 11: Render-Warteschlange (`renderQueue.ts`)

**Files:**
- Create: `src/services/thumbnails/renderQueue.ts`
- Test: `src/services/thumbnails/renderQueue.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `type QueueTask<T> = (signal: AbortSignal) => Promise<T>`
  - `createRenderQueue(options?: { concurrency?: number }): RenderQueue` mit `run(key, priority, task)`, `cancel(key)`, `keepOnly(keys)`, `stats`

Aus dem Design: eine Queue, maximal drei parallele Renders, sichtbare Thumbnails zuerst, beim Wegscrollen wird der Auftrag verworfen bzw. abgebrochen. Der Schluessel ist zugleich die Identitaet des Auftrags -- zweimal dieselbe Zelle anfordern rendert nicht zweimal.

Hoehere `priority` bedeutet dringender. Bei gleicher Prioritaet gilt die Reihenfolge der Anmeldung.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/services/thumbnails/renderQueue.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createRenderQueue } from './renderQueue';

/** Eine Aufgabe, die erst auf Zuruf fertig wird. */
function deferred() {
  let resolve: (value: string) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('createRenderQueue', () => {
  it('laesst hoechstens so viele Aufgaben gleichzeitig laufen wie erlaubt', async () => {
    const queue = createRenderQueue({ concurrency: 2 });
    const gates = [deferred(), deferred(), deferred()];
    const started: number[] = [];

    gates.forEach((gate, index) => {
      void queue.run(`k${index}`, 0, async () => {
        started.push(index);
        return gate.promise;
      });
    });
    await tick();

    expect(started).toEqual([0, 1]);
    expect(queue.stats).toEqual({ running: 2, waiting: 1 });

    gates[0]?.resolve('fertig');
    await tick();
    expect(started).toEqual([0, 1, 2]);
  });

  it('nimmt die dringendste wartende Aufgabe zuerst', async () => {
    const queue = createRenderQueue({ concurrency: 1 });
    const first = deferred();
    const started: string[] = [];

    void queue.run('laeuft', 0, async () => {
      started.push('laeuft');
      return first.promise;
    });
    await tick();

    void queue.run('unwichtig', 1, async () => {
      started.push('unwichtig');
      return 'ok';
    });
    void queue.run('sichtbar', 10, async () => {
      started.push('sichtbar');
      return 'ok';
    });

    first.resolve('fertig');
    await tick();
    await tick();

    expect(started).toEqual(['laeuft', 'sichtbar', 'unwichtig']);
  });

  it('fuehrt denselben Schluessel nur einmal aus', async () => {
    const queue = createRenderQueue();
    const task = vi.fn(async () => 'einmal');

    const [a, b] = await Promise.all([queue.run('k', 0, task), queue.run('k', 0, task)]);

    expect(task).toHaveBeenCalledTimes(1);
    expect([a, b]).toEqual(['einmal', 'einmal']);
  });

  it('verwirft eine wartende Aufgabe, ohne sie zu starten', async () => {
    const queue = createRenderQueue({ concurrency: 1 });
    const gate = deferred();
    const waiting = vi.fn(async () => 'nie');

    void queue.run('laeuft', 0, async () => gate.promise);
    await tick();
    const wartend = queue.run('wartend', 0, waiting);
    queue.cancel('wartend');

    await expect(wartend).rejects.toThrow(/abgebrochen/i);
    expect(waiting).not.toHaveBeenCalled();

    gate.resolve('fertig');
    await tick();
    expect(queue.stats).toEqual({ running: 0, waiting: 0 });
  });

  it('signalisiert einer laufenden Aufgabe den Abbruch', async () => {
    const queue = createRenderQueue();
    let seen: AbortSignal | undefined;
    const gate = deferred();

    const running = queue.run('k', 0, async (signal) => {
      seen = signal;
      signal.addEventListener('abort', () => gate.reject(new Error('abgebrochen')));
      return gate.promise;
    });
    await tick();

    queue.cancel('k');

    await expect(running).rejects.toThrow('abgebrochen');
    expect(seen?.aborted).toBe(true);
  });

  it('gibt den Platz auch nach einem Fehler frei', async () => {
    const queue = createRenderQueue({ concurrency: 1 });
    await expect(
      queue.run('kaputt', 0, async () => {
        throw new Error('Render fehlgeschlagen');
      }),
    ).rejects.toThrow('Render fehlgeschlagen');

    await expect(queue.run('gut', 0, async () => 'ok')).resolves.toBe('ok');
    expect(queue.stats.running).toBe(0);
  });

  it('behaelt nur die genannten Schluessel', async () => {
    const queue = createRenderQueue({ concurrency: 1 });
    const gate = deferred();
    void queue.run('sichtbar', 0, async () => gate.promise);
    await tick();
    const weg = queue.run('weggescrollt', 0, async () => 'nie');

    queue.keepOnly(['sichtbar']);

    await expect(weg).rejects.toThrow(/abgebrochen/i);
    expect(queue.stats.running).toBe(1);
    gate.resolve('fertig');
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/thumbnails/renderQueue.test.ts`
Expected: FAIL, `Failed to resolve import "./renderQueue"`.

- [ ] **Step 3: renderQueue.ts implementieren**

`src/services/thumbnails/renderQueue.ts`:

```ts
export type QueueTask<T> = (signal: AbortSignal) => Promise<T>;

export interface RenderQueue {
  /**
   * Meldet eine Aufgabe an. Derselbe Schluessel liefert dieselbe Zusage
   * zurueck, statt ein zweites Mal zu rendern. Hoehere `priority` ist
   * dringender; bei Gleichstand gilt die Reihenfolge der Anmeldung.
   */
  run<T>(key: string, priority: number, task: QueueTask<T>): Promise<T>;
  cancel(key: string): void;
  /** Verwirft alles, was nicht mehr sichtbar ist. */
  keepOnly(keys: Iterable<string>): void;
  readonly stats: { running: number; waiting: number };
}

interface Entry {
  key: string;
  priority: number;
  order: number;
  running: boolean;
  controller: AbortController;
  task: QueueTask<unknown>;
  promise: Promise<unknown>;
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

function abortError(): Error {
  return new Error('Der Renderauftrag wurde abgebrochen.');
}

export function createRenderQueue({ concurrency = 3 }: { concurrency?: number } = {}): RenderQueue {
  const entries = new Map<string, Entry>();
  let running = 0;
  let counter = 0;

  function pick(): Entry | undefined {
    let best: Entry | undefined;
    for (const entry of entries.values()) {
      if (entry.running) continue;
      if (!best || entry.priority > best.priority || (entry.priority === best.priority && entry.order < best.order)) {
        best = entry;
      }
    }
    return best;
  }

  function pump(): void {
    while (running < concurrency) {
      const entry = pick();
      if (!entry) return;
      entry.running = true;
      running += 1;
      void entry
        .task(entry.controller.signal)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          running -= 1;
          entries.delete(entry.key);
          pump();
        });
    }
  }

  function discard(key: string): void {
    const entry = entries.get(key);
    if (!entry) return;
    entry.controller.abort();
    if (entry.running) return; // Der Abschluss der laufenden Aufgabe raeumt selbst auf.
    entries.delete(key);
    entry.reject(abortError());
  }

  return {
    run<T>(key: string, priority: number, task: QueueTask<T>): Promise<T> {
      const existing = entries.get(key);
      if (existing) {
        // Eine wieder sichtbar gewordene Zelle darf ihre Aufgabe vordraengen.
        existing.priority = Math.max(existing.priority, priority);
        return existing.promise as Promise<T>;
      }

      let resolve: (value: unknown) => void = () => {};
      let reject: (error: unknown) => void = () => {};
      const promise = new Promise<unknown>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      entries.set(key, {
        key,
        priority,
        order: counter++,
        running: false,
        controller: new AbortController(),
        task: task as QueueTask<unknown>,
        promise,
        resolve,
        reject,
      });

      pump();
      return promise as Promise<T>;
    },

    cancel: discard,

    keepOnly(keys) {
      const keep = new Set(keys);
      for (const key of [...entries.keys()]) {
        if (!keep.has(key)) discard(key);
      }
    },

    get stats() {
      let waiting = 0;
      for (const entry of entries.values()) if (!entry.running) waiting += 1;
      return { running, waiting };
    },
  };
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/services/thumbnails/renderQueue.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Render-Warteschlange mit Prioritaet, Abbruch und Deduplizierung

Maximal drei parallele Renders, sichtbare Zellen zuerst, weggescrollte
Auftraege werden verworfen oder abgebrochen. Der Schluessel ist zugleich die
Identitaet des Auftrags: dieselbe Zelle zweimal anzufordern rendert nicht
zweimal.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 12: Thumbnail-Cache und Thumbnail-Dienst

**Files:**
- Create: `src/services/persistence/thumbStore.ts`, `src/services/thumbnails/thumbnailCache.ts`, `src/services/thumbnails/thumbnailService.ts`
- Test: `src/services/thumbnails/thumbnailCache.test.ts`, `src/services/thumbnails/thumbnailService.test.ts`

**Interfaces:**
- Consumes: `Database`, `thumbKey` aus `../persistence/db`; `RenderQueue` aus `./renderQueue`; `DocumentAdapter` aus `../../adapters/types`; `BlockRef` aus `../../domain/types`
- Produces:
  - `createThumbStore(db, now?): ThumbStore` mit `get`, `put`, `clear`
  - `createBlobUrlCache(deps): BlobUrlCache` mit `get`, `set`, `delete`, `keepOnly`, `clear`, `size`
  - `THUMBNAIL_WIDTH = 180`
  - `createThumbnailService(deps): ThumbnailService` mit `request`, `peek`, `cancel`, `keepOnly`, `clearMemory`

Der zweistufige Cache aus dem Design: ein Speicher-LRU von rund 300 Blob-URLs ueber dem `thumbs`-Store. Die Freigabe per `URL.revokeObjectURL` bei Verdraengung ist kein Detail, sondern der Unterschied zwischen konstantem und stetig wachsendem Speicherverbrauch -- deshalb bekommt der Cache `createUrl`/`revokeUrl` hereingereicht und ist damit auch ohne Browser testbar.

- [ ] **Step 1: Den fehlschlagenden Test fuer den Cache schreiben**

`src/services/thumbnails/thumbnailCache.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createBlobUrlCache } from './thumbnailCache';

function setup(maxEntries = 2) {
  const revokeUrl = vi.fn();
  let counter = 0;
  const cache = createBlobUrlCache({
    maxEntries,
    createUrl: () => `blob:${++counter}`,
    revokeUrl,
  });
  return { cache, revokeUrl };
}

const blob = () => new Blob([new Uint8Array([1])], { type: 'image/webp' });

describe('createBlobUrlCache', () => {
  it('legt eine URL an und gibt sie wieder zurueck', () => {
    const { cache } = setup();
    const url = cache.set('a', blob());
    expect(cache.get('a')).toBe(url);
  });

  it('kennt einen unbekannten Schluessel nicht', () => {
    expect(setup().cache.get('a')).toBeUndefined();
  });

  it('verdraengt den am laengsten unbenutzten Eintrag und gibt ihn frei', () => {
    const { cache, revokeUrl } = setup(2);
    const first = cache.set('a', blob());
    cache.set('b', blob());
    cache.get('a');
    cache.set('c', blob());

    expect(revokeUrl).toHaveBeenCalledTimes(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(first);
    expect(cache.size).toBe(2);
  });

  it('gibt eine ersetzte URL frei', () => {
    const { cache, revokeUrl } = setup();
    const first = cache.set('a', blob());
    cache.set('a', blob());
    expect(revokeUrl).toHaveBeenCalledWith(first);
  });

  it('gibt beim Loeschen frei', () => {
    const { cache, revokeUrl } = setup();
    const url = cache.set('a', blob());
    cache.delete('a');
    expect(revokeUrl).toHaveBeenCalledWith(url);
    expect(cache.size).toBe(0);
  });

  it('behaelt nur die genannten Schluessel', () => {
    const { cache, revokeUrl } = setup(5);
    cache.set('a', blob());
    cache.set('b', blob());
    cache.keepOnly(['b']);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeDefined();
    expect(revokeUrl).toHaveBeenCalledTimes(1);
  });

  it('gibt beim Leeren alles frei', () => {
    const { cache, revokeUrl } = setup(5);
    cache.set('a', blob());
    cache.set('b', blob());
    cache.clear();
    expect(revokeUrl).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/thumbnails/thumbnailCache.test.ts`
Expected: FAIL, `Failed to resolve import "./thumbnailCache"`.

- [ ] **Step 3: thumbnailCache.ts implementieren**

`src/services/thumbnails/thumbnailCache.ts`:

```ts
export interface BlobUrlCacheDeps {
  /** Rund 300 Eintraege: genug fuer mehrere Bildschirmhoehen Raster. */
  maxEntries?: number;
  createUrl(blob: Blob): string;
  revokeUrl(url: string): void;
}

export interface BlobUrlCache {
  get(key: string): string | undefined;
  set(key: string, blob: Blob): string;
  delete(key: string): void;
  keepOnly(keys: Iterable<string>): void;
  clear(): void;
  readonly size: number;
}

export function createBlobUrlCache({
  maxEntries = 300,
  createUrl,
  revokeUrl,
}: BlobUrlCacheDeps): BlobUrlCache {
  // Map haelt die Einfuegereihenfolge: der erste Eintrag ist der aelteste.
  const urls = new Map<string, string>();

  function drop(key: string): void {
    const url = urls.get(key);
    if (url === undefined) return;
    urls.delete(key);
    // Ohne revoke waechst der Speicherverbrauch mit jedem gescrollten Raster.
    revokeUrl(url);
  }

  return {
    get(key) {
      const url = urls.get(key);
      if (url === undefined) return undefined;
      // Erneut einfuegen heisst: als zuletzt benutzt markieren.
      urls.delete(key);
      urls.set(key, url);
      return url;
    },

    set(key, blob) {
      drop(key);
      const url = createUrl(blob);
      urls.set(key, url);
      while (urls.size > maxEntries) {
        const oldest = urls.keys().next();
        if (oldest.done) break;
        drop(oldest.value);
      }
      return url;
    },

    delete: drop,

    keepOnly(keys) {
      const keep = new Set(keys);
      for (const key of [...urls.keys()]) if (!keep.has(key)) drop(key);
    },

    clear() {
      for (const key of [...urls.keys()]) drop(key);
    },

    get size() {
      return urls.size;
    },
  };
}
```

- [ ] **Step 4: Den fehlschlagenden Test fuer den Dienst schreiben**

`src/services/thumbnails/thumbnailService.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createBlobUrlCache } from './thumbnailCache';
import { createRenderQueue } from './renderQueue';
import { createThumbnailService, THUMBNAIL_WIDTH } from './thumbnailService';
import type { ThumbStore } from '../persistence/thumbStore';
import type { DocumentAdapter, RenderOpts, RenderedBitmap } from '../../adapters/types';
import type { BlockRef } from '../../domain/types';

function fakeStore(): ThumbStore & { entries: Map<string, Blob> } {
  const entries = new Map<string, Blob>();
  return {
    entries,
    get: async (key) => entries.get(key),
    put: async (key, blob) => {
      entries.set(key, blob);
    },
    clear: async () => entries.clear(),
  };
}

function setup(store = fakeStore()) {
  const rendered = new Blob([new Uint8Array([1, 2])], { type: 'image/webp' });
  // Wie der echte Adapter: der Render laeuft ueber mindestens einen Tick und
  // bricht ab, wenn das Signal ausgeloest wurde.
  const renderBlock = vi.fn(async (_ref: BlockRef, opts: RenderOpts): Promise<RenderedBitmap> => {
    await Promise.resolve();
    opts.signal?.throwIfAborted();
    return { blob: rendered, width: 180, height: 240 };
  });
  const adapter = {
    kind: 'pdf',
    accepts: () => true,
    probe: () => Promise.reject(new Error('im Test nicht benutzt')),
    renderBlock,
  } satisfies DocumentAdapter;

  let counter = 0;
  const revokeUrl = vi.fn();
  const service = createThumbnailService({
    adapter,
    store,
    queue: createRenderQueue({ concurrency: 2 }),
    cache: createBlobUrlCache({ createUrl: () => `blob:${++counter}`, revokeUrl }),
  });
  return { service, renderBlock, store, revokeUrl };
}

const ref = { sourceId: 'src-a', blockIndex: 16 };

describe('createThumbnailService', () => {
  it('rendert, legt im Cache ab und liefert eine URL', async () => {
    const { service, renderBlock, store } = setup();
    const url = await service.request({ ref });

    expect(url).toMatch(/^blob:/);
    expect(renderBlock).toHaveBeenCalledWith(ref, expect.objectContaining({ targetWidth: THUMBNAIL_WIDTH }));
    expect(store.entries.has('src-a:16:180')).toBe(true);
  });

  it('rendert nicht erneut, wenn die URL noch im Speicher liegt', async () => {
    const { service, renderBlock } = setup();
    const first = await service.request({ ref });
    const second = await service.request({ ref });

    expect(second).toBe(first);
    expect(renderBlock).toHaveBeenCalledTimes(1);
  });

  it('nimmt ein Thumbnail aus der Datenbank, statt neu zu rendern', async () => {
    const store = fakeStore();
    store.entries.set('src-a:16:180', new Blob([new Uint8Array([9])], { type: 'image/webp' }));
    const { service, renderBlock } = setup(store);

    await expect(service.request({ ref })).resolves.toMatch(/^blob:/);
    expect(renderBlock).not.toHaveBeenCalled();
  });

  it('beantwortet peek erst nach dem Rendern', async () => {
    const { service } = setup();
    expect(service.peek(ref)).toBeUndefined();
    const url = await service.request({ ref });
    expect(service.peek(ref)).toBe(url);
  });

  it('unterscheidet Breiten im Schluessel', async () => {
    const { service, store } = setup();
    await service.request({ ref, width: 360 });
    expect(store.entries.has('src-a:16:360')).toBe(true);
  });

  it('bricht einen laufenden Auftrag ab', async () => {
    const { service } = setup();
    const pending = service.request({ ref });
    service.cancel(ref);
    await expect(pending).rejects.toThrow();
  });

  it('gibt beim Leeren des Speichers alle URLs frei', async () => {
    const { service, revokeUrl } = setup();
    await service.request({ ref });
    service.clearMemory();
    expect(revokeUrl).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 5: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/thumbnails/thumbnailService.test.ts`
Expected: FAIL, `Failed to resolve import "./thumbnailService"`.

- [ ] **Step 6: thumbStore.ts und thumbnailService.ts implementieren**

`src/services/persistence/thumbStore.ts`:

```ts
import type { Database } from './db';

export interface ThumbStore {
  get(key: string): Promise<Blob | undefined>;
  put(key: string, blob: Blob, width: number): Promise<void>;
  /** Der Cache ist verwerfbar: bei Speicherdruck wird er als erstes geleert. */
  clear(): Promise<void>;
}

export function createThumbStore(db: Database, now: () => number = () => Date.now()): ThumbStore {
  return {
    async get(key) {
      return (await db.get('thumbs', key))?.blob;
    },
    async put(key, blob, width) {
      await db.put('thumbs', { key, blob, width, createdAt: now() });
    },
    async clear() {
      await db.clear('thumbs');
    },
  };
}
```

`src/services/thumbnails/thumbnailService.ts`:

```ts
import type { DocumentAdapter } from '../../adapters/types';
import type { BlockRef } from '../../domain/types';
import { thumbKey } from '../persistence/db';
import type { ThumbStore } from '../persistence/thumbStore';
import type { BlobUrlCache } from './thumbnailCache';
import type { RenderQueue } from './renderQueue';

/** Feste Zielbreite aus dem Design; Thumbnails werden nie in Originalgroesse gerendert. */
export const THUMBNAIL_WIDTH = 180;

export interface ThumbnailRequest {
  ref: BlockRef;
  width?: number;
  dpr?: number;
  /** Hoeher ist dringender; sichtbare Zellen bekommen den hoeheren Wert. */
  priority?: number;
}

export interface ThumbnailService {
  request(request: ThumbnailRequest): Promise<string>;
  /** Synchroner Blick in den Speicher-Cache, fuer das erste Rendern einer Zelle. */
  peek(ref: BlockRef, width?: number): string | undefined;
  cancel(ref: BlockRef, width?: number): void;
  keepOnly(refs: Iterable<BlockRef>, width?: number): void;
  clearMemory(): void;
}

export interface ThumbnailServiceDeps {
  adapter: DocumentAdapter;
  store: ThumbStore;
  queue: RenderQueue;
  cache: BlobUrlCache;
  dpr?: number;
}

export function createThumbnailService({
  adapter,
  store,
  queue,
  cache,
  dpr = 1,
}: ThumbnailServiceDeps): ThumbnailService {
  const keyOf = (ref: BlockRef, width: number) => thumbKey(ref.sourceId, ref.blockIndex, width);

  return {
    async request({ ref, width = THUMBNAIL_WIDTH, dpr: requestDpr = dpr, priority = 0 }) {
      const key = keyOf(ref, width);
      const known = cache.get(key);
      if (known) return known;

      return queue.run(key, priority, async (signal) => {
        // Zweite Stufe: ein frueher gerendertes Thumbnail liegt noch in der
        // Datenbank und muss nicht erneut aus dem PDF erzeugt werden.
        const stored = await store.get(key);
        if (stored) return cache.set(key, stored);

        const bitmap = await adapter.renderBlock(ref, { targetWidth: width, dpr: requestDpr, signal });
        await store.put(key, bitmap.blob, width);
        return cache.set(key, bitmap.blob);
      });
    },

    peek(ref, width = THUMBNAIL_WIDTH) {
      return cache.get(keyOf(ref, width));
    },

    cancel(ref, width = THUMBNAIL_WIDTH) {
      queue.cancel(keyOf(ref, width));
    },

    keepOnly(refs, width = THUMBNAIL_WIDTH) {
      queue.keepOnly([...refs].map((ref) => keyOf(ref, width)));
    },

    clearMemory() {
      cache.clear();
    },
  };
}
```

- [ ] **Step 7: Tests pruefen**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: alle Tests PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: zweistufiger Thumbnail-Cache und Thumbnail-Dienst

Speicher-LRU von Blob-URLs ueber dem thumbs-Store: erst der Speicher, dann
die Datenbank, erst dann ein Render. Die Freigabe per revokeObjectURL bei
Verdraengung ist der Unterschied zwischen konstantem und stetig wachsendem
Speicherverbrauch, deshalb bekommt der Cache createUrl und revokeUrl
hereingereicht und ist ohne Browser testbar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 13: Zusammenbau, provisorische Oberflaeche und Integrationstest

**Files:**
- Create: `src/services/app/appServices.ts`, `src/ui/dev/ImportProbe.tsx`
- Create: `scripts/make-fixture-pdfs.mjs`, `playwright.config.ts`, `tests/e2e/import.spec.ts`
- Modify: `src/ui/app/App.tsx`, `package.json`, `.gitignore`

**Interfaces:**
- Consumes: alles aus den Tasks 1-12
- Produces:
  - `createAppServices(deps: AppServicesDeps): Promise<AppServices>` -- der Zusammenbau, den Plan 3 uebernimmt
  - `ImportProbe` -- provisorische Oberflaeche, die Plan 3 durch die echte Arbeitsflaeche ersetzt
  - npm-Skripte `fixtures` und `test:e2e`

Dies ist der Task, der aus Bausteinen eine App macht. Der Zusammenbau liegt bewusst in `services/app/appServices.ts` und nicht in einer Komponente: Plan 3 baut die Arbeitsflaeche darauf, ohne die Verdrahtung neu zu erfinden.

Der Pool braucht zu einer `sourceId` den `contentHash` -- diese Zuordnung steht im Workspace, den die Adapter-Schicht nicht kennen darf. Deshalb bekommt `createAppServices` eine Funktion `contentHashOf` hereingereicht, die der Aufrufer aus seinem jeweils aktuellen Zustand beantwortet.

- [ ] **Step 1: Testwerkzeug installieren**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: appServices.ts schreiben**

`src/services/app/appServices.ts`:

```ts
import { createPdfAdapter } from '../../adapters/pdf/pdfAdapter';
import { createPdfAssembler } from '../../adapters/pdf/pdfAssembler';
import { createDocumentPool } from '../../adapters/pdf/pdfPool';
import type { PdfDocumentHandle } from '../../adapters/pdf/pdfEngine';
import { createOffscreenSurface, createPdfjsEngine } from '../../adapters/pdf/pdfjsEngine';
import { createRegistry } from '../../adapters/registry';
import type { AdapterRegistry, BlockAssembler, DocumentAdapter } from '../../adapters/types';
import type { SourceId } from '../../domain/types';
import { createAutosave, type Autosave } from '../persistence/autosave';
import { openWorkspaceDb, type Database } from '../persistence/db';
import { createSourceBlobStore, type SourceBlobStore } from '../persistence/sourceBlobStore';
import { createStorageGuard, type StorageGuard } from '../persistence/storage';
import { createThumbStore } from '../persistence/thumbStore';
import { createWorkspaceRepo, type WorkspaceRepo } from '../persistence/workspaceRepo';
import { createBlobUrlCache } from '../thumbnails/thumbnailCache';
import { createRenderQueue } from '../thumbnails/renderQueue';
import { createThumbnailService, type ThumbnailService } from '../thumbnails/thumbnailService';

export interface AppServicesDeps {
  /**
   * Beantwortet, welcher Inhalt zu einer Quelle gehoert. Der Aufrufer liest
   * das aus seinem aktuellen Workspace -- die Adapter-Schicht darf ihn nicht kennen.
   */
  contentHashOf(sourceId: SourceId): string | undefined;
  dbName?: string;
}

export interface AppServices {
  db: Database;
  registry: AdapterRegistry;
  adapter: DocumentAdapter;
  assembler: BlockAssembler;
  blobStore: SourceBlobStore;
  repo: WorkspaceRepo;
  storage: StorageGuard;
  autosave: Autosave;
  thumbnails: ThumbnailService;
  readBytesForSource(sourceId: SourceId): Promise<Uint8Array>;
  dispose(): Promise<void>;
}

export async function createAppServices({
  contentHashOf,
  dbName,
}: AppServicesDeps): Promise<AppServices> {
  const db = await openWorkspaceDb(dbName);
  const blobStore = createSourceBlobStore(db);
  const repo = createWorkspaceRepo(db);
  const storage = createStorageGuard(globalThis.navigator?.storage);

  function hashOrThrow(sourceId: SourceId): string {
    const hash = contentHashOf(sourceId);
    if (!hash) throw new Error(`Zur Quelle ${sourceId} ist kein gespeicherter Inhalt bekannt.`);
    return hash;
  }

  const readBytesForSource = (sourceId: SourceId) => blobStore.readBytes(hashOrThrow(sourceId));

  const engine = createPdfjsEngine();
  const pool = createDocumentPool<PdfDocumentHandle>({
    load: async (sourceId) => engine.open(await readBytesForSource(sourceId)),
    destroy: (document) => document.destroy(),
    maxOpen: 4,
  });

  const adapter = createPdfAdapter({ engine, pool, createSurface: createOffscreenSurface });
  const assembler = createPdfAssembler();
  const registry = createRegistry();
  registry.register(adapter);
  registry.registerAssembler(assembler);

  const thumbnails = createThumbnailService({
    adapter,
    store: createThumbStore(db),
    queue: createRenderQueue({ concurrency: 3 }),
    cache: createBlobUrlCache({
      createUrl: (blob) => URL.createObjectURL(blob),
      revokeUrl: (url) => URL.revokeObjectURL(url),
    }),
    dpr: Math.min(globalThis.devicePixelRatio || 1, 2),
  });

  const autosave = createAutosave({ save: (ws) => repo.save(ws) });

  return {
    db,
    registry,
    adapter,
    assembler,
    blobStore,
    repo,
    storage,
    autosave,
    thumbnails,
    readBytesForSource,
    async dispose() {
      autosave.dispose();
      thumbnails.clearMemory();
      await pool.clear();
      db.close();
    },
  };
}
```

- [ ] **Step 3: Provisorische Oberflaeche schreiben**

`src/ui/dev/ImportProbe.tsx`:

```tsx
import { produce } from 'immer';
import { useCallback, useEffect, useRef, useState } from 'react';
import { applyCommand } from '../../domain/commands';
import { newId } from '../../domain/ids';
import { createEmptyWorkspace } from '../../domain/types';
import type { CompositionItem, Workspace } from '../../domain/types';
import { createAppServices, type AppServices } from '../../services/app/appServices';
import { describeSaveStatus, type SaveStatus } from '../../services/persistence/autosave';
import { collectFromFileList } from '../../services/import/fileSources';
import { importCandidates, sha256Hex } from '../../services/import/importSources';
import type { ThumbnailService } from '../../services/thumbnails/thumbnailService';

/**
 * Provisorische Oberflaeche fuer Plan 2. Sie zeigt, dass Import, Persistenz,
 * Thumbnails und Assembler zusammenspielen, und wird in Plan 3 durch die
 * eigentliche Arbeitsflaeche ersetzt.
 */
export function ImportProbe() {
  const [workspace, setWorkspace] = useState<Workspace>(() =>
    createEmptyWorkspace({ id: 'ws-dev', name: 'Entwurf' }),
  );
  const workspaceRef = useRef(workspace);
  const [services, setServices] = useState<AppServices>();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [rejected, setRejected] = useState<string[]>([]);
  const [assembled, setAssembled] = useState('');

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    let disposed = false;
    let created: AppServices | undefined;

    void (async () => {
      const app = await createAppServices({
        contentHashOf: (sourceId) => workspaceRef.current.sources[sourceId]?.contentHash,
      });
      if (disposed) {
        await app.dispose();
        return;
      }
      created = app;
      app.autosave.subscribe(setStatus);
      const stored = await app.repo.loadMostRecent();
      if (stored) {
        workspaceRef.current = stored;
        setWorkspace(stored);
      }
      setServices(app);
    })();

    return () => {
      disposed = true;
      void created?.dispose();
    };
  }, []);

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!services || !files || files.length === 0) return;
      const report = await importCandidates(collectFromFileList(files), {
        registry: services.registry,
        blobStore: services.blobStore,
        storage: services.storage,
        hash: sha256Hex,
        newId,
      });
      setRejected(report.rejected.map((entry) => `${entry.name}: ${entry.message}`));
      if (report.sources.length === 0) return;

      const next = produce(workspaceRef.current, (draft) => {
        applyCommand(draft, { type: 'importSources', sources: report.sources }, { now: Date.now() });
      });
      workspaceRef.current = next;
      setWorkspace(next);
      services.autosave.schedule(next);
    },
    [services],
  );

  const onAssemble = useCallback(async () => {
    if (!services) return;
    const first = workspaceRef.current.sourceOrder[0];
    const source = first ? workspaceRef.current.sources[first] : undefined;
    if (!source || source.status !== 'ready') return;

    const items: CompositionItem[] = Array.from(
      { length: Math.min(source.blockCount, 3) },
      (_, index) => ({ id: `probe-${index}`, sourceId: source.id, blockIndex: index, rotation: 0 }),
    );
    const bytes = await services.assembler.assemble(items, {
      readBytes: services.readBytesForSource,
    });
    setAssembled(`${bytes.byteLength} Bytes aus ${items.length} Seiten`);
  }, [services]);

  const sources = workspace.sourceOrder
    .map((id) => workspace.sources[id])
    .filter((source) => source !== undefined);

  return (
    <div className="space-y-6 p-4 text-sm text-slate-200">
      <div className="flex items-center gap-4">
        <input
          data-testid="import-input"
          type="file"
          multiple
          accept={services?.registry.acceptAttribute()}
          onChange={(event) => void onFiles(event.target.files)}
          className="text-slate-300"
        />
        <span data-testid="save-status" className="text-slate-400">
          {describeSaveStatus(status)}
        </span>
      </div>

      {rejected.length > 0 && (
        <ul data-testid="rejected" className="space-y-1 text-amber-400">
          {rejected.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      )}

      <div className="space-y-6">
        {sources.map((source) => (
          <section key={source.id} data-testid="source-row" className="space-y-2">
            <header className="flex gap-3 text-slate-300">
              <strong>{source.name}</strong>
              <span>{source.blockCount} Seiten</span>
              {source.status !== 'ready' && (
                <span className="text-amber-400">{source.statusDetail}</span>
              )}
            </header>
            {source.status === 'ready' && services && (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: Math.min(source.blockCount, 12) }, (_, index) => (
                  <Thumb
                    key={index}
                    service={services.thumbnails}
                    sourceId={source.id}
                    blockIndex={index}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          data-testid="assemble"
          type="button"
          onClick={() => void onAssemble()}
          className="rounded border border-line px-3 py-1 text-slate-200"
        >
          Testexport der ersten Seiten
        </button>
        <span data-testid="assemble-result" className="text-slate-400">
          {assembled}
        </span>
      </div>
    </div>
  );
}

function Thumb({
  service,
  sourceId,
  blockIndex,
}: {
  service: ThumbnailService;
  sourceId: string;
  blockIndex: number;
}) {
  const [url, setUrl] = useState<string | undefined>(() =>
    service.peek({ sourceId, blockIndex }),
  );

  useEffect(() => {
    let active = true;
    service
      .request({ ref: { sourceId, blockIndex }, priority: 1 })
      .then((next) => {
        if (active) setUrl(next);
      })
      .catch((error: unknown) => {
        console.warn(`Thumbnail fuer Seite ${blockIndex + 1} nicht verfuegbar`, error);
      });
    return () => {
      active = false;
    };
  }, [service, sourceId, blockIndex]);

  if (!url) return <div className="h-32 w-24 rounded bg-panel" aria-hidden />;
  return (
    <img
      data-testid="thumb"
      src={url}
      alt={`Seite ${blockIndex + 1}`}
      className="h-32 w-auto rounded border border-line bg-white"
    />
  );
}
```

`src/ui/app/App.tsx` rendert jetzt die Probe:

```tsx
import { ImportProbe } from '../dev/ImportProbe';

export function App() {
  return (
    <div className="min-h-screen bg-shell text-slate-200">
      <header className="border-b border-line px-4 py-3 text-sm font-medium">
        PDF-Master -- Importprobe (Plan 2)
      </header>
      <ImportProbe />
    </div>
  );
}
```

- [ ] **Step 4: Fixture-Skript und Playwright einrichten**

`scripts/make-fixture-pdfs.mjs`:

```js
// Erzeugt die PDFs fuer den Integrationstest. Sie sind abgeleitet und
// gehoeren nicht ins Repository.
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const target = new URL('../tests/fixtures/', import.meta.url);
await mkdir(target, { recursive: true });

for (const [name, pageCount] of [
  ['Contract.pdf', 5],
  ['Bank.pdf', 3],
]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index++) {
    const page = doc.addPage([300, 400]);
    page.drawText(`${name} Seite ${index + 1}`, {
      x: 24,
      y: 340,
      size: 18,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }
  await writeFile(new URL(name, target), await doc.save());
  console.log(`${name} mit ${pageCount} Seiten erzeugt`);
}
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

// Getestet wird der gebaute Stand, nicht der Dev-Server: nur so laeuft auch
// die Kopie der pdf.js-Assets (prebuild) mit durch.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

In `package.json` ergaenzen:

```json
{
  "fixtures": "node scripts/make-fixture-pdfs.mjs",
  "pretest:e2e": "npm run fixtures",
  "test:e2e": "playwright test"
}
```

`.gitignore` um `tests/fixtures/`, `test-results/` und `playwright-report/` ergaenzen.

- [ ] **Step 5: Den Integrationstest schreiben**

`tests/e2e/import.spec.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

test('importiert PDFs, rendert Thumbnails und ueberlebt einen Neustart', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));

  await page.goto('/');
  await page
    .getByTestId('import-input')
    .setInputFiles([fixture('Contract.pdf'), fixture('Bank.pdf')]);

  const rows = page.getByTestId('source-row');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Contract.pdf');
  await expect(rows.first()).toContainText('5 Seiten');

  // Ein wirklich gerendertes Bild hat eine Breite; ein kaputtes nicht.
  const thumb = page.getByTestId('thumb').first();
  await expect(thumb).toBeVisible();
  await expect
    .poll(async () => thumb.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);

  await expect(page.getByTestId('save-status')).toHaveText('Lokal gespeichert');

  // Neustart: der Workspace kommt aus IndexedDB zurueck, ohne Nachfrage.
  await page.reload();
  await expect(page.getByTestId('source-row')).toHaveCount(2);
  await expect(page.getByTestId('thumb').first()).toBeVisible();

  await page.getByTestId('assemble').click();
  await expect(page.getByTestId('assemble-result')).toContainText('Bytes aus 3 Seiten');

  expect(problems).toEqual([]);
});

test('nimmt eine unbrauchbare Datei an, ohne den Import zu kippen', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles([
    { name: 'Kaputt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('kein PDF') },
    { name: 'Bank.pdf', mimeType: 'application/pdf', buffer: await readFixture('Bank.pdf') },
  ]);

  await expect(page.getByTestId('source-row')).toHaveCount(2);
  await expect(page.getByTestId('source-row').first()).toContainText('konnte nicht gelesen werden');
  await expect(page.getByTestId('source-row').last()).toContainText('3 Seiten');
});

async function readFixture(name: string): Promise<Buffer> {
  const { readFile } = await import('node:fs/promises');
  return readFile(fixture(name));
}
```

- [ ] **Step 6: Alles laufen lassen**

Run: `npm run test && npm run typecheck && npm run lint && npm run test:e2e`
Expected: Unit-Tests PASS, beide Playwright-Tests PASS. Schlaegt der Thumbnail-Teil fehl, zuerst die Konsolenausgabe des Browsers pruefen -- die haeufigste Ursache ist ein Worker- oder Asset-Pfad, der nicht zu Task 1 Step 2 passt.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Zusammenbau der Dienste, Importprobe und Integrationstest

createAppServices verdrahtet Datenbank, Blob-Store, Repository, Autosave,
Adapter, Assembler und Thumbnails an einer Stelle; Plan 3 baut die
Arbeitsflaeche darauf. Der Playwright-Test prueft in Chromium, was in Node
nicht pruefbar ist: echtes pdf.js, echtes OffscreenCanvas, echtes IndexedDB
ueber einen Neustart hinweg.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

## Selbstpruefung gegen die Spezifikation

| Abschnitt der Spezifikation | In diesem Plan |
| --- | --- |
| 2 pdfjs-dist, pdf-lib, idb, Playwright | Task 1, 2, 5, 13 |
| 3 Modulschnitt `adapters/`, `services/persistence`, `services/import`, `services/thumbnails` | Task 1-13 |
| 4 `DocumentAdapter`, `BlockAssembler`, Registry statt `if (isPdf)` | Task 1 |
| 5 `SourceDocument` vollstaendig gefuellt (contentHash, blockRotations, outline, status) | Task 10 |
| 7 Vier Object Stores, Blob-Kopie in IndexedDB, `SourceBlobStore`-Naht | Task 5 |
| 7 Autosave 400 ms, Flush, Header-Status | Task 7 (Ereignis anhaengen: Plan 3) |
| 7 `navigator.storage.persist()`, `estimate()`, Ablehnung statt QuotaExceededError | Task 8, 10 |
| 7 `schemaVersion` und Migrationsnaht | Task 6 |
| 8 Dokument-Pool mit maximal vier offenen Dokumenten | Task 3 |
| 8 Render-Queue, Prioritaet, Abbruch, maximal drei parallel | Task 11 |
| 8 Zweistufiger Thumbnail-Cache, 180 px, DPR gedeckelt, revokeObjectURL | Task 4, 12 |
| 8 Assembler laedt je Quelle einmal, gebuendeltes copyPages | Task 2 |
| 10 Textextraktion (Adapter-Seite) | Task 4 (`extractText`); Worker, Cache und Suche in Plan 4 |
| 11 Import per Drop, Dateidialog, Ordnerwahl, `importPath` | Task 9, 10 |
| 14 `isEvalSupported: false`, keine externen Requests, verstaendliche Fehlertexte | Task 1, 4, 10 |
| 15 Adapter-Tests gegen im Test erzeugte PDFs | Task 2 (Assembler), Task 13 (echtes pdf.js in Chromium) |

Bewusst nicht in Plan 2: Store und History (Plan 3), Virtualisierung und Drag (Plan 3), Viewer, Suche, Textworker und die beiden Export-Writer (Plan 4). Die provisorische `ImportProbe` ist ausdruecklich Wegwerfcode; Plan 3 ersetzt sie durch die Arbeitsflaeche und entfernt `src/ui/dev/`.

## Anschluss

- **Plan 3 -- Workspace-UI und Interaktion:** Zustand-Store mit `produceWithPatches` ueber `applyCommand`, History mit Selektionswiederherstellung, virtualisierte Raster auf `thumbnails.request`, Baum, Range-Feld, Split-Panel, die beiden getrennten Drag-Systeme, Tastaturkuerzel, `visibilitychange` auf `autosave.flush()`.
- **Plan 4 -- Preview, Suche, Export:** Viewer auf `adapter.renderBlock`, Textworker und `pageText`-Cache auf `adapter.extractText`, Suche, `fsAccessWriter` und `zipWriter` auf `buildExportPlan` und `assembler.assemble`, Playwright-Test des Akzeptanzszenarios.
