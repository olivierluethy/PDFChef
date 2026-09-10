# Phase 1 / Plan 4: Preview, Suche und Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der letzte Baustein von Phase 1: ein Viewer, der Quellseiten und die `items`-Liste eines Outputs in derselben Komponente rendert (Zoom, Einpassen, Rotation, Herkunftssprung); die Textsuche mit Bereichsumschalter ueber einen eigenen Worker mit Cache; und der Export der Ordnerstruktur -- direkt in ein Verzeichnis (wo die API vorhanden ist) und als ZIP -- beide ausschliesslich aus dem `ExportPlan`. Am Ende spielt ein Playwright-Test das Akzeptanzszenario aus Abschnitt 12 von Import bis ZIP-Export durch.

**Architecture:** Der Ergebnis-Preview rendert kein assembliertes PDF, sondern die referenzierten Quellseiten in der Reihenfolge der `items`-Liste -- dieselbe Viewer-Komponente zeigt auch Quelldokumente, der Unterschied ist nur die uebergebene Liste von `BlockRef`. Die Textextraktion laeuft in einem separaten Worker, damit die Oberflaeche bei einem 500-Seiten-Dokument nicht einfriert; die reine Trefferlogik ist davon getrennt und in Node getestet. Beide Export-Writer konsumieren ausschliesslich den `ExportPlan` aus Plan 1 und den Assembler aus Plan 2 ueber einen gemeinsamen `Writer`-Vertrag, sodass sich Verzeichnis- und ZIP-Weg nur noch im Schreibziel unterscheiden.

**Tech Stack:** `pdfjs-dist` (Rendern und Text, ueber die Fassade aus Plan 2), `fflate` (ZIP), File System Access API (`showDirectoryPicker`/`showSaveFilePicker`), Web Worker, React 19 + TypeScript strict, Vitest + jsdom, `@playwright/test` (Chromium).

**Spec:** `docs/superpowers/specs/2026-09-10-document-workspace-design.md`

**Vorherige Plaene:** Plan 1, 2 und 3 (alle vollstaendig umgesetzt und gruen)

## Global Constraints

- Local-first: kein Netzwerkverkehr mit Dokumentinhalten, kein Analytics, keine externen Laufzeit-Requests. Der Text-Worker und die von ihm genutzten pdf.js-Assets kommen aus dem eigenen Bundle.
- Schichtregel (per ESLint erzwungen): `domain` nur `domain`; `adapters` nur `domain`; `services` nur `domain` und `adapters`; `ui` darf alles. **Kein Modul unter `services` oder `adapters` importiert React.**
- Abhaengigkeiten werden hereingegeben, nicht importiert: Writer, Runner und Suchdienst werden von `create...`-Funktionen mit einem Abhaengigkeitsobjekt gebaut. Zeit und Ids kommen von aussen.
- Kein OCR: gescannte PDFs ohne Textschicht liefern keine Treffer, und die App sagt das (`Dieses Dokument enthaelt keinen durchsuchbaren Text.`), statt still nichts zu finden.
- Fehlende Browser-APIs fuehren nie zu einem Bruch, sondern zu einem Fallback: fehlt `showDirectoryPicker`, ist der ZIP-Weg primaer und ein einzeiliger Hinweis erklaert den Grund. Kein Feature verschwindet stillschweigend.
- Exporte entstehen ausschliesslich aus der Komposition, nie aus einer Zwischendatei. Der Assembler laedt jede Quelle beim Export **einmal** (Plan 2).
- TypeScript `strict`, `verbatimModuleSyntax` (Typimporte als `import type`).
- Alle nutzersichtbaren Texte sind deutsch, verwenden **nie das scharfe s** (immer `ss`) und erklaeren die Lage in ganzen Saetzen. Stacktraces gehen in die Konsole.
- Jeder Task endet mit gruenen Tests (`npm run test`), gruenem `typecheck`, gruenem `lint` und einem Commit. Commit-Messages beginnen mit `feat:`, `test:`, `chore:` oder `docs:` und enden mit der Attributionszeile aus der Repo-Konvention.

## Was dieser Plan aus den Plaenen 1-3 benutzt

Aus `domain` (Plan 1): `buildExportPlan`, `type ExportPlan`, `type ExportEntry`, `type ExportScope`, `type SkippedOutput` (`domain/exportPlan`); `type BlockRef`, `type CompositionItem`, `type NodeId`, `type SourceId`, `type Rotation`, `isOutput` (`domain/types`).

Aus `services`/`adapters` (Plan 2): `type AppServices` mit `adapter` (`renderBlock`, `extractText`), `assembler` (`BlockAssembler`), `readBytesForSource(sourceId)`, `db` (`services/app/appServices`); `type PageText`, `type TextSpan` (`adapters/types`); der `Database`-Typ und die pdf.js-Fassade (`adapters/pdf/pdfjsEngine`).

Aus `ui`/Stores (Plan 3): `useServices`, `useWorkspace`, `useSelection`, `useSelectionStore` (`ui/app/StoreProvider`); `useKeyboardShortcuts` (die `onSearch`/`onPreview`-Naht); der Preview-Bereich und der Export-Knopf in `App.tsx`/`Header.tsx` sind beschriftete Platzhalter, die dieser Plan ersetzt.

## Dateistruktur dieses Plans

| Datei                                                  | Verantwortung                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `src/ui/common/useObjectUrl.ts`                        | Blob-URL-Lebenszyklus (Erzeugen und Freigeben) einer einzelnen URL  |
| `src/ui/preview/usePageImage.ts`                       | rendert eine `BlockRef` in voller Ansichtsgroesse ueber den Adapter |
| `src/ui/preview/Viewer.tsx`                            | Viewer fuer Quelle und Ergebnis (dieselbe Komponente)               |
| `src/workers/pdfText.worker.ts`                        | Textextraktion in einem eigenen Worker                              |
| `src/services/search/textMatch.ts`                     | reine Trefferlogik (Query -> Treffer mit Ausschnitt und Spans)      |
| `src/services/search/pageTextStore.ts`                 | Cache der Seitentexte im `pageText`-Store                           |
| `src/services/search/searchService.ts`                 | verbindet Worker, Cache und Trefferlogik; lazy je Dokument          |
| `src/ui/preview/SearchPanel.tsx`                       | Suchoberflaeche mit Bereichsumschalter und Trefferliste             |
| `src/services/export/writer.ts`                        | `Writer`-Vertrag, den beide Export-Wege erfuellen                   |
| `src/services/export/fsAccessWriter.ts`                | Verzeichnis-Writer ueber die File System Access API                 |
| `src/services/export/zipWriter.ts`                     | ZIP-Writer ueber `fflate`                                           |
| `src/services/export/exportRunner.ts`                  | Assembler je Eintrag, Fortschritt, Abbruch                          |
| `src/ui/export/ExportDialog.tsx`                       | Plan-Vorschau, Zielwahl, Fortschritt, Abbruch                       |
| `src/ui/app/App.tsx` (Modify)                          | Viewer, Suche und Export statt der Platzhalter                      |
| `playwright.config.ts`, `tests/e2e/acceptance.spec.ts` | der Akzeptanz-Flow bis zum ZIP                                      |

---

### Task 1: Blob-URL-Lebenszyklus und Seiten-Render-Hook

**Files:**

- Create: `src/ui/common/useObjectUrl.ts`, `src/ui/preview/usePageImage.ts`
- Test: `src/ui/common/useObjectUrl.test.tsx`, `src/ui/preview/usePageImage.test.tsx`

**Interfaces:**

- Consumes: `useServices` aus `../app/StoreProvider`; `type BlockRef` aus `../../domain/types`
- Produces:
  - `useObjectUrl(blob: Blob | undefined): string | undefined`
  - `usePageImage(ref: BlockRef, targetWidth: number): { url: string | undefined; status: 'idle' | 'loading' | 'ready' | 'error' }`

Der Viewer rendert die Quellseite in voller Ansichtsgroesse -- anders als das Thumbnail-Raster, das auf 180 px deckelt. `usePageImage` ruft dafuer `adapter.renderBlock` mit der Zielbreite des Viewers und einer bei 2 gedeckelten Geraeteaufloesung; `useObjectUrl` gibt die vorige URL frei, sobald ein neuer Blob kommt oder die Komponente verschwindet -- ohne diese Freigabe waechst der Speicher bei jedem Seitenwechsel.

- [ ] **Step 1: Den fehlschlagenden Test fuer useObjectUrl schreiben**

`src/ui/common/useObjectUrl.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useObjectUrl } from './useObjectUrl';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useObjectUrl', () => {
  it('erzeugt eine URL fuer einen Blob und gibt sie bei Wechsel frei', () => {
    const create = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:a')
      .mockReturnValueOnce('blob:b');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    const first = new Blob(['a']);
    const second = new Blob(['b']);
    const { result, rerender } = renderHook(({ blob }) => useObjectUrl(blob), {
      initialProps: { blob: first as Blob | undefined },
    });
    expect(result.current).toBe('blob:a');

    rerender({ blob: second });
    expect(revoke).toHaveBeenCalledWith('blob:a');
    expect(result.current).toBe('blob:b');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('gibt die URL beim Unmount frei', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { unmount } = renderHook(() => useObjectUrl(new Blob(['x'])));
    unmount();
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });

  it('liefert undefined ohne Blob und erzeugt keine URL', () => {
    const create = vi.spyOn(URL, 'createObjectURL');
    const { result } = renderHook(() => useObjectUrl(undefined));
    expect(result.current).toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: useObjectUrl.ts implementieren, Test gruen**

`src/ui/common/useObjectUrl.ts`:

```ts
import { useEffect, useState } from 'react';

/**
 * Haelt genau eine Blob-URL am Leben und gibt sie frei, sobald der Blob
 * wechselt oder die Komponente verschwindet. Ohne die Freigabe waechst der
 * Speicher bei jedem Seitenwechsel im Viewer.
 */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
    };
  }, [blob]);

  return url;
}
```

Run: `npm run test -- src/ui/common/useObjectUrl.test.tsx`
Expected: PASS.

- [ ] **Step 3: Den fehlschlagenden Test fuer usePageImage schreiben**

`src/ui/preview/usePageImage.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePageImage } from './usePageImage';
import { StoreProvider, wireStores } from '../app/StoreProvider';
import type { AppServices } from '../../services/app/appServices';
import type { ReactNode } from 'react';

function wrapper(renderBlock: AppServices['adapter']['renderBlock']) {
  const services = { adapter: { renderBlock } } as unknown as AppServices;
  const value = wireStores({ services, now: () => 1 });
  return ({ children }: { children: ReactNode }) => (
    <StoreProvider value={value}>{children}</StoreProvider>
  );
}

describe('usePageImage', () => {
  it('rendert die Seite und meldet ready mit einer URL', async () => {
    const bitmap = { blob: new Blob(['p'], { type: 'image/webp' }), width: 800, height: 1100 };
    const renderBlock = vi.fn(async () => bitmap);
    const { result } = renderHook(() => usePageImage({ sourceId: 'src-a', blockIndex: 2 }, 800), {
      wrapper: wrapper(renderBlock),
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.url).toMatch(/^blob:/);
    expect(renderBlock).toHaveBeenCalledWith(
      { sourceId: 'src-a', blockIndex: 2 },
      expect.objectContaining({ targetWidth: 800 }),
    );
  });

  it('meldet error, wenn das Rendern scheitert', async () => {
    const renderBlock = vi.fn(async () => {
      throw new Error('kaputt');
    });
    const { result } = renderHook(() => usePageImage({ sourceId: 'src-a', blockIndex: 0 }, 800), {
      wrapper: wrapper(renderBlock),
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});
```

- [ ] **Step 4: usePageImage.ts implementieren**

`src/ui/preview/usePageImage.ts`:

```ts
import { useEffect, useState } from 'react';
import type { BlockRef } from '../../domain/types';
import { useObjectUrl } from '../common/useObjectUrl';
import { useServices } from '../app/StoreProvider';

export type PageImageStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Rendert eine Seite in voller Ansichtsgroesse; das Thumbnail-Raster deckelt bei 180 px, der Viewer nicht. */
export function usePageImage(
  ref: BlockRef,
  targetWidth: number,
): { url: string | undefined; status: PageImageStatus } {
  const { adapter } = useServices();
  const [blob, setBlob] = useState<Blob | undefined>(undefined);
  const [status, setStatus] = useState<PageImageStatus>('idle');
  const url = useObjectUrl(blob);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setStatus('loading');
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    adapter
      .renderBlock(ref, { targetWidth, dpr, signal: controller.signal })
      .then((bitmap) => {
        if (!active) return;
        setBlob(bitmap.blob);
        setStatus('ready');
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        console.warn('Seite konnte nicht gerendert werden', error);
        setStatus('error');
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [adapter, ref.sourceId, ref.blockIndex, targetWidth]);

  return { url, status };
}
```

- [ ] **Step 5: Tests pruefen**

Run: `npm run test -- src/ui/common/useObjectUrl.test.tsx src/ui/preview/usePageImage.test.tsx && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Blob-URL-Lebenszyklus und Seiten-Render-Hook

useObjectUrl gibt die vorige URL bei jedem Seitenwechsel und beim Unmount frei.
usePageImage rendert eine Seite in voller Ansichtsgroesse ueber den Adapter,
mit gedeckelter Geraeteaufloesung und Abbruch beim Wegwechseln.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 2: Viewer fuer Quelle und Ergebnis

**Files:**

- Create: `src/ui/preview/viewerModel.ts`, `src/ui/preview/Viewer.tsx`
- Test: `src/ui/preview/viewerModel.test.ts`, `src/ui/preview/Viewer.test.tsx`

**Interfaces:**

- Consumes: `usePageImage`; `type BlockRef`, `type Rotation` aus `../../domain/types`
- Produces:
  - `interface ViewerPage { ref: BlockRef; rotation: Rotation; provenance: string }`
  - `type FitMode = 'width' | 'page' | 'original'`
  - `clampPageIndex(index: number, count: number): number`
  - `nextZoom(current: number, direction: 1 | -1): number`
  - `Viewer(props: { pages: ViewerPage[]; onJumpToSource?(ref: BlockRef): void; emptyLabel?: string })`

Der Ergebnis-Preview rendert kein assembliertes PDF, sondern die uebergebenen Seiten in Reihenfolge. Dieselbe Komponente zeigt Quelldokumente -- der Unterschied ist nur die Liste. Deshalb kennt der Viewer weder Quelle noch Output, sondern nur `ViewerPage[]`. Die reine Navigations- und Zoomlogik ist ausgelagert und in Node getestet.

- [ ] **Step 1: Den fehlschlagenden Test fuer das Viewer-Modell schreiben**

`src/ui/preview/viewerModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clampPageIndex, nextZoom } from './viewerModel';

describe('clampPageIndex', () => {
  it('haelt den Index im gueltigen Bereich', () => {
    expect(clampPageIndex(-1, 5)).toBe(0);
    expect(clampPageIndex(9, 5)).toBe(4);
    expect(clampPageIndex(2, 5)).toBe(2);
  });

  it('ist 0 bei leerer Liste', () => {
    expect(clampPageIndex(3, 0)).toBe(0);
  });
});

describe('nextZoom', () => {
  it('erhoeht und senkt in Stufen', () => {
    expect(nextZoom(1, 1)).toBeGreaterThan(1);
    expect(nextZoom(1, -1)).toBeLessThan(1);
  });

  it('deckelt bei sinnvollen Grenzen', () => {
    expect(nextZoom(8, 1)).toBeLessThanOrEqual(8);
    expect(nextZoom(0.25, -1)).toBeGreaterThanOrEqual(0.25);
  });
});
```

- [ ] **Step 2: viewerModel.ts implementieren, Test gruen**

`src/ui/preview/viewerModel.ts`:

```ts
export type FitMode = 'width' | 'page' | 'original';

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 8;
const ZOOM_STEP = 1.25;

export function clampPageIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(index, count - 1));
}

export function nextZoom(current: number, direction: 1 | -1): number {
  const raw = direction === 1 ? current * ZOOM_STEP : current / ZOOM_STEP;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, raw));
}
```

Run: `npm run test -- src/ui/preview/viewerModel.test.ts`
Expected: PASS.

- [ ] **Step 3: Den fehlschlagenden Test fuer den Viewer schreiben**

`src/ui/preview/Viewer.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Viewer, type ViewerPage } from './Viewer';
import { StoreProvider, wireStores } from '../app/StoreProvider';
import type { AppServices } from '../../services/app/appServices';

function setup(pages: ViewerPage[], onJumpToSource = vi.fn()) {
  const services = {
    adapter: {
      renderBlock: vi.fn(async () => ({
        blob: new Blob(['x'], { type: 'image/webp' }),
        width: 800,
        height: 1100,
      })),
    },
  } as unknown as AppServices;
  const value = wireStores({ services, now: () => 1 });
  render(
    <StoreProvider value={value}>
      <Viewer pages={pages} onJumpToSource={onJumpToSource} />
    </StoreProvider>,
  );
  return { onJumpToSource };
}

const pages: ViewerPage[] = [
  { ref: { sourceId: 'src-a', blockIndex: 0 }, rotation: 0, provenance: 'Bank.pdf . Seite 1' },
  { ref: { sourceId: 'src-a', blockIndex: 1 }, rotation: 90, provenance: 'Bank.pdf . Seite 2' },
];

describe('Viewer', () => {
  it('zeigt die Herkunftszeile der aktuellen Seite', () => {
    setup(pages);
    expect(screen.getByText('Bank.pdf . Seite 1')).toBeInTheDocument();
  });

  it('blaettert vor und zeigt die naechste Seite und Position', async () => {
    setup(pages);
    await userEvent.click(screen.getByRole('button', { name: 'Naechste Seite' }));
    expect(screen.getByText('Bank.pdf . Seite 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Seite')).toHaveValue(2);
  });

  it('springt ueber die Herkunft zur Quellseite', async () => {
    const { onJumpToSource } = setup(pages);
    await userEvent.click(screen.getByRole('button', { name: /Zur Quelle/ }));
    expect(onJumpToSource).toHaveBeenCalledWith({ sourceId: 'src-a', blockIndex: 0 });
  });

  it('zeigt einen Hinweis bei leerer Liste', () => {
    setup([]);
    expect(screen.getByText(/Nichts zum Anzeigen/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Viewer.tsx implementieren**

`src/ui/preview/Viewer.tsx`:

```tsx
import { useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import type { BlockRef, Rotation } from '../../domain/types';
import { usePageImage } from './usePageImage';
import { clampPageIndex, nextZoom } from './viewerModel';

export interface ViewerPage {
  ref: BlockRef;
  rotation: Rotation;
  provenance: string;
}

export interface ViewerProps {
  pages: ViewerPage[];
  onJumpToSource?(ref: BlockRef): void;
  emptyLabel?: string;
}

const VIEW_WIDTH = 800;

export function Viewer({ pages, onJumpToSource, emptyLabel }: ViewerProps) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [extraRotation, setExtraRotation] = useState<Rotation>(0);

  if (pages.length === 0) {
    return (
      <p className="grid h-full place-items-center text-sm text-neutral-500">
        {emptyLabel ?? 'Nichts zum Anzeigen.'}
      </p>
    );
  }

  const current = pages[clampPageIndex(index, pages.length)];
  const rotation = ((current.rotation + extraRotation) % 360) as Rotation;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-1 text-sm">
        <button
          type="button"
          aria-label="Vorige Seite"
          disabled={index === 0}
          onClick={() => setIndex((i) => clampPageIndex(i - 1, pages.length))}
          className="rounded p-1 hover:bg-panel disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <label className="flex items-center gap-1">
          Seite
          <input
            type="number"
            min={1}
            max={pages.length}
            value={index + 1}
            onChange={(e) => setIndex(clampPageIndex(Number(e.target.value) - 1, pages.length))}
            className="w-14 rounded border border-line bg-panel px-1 py-0.5"
          />
          von {pages.length}
        </label>
        <button
          type="button"
          aria-label="Naechste Seite"
          disabled={index >= pages.length - 1}
          onClick={() => setIndex((i) => clampPageIndex(i + 1, pages.length))}
          className="rounded p-1 hover:bg-panel disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
        <span className="mx-2 h-4 w-px bg-line" />
        <button
          type="button"
          aria-label="Verkleinern"
          onClick={() => setZoom((z) => nextZoom(z, -1))}
          className="rounded p-1 hover:bg-panel"
        >
          <ZoomOut className="size-4" />
        </button>
        <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          aria-label="Vergroessern"
          onClick={() => setZoom((z) => nextZoom(z, 1))}
          className="rounded p-1 hover:bg-panel"
        >
          <ZoomIn className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Drehen"
          onClick={() => setExtraRotation((r) => ((r + 90) % 360) as Rotation)}
          className="rounded p-1 hover:bg-panel"
        >
          <RotateCw className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-black/30 p-4">
        <PageImage
          ref={current.ref}
          zoom={zoom}
          rotation={rotation}
          provenance={current.provenance}
        />
      </div>

      <div className="flex items-center justify-between border-t border-line px-3 py-1 text-xs text-neutral-400">
        <span>{current.provenance}</span>
        {onJumpToSource && (
          <button
            type="button"
            onClick={() => onJumpToSource(current.ref)}
            className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-panel"
            aria-label={`Zur Quelle: ${current.provenance}`}
          >
            <ExternalLink className="size-3" /> Zur Quelle
          </button>
        )}
      </div>
    </div>
  );
}

function PageImage({
  ref,
  zoom,
  rotation,
  provenance,
}: {
  ref: BlockRef;
  zoom: number;
  rotation: Rotation;
  provenance: string;
}) {
  const { url, status } = usePageImage(ref, VIEW_WIDTH);
  if (status === 'error') {
    return (
      <p className="grid h-40 place-items-center text-sm text-amber-400">
        Diese Seite konnte nicht gerendert werden.
      </p>
    );
  }
  if (!url) {
    return (
      <div
        className="mx-auto h-[60vh] w-2/3 animate-pulse rounded bg-panel"
        aria-label={`${provenance} wird geladen`}
      />
    );
  }
  return (
    <img
      src={url}
      alt={provenance}
      className="mx-auto rounded shadow-lg"
      style={{ width: `${zoom * 100}%`, transform: `rotate(${rotation}deg)` }}
    />
  );
}
```

- [ ] **Step 5: Tests pruefen**

Run: `npm run test -- src/ui/preview && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Viewer fuer Quelle und Ergebnis

Dieselbe Komponente zeigt Quelldokumente und Ergebnisse -- der Unterschied ist
nur die uebergebene Liste von Seiten. Der Ergebnis-Preview rendert keine
assemblierte Datei, sondern die referenzierten Quellseiten in Reihenfolge mit
Rotation. Navigation und Zoom sind reine Logik und getrennt getestet; die
Herkunftszeile springt zur Originalseite.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 3: Trefferlogik, Seitentext-Cache und Text-Worker

**Files:**

- Create: `src/services/search/textMatch.ts`, `src/services/search/pageTextStore.ts`, `src/workers/pdfText.worker.ts`
- Test: `src/services/search/textMatch.test.ts`, `src/services/search/pageTextStore.test.ts`

**Interfaces:**

- Consumes: `type PageText`, `type TextSpan` aus `../../adapters/types`; `type Database` aus `../persistence/db`; `idb`; `pdfjs-dist` (nur im Worker)
- Produces:
  - `interface PageMatch { blockIndex: number; snippet: string; count: number; spanRects: TextSpan['rect'][] }`
  - `normalizeQuery(query: string): string`
  - `findPageMatch(page: PageText, query: string): PageMatch | null`
  - `pageTextKey(sourceId: string, blockIndex: number): string`
  - `interface StoredPageText extends PageText { key: string; sourceId: string }`
  - `createPageTextStore(db): PageTextStore` mit `get(sourceId, blockIndex)`, `put(sourceId, page)`, `clear()`
  - der Worker `pdfText.worker.ts` (Nachrichtenprotokoll `ExtractRequest`/`ExtractResponse`)

Die Textextraktion laeuft im Worker, damit die Oberflaeche bei einem 500-Seiten-Dokument nicht einfriert. Die Entscheidung, was ein Treffer ist (Gross-/Kleinschreibung ignorieren, Ausschnitt bilden, Trefferrechtecke sammeln), ist reine Logik und gehoert nicht in den Worker -- sie wird in Node getestet. Der Worker liefert nur Rohtext und Spans; die Trefferbildung passiert im Hauptthread ueber `findPageMatch`.

- [ ] **Step 1: Den fehlschlagenden Test fuer die Trefferlogik schreiben**

`src/services/search/textMatch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findPageMatch, normalizeQuery } from './textMatch';
import type { PageText } from '../../adapters/types';

const page: PageText = {
  blockIndex: 4,
  text: 'Konto Saldo per Ende Jahr, Saldo uebertragen',
  spans: [
    { text: 'Konto', rect: [10, 20, 40, 12] },
    { text: 'Saldo', rect: [60, 20, 40, 12] },
    { text: 'per', rect: [110, 20, 20, 12] },
    { text: 'Saldo', rect: [10, 40, 40, 12] },
  ],
};

describe('normalizeQuery', () => {
  it('trimmt und senkt die Gross-/Kleinschreibung', () => {
    expect(normalizeQuery('  Saldo ')).toBe('saldo');
  });
});

describe('findPageMatch', () => {
  it('zaehlt Vorkommen und sammelt die Trefferrechtecke der passenden Spans', () => {
    const match = findPageMatch(page, 'saldo');
    expect(match).not.toBeNull();
    expect(match!.count).toBe(2);
    expect(match!.spanRects).toEqual([
      [60, 20, 40, 12],
      [10, 40, 40, 12],
    ]);
    expect(match!.snippet).toContain('Saldo');
  });

  it('ignoriert die Gross-/Kleinschreibung', () => {
    expect(findPageMatch(page, 'KONTO')?.count).toBe(1);
  });

  it('liefert null ohne Treffer', () => {
    expect(findPageMatch(page, 'Hypothek')).toBeNull();
  });

  it('liefert null bei leerer Anfrage', () => {
    expect(findPageMatch(page, '   ')).toBeNull();
  });

  it('liefert null fuer eine Seite ohne Text (gescannt, ohne Textschicht)', () => {
    expect(findPageMatch({ blockIndex: 0, text: '', spans: [] }, 'saldo')).toBeNull();
  });
});
```

- [ ] **Step 2: textMatch.ts implementieren, Test gruen**

`src/services/search/textMatch.ts`:

```ts
import type { PageText, TextSpan } from '../../adapters/types';

export interface PageMatch {
  blockIndex: number;
  snippet: string;
  count: number;
  spanRects: TextSpan['rect'][];
}

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Ausschnitt um den ersten Treffer, damit die Trefferliste Kontext zeigt. */
function snippetAround(text: string, at: number, length: number): string {
  const radius = 30;
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + length + radius);
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
}

export function findPageMatch(page: PageText, query: string): PageMatch | null {
  const needle = normalizeQuery(query);
  if (needle === '' || page.text.trim() === '') return null;

  const haystack = page.text.toLowerCase();
  let count = 0;
  let from = haystack.indexOf(needle);
  const first = from;
  while (from !== -1) {
    count += 1;
    from = haystack.indexOf(needle, from + needle.length);
  }
  if (count === 0) return null;

  const spanRects = page.spans
    .filter((span) => span.text.toLowerCase().includes(needle))
    .map((span) => span.rect);

  return {
    blockIndex: page.blockIndex,
    snippet: snippetAround(page.text, first, needle.length),
    count,
    spanRects,
  };
}
```

- [ ] **Step 3: Den fehlschlagenden Test fuer den Seitentext-Cache schreiben**

`src/services/search/pageTextStore.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openWorkspaceDb, type Database } from '../persistence/db';
import { createPageTextStore, pageTextKey } from './pageTextStore';

let db: Database;
let counter = 0;

beforeEach(async () => {
  db = await openWorkspaceDb(`pdf-master-text-${++counter}`);
});

describe('pageTextKey', () => {
  it('bildet einen stabilen Schluessel aus Quelle und Index', () => {
    expect(pageTextKey('src-a', 16)).toBe('src-a:16');
  });
});

describe('createPageTextStore', () => {
  it('legt Seitentext ab und liest ihn wieder', async () => {
    const store = createPageTextStore(db);
    await store.put('src-a', {
      blockIndex: 3,
      text: 'Saldo',
      spans: [{ text: 'Saldo', rect: [1, 2, 3, 4] }],
    });
    const read = await store.get('src-a', 3);
    expect(read?.text).toBe('Saldo');
    expect(read?.spans).toHaveLength(1);
  });

  it('liefert undefined fuer eine ungecachte Seite', async () => {
    expect(await createPageTextStore(db).get('src-a', 99)).toBeUndefined();
  });
});
```

- [ ] **Step 4: pageTextStore.ts implementieren**

`src/services/search/pageTextStore.ts`:

```ts
import type { PageText } from '../../adapters/types';
import type { Database } from '../persistence/db';

export function pageTextKey(sourceId: string, blockIndex: number): string {
  return `${sourceId}:${blockIndex}`;
}

export interface StoredPageText extends PageText {
  key: string;
  sourceId: string;
}

export interface PageTextStore {
  get(sourceId: string, blockIndex: number): Promise<PageText | undefined>;
  put(sourceId: string, page: PageText): Promise<void>;
  clear(): Promise<void>;
}

export function createPageTextStore(db: Database): PageTextStore {
  return {
    async get(sourceId, blockIndex) {
      const record = (await db.get('pageText', pageTextKey(sourceId, blockIndex))) as
        StoredPageText | undefined;
      if (!record) return undefined;
      return { blockIndex: record.blockIndex, text: record.text, spans: record.spans };
    },
    async put(sourceId, page) {
      const record: StoredPageText = {
        ...page,
        sourceId,
        key: pageTextKey(sourceId, page.blockIndex),
      };
      await db.put('pageText', record);
    },
    async clear() {
      await db.clear('pageText');
    },
  };
}
```

Falls der `pageText`-Store in `db.ts` (Plan 2) einen anderen Wert-Typ als `StoredPageText` deklariert, dort den Typ auf `StoredPageText` festlegen -- der Store wurde in Plan 2 als vierter Object Store angelegt, aber ohne konkreten Werttyp benutzt.

- [ ] **Step 5: Den Text-Worker implementieren (kein Unit-Test -- vom Playwright-Test in Task 11 abgedeckt)**

`src/workers/pdfText.worker.ts`:

```ts
/// <reference lib="webworker" />
import * as pdfjs from 'pdfjs-dist';
import type { TextSpan } from '../adapters/types';

// Der Worker parst selbst; er nutzt keinen zweiten pdf.js-Worker (das waere
// eine verschachtelte Worker-Kette). disableWorker haelt die Verarbeitung in
// diesem Worker-Thread. cMaps und Schriften kommen aus dem eigenen Bundle.
const base = (self as unknown as { location: Location }).location.origin + '/';

export interface ExtractRequest {
  type: 'extract';
  sourceId: string;
  bytes: Uint8Array;
  indices: number[];
}

export type ExtractResponse =
  | { type: 'page'; sourceId: string; blockIndex: number; text: string; spans: TextSpan[] }
  | { type: 'done'; sourceId: string }
  | { type: 'error'; sourceId: string; message: string };

self.onmessage = async (event: MessageEvent<ExtractRequest>) => {
  const request = event.data;
  if (request.type !== 'extract') return;
  const post = (message: ExtractResponse) => (self as unknown as Worker).postMessage(message);

  try {
    const doc = await pdfjs.getDocument({
      data: request.bytes.slice(),
      isEvalSupported: false,
      cMapUrl: `${base}pdfjs/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${base}pdfjs/standard_fonts/`,
      disableAutoFetch: true,
    }).promise;

    for (const blockIndex of request.indices) {
      const page = await doc.getPage(blockIndex + 1);
      const content = await page.getTextContent();
      const spans: TextSpan[] = content.items
        .filter(
          (
            item,
          ): item is typeof item & {
            str: string;
            transform: number[];
            width: number;
            height: number;
          } => 'str' in item,
        )
        .map((item) => ({
          text: item.str,
          rect: [item.transform[4], item.transform[5], item.width, item.height],
        }));
      page.cleanup();
      post({
        type: 'page',
        sourceId: request.sourceId,
        blockIndex,
        text: spans.map((s) => s.text).join(' '),
        spans,
      });
    }
    await doc.destroy();
    post({ type: 'done', sourceId: request.sourceId });
  } catch (error) {
    console.error('Textextraktion fehlgeschlagen', error);
    post({
      type: 'error',
      sourceId: request.sourceId,
      message: 'Der Text dieses Dokuments konnte nicht gelesen werden.',
    });
  }
};
```

- [ ] **Step 6: Tests pruefen**

Run: `npm run test -- src/services/search/textMatch.test.ts src/services/search/pageTextStore.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Trefferlogik, Seitentext-Cache und Text-Worker

Die Extraktion laeuft in einem eigenen Worker, damit ein 500-Seiten-Dokument
die Oberflaeche nicht einfrieren laesst. Was ein Treffer ist -- Ausschnitt,
Zahl, Trefferrechtecke -- ist reine Logik und getrennt getestet. Der Cache im
pageText-Store spart die Extraktion beim zweiten Suchlauf.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 4: Suchdienst (`searchService.ts`)

**Files:**

- Create: `src/services/search/searchService.ts`
- Test: `src/services/search/searchService.test.ts`

**Interfaces:**

- Consumes: `findPageMatch`, `type PageMatch` aus `./textMatch`; `type PageTextStore` aus `./pageTextStore`; `type PageText` aus `../../adapters/types`
- Produces:
  - `interface SearchTarget { sourceId: string; name: string; indices: number[] }`
  - `interface DocumentResult { sourceId: string; name: string; searchable: boolean; matches: PageMatch[] }`
  - `interface SearchDeps { store: PageTextStore; extractUncached(sourceId, indices): Promise<PageText[]>; }`
  - `createSearchService(deps): { search(query, targets, onProgress?): Promise<DocumentResult[]> }`

Der Suchdienst verbindet Cache, Extraktion und Trefferlogik. Er ist lazy je Dokument: fuer jede Zielquelle liest er zuerst die gecachten Seitentexte der **gesuchten Seiten** (`indices`) und laesst nur die fehlenden ueber `extractUncached` (den Worker-Adapter) nachziehen, cacht sie und bildet die Treffer. `indices` traegt genau die Seiten des Bereichs: bei "aktuelle Quelle" alle Seiten, bei "aktuelles Output" nur die dort enthaltenen Quellseiten, sodass die Suche im Output keine Treffer auf Seiten meldet, die gar nicht darin liegen. Ein Dokument ohne jeglichen Text ist nicht durchsuchbar (`searchable: false`) -- die Oberflaeche sagt das, statt still leer zu bleiben. `extractUncached` wird hereingegeben, damit der Dienst ohne echten Worker in Node testbar ist.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/services/search/searchService.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createSearchService, type SearchTarget } from './searchService';
import type { PageText } from '../../adapters/types';
import type { PageTextStore } from './pageTextStore';

function fakeStore(seed: Record<string, PageText> = {}): PageTextStore & { puts: string[] } {
  const map = new Map(Object.entries(seed));
  const puts: string[] = [];
  return {
    puts,
    async get(sourceId, blockIndex) {
      return map.get(`${sourceId}:${blockIndex}`);
    },
    async put(sourceId, page) {
      puts.push(`${sourceId}:${page.blockIndex}`);
      map.set(`${sourceId}:${page.blockIndex}`, page);
    },
    async clear() {
      map.clear();
    },
  };
}

const page = (blockIndex: number, text: string): PageText => ({
  blockIndex,
  text,
  spans: [{ text, rect: [0, 0, 10, 10] }],
});
const bank: SearchTarget = { sourceId: 'bank', name: 'Bank.pdf', indices: [0, 1] };

describe('createSearchService', () => {
  it('extrahiert nur die ungecachten Seiten und cacht sie', async () => {
    const store = fakeStore({ 'bank:0': page(0, 'Konto Saldo') });
    const extractUncached = vi.fn(async (_sourceId: string, indices: number[]) =>
      indices.map((i) => page(i, 'Saldo neu')),
    );
    const service = createSearchService({ store, extractUncached });

    const results = await service.search('saldo', [bank]);
    expect(extractUncached).toHaveBeenCalledWith('bank', [1]); // 0 war gecacht
    expect(store.puts).toEqual(['bank:1']);
    expect(results[0].matches.map((m) => m.blockIndex)).toEqual([0, 1]);
  });

  it('meldet ein Dokument ohne Text als nicht durchsuchbar', async () => {
    const store = fakeStore();
    const extractUncached = vi.fn(async (_sourceId: string, indices: number[]) =>
      indices.map((i) => page(i, '')),
    );
    const service = createSearchService({ store, extractUncached });

    const results = await service.search('saldo', [bank]);
    expect(results[0].searchable).toBe(false);
    expect(results[0].matches).toEqual([]);
  });

  it('meldet Fortschritt je Dokument', async () => {
    const store = fakeStore();
    const extractUncached = async (_sourceId: string, indices: number[]) =>
      indices.map((i) => page(i, 'Saldo'));
    const onProgress = vi.fn();
    await createSearchService({ store, extractUncached }).search('saldo', [bank], onProgress);
    expect(onProgress).toHaveBeenLastCalledWith(1, 1);
  });

  it('liefert nichts fuer eine leere Anfrage, ohne zu extrahieren', async () => {
    const extractUncached = vi.fn();
    const results = await createSearchService({ store: fakeStore(), extractUncached }).search(
      '   ',
      [bank],
    );
    expect(results).toEqual([]);
    expect(extractUncached).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/search/searchService.test.ts`
Expected: FAIL, `Failed to resolve import "./searchService"`.

- [ ] **Step 3: searchService.ts implementieren**

`src/services/search/searchService.ts`:

```ts
import type { PageText } from '../../adapters/types';
import type { PageTextStore } from './pageTextStore';
import { findPageMatch, normalizeQuery, type PageMatch } from './textMatch';

export interface SearchTarget {
  sourceId: string;
  name: string;
  /** Genau die zu durchsuchenden Seiten dieses Dokuments (0-basiert). */
  indices: number[];
}

export interface DocumentResult {
  sourceId: string;
  name: string;
  /** false, wenn das Dokument keinerlei Text enthaelt (gescannt, ohne Textschicht). */
  searchable: boolean;
  matches: PageMatch[];
}

export interface SearchDeps {
  store: PageTextStore;
  /** Zieht die fehlenden Seiten ueber den Worker nach; in Tests ein Fake. */
  extractUncached(sourceId: string, indices: number[]): Promise<PageText[]>;
}

export function createSearchService({ store, extractUncached }: SearchDeps) {
  async function pagesOf(target: SearchTarget): Promise<PageText[]> {
    const byIndex = new Map<number, PageText>();
    const missing: number[] = [];
    for (const index of target.indices) {
      const cached = await store.get(target.sourceId, index);
      if (cached) byIndex.set(index, cached);
      else missing.push(index);
    }
    if (missing.length > 0) {
      const extracted = await extractUncached(target.sourceId, missing);
      for (const page of extracted) {
        await store.put(target.sourceId, page);
        byIndex.set(page.blockIndex, page);
      }
    }
    // In der Reihenfolge der gesuchten Seiten zurueckgeben.
    return target.indices
      .map((index) => byIndex.get(index))
      .filter((page): page is PageText => page !== undefined);
  }

  return {
    async search(
      query: string,
      targets: SearchTarget[],
      onProgress?: (done: number, total: number) => void,
    ): Promise<DocumentResult[]> {
      if (normalizeQuery(query) === '') return [];
      const results: DocumentResult[] = [];
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const pages = await pagesOf(target);
        const searchable = pages.some((page) => page.text.trim() !== '');
        const matches = pages
          .map((page) => findPageMatch(page, query))
          .filter((match): match is PageMatch => match !== null);
        results.push({ sourceId: target.sourceId, name: target.name, searchable, matches });
        onProgress?.(i + 1, targets.length);
      }
      return results;
    },
  };
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/services/search/searchService.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Suchdienst mit lazy Extraktion und Cache

Der Dienst liest gecachte Seitentexte und laesst nur die fehlenden ueber den
Worker nachziehen, cacht sie und bildet die Treffer. Ein Dokument ohne Text
ist nicht durchsuchbar und wird so gemeldet. extractUncached ist hereingegeben,
damit der Dienst ohne echten Worker in Node testbar bleibt.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 5: Suchbereiche, Worker-Adapter und Suchoberflaeche

**Files:**

- Create: `src/services/search/searchScope.ts`, `src/services/search/workerExtractor.ts`, `src/ui/preview/SearchPanel.tsx`
- Test: `src/services/search/searchScope.test.ts`, `src/services/search/workerExtractor.test.ts`, `src/ui/preview/SearchPanel.test.tsx`

**Interfaces:**

- Consumes: `type SearchTarget`, `type DocumentResult` aus `./searchService`; `type PageText` aus `../../adapters/types`; `isOutput`, `type NodeId`, `type SourceId`, `type Workspace` aus `../../domain/types`; `ExtractRequest`, `ExtractResponse` aus `../../workers/pdfText.worker`
- Produces:
  - `type SearchScopeKind = 'source' | 'output' | 'all'`
  - `targetsForScope(ws, kind, activeSourceId, activeOutputId): SearchTarget[]` (rein)
  - `interface WorkerLike { postMessage(msg): void; addEventListener(type, cb): void; removeEventListener(type, cb): void }`
  - `createWorkerExtractor(deps: { worker: WorkerLike; readBytes(sourceId): Promise<Uint8Array> }): (sourceId, indices) => Promise<PageText[]>`
  - `SearchPanel(props: { runSearch(query, kind): Promise<DocumentResult[]>; onJump(sourceId, blockIndex): void; onClose(): void })`

Der Bereichsumschalter des Designs (aktuelle Quelle / aktuelles Output / alle Quellen) wird zu einer reinen Funktion, die die konkreten Seiten je Dokument liefert. Der Worker-Adapter buendelt Bytes-Lesen und Worker-Nachrichten zu der `extractUncached`-Funktion, die der Suchdienst erwartet. Die Oberflaeche gruppiert die Treffer nach Dokument, springt bei Klick zur Seite und sagt bei einem Dokument ohne Textschicht klar, dass es keinen durchsuchbaren Text enthaelt.

- [ ] **Step 1: Den fehlschlagenden Test fuer die Bereiche schreiben**

`src/services/search/searchScope.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { targetsForScope } from './searchScope';
import { makeWorkspace, IDS } from '../../domain/__fixtures__/workspace';

describe('targetsForScope', () => {
  it('aktuelle Quelle: alle Seiten der aktiven Quelle', () => {
    const targets = targetsForScope(makeWorkspace(), 'source', IDS.bank, null);
    expect(targets).toHaveLength(1);
    expect(targets[0].sourceId).toBe(IDS.bank);
    expect(targets[0].indices).toHaveLength(50); // Bank.pdf hat 50 Seiten
  });

  it('aktuelles Output: je Quelle nur die dort enthaltenen Seiten', () => {
    // Fixture-Output Insurance enthaelt Insurance Seite 7 und Bank Seite 17.
    const targets = targetsForScope(makeWorkspace(), 'output', null, IDS.outInsurance);
    const byId = Object.fromEntries(targets.map((t) => [t.sourceId, t.indices]));
    expect(byId[IDS.insurance]).toEqual([6]);
    expect(byId[IDS.bank]).toEqual([16]);
  });

  it('alle Quellen: jede lesbare Quelle mit vollem Bereich', () => {
    const targets = targetsForScope(makeWorkspace(), 'all', null, null);
    expect(targets.map((t) => t.sourceId).sort()).toEqual(
      [IDS.bank, IDS.contract, IDS.insurance].sort(),
    );
  });

  it('leere Liste, wenn nichts aktiv ist', () => {
    expect(targetsForScope(makeWorkspace(), 'source', null, null)).toEqual([]);
    expect(targetsForScope(makeWorkspace(), 'output', null, null)).toEqual([]);
  });
});
```

- [ ] **Step 2: searchScope.ts implementieren, Test gruen**

`src/services/search/searchScope.ts`:

```ts
import { isOutput, type NodeId, type SourceId, type Workspace } from '../../domain/types';
import type { SearchTarget } from './searchService';

export type SearchScopeKind = 'source' | 'output' | 'all';

function fullRange(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

export function targetsForScope(
  ws: Workspace,
  kind: SearchScopeKind,
  activeSourceId: SourceId | null,
  activeOutputId: NodeId | null,
): SearchTarget[] {
  if (kind === 'source') {
    const source = activeSourceId ? ws.sources[activeSourceId] : undefined;
    return source && source.status === 'ready'
      ? [{ sourceId: source.id, name: source.name, indices: fullRange(source.blockCount) }]
      : [];
  }

  if (kind === 'output') {
    const node = activeOutputId ? ws.nodes[activeOutputId] : undefined;
    if (!node || !isOutput(node)) return [];
    // Je Quelle die tatsaechlich enthaltenen Seiten, in Erst-Vorkommen-Reihenfolge.
    const bySource = new Map<SourceId, number[]>();
    for (const itemId of node.items) {
      const item = ws.items[itemId];
      if (!item) continue;
      const indices = bySource.get(item.sourceId) ?? [];
      if (!indices.includes(item.blockIndex)) indices.push(item.blockIndex);
      bySource.set(item.sourceId, indices);
    }
    return [...bySource].map(([sourceId, indices]) => ({
      sourceId,
      name: ws.sources[sourceId]?.name ?? 'Quelle',
      indices,
    }));
  }

  return ws.sourceOrder
    .map((id) => ws.sources[id])
    .filter((source) => source && source.status === 'ready')
    .map((source) => ({
      sourceId: source.id,
      name: source.name,
      indices: fullRange(source.blockCount),
    }));
}
```

Run: `npm run test -- src/services/search/searchScope.test.ts`
Expected: PASS.

- [ ] **Step 3: Den fehlschlagenden Test fuer den Worker-Adapter schreiben**

`src/services/search/workerExtractor.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createWorkerExtractor, type WorkerLike } from './workerExtractor';
import type { ExtractRequest, ExtractResponse } from '../../workers/pdfText.worker';

/** Ein Fake-Worker, der auf jede Anfrage mit Seiten und done antwortet. */
function fakeWorker(): WorkerLike {
  const listeners = new Set<(event: MessageEvent<ExtractResponse>) => void>();
  return {
    postMessage(message: ExtractRequest) {
      queueMicrotask(() => {
        for (const index of message.indices) {
          const page: ExtractResponse = {
            type: 'page',
            sourceId: message.sourceId,
            blockIndex: index,
            text: `Seite ${index}`,
            spans: [],
          };
          listeners.forEach((cb) => cb({ data: page } as MessageEvent<ExtractResponse>));
        }
        const done: ExtractResponse = { type: 'done', sourceId: message.sourceId };
        listeners.forEach((cb) => cb({ data: done } as MessageEvent<ExtractResponse>));
      });
    },
    addEventListener: (_type, cb) => listeners.add(cb as never),
    removeEventListener: (_type, cb) => listeners.delete(cb as never),
  };
}

describe('createWorkerExtractor', () => {
  it('liest Bytes, schickt sie zum Worker und sammelt die Seiten bis done', async () => {
    const readBytes = vi.fn(async () => new Uint8Array([1, 2, 3]));
    const extract = createWorkerExtractor({ worker: fakeWorker(), readBytes });
    const pages = await extract('src-a', [0, 2]);
    expect(readBytes).toHaveBeenCalledWith('src-a');
    expect(pages.map((p) => p.blockIndex)).toEqual([0, 2]);
  });

  it('lehnt ab, wenn der Worker einen Fehler meldet', async () => {
    const worker: WorkerLike = {
      postMessage(message: ExtractRequest) {
        queueMicrotask(() =>
          handler?.({
            data: { type: 'error', sourceId: message.sourceId, message: 'kaputt' },
          } as MessageEvent<ExtractResponse>),
        );
      },
      addEventListener: (_t, cb) => (handler = cb as never),
      removeEventListener: () => (handler = null),
    };
    let handler: ((event: MessageEvent<ExtractResponse>) => void) | null = null;
    const extract = createWorkerExtractor({ worker, readBytes: async () => new Uint8Array() });
    await expect(extract('src-a', [0])).rejects.toThrow(/kaputt/);
  });
});
```

- [ ] **Step 4: workerExtractor.ts implementieren**

`src/services/search/workerExtractor.ts`:

```ts
import type { PageText } from '../../adapters/types';
import type { ExtractRequest, ExtractResponse } from '../../workers/pdfText.worker';

export interface WorkerLike {
  postMessage(message: ExtractRequest): void;
  addEventListener(type: 'message', callback: (event: MessageEvent<ExtractResponse>) => void): void;
  removeEventListener(
    type: 'message',
    callback: (event: MessageEvent<ExtractResponse>) => void,
  ): void;
}

export interface WorkerExtractorDeps {
  worker: WorkerLike;
  readBytes(sourceId: string): Promise<Uint8Array>;
}

/**
 * Buendelt Bytes-Lesen und Worker-Nachrichten zu der extractUncached-Funktion,
 * die der Suchdienst erwartet. Eine Anfrage sammelt die Seitennachrichten
 * dieser Quelle, bis der Worker done meldet.
 */
export function createWorkerExtractor({ worker, readBytes }: WorkerExtractorDeps) {
  return (sourceId: string, indices: number[]): Promise<PageText[]> =>
    new Promise<PageText[]>((resolve, reject) => {
      const pages: PageText[] = [];
      const onMessage = (event: MessageEvent<ExtractResponse>) => {
        const message = event.data;
        if (message.sourceId !== sourceId) return;
        if (message.type === 'page') {
          pages.push({ blockIndex: message.blockIndex, text: message.text, spans: message.spans });
        } else if (message.type === 'done') {
          worker.removeEventListener('message', onMessage);
          resolve(pages);
        } else if (message.type === 'error') {
          worker.removeEventListener('message', onMessage);
          reject(new Error(message.message));
        }
      };
      worker.addEventListener('message', onMessage);
      readBytes(sourceId)
        .then((bytes) => worker.postMessage({ type: 'extract', sourceId, bytes, indices }))
        .catch((error) => {
          worker.removeEventListener('message', onMessage);
          reject(error);
        });
    });
}
```

- [ ] **Step 5: Den fehlschlagenden Test fuer die Suchoberflaeche schreiben**

`src/ui/preview/SearchPanel.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchPanel } from './SearchPanel';
import type { DocumentResult } from '../../services/search/searchService';

const results: DocumentResult[] = [
  {
    sourceId: 'bank',
    name: 'Bank.pdf',
    searchable: true,
    matches: [{ blockIndex: 16, snippet: '...Saldo per Ende...', count: 2, spanRects: [] }],
  },
  { sourceId: 'scan', name: 'Scan.pdf', searchable: false, matches: [] },
];

describe('SearchPanel', () => {
  it('zeigt gruppierte Treffer und springt bei Klick zur Seite', async () => {
    const onJump = vi.fn();
    render(<SearchPanel runSearch={async () => results} onJump={onJump} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('searchbox'), 'Saldo');
    await userEvent.click(screen.getByRole('button', { name: 'Suchen' }));

    expect(await screen.findByText('Bank.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Saldo per Ende/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Seite 17/ }));
    expect(onJump).toHaveBeenCalledWith('bank', 16);
  });

  it('sagt, wenn ein Dokument keinen durchsuchbaren Text enthaelt', async () => {
    render(<SearchPanel runSearch={async () => results} onJump={vi.fn()} onClose={vi.fn()} />);
    await userEvent.type(screen.getByRole('searchbox'), 'Saldo');
    await userEvent.click(screen.getByRole('button', { name: 'Suchen' }));
    expect(await screen.findByText(/keinen durchsuchbaren Text/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: SearchPanel.tsx implementieren**

`src/ui/preview/SearchPanel.tsx`:

```tsx
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { SearchScopeKind } from '../../services/search/searchScope';
import type { DocumentResult } from '../../services/search/searchService';

export interface SearchPanelProps {
  runSearch(query: string, kind: SearchScopeKind): Promise<DocumentResult[]>;
  onJump(sourceId: string, blockIndex: number): void;
  onClose(): void;
}

const SCOPES: { key: SearchScopeKind; label: string }[] = [
  { key: 'source', label: 'Aktuelle Quelle' },
  { key: 'output', label: 'Aktuelles Dokument' },
  { key: 'all', label: 'Alle Quellen' },
];

export function SearchPanel({ runSearch, onJump, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScopeKind>('source');
  const [results, setResults] = useState<DocumentResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim() === '') return;
    setBusy(true);
    try {
      setResults(await runSearch(query, scope));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-line">
      <form onSubmit={submit} className="flex flex-col gap-2 border-b border-line p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Suchen</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Suche schliessen"
            className="rounded p-1 hover:bg-panel"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Text im Dokument suchen"
            className="min-w-0 flex-1 rounded border border-line bg-panel px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="flex items-center gap-1 rounded bg-sky-600 px-3 py-1 text-sm"
          >
            <Search className="size-4" /> Suchen
          </button>
        </div>
        <div className="flex gap-1 text-xs">
          {SCOPES.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setScope(entry.key)}
              aria-pressed={scope === entry.key}
              className={`rounded px-2 py-1 ${scope === entry.key ? 'bg-panel text-neutral-100' : 'text-neutral-400 hover:bg-panel/60'}`}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </form>

      <div className="min-h-0 flex-1 overflow-auto p-3 text-sm">
        {busy && <p className="text-neutral-500">Wird durchsucht...</p>}
        {!busy && results && results.every((r) => r.matches.length === 0) && (
          <p className="text-neutral-500">Keine Treffer.</p>
        )}
        {!busy &&
          results?.map((result) => (
            <section key={result.sourceId} className="mb-3">
              <h3 className="mb-1 font-medium">{result.name}</h3>
              {!result.searchable ? (
                <p className="text-neutral-500">
                  Dieses Dokument enthaelt keinen durchsuchbaren Text.
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {result.matches.map((match) => (
                    <li key={match.blockIndex}>
                      <button
                        type="button"
                        onClick={() => onJump(result.sourceId, match.blockIndex)}
                        className="w-full rounded px-2 py-1 text-left hover:bg-panel"
                      >
                        <span className="text-neutral-400">Seite {match.blockIndex + 1}</span>{' '}
                        <span className="text-neutral-300">{match.snippet}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Tests pruefen**

Run: `npm run test -- src/services/search/searchScope.test.ts src/services/search/workerExtractor.test.ts src/ui/preview/SearchPanel.test.tsx && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Suchbereiche, Worker-Adapter und Suchoberflaeche

Der Bereichsumschalter wird zu einer reinen Funktion, die je Dokument genau
die zu durchsuchenden Seiten liefert -- "aktuelles Dokument" sucht nur in
dessen Seiten. Der Worker-Adapter buendelt Bytes-Lesen und Nachrichten zur
extractUncached-Funktion. Die Oberflaeche gruppiert nach Dokument, springt zur
Seite und nennt Dokumente ohne Textschicht beim Namen.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 6: Writer-Vertrag, ZIP-Writer und Verzeichnis-Writer

**Files:**

- Create: `src/services/export/writer.ts`, `src/services/export/zipWriter.ts`, `src/services/export/fsAccessWriter.ts`
- Test: `src/services/export/zipWriter.test.ts`, `src/services/export/fsAccessWriter.test.ts`

**Interfaces:**

- Consumes: `zipSync`, `unzipSync` aus `fflate` (Letzteres nur im Test)
- Produces:
  - `type ExportArtifact = { kind: 'directory' } | { kind: 'zip'; blob: Blob; fileName: string }`
  - `interface ExportWriter { writeFile(path: string[], fileName: string, bytes: Uint8Array): Promise<void>; finalize(): Promise<ExportArtifact> }`
  - `createZipWriter(zipName: string): ExportWriter`
  - `interface DirectoryHandleLike`, `interface FileHandleLike`, `interface WritableLike`
  - `createFsAccessWriter(root: DirectoryHandleLike): ExportWriter`

Beide Writer erfuellen denselben Vertrag, damit sich Verzeichnis- und ZIP-Weg nur noch im Schreibziel unterscheiden -- die Struktur und die Benennung stecken bereits im `ExportPlan` (Plan 1). Der Verzeichnis-Writer arbeitet gegen ein minimales `...Like`-Interface statt gegen die DOM-Typen der File System Access API, sodass er ohne Browser gegen ein Fake getestet werden kann.

- [ ] **Step 1: writer.ts implementieren (nur Typen, kein Test)**

`src/services/export/writer.ts`:

```ts
export type ExportArtifact = { kind: 'directory' } | { kind: 'zip'; blob: Blob; fileName: string };

export interface ExportWriter {
  /** `path` ist relativ und enthaelt bereits sanitisierte, kollisionsfreie Namen. */
  writeFile(path: string[], fileName: string, bytes: Uint8Array): Promise<void>;
  finalize(): Promise<ExportArtifact>;
}
```

- [ ] **Step 2: Den fehlschlagenden Test fuer den ZIP-Writer schreiben**

`src/services/export/zipWriter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createZipWriter } from './zipWriter';

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

describe('createZipWriter', () => {
  it('erhaelt die Ordnerstruktur in den ZIP-Pfaden', async () => {
    const writer = createZipWriter('Tax 2026.zip');
    await writer.writeFile(['Tax 2026', 'Contracts'], 'Contracts.pdf', new Uint8Array([1, 2, 3]));
    await writer.writeFile(['Tax 2026', 'Insurance'], 'Insurance.pdf', new Uint8Array([4, 5]));
    const artifact = await writer.finalize();

    expect(artifact.kind).toBe('zip');
    if (artifact.kind !== 'zip') throw new Error('kein ZIP');
    expect(artifact.fileName).toBe('Tax 2026.zip');

    const entries = unzipSync(await bytesOf(artifact.blob));
    expect(Object.keys(entries).sort()).toEqual([
      'Tax 2026/Contracts/Contracts.pdf',
      'Tax 2026/Insurance/Insurance.pdf',
    ]);
    expect([...entries['Tax 2026/Contracts/Contracts.pdf']]).toEqual([1, 2, 3]);
  });

  it('schreibt eine Datei ohne Pfad in die Wurzel', async () => {
    const writer = createZipWriter('Export.zip');
    await writer.writeFile([], 'Insurance.pdf', new Uint8Array([9]));
    const artifact = await writer.finalize();
    if (artifact.kind !== 'zip') throw new Error('kein ZIP');
    expect(Object.keys(unzipSync(await bytesOf(artifact.blob)))).toEqual(['Insurance.pdf']);
    expect(strFromU8).toBeTypeOf('function'); // fflate ist eingebunden
  });
});
```

- [ ] **Step 3: zipWriter.ts implementieren**

`src/services/export/zipWriter.ts`:

```ts
import { zipSync } from 'fflate';
import type { ExportArtifact, ExportWriter } from './writer';

export function createZipWriter(zipName: string): ExportWriter {
  // fflate erwartet ein flaches Objekt mit "/"-getrennten Pfaden als Schluessel.
  const files: Record<string, Uint8Array> = {};

  return {
    async writeFile(path, fileName, bytes) {
      const key = [...path, fileName].join('/');
      files[key] = bytes;
    },
    async finalize(): Promise<ExportArtifact> {
      const zipped = zipSync(files);
      return {
        kind: 'zip',
        blob: new Blob([zipped], { type: 'application/zip' }),
        fileName: zipName,
      };
    },
  };
}
```

- [ ] **Step 4: Den fehlschlagenden Test fuer den Verzeichnis-Writer schreiben**

`src/services/export/fsAccessWriter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createFsAccessWriter, type DirectoryHandleLike } from './fsAccessWriter';

/** Ein Fake-Verzeichnisbaum, der die geschriebenen Pfade merkt. */
function fakeRoot(written: Map<string, Uint8Array>, prefix = ''): DirectoryHandleLike {
  return {
    async getDirectoryHandle(name) {
      return fakeRoot(written, `${prefix}${name}/`);
    },
    async getFileHandle(name) {
      return {
        async createWritable() {
          let buffer = new Uint8Array();
          return {
            async write(data: Uint8Array) {
              buffer = data;
            },
            async close() {
              written.set(`${prefix}${name}`, buffer);
            },
          };
        },
      };
    },
  };
}

describe('createFsAccessWriter', () => {
  it('legt Verzeichnisse rekursiv an und schreibt die Datei', async () => {
    const written = new Map<string, Uint8Array>();
    const writer = createFsAccessWriter(fakeRoot(written));
    await writer.writeFile(['Tax 2026', 'Contracts'], 'Contracts.pdf', new Uint8Array([1, 2, 3]));
    const artifact = await writer.finalize();

    expect(artifact).toEqual({ kind: 'directory' });
    expect([...written.keys()]).toEqual(['Tax 2026/Contracts/Contracts.pdf']);
    expect([...written.get('Tax 2026/Contracts/Contracts.pdf')!]).toEqual([1, 2, 3]);
  });

  it('schreibt eine Datei ohne Pfad direkt in die Wurzel', async () => {
    const written = new Map<string, Uint8Array>();
    const writer = createFsAccessWriter(fakeRoot(written));
    await writer.writeFile([], 'Insurance.pdf', new Uint8Array([7]));
    expect([...written.keys()]).toEqual(['Insurance.pdf']);
  });
});
```

- [ ] **Step 5: fsAccessWriter.ts implementieren**

`src/services/export/fsAccessWriter.ts`:

```ts
import type { ExportArtifact, ExportWriter } from './writer';

export interface WritableLike {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

export interface FileHandleLike {
  createWritable(): Promise<WritableLike>;
}

export interface DirectoryHandleLike {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
}

export function createFsAccessWriter(root: DirectoryHandleLike): ExportWriter {
  return {
    async writeFile(path, fileName, bytes) {
      let directory = root;
      for (const segment of path) {
        directory = await directory.getDirectoryHandle(segment, { create: true });
      }
      const file = await directory.getFileHandle(fileName, { create: true });
      const writable = await file.createWritable();
      await writable.write(bytes);
      await writable.close();
    },
    async finalize(): Promise<ExportArtifact> {
      return { kind: 'directory' };
    },
  };
}
```

- [ ] **Step 6: Tests pruefen**

Run: `npm run test -- src/services/export/zipWriter.test.ts src/services/export/fsAccessWriter.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Writer-Vertrag, ZIP-Writer und Verzeichnis-Writer

Beide Writer erfuellen denselben Vertrag; Struktur und Benennung stecken schon
im ExportPlan, sodass sich die Wege nur im Schreibziel unterscheiden. Der
Verzeichnis-Writer arbeitet gegen minimale ...Like-Interfaces und ist damit
ohne Browser gegen ein Fake testbar.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 7: Export-Runner

**Files:**

- Create: `src/services/export/exportRunner.ts`
- Test: `src/services/export/exportRunner.test.ts`

**Interfaces:**

- Consumes: `type ExportWriter`, `type ExportArtifact` aus `./writer`; `type ExportPlan`, `type ExportEntry` aus `../../domain/exportPlan`; `type BlockAssembler` aus `../../adapters/types`
- Produces:
  - `interface ExportProgress { done: number; total: number; currentName: string }`
  - `interface ExportRunDeps { assembler: BlockAssembler; readBytes(sourceId): Promise<Uint8Array>; onProgress?(progress: ExportProgress): void; signal?: AbortSignal }`
  - `runExport(plan: ExportPlan, writer: ExportWriter, deps: ExportRunDeps): Promise<ExportArtifact>`

Der Runner ist die Mitte: er geht den `ExportPlan` Eintrag fuer Eintrag durch, laesst den Assembler (Plan 2) aus den Items die PDF-Bytes bauen, reicht sie an den Writer und meldet Fortschritt. Er kennt weder das Schreibziel (das ist der Writer) noch die Struktur (die ist der Plan) -- er orchestriert nur und respektiert das Abbruchsignal.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/services/export/exportRunner.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { runExport } from './exportRunner';
import type { ExportPlan } from '../../domain/exportPlan';
import type { ExportWriter } from './writer';
import type { BlockAssembler } from '../../adapters/types';

function fakeWriter() {
  const files: { path: string[]; fileName: string; size: number }[] = [];
  const writer: ExportWriter = {
    writeFile: vi.fn(async (path, fileName, bytes) => {
      files.push({ path, fileName, size: bytes.length });
    }),
    finalize: vi.fn(async () => ({ kind: 'directory' as const })),
  };
  return { writer, files };
}

function fakeAssembler(): BlockAssembler {
  // Baut Bytes, deren Laenge = Zahl der Items, damit der Test die Zuordnung sieht.
  return { targetFormat: 'pdf', assemble: vi.fn(async (items) => new Uint8Array(items.length)) };
}

const plan: ExportPlan = {
  entries: [
    {
      outputId: 'o1',
      path: ['Tax 2026', 'Contracts'],
      fileName: 'Contracts.pdf',
      items: [{ id: 'i1', sourceId: 's', blockIndex: 0, rotation: 0 }],
    },
    {
      outputId: 'o2',
      path: ['Tax 2026', 'Insurance'],
      fileName: 'Insurance.pdf',
      items: [
        { id: 'i2', sourceId: 's', blockIndex: 1, rotation: 0 },
        { id: 'i3', sourceId: 's', blockIndex: 2, rotation: 0 },
      ],
    },
  ],
  skipped: [],
  totalBlocks: 3,
};

describe('runExport', () => {
  it('assembliert jeden Eintrag und schreibt ihn an seinen Pfad', async () => {
    const { writer, files } = fakeWriter();
    const artifact = await runExport(plan, writer, {
      assembler: fakeAssembler(),
      readBytes: async () => new Uint8Array(),
    });
    expect(artifact).toEqual({ kind: 'directory' });
    expect(files).toEqual([
      { path: ['Tax 2026', 'Contracts'], fileName: 'Contracts.pdf', size: 1 },
      { path: ['Tax 2026', 'Insurance'], fileName: 'Insurance.pdf', size: 2 },
    ]);
  });

  it('meldet Fortschritt je Eintrag mit Namen', async () => {
    const { writer } = fakeWriter();
    const onProgress = vi.fn();
    await runExport(plan, writer, {
      assembler: fakeAssembler(),
      readBytes: async () => new Uint8Array(),
      onProgress,
    });
    expect(onProgress.mock.calls.map((call) => call[0])).toEqual([
      { done: 1, total: 2, currentName: 'Contracts.pdf' },
      { done: 2, total: 2, currentName: 'Insurance.pdf' },
    ]);
  });

  it('bricht vor dem naechsten Eintrag ab, wenn das Signal ausgeloest wurde', async () => {
    const { writer } = fakeWriter();
    const controller = new AbortController();
    controller.abort();
    await expect(
      runExport(plan, writer, {
        assembler: fakeAssembler(),
        readBytes: async () => new Uint8Array(),
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/export/exportRunner.test.ts`
Expected: FAIL, `Failed to resolve import "./exportRunner"`.

- [ ] **Step 3: exportRunner.ts implementieren**

`src/services/export/exportRunner.ts`:

```ts
import type { BlockAssembler } from '../../adapters/types';
import type { ExportPlan } from '../../domain/exportPlan';
import type { ExportArtifact, ExportWriter } from './writer';

export interface ExportProgress {
  done: number;
  total: number;
  currentName: string;
}

export interface ExportRunDeps {
  assembler: BlockAssembler;
  readBytes(sourceId: string): Promise<Uint8Array>;
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
      signal: deps.signal,
    });
    await writer.writeFile(entry.path, entry.fileName, bytes);
    deps.onProgress?.({ done: i + 1, total, currentName: entry.fileName });
  }
  return writer.finalize();
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/services/export/exportRunner.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Export-Runner orchestriert Assembler und Writer

Der Runner geht den ExportPlan durch, laesst den Assembler die Bytes bauen und
reicht sie an den Writer, meldet Fortschritt je Eintrag und respektiert das
Abbruchsignal. Er kennt weder Schreibziel noch Struktur -- damit ist die
gesamte Exportmechanik ohne Browser testbar.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 8: Export-Dialog (Plan-Vorschau und Zielwahl)

**Files:**

- Create: `src/ui/export/ExportDialog.tsx`
- Test: `src/ui/export/ExportDialog.test.tsx`

**Interfaces:**

- Consumes: `type ExportPlan` aus `../../domain/exportPlan`; `type ExportProgress` aus `../../services/export/exportRunner`
- Produces:
  - `ExportDialog(props: { plan: ExportPlan; canWriteDirectory: boolean; progress: ExportProgress | null; onExport(target: 'directory' | 'zip'): void; onCancel(): void; onClose(): void })`

Das Design verlangt: vor dem Start den Plan als Baum mit Seitenzahlen zeigen; direkter Ordner-Export nur dort, wo `showDirectoryPicker` vorhanden ist, sonst ist ZIP primaer und ein Einzeiler erklaert den Grund. Der Dialog ist rein darstellend -- den eigentlichen Lauf (Verzeichnis waehlen, Writer bauen, Runner starten, Abbruch) besitzt die App (Task 9). So bleibt der Dialog ohne Browser-APIs testbar.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/ui/export/ExportDialog.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportDialog } from './ExportDialog';
import type { ExportPlan } from '../../domain/exportPlan';

const plan: ExportPlan = {
  entries: [
    {
      outputId: 'o1',
      path: ['Tax 2026', 'Contracts'],
      fileName: 'Contracts.pdf',
      items: [
        { id: 'i1', sourceId: 's', blockIndex: 0, rotation: 0 },
        { id: 'i2', sourceId: 's', blockIndex: 1, rotation: 0 },
      ],
    },
    {
      outputId: 'o2',
      path: ['Tax 2026', 'Insurance'],
      fileName: 'Insurance.pdf',
      items: [{ id: 'i3', sourceId: 's', blockIndex: 2, rotation: 0 }],
    },
  ],
  skipped: [{ outputId: 'o3', name: 'Leeres Dokument', reason: 'empty' }],
  totalBlocks: 3,
};

describe('ExportDialog', () => {
  it('zeigt den Plan mit Pfad, Dateiname und Seitenzahl', () => {
    render(
      <ExportDialog
        plan={plan}
        canWriteDirectory
        progress={null}
        onExport={vi.fn()}
        onCancel={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Tax 2026 . Contracts . Contracts\.pdf/)).toBeInTheDocument();
    expect(screen.getByText('2 Seiten')).toBeInTheDocument();
    expect(screen.getByText(/Leeres Dokument/)).toBeInTheDocument(); // uebergangen, aber genannt
  });

  it('startet den ZIP-Export', async () => {
    const onExport = vi.fn();
    render(
      <ExportDialog
        plan={plan}
        canWriteDirectory
        progress={null}
        onExport={onExport}
        onCancel={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Als ZIP/ }));
    expect(onExport).toHaveBeenCalledWith('zip');
  });

  it('deaktiviert den Ordner-Export ohne API und erklaert den Grund', () => {
    render(
      <ExportDialog
        plan={plan}
        canWriteDirectory={false}
        progress={null}
        onExport={vi.fn()}
        onCancel={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /In Ordner exportieren/ })).toBeDisabled();
    expect(screen.getByText(/Dieser Browser/)).toBeInTheDocument();
  });

  it('zeigt den Fortschritt und den Abbrechen-Knopf waehrend des Laufs', () => {
    render(
      <ExportDialog
        plan={plan}
        canWriteDirectory
        progress={{ done: 1, total: 2, currentName: 'Contracts.pdf' }}
        onExport={vi.fn()}
        onCancel={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Contracts\.pdf/)).toBeInTheDocument();
    expect(screen.getByText('1 von 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: ExportDialog.tsx implementieren**

`src/ui/export/ExportDialog.tsx`:

```tsx
import { Download, FolderTree, X } from 'lucide-react';
import type { ExportPlan } from '../../domain/exportPlan';
import type { ExportProgress } from '../../services/export/exportRunner';

export interface ExportDialogProps {
  plan: ExportPlan;
  canWriteDirectory: boolean;
  progress: ExportProgress | null;
  onExport(target: 'directory' | 'zip'): void;
  onCancel(): void;
  onClose(): void;
}

function pages(count: number): string {
  return count === 1 ? '1 Seite' : `${count} Seiten`;
}

export function ExportDialog({
  plan,
  canWriteDirectory,
  progress,
  onExport,
  onCancel,
  onClose,
}: ExportDialogProps) {
  const running = progress !== null;

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/50"
      role="dialog"
      aria-label="Exportieren"
    >
      <div className="flex max-h-[80vh] w-[32rem] flex-col rounded-lg border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <h2 className="text-sm font-medium">Exportieren</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schliessen"
            disabled={running}
            className="rounded p-1 hover:bg-shell disabled:opacity-40"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-sm">
          <p className="mb-2 text-neutral-400">
            {plan.entries.length} Dokumente, {pages(plan.totalBlocks)} insgesamt.
          </p>
          <ul className="flex flex-col gap-1">
            {plan.entries.map((entry) => (
              <li key={entry.outputId} className="flex justify-between">
                <span className="truncate">{[...entry.path, entry.fileName].join(' . ')}</span>
                <span className="ml-2 shrink-0 text-neutral-500">{pages(entry.items.length)}</span>
              </li>
            ))}
          </ul>
          {plan.skipped.length > 0 && (
            <p className="mt-3 text-xs text-neutral-500">
              Uebergangen (leer): {plan.skipped.map((entry) => entry.name).join(', ')}
            </p>
          )}
        </div>

        <div className="border-t border-line px-4 py-3">
          {running ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-300">
                {progress.currentName} · {progress.done} von {progress.total}
              </span>
              <button
                type="button"
                onClick={onCancel}
                className="rounded px-3 py-1 text-sm hover:bg-shell"
              >
                Abbrechen
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={!canWriteDirectory}
                  onClick={() => onExport('directory')}
                  className="flex items-center gap-1 rounded bg-shell px-3 py-1 text-sm disabled:opacity-40"
                >
                  <FolderTree className="size-4" /> In Ordner exportieren
                </button>
                <button
                  type="button"
                  onClick={() => onExport('zip')}
                  className="flex items-center gap-1 rounded bg-sky-600 px-3 py-1 text-sm"
                >
                  <Download className="size-4" /> Als ZIP herunterladen
                </button>
              </div>
              {!canWriteDirectory && (
                <p className="text-right text-xs text-neutral-500">
                  Dieser Browser kann nicht direkt in einen Ordner schreiben; nutzen Sie den
                  ZIP-Export.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Tests pruefen**

Run: `npm run test -- src/ui/export/ExportDialog.test.tsx && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Export-Dialog mit Plan-Vorschau und Zielwahl

Der Dialog zeigt den Plan mit Pfad, Dateiname und Seitenzahl und nennt leere,
uebergangene Outputs. Fehlt die Verzeichnis-API, ist der Ordner-Export
deaktiviert und ein Einzeiler erklaert den Grund -- kein Feature verschwindet
still. Der Dialog ist rein darstellend; den Lauf besitzt die App.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 9: Viewer, Suche und Export in die App verdrahten

**Files:**

- Create: `src/ui/preview/PreviewPane.tsx`, `src/ui/export/useExport.ts`, `src/ui/preview/useSearch.ts`
- Modify: `src/ui/app/App.tsx`
- Test: `src/ui/app/App.export.test.tsx`, `src/ui/preview/PreviewPane.test.tsx`

**Interfaces:**

- Consumes: alle Bausteine der Tasks 1-8; `buildExportPlan` aus `../../domain/exportPlan`; `createZipWriter`, `createFsAccessWriter`, `runExport`; `createSearchService`, `createWorkerExtractor`, `createPageTextStore`, `targetsForScope`; `useServices`, `useWorkspace`, `useSelection`
- Produces:
  - `PreviewPane(props: { activeSourceId: SourceId | null; activeOutputId: NodeId | null; onJumpToSource(ref: BlockRef): void })`
  - `useExport(): { open(): void; dialog: ReactNode }`
  - `useSearch(): { open(): void; panel: ReactNode; jumpTarget: BlockRef | null }`

Diese Task ersetzt die Platzhalter aus Plan 3 (Preview-Bereich und Export-Knopf). `PreviewPane` waehlt die Seitenliste (aktives Output bevorzugt, sonst aktive Quelle) und uebergibt sie dem Viewer. `useExport` baut den Plan, waehlt Writer und Ziel und faehrt den Runner mit Fortschritt und Abbruch. `useSearch` verdrahtet den Suchdienst mit dem Worker; der Worker wird erst beim ersten Suchlauf erzeugt, damit App-Tests ohne Worker auskommen.

- [ ] **Step 1: Den fehlschlagenden Test fuer PreviewPane schreiben**

`src/ui/preview/PreviewPane.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreviewPane } from './PreviewPane';
import { StoreProvider, wireStores } from '../app/StoreProvider';
import { makeWorkspace, IDS } from '../../domain/__fixtures__/workspace';
import type { AppServices } from '../../services/app/appServices';

function setup(props: { activeSourceId?: string | null; activeOutputId?: string | null } = {}) {
  const services = {
    adapter: {
      renderBlock: vi.fn(async () => ({
        blob: new Blob(['x'], { type: 'image/webp' }),
        width: 800,
        height: 1100,
      })),
    },
  } as unknown as AppServices;
  const value = wireStores({ services, initialWorkspace: makeWorkspace(), now: () => 1 });
  render(
    <StoreProvider value={value}>
      <PreviewPane
        activeSourceId={props.activeSourceId ?? null}
        activeOutputId={props.activeOutputId ?? null}
        onJumpToSource={vi.fn()}
      />
    </StoreProvider>,
  );
}

describe('PreviewPane', () => {
  it('zeigt die Seiten des aktiven Outputs mit Herkunft', () => {
    setup({ activeOutputId: IDS.outInsurance });
    expect(screen.getByText(/Insurance\.pdf . Seite 7/)).toBeInTheDocument();
  });

  it('zeigt sonst die aktive Quelle', () => {
    setup({ activeSourceId: IDS.bank });
    expect(screen.getByText(/Bank\.pdf . Seite 1/)).toBeInTheDocument();
  });

  it('zeigt einen Hinweis, wenn nichts gewaehlt ist', () => {
    setup();
    expect(screen.getByText(/Waehlen Sie/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: PreviewPane.tsx implementieren**

`src/ui/preview/PreviewPane.tsx`:

```tsx
import { useMemo } from 'react';
import { isOutput, type BlockRef, type NodeId, type SourceId } from '../../domain/types';
import { useWorkspace } from '../app/StoreProvider';
import { Viewer, type ViewerPage } from './Viewer';

export interface PreviewPaneProps {
  activeSourceId: SourceId | null;
  activeOutputId: NodeId | null;
  onJumpToSource(ref: BlockRef): void;
}

export function PreviewPane({ activeSourceId, activeOutputId, onJumpToSource }: PreviewPaneProps) {
  const workspace = useWorkspace();

  const pages = useMemo<ViewerPage[]>(() => {
    // Ein aktives Output geht vor: sein Preview ist der eigentliche Zweck.
    const output = activeOutputId ? workspace.nodes[activeOutputId] : undefined;
    if (output && isOutput(output)) {
      return output.items
        .map((itemId) => workspace.items[itemId])
        .filter((item) => item !== undefined)
        .map((item) => ({
          ref: { sourceId: item.sourceId, blockIndex: item.blockIndex },
          rotation: item.rotation,
          provenance: `${workspace.sources[item.sourceId]?.name ?? 'Quelle'} . Seite ${item.blockIndex + 1}`,
        }));
    }
    const source = activeSourceId ? workspace.sources[activeSourceId] : undefined;
    if (source) {
      return Array.from({ length: source.blockCount }, (_, blockIndex) => ({
        ref: { sourceId: source.id, blockIndex },
        rotation: 0 as const,
        provenance: `${source.name} . Seite ${blockIndex + 1}`,
      }));
    }
    return [];
  }, [workspace, activeSourceId, activeOutputId]);

  return (
    <Viewer
      pages={pages}
      onJumpToSource={onJumpToSource}
      emptyLabel="Waehlen Sie eine Quelle oder ein Dokument fuer die Vorschau."
    />
  );
}
```

- [ ] **Step 3: useExport.ts implementieren**

`src/ui/export/useExport.ts`:

```tsx
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { buildExportPlan, type ExportPlan } from '../../domain/exportPlan';
import { createFsAccessWriter } from '../../services/export/fsAccessWriter';
import { createZipWriter } from '../../services/export/zipWriter';
import { runExport, type ExportProgress } from '../../services/export/exportRunner';
import { useServices, useWorkspace } from '../app/StoreProvider';
import { ExportDialog } from './ExportDialog';

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

const canWriteDirectory =
  typeof (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function';

export function useExport(): { open(): void; dialog: ReactNode } {
  const services = useServices();
  const workspace = useWorkspace();
  const [plan, setPlan] = useState<ExportPlan | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const abort = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    setPlan(null);
    setProgress(null);
  }, []);

  const onExport = useCallback(
    async (target: 'directory' | 'zip') => {
      const current = buildExportPlan(workspace);
      const controller = new AbortController();
      abort.current = controller;
      setProgress({ done: 0, total: current.entries.length, currentName: '' });
      try {
        const writer =
          target === 'zip'
            ? createZipWriter(`${workspace.name}.zip`)
            : createFsAccessWriter(
                await (
                  globalThis as { showDirectoryPicker(): Promise<never> }
                ).showDirectoryPicker(),
              );
        const artifact = await runExport(current, writer, {
          assembler: services.assembler,
          readBytes: services.readBytesForSource,
          onProgress: setProgress,
          signal: controller.signal,
        });
        if (artifact.kind === 'zip') download(artifact.blob, artifact.fileName);
        close();
      } catch (error) {
        console.error('Export fehlgeschlagen oder abgebrochen', error);
        setProgress(null);
      }
    },
    [services, workspace, close],
  );

  return {
    open: () => setPlan(buildExportPlan(workspace)),
    dialog: plan ? (
      <ExportDialog
        plan={plan}
        canWriteDirectory={canWriteDirectory}
        progress={progress}
        onExport={(target) => void onExport(target)}
        onCancel={() => abort.current?.abort()}
        onClose={close}
      />
    ) : null,
  };
}
```

- [ ] **Step 4: useSearch.ts implementieren**

`src/ui/preview/useSearch.ts`:

```tsx
import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { BlockRef, NodeId, SourceId } from '../../domain/types';
import { createPageTextStore } from '../../services/search/pageTextStore';
import { createSearchService } from '../../services/search/searchService';
import { targetsForScope, type SearchScopeKind } from '../../services/search/searchScope';
import { createWorkerExtractor } from '../../services/search/workerExtractor';
import { useServices, useWorkspace } from '../app/StoreProvider';
import { SearchPanel } from './SearchPanel';

export function useSearch(active: { sourceId: SourceId | null; outputId: NodeId | null }): {
  open(): void;
  panel: ReactNode;
  jumpTarget: BlockRef | null;
  clearJump(): void;
} {
  const services = useServices();
  const workspace = useWorkspace();
  const [visible, setVisible] = useState(false);
  const [jumpTarget, setJumpTarget] = useState<BlockRef | null>(null);
  const serviceRef = useRef<ReturnType<typeof createSearchService> | null>(null);

  // Der Worker wird erst beim ersten Suchlauf erzeugt -- App-Tests, die nie
  // suchen, brauchen so keinen Worker.
  const getService = useCallback(() => {
    if (!serviceRef.current) {
      const worker = new Worker(new URL('../../workers/pdfText.worker.ts', import.meta.url), {
        type: 'module',
      });
      serviceRef.current = createSearchService({
        store: createPageTextStore(services.db),
        extractUncached: createWorkerExtractor({ worker, readBytes: services.readBytesForSource }),
      });
    }
    return serviceRef.current;
  }, [services]);

  const runSearch = useCallback(
    (query: string, kind: SearchScopeKind) =>
      getService().search(
        query,
        targetsForScope(workspace, kind, active.sourceId, active.outputId),
      ),
    [getService, workspace, active.sourceId, active.outputId],
  );

  return {
    open: () => setVisible(true),
    jumpTarget,
    clearJump: () => setJumpTarget(null),
    panel: visible ? (
      <SearchPanel
        runSearch={runSearch}
        onJump={(sourceId, blockIndex) => setJumpTarget({ sourceId, blockIndex })}
        onClose={() => setVisible(false)}
      />
    ) : null,
  };
}
```

- [ ] **Step 5: App.tsx: Platzhalter durch Preview, Suche und Export ersetzen**

Im `Workspace`-Bestandteil aus Plan 3 die rechte Spalte und den Export-Knopf verdrahten. Die Aenderungen:

```tsx
// Neue Hooks im Workspace-Bestandteil (aus Plan 3 hat er bereits dispatch,
// activeSourceId, activeOutputId):
const exportUi = useExport();
const search = useSearch({ sourceId: activeSourceId, outputId: activeOutputId });
useKeyboardShortcuts({ onSearch: search.open });

// Wenn die Suche eine Seite anspringt, die Quelle aktiv setzen (Herkunftssprung):
useEffect(() => {
  if (search.jumpTarget) {
    setActiveSourceId(search.jumpTarget.sourceId);
    search.clearJump();
  }
}, [search.jumpTarget]);
```

Die rechte Spalte (in Plan 3 der Platzhalter `Vorschau und Suche folgen in Plan 4.`) wird zu:

```tsx
<aside className="flex w-96 border-l border-line">
  <div className="min-w-0 flex-1">
    <PreviewPane
      activeSourceId={activeSourceId}
      activeOutputId={activeOutputId}
      onJumpToSource={(ref) => setActiveSourceId(ref.sourceId)}
    />
  </div>
  {search.panel && <div className="w-80 shrink-0">{search.panel}</div>}
</aside>
```

Der Export-Knopf im `Header` (in Plan 3 `disabled`) wird aktiviert und ruft `exportUi.open`. Dazu bekommt `Header` einen Prop `onExport(): void`; in `App` wird `exportUi.open` durchgereicht. Am Ende des `Workspace`-Bestandteils zusaetzlich `{exportUi.dialog}` rendern.

Die noetigen Importe in `App.tsx`:

```tsx
import { PreviewPane } from '../preview/PreviewPane';
import { useExport } from '../export/useExport';
import { useSearch } from '../preview/useSearch';
```

Und in `Header.tsx` den Export-Knopf:

```tsx
// Prop ergaenzen: onExport(): void;
<button
  type="button"
  onClick={onExport}
  className="flex items-center gap-1 rounded bg-panel px-3 py-1 text-sm hover:bg-panel/80"
>
  <Download className="size-4" aria-hidden /> Exportieren
</button>
```

- [ ] **Step 6: Den fehlschlagenden Integrationstest fuer den Export schreiben**

`src/ui/app/App.export.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { wireStores, type StoreContextValue } from './StoreProvider';
import { makeWorkspace } from '../../domain/__fixtures__/workspace';
import type { AppServices } from '../../services/app/appServices';

function fakeStore(): StoreContextValue {
  const services = {
    adapter: {
      renderBlock: vi.fn(async () => ({
        blob: new Blob(['x'], { type: 'image/webp' }),
        width: 800,
        height: 1100,
      })),
    },
    assembler: { targetFormat: 'pdf', assemble: vi.fn(async () => new Uint8Array([1])) },
    readBytesForSource: vi.fn(async () => new Uint8Array()),
    autosave: { subscribe: () => () => {}, schedule: () => {}, flush: async () => {} },
    importForFiles: vi.fn(async () => ({ sources: [], rejected: [] })),
    db: {},
  } as unknown as AppServices;
  return wireStores({ services, initialWorkspace: makeWorkspace(), now: () => 1 });
}

describe('App-Export', () => {
  it('oeffnet den Export-Dialog und zeigt den Plan des Workspace', async () => {
    render(<App bootstrap={async () => fakeStore()} />);
    await userEvent.click(await screen.findByRole('button', { name: /Exportieren/ }));
    // Fixture: Tax 2026/Insurance/Insurance.pdf und Tax 2026/Contracts/Contracts.pdf.
    expect(await screen.findByText(/Insurance\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Als ZIP/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Tests pruefen**

Run: `npm run test -- src/ui/preview/PreviewPane.test.tsx src/ui/app/App.export.test.tsx && npm run typecheck && npm run lint`
Expected: PASS. Falls der bestehende `App.test.tsx` aus Plan 3 durch die neue rechte Spalte bricht (etwa weil der Platzhaltertext verschwindet), dort die entsprechende Zusicherung auf den neuen Zustand anpassen.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Viewer, Suche und Export in die Arbeitsflaeche verdrahtet

Die Platzhalter aus Plan 3 sind ersetzt: der Preview-Bereich zeigt das aktive
Output (sonst die Quelle) ueber den Viewer, die Suche oeffnet per Ctrl/Cmd+F
und springt zur Herkunftsseite, der Export-Knopf oeffnet den Dialog und faehrt
Runner und Writer mit Fortschritt und Abbruch. Der Text-Worker wird erst beim
ersten Suchlauf erzeugt.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 10: Playwright-Akzeptanztest bis zum ZIP-Export

**Files:**

- Create: `tests/e2e/fixtures/makePdf.ts`, `tests/e2e/acceptance.spec.ts`
- Modify: `playwright.config.ts` (aus Plan 2, nur falls noetig)
- Test: der Playwright-Lauf selbst

**Interfaces:**

- Consumes: die laufende App unter der Vite-Vorschau; `pdf-lib` (Fixture-Erzeugung); `fflate` (`unzipSync`, ZIP-Pruefung); `@playwright/test`
- Produces: `makeAcceptancePdfs(dir): Promise<{ contract; bank; insurance }>` und der Akzeptanztest

Das Design verlangt einen Playwright-Test fuer den Akzeptanz-Flow aus Abschnitt 12 bis zum ZIP-Export (der Directory-Picker ist nicht automatisierbar). Der Test faehrt die echte App in Chromium: pdf.js liest echte Dateien, OffscreenCanvas rendert, IndexedDB haelt den Zustand, der Assembler baut echte PDF-Bytes, `fflate` packt. Er ist der Beweis, dass das Zusammenspiel aus allen vier Plaenen traegt.

- [ ] **Step 1: Fixture-Erzeugung schreiben**

Echte PDFs mit unterscheidbaren Seiten, damit Reihenfolge und Herkunft pruefbar sind. `tests/e2e/fixtures/makePdf.ts`:

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/** Ein PDF mit `count` Seiten, jede mit ihrer Nummer beschriftet. */
async function makePdf(title: string, count: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let page = 1; page <= count; page++) {
    const p = doc.addPage([420, 595]);
    p.drawText(`${title} Seite ${page}`, { x: 40, y: 520, size: 20, font });
  }
  return doc.save();
}

export async function makeAcceptancePdfs(
  dir: string,
): Promise<{ contract: string; bank: string; insurance: string }> {
  await mkdir(dir, { recursive: true });
  const files = {
    contract: join(dir, 'Contract.pdf'),
    bank: join(dir, 'Bank.pdf'),
    insurance: join(dir, 'Insurance.pdf'),
  };
  await writeFile(files.contract, await makePdf('Contract', 100));
  await writeFile(files.bank, await makePdf('Bank', 50));
  await writeFile(files.insurance, await makePdf('Insurance', 30));
  return files;
}
```

- [ ] **Step 2: Sicherstellen, dass die Vorschau laeuft**

`playwright.config.ts` (aus Plan 2) startet die App ueber `webServer`. Falls dort nur der Importtest lief, den `webServer`-Block pruefen:

```ts
webServer: {
  command: 'npm run build && npm run preview -- --port 4173',
  url: 'http://localhost:4173',
  reuseExistingServer: !process.env.CI,
},
```

- [ ] **Step 3: Den Akzeptanztest schreiben**

`tests/e2e/acceptance.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { unzipSync } from 'fflate';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeAcceptancePdfs } from './fixtures/makePdf';

test('Import, Komposition per Drag und ZIP-Export', async ({ page }) => {
  const dir = join(tmpdir(), `pdf-master-e2e-${Date.now()}`);
  const files = await makeAcceptancePdfs(dir);

  await page.goto('/');
  await expect(page.getByRole('banner')).toContainText('PDF-Master');

  // 1) Import ueber den Dateidialog (drei Dokumente).
  await page.getByRole('button', { name: /Importieren/ }).click();
  await page
    .locator('input[type=file]')
    .setInputFiles([files.contract, files.bank, files.insurance]);
  await expect(page.getByText('Contract.pdf')).toBeVisible();
  await expect(page.getByText('100 Seiten')).toBeVisible();

  // 2) Einen Ausgabeordner anlegen.
  await page.getByRole('button', { name: 'Ordner anlegen' }).click();
  await expect(page.getByText('Neuer Ordner')).toBeVisible();

  // 3) Quelle waehlen, Range setzen (4-49), auf den Ordner ziehen -> neues Output.
  await page.getByRole('button', { name: /Contract\.pdf/ }).click();
  await page.getByLabel('Seiten').fill('4-49');
  await expect(page.getByText('46 Seiten ausgewaehlt')).toBeVisible();

  const firstCell = page.locator('[data-testid=virtual-grid] button[aria-pressed=true]').first();
  const folder = page.locator('[data-node-type=folder]').first();
  const from = await firstCell.boundingBox();
  const to = await folder.boundingBox();
  if (!from || !to) throw new Error('Zellen- oder Ordnerposition nicht messbar');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();

  // Das neue Output erscheint im Baum (Name = Ordnername).
  const outputInTree = page.locator('[data-node-type=output]').first();
  await expect(outputInTree).toBeVisible();

  // 4) Output oeffnen und die Vorschau pruefen (erste Seite ist Contract Seite 4).
  await outputInTree.click();
  await expect(page.getByText(/Contract\.pdf . Seite 4/)).toBeVisible();

  // 5) ZIP-Export ausloesen und den Download einfangen.
  await page.getByRole('button', { name: /Exportieren/ }).click();
  await expect(page.getByRole('dialog', { name: 'Exportieren' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Als ZIP/ }).click();
  const download = await downloadPromise;

  // 6) Das ZIP enthaelt die erwartete Struktur mit einer nicht-leeren PDF-Datei.
  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  const entries = unzipSync(new Uint8Array(await readFile(path!)));
  const pdfEntry = Object.entries(entries).find(([name]) => name.endsWith('.pdf'));
  expect(pdfEntry).toBeDefined();
  expect(pdfEntry![1].length).toBeGreaterThan(0);
  // Die Bytes beginnen mit der PDF-Signatur %PDF.
  expect(Array.from(pdfEntry![1].slice(0, 4))).toEqual([0x25, 0x50, 0x44, 0x46]);
});
```

- [ ] **Step 4: Den Test laufen lassen**

Run: `npx playwright test tests/e2e/acceptance.spec.ts`
Expected: PASS. Der Test baut die App, startet die Vorschau, importiert echte PDFs, komponiert per Drag und exportiert ein gueltiges ZIP.

Falls das interne Drag ueber die Maus keine `pointer`-Events ausloest, in den Rasterzellen sicherstellen, dass `onPointerDown` gebunden ist (Playwright dispatcht fuer die Maus auch Pointer-Events) und dass die Zell-Container `data-drop-index` und der Ordner `data-node-id`/`data-node-type` tragen -- diese Attribute stammen aus Plan 3, Task 9-11.

- [ ] **Step 5: Vollstaendigen Lauf pruefen**

Run: `npm run test && npm run typecheck && npm run lint && npm run build && npx playwright test`
Expected: alle Unit-/Komponententests PASS, Typen und Lint gruen, Build gruen, beide Playwright-Tests (Import aus Plan 2 und Akzeptanz aus diesem Plan) gruen.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
test: Playwright-Akzeptanztest von Import bis ZIP-Export

Der Test faehrt die echte App in Chromium: pdf.js liest echte Dateien,
OffscreenCanvas rendert, IndexedDB haelt den Zustand, der Assembler baut echte
PDF-Bytes und fflate packt. Import, Komposition per Drag, Vorschau und ZIP-
Export laufen durch; das ZIP enthaelt eine gueltige PDF-Datei. Damit ist das
Zusammenspiel aller vier Plaene bewiesen.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

## Selbstpruefung gegen die Spezifikation

Abgleich mit `docs/superpowers/specs/2026-09-10-document-workspace-design.md`, Bereiche, die dieser Plan traegt:

| Abschnitt der Spezifikation                                                                          | In diesem Plan                          |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 10 Ergebnis-Preview rendert Quellseiten in Reihenfolge, dieselbe Komponente fuer Quelle und Ergebnis | Task 1, 2, 9                            |
| 10 Viewer: Zoom, Einpassen, Seitennavigation mit Nummernfeld, Rotation, Herkunftszeile mit Sprung    | Task 2, 9                               |
| 10 Suche mit Bereichsumschalter (Quelle / Output / alle Quellen), gruppierte Treffer, Sprung         | Task 4, 5, 9                            |
| 10 Textextraktion im Worker, seitenweise, lazy, Cache in `pageText`                                  | Task 3, 4                               |
| 10 Kein OCR: klare Meldung bei fehlender Textschicht                                                 | Task 3, 4, 5                            |
| 11 Export: beide Writer konsumieren ausschliesslich den `ExportPlan`                                 | Task 6, 7                               |
| 11 Direkt in einen Ordner (`showDirectoryPicker`), rekursives Schreiben                              | Task 6, 9                               |
| 11 ZIP ueber `fflate`, vollstaendige Hierarchie, als Fallback und Alternative                        | Task 6, 9                               |
| 11 Fehlt die Directory-API: ZIP primaer, Einzeiler erklaert den Grund                                | Task 8, 9                               |
| 11 Export einzelner Outputs/Ordner/Workspace, Fortschritt und Abbruch, Plan als Baum vor dem Start   | Task 7, 8, 9                            |
| 8 Assembler laedt jede Quelle beim Export einmal                                                     | Task 7 (nutzt den Assembler aus Plan 2) |
| 12 Akzeptanzszenario bis zum ZIP als Playwright-Flow                                                 | Task 10                                 |
| 14 pdf.js-Worker/Assets aus dem Bundle, kein externer Request                                        | Task 3 (Worker), aus Plan 2 uebernommen |
| 15 Adapter/Assembler-Tests, Playwright-Flow, Domain per TDD                                          | Task 6-10 plus Plan 1-3                 |

Bewusst nicht in Phase 1 (aus Abschnitt 13 der Spezifikation), hier nur bestaetigt: Bookmark-Navigation im UI (die Outline wird schon gelesen), Export-Review mit Warnungsanalyse (der Plan wird gezeigt, nicht analysiert), Papierkorb, Command Palette, ZIP-Import, PWA/Offline, OCR, weitere Formate.

## Phase 1 abgeschlossen

Mit diesem Plan ist Phase 1 vollstaendig: die getestete Domain (Plan 1), die PDF-Engine mit Persistenz und Import (Plan 2), die Arbeitsflaeche mit Store, Selektion, Rastern, Baum und Drag (Plan 3) und schliesslich Preview, Suche und Export (Plan 4). Das Akzeptanzszenario aus Abschnitt 12 laeuft von Hand und im Playwright-Test von Import bis ZIP durch, ohne dass zu irgendeinem Zeitpunkt eine Zwischendatei entsteht. Die in der Architektur angelegten Naehte fuer Phase 2 -- weitere Quellformate ueber die Adapter-Registry, der `contentHash` fuer die Duplikaterkennung, die Outline-Daten fuer die Kapitelnavigation, `schemaVersion` fuer Migrationen -- bleiben unberuehrt und einsatzbereit.
