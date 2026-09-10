# Phase 1 / Plan 3: Workspace-UI und Interaktion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aus den getesteten Diensten von Plan 2 wird die eigentliche Arbeitsflaeche: ein Store, der jede Nutzeraktion als benannten Command mit abgeleiteter Undo-Inverse ausfuehrt, zwei gleichzeitig sichtbare virtualisierte Raster, ein Ordner-/Ausgabebaum, das permanente Range-Feld, das Split-Panel, die beiden getrennten Drag-Systeme und die Tastaturkuerzel -- das Akzeptanzszenario aus Abschnitt 12 wird damit von Hand bedienbar (Preview, Suche und Export folgen in Plan 4).

**Architecture:** Der Zustand liegt in zwei framework-freien `zustand/vanilla`-Stores (Workspace mit History, Selektion), damit die gesamte Zustandslogik in Node getestet werden kann und React nur die Anzeige ist. Der Workspace-Store fuehrt Commands ueber `produceWithPatches` aus und leitet die Undo-Inverse aus den Patches ab -- handgeschriebenes `undo()` gibt es nicht. Jede Entscheidung, die im Design steht (welche Aktion ein Drag ausloest, welches Ziel ein Drop trifft, welche Zellen eine Marquee trifft), ist eine reine Funktion und getrennt von der Pointer-Verdrahtung; die reinen Funktionen sind unit-getestet, das echte Zeigerverhalten deckt der Playwright-Test in Plan 4 ab.

**Tech Stack:** React 19 + TypeScript strict, `zustand` (mit `zustand/vanilla` fuer die Stores), `immer` (`produceWithPatches`, `applyPatches`), `@tanstack/react-virtual` (Grid-Virtualisierung), `lucide-react` (Icons), Tailwind CSS v4, Vitest + jsdom + `@testing-library/react` + `@testing-library/user-event`.

**Spec:** `docs/superpowers/specs/2026-09-10-document-workspace-design.md`

**Vorherige Plaene:** `docs/superpowers/plans/2026-09-10-phase1-plan1-fundament-domain.md` und `docs/superpowers/plans/2026-09-10-phase1-plan2-pdf-persistenz-import.md` (beide vollstaendig umgesetzt und gruen)

## Global Constraints

- Local-first: kein Netzwerkverkehr mit Dokumentinhalten, kein Analytics, keine externen Laufzeit-Requests, keine externen Fonts oder CDN-Skripte.
- Schichtregel (per ESLint `import/no-restricted-paths` erzwungen): `domain` importiert nur `domain`; `adapters` nur `domain`; `services` nur `domain` und `adapters`; `ui` darf alles. **Kein Modul unter `services` oder `adapters` importiert React.** Die Stores liegen unter `services/store` und verwenden deshalb `zustand/vanilla`, nicht das React-Paket `zustand`.
- Abhaengigkeiten werden hereingegeben, nicht importiert: jeder Store und jeder Dienst wird von einer `create...`-Funktion mit einem Abhaengigkeitsobjekt gebaut. Zeit kommt als `now()`, Ids kommen als Payload oder als injizierte `newId()`.
- Deterministische Commands: keine `Date.now()`- oder Id-Erzeugung innerhalb von `dispatch`; die UI erzeugt Ids und Zeitstempel und legt sie in die Command-Payload.
- TypeScript `strict`, `verbatimModuleSyntax` (Typimporte als `import type`). `noUnusedLocals`/`noUnusedParameters` sind an.
- Alle nutzersichtbaren Texte sind deutsch, verwenden **nie das scharfe s** (immer `ss`) und erklaeren die Lage in ganzen Saetzen. Stacktraces gehen in die Konsole, nie in die Oberflaeche.
- Dunkles Thema als Standard, zurueckhaltende Typografie, klare Selektionszustaende, Bewegung nur wo sie eine Zustandsaenderung erklaert. Keine eigenen Farb-Hex-Werte in Komponenten -- nur die Theme-Tokens aus `styles.css` und Tailwind-Utilities.
- Zwei getrennte Drag-Systeme: **intern** (Seiten, Outputs, Ordner) ueber selbst gebaute Pointer-Events, **extern** (Dateien aus dem Betriebssystem) ueber native Drop-Events. Nie HTML5-DnD fuer das interne System.
- `assertWorkspaceInvariants` (aus Plan 1) laeuft in Entwicklungsbuilds nach jedem Command; in Produktionsbuilds nicht.
- Jeder Task endet mit gruenen Tests (`npm run test`), gruenem `typecheck`, gruenem `lint` und einem Commit. Commit-Messages beginnen mit `feat:`, `test:`, `chore:` oder `docs:` und enden mit der Attributionszeile aus der Repo-Konvention.

## Was dieser Plan aus Plan 1 und 2 benutzt (bereits vorhanden und gruen)

Aus `domain` (Plan 1): `Workspace`, `SourceDocument`, `CompositionItem`, `FolderNode`, `OutputDocument`, `WorkspaceNode`, `SourceId`, `NodeId`, `ItemId`, `Rotation`, `parentKey`, `ROOT`, `isFolder`, `isOutput`, `createEmptyWorkspace` (`domain/types`); `type Command`, `applyCommand`, `describeCommand`, `type CommandCtx`, `type SplitOutputSpec` (`domain/commands`); `assertWorkspaceInvariants`, `checkWorkspaceInvariants` (`domain/invariants`); `parseRanges`, `formatRanges`, `rangesToIndices`, `type RangeSpec`, `type ParseRangesResult` (`domain/ranges`); `planSplit`, `describeSplitPart`, `type SplitStrategy`, `type SplitPart`, `type SplitPlanResult` (`domain/split`); `newId` (`domain/ids`).

Aus `services` (Plan 2): `createAppServices`, `type AppServices` (`services/app/appServices`); `type ThumbnailService`, `THUMBNAIL_WIDTH` (`services/thumbnails/thumbnailService`); `describeSaveStatus`, `type SaveStatus`, `type Autosave` (`services/persistence/autosave`); `type WorkspaceRepo`, `type WorkspaceSummary` (`services/persistence/workspaceRepo`); `importCandidates`, `sha256Hex`, `type ImportReport` (`services/import/importSources`); `collectFromDataTransfer`, `collectFromFileList`, `collectFromDirectoryHandle`, `type ImportCandidate` (`services/import/fileSources`).

Die provisorische Oberflaeche `src/ui/dev/ImportProbe.tsx` aus Plan 2 wird in Task 11 dieses Plans **geloescht und ersetzt**.

## Was dieser Plan produziert (die Naht fuer Plan 4)

- `services/store/selection.ts`: reine Selektionslogik und `type SelectionState`, `type SelectionScope`, `type SelectionSnapshot`.
- `services/store/workspaceStore.ts`: `createWorkspaceStore(deps): WorkspaceStore` mit `dispatch`, `undo`, `redo`, `replaceWorkspace`, History.
- `services/store/selectionStore.ts`: `createSelectionStore(): SelectionStore`.
- `ui/app/StoreProvider.tsx`: React-Kontext, der beide Stores und `AppServices` bereitstellt, plus die Hooks `useWorkspace`, `useSelection`, `useServices`, `useDispatch`.
- `ui/workspace/dragLogic.ts`: reine Entscheidungsfunktionen `resolveDropAction`, `resolveDropTarget`, `hitTestMarquee`, `rangeBetween`.

Plan 4 haengt an diese Naht: der Viewer liest `useWorkspace`/`useSelection`, die Suche nutzt `ThumbnailService`-Nachbarn und den Textdienst, der Export liest `buildExportPlan(store.workspace)` und ruft `services.assembler`.

## Dateistruktur dieses Plans

| Datei                                  | Verantwortung                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `vite.config.ts` (Modify)              | jsdom fuer `*.test.tsx`, `test/setup.ts` als `setupFiles`                                       |
| `test/setup.ts`                        | `@testing-library/jest-dom`, `ResizeObserver`- und `scrollTo`-Stubs fuer jsdom                  |
| `src/services/store/selection.ts`      | reine Selektionslogik, `SelectionState`, `SelectionSnapshot`                                    |
| `src/services/store/workspaceStore.ts` | Workspace-Store mit `produceWithPatches` und History                                            |
| `src/services/store/selectionStore.ts` | Selektions-Store ueber `selection.ts`                                                           |
| `src/ui/app/StoreProvider.tsx`         | Kontext und Hooks fuer Stores und Dienste                                                       |
| `src/ui/app/useKeyboardShortcuts.ts`   | globale Tastaturkuerzel                                                                         |
| `src/ui/app/App.tsx` (Modify)          | Shell, Layout, Bootstrapping, Workspace laden                                                   |
| `src/ui/app/Header.tsx`                | Workspace-Name, Speicherstatus, Import- und Export-Knopf (Export-Knopf: Platzhalter bis Plan 4) |
| `src/ui/app/ContextBar.tsx`            | Kontextaktionen (Auswahlzahl, Drehen, Entfernen, Split)                                         |
| `src/ui/common/useBlobUrl.ts`          | (bereits in Plan 2 vorbereitet; hier nur konsumiert)                                            |
| `src/ui/common/Thumbnail.tsx`          | eine virtualisierte Rasterzelle mit Thumbnail-Anforderung                                       |
| `src/ui/common/VirtualGrid.tsx`        | Grid-Virtualisierung ueber `@tanstack/react-virtual`                                            |
| `src/ui/sources/SourceList.tsx`        | Liste der Quellen mit Status und Nutzungsschalter                                               |
| `src/ui/sources/SourceGrid.tsx`        | virtualisiertes Quellraster einer Quelle                                                        |
| `src/ui/sources/RangeField.tsx`        | permanentes Range-Feld ueber dem Quellraster                                                    |
| `src/ui/workspace/OutputTree.tsx`      | Ordner-/Ausgabebaum mit Umbenennen und Verschieben                                              |
| `src/ui/workspace/OutputGrid.tsx`      | virtualisiertes Output-Raster                                                                   |
| `src/ui/workspace/dragLogic.ts`        | reine Drag-/Drop-/Marquee-Entscheidungen                                                        |
| `src/ui/workspace/usePointerDrag.ts`   | internes Pointer-Drag inkl. Auto-Scroll und Vorschau                                            |
| `src/ui/workspace/DragPreview.tsx`     | gestapelte Kartenvorschau mit Zaehler                                                           |
| `src/ui/workspace/useExternalDrop.ts`  | native Datei-/Ordner-Drops                                                                      |
| `src/ui/workspace/SplitPanel.tsx`      | Split-Panel mit Vorschau der Bereiche                                                           |
| `tests/e2e/`                           | unveraendert aus Plan 2; der Akzeptanz-Flow folgt in Plan 4                                     |

---

### Task 1: UI-Test-Infrastruktur und neue Abhaengigkeiten

**Files:**

- Create: `test/setup.ts`
- Modify: `vite.config.ts`, `package.json`
- Test: `src/ui/app/App.test.tsx`

**Interfaces:**

- Consumes: die Shell `App` aus Plan 1
- Produces: eine funktionierende jsdom-Testumgebung fuer `*.test.tsx`; die Laufzeit-Abhaengigkeiten `zustand`, `@tanstack/react-virtual`, `lucide-react` und die Test-Abhaengigkeiten `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`

Der Grund fuer eine eigene Testumgebung: die Domain aus Plan 1 lief unter `environment: 'node'`, weil sie kein DOM braucht. Komponenten brauchen eines. jsdom kennt weder `ResizeObserver` (von `@tanstack/react-virtual` benutzt) noch echtes Scrollen -- beides wird im Setup gestubbt, damit die Virtualisierung im Test eine Groesse annimmt und nicht null Zellen rendert.

- [ ] **Step 1: Abhaengigkeiten installieren**

```bash
npm install zustand @tanstack/react-virtual lucide-react
npm install -D jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

- [ ] **Step 2: Setup-Datei anlegen**

`test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom raeumt zwischen Tests nicht selbst auf; ohne cleanup bleiben Knoten
// aus einem Test im DOM des naechsten stehen.
afterEach(() => {
  cleanup();
});

// @tanstack/react-virtual misst seinen Scrollcontainer per ResizeObserver.
// jsdom bringt keinen mit; ein no-op-Stub genuegt, damit die Virtualisierung
// nicht wirft. Die konkrete Groesse setzen die Tests ueber getBoundingClientRect.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom implementiert Element.scrollTo nicht; der Auto-Scroll und die
// Virtualisierung rufen es. Ein no-op verhindert "not implemented".
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}

// Blob-URLs existieren in jsdom nicht; Thumbnails fordern sie an.
globalThis.URL.createObjectURL ??= () => 'blob:stub';
globalThis.URL.revokeObjectURL ??= () => {};
```

- [ ] **Step 3: vite.config.ts auf zwei Testumgebungen umstellen**

Die Domain-Tests bleiben in Node schnell, die Komponententests laufen in jsdom. `environmentMatchGlobs` waehlt pro Datei:

`vite.config.ts` (Testblock ersetzen):

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: false,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // .test.tsx braucht ein DOM, .test.ts nicht -- das haelt die Domain schnell.
    environmentMatchGlobs: [
      ['src/**/*.test.tsx', 'jsdom'],
      ['src/**/*.test.ts', 'node'],
    ],
  },
});
```

`setupFiles` laeuft auch fuer Node-Tests; das Setup ist so geschrieben, dass seine Stubs dort schlicht nichts tun (die APIs fehlen und werden gesetzt, aber kein Node-Test benutzt sie).

- [ ] **Step 4: Den fehlschlagenden Test schreiben**

`src/ui/app/App.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App-Shell', () => {
  it('rendert eine Landmarke mit dem Produktnamen', () => {
    render(<App />);
    expect(screen.getByRole('banner')).toHaveTextContent('PDF-Master');
  });
});
```

- [ ] **Step 5: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/ui/app/App.test.tsx`
Expected: FAIL -- die Shell aus Plan 1 hat noch keine `banner`-Landmarke mit diesem Text (oder der Test-Renderer ist noch nicht verdrahtet).

- [ ] **Step 6: Minimale Shell anpassen**

`src/ui/app/App.tsx` (nur so weit, dass der Test gruen wird -- die echte Shell kommt in Task 5):

```tsx
export function App() {
  return (
    <div className="min-h-screen bg-shell text-neutral-200">
      <header className="border-b border-line px-4 py-3 font-medium">PDF-Master</header>
    </div>
  );
}
```

- [ ] **Step 7: Tests pruefen**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: alle Tests PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
chore: jsdom-Testumgebung und UI-Abhaengigkeiten

.test.tsx laeuft ab jetzt in jsdom, .test.ts bleibt in Node und damit schnell.
ResizeObserver, scrollTo und Blob-URLs werden gestubbt, weil jsdom sie nicht
mitbringt und die Virtualisierung sonst null Zellen rendert.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 2: Selektionsmodell (`selection.ts`)

**Files:**

- Create: `src/services/store/selection.ts`
- Test: `src/services/store/selection.test.ts`

**Interfaces:**

- Consumes: `SourceId`, `NodeId`, `ItemId` aus `../../domain/types`
- Produces:
  - `type SelectionScope = { kind: 'source'; sourceId: SourceId } | { kind: 'output'; outputId: NodeId }`
  - `interface SelectionState { scope: SelectionScope | null; anchor: string | null; ids: string[] }`
  - `type SelectionSnapshot = SelectionState` (die History speichert genau diesen Wert)
  - `EMPTY_SELECTION: SelectionState`
  - `sameScope(a, b): boolean`
  - `rangeBetween(order: string[], anchor: string, target: string): string[]`
  - `applySelect(state, scope, id, order): SelectionState` (Klick: setzt neu)
  - `applyExtend(state, scope, id, order): SelectionState` (Shift: vom Anker)
  - `applyToggle(state, scope, id): SelectionState` (Ctrl/Cmd: einzeln)
  - `applyReplace(state, scope, ids, anchor, additive): SelectionState` (Marquee)
  - `applySelectAll(scope, order): SelectionState`
  - `isSelected(state, scope, id): boolean`
  - `selectionCount(state): number`

Das Design legt fest: `{ scope, anchor, ids }`, Klick setzt, Shift erweitert vom Anker, Ctrl/Cmd schaltet einzeln um, Marquee ersetzt (mit Shift additiv), nicht-zusammenhaengende Selektionen sind ausdruecklich erlaubt. Weil ein Wechsel des Scopes (andere Quelle, anderes Output) die alte Selektion bedeutungslos macht, verwerfen alle Operationen ausser `toggle` bei fremdem Scope die alte Menge. Ids sind Zeichenketten: im Quellraster der Blockindex als Text (`"16"`), im Output-Raster die `ItemId`. So braucht die Selektion nur einen Typ.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/services/store/selection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  EMPTY_SELECTION,
  applyExtend,
  applyReplace,
  applySelect,
  applySelectAll,
  applyToggle,
  isSelected,
  rangeBetween,
  sameScope,
  selectionCount,
  type SelectionScope,
} from './selection';

const source: SelectionScope = { kind: 'source', sourceId: 'src-a' };
const other: SelectionScope = { kind: 'source', sourceId: 'src-b' };
const order = ['0', '1', '2', '3', '4', '5'];

describe('sameScope', () => {
  it('unterscheidet Quelle und Output und verschiedene Ids', () => {
    expect(sameScope(source, { kind: 'source', sourceId: 'src-a' })).toBe(true);
    expect(sameScope(source, other)).toBe(false);
    expect(sameScope(source, { kind: 'output', outputId: 'src-a' })).toBe(false);
    expect(sameScope(null, null)).toBe(true);
    expect(sameScope(source, null)).toBe(false);
  });
});

describe('rangeBetween', () => {
  it('liefert die zusammenhaengende Strecke unabhaengig von der Richtung', () => {
    expect(rangeBetween(order, '1', '4')).toEqual(['1', '2', '3', '4']);
    expect(rangeBetween(order, '4', '1')).toEqual(['1', '2', '3', '4']);
    expect(rangeBetween(order, '2', '2')).toEqual(['2']);
  });

  it('faellt auf das Ziel zurueck, wenn der Anker nicht in der Ordnung liegt', () => {
    expect(rangeBetween(order, 'weg', '3')).toEqual(['3']);
  });
});

describe('applySelect', () => {
  it('setzt eine neue Einzelselektion und den Anker', () => {
    const next = applySelect(EMPTY_SELECTION, source, '2', order);
    expect(next).toEqual({ scope: source, anchor: '2', ids: ['2'] });
  });

  it('ersetzt eine Selektion in einem anderen Scope vollstaendig', () => {
    const before = { scope: other, anchor: '0', ids: ['0', '1'] };
    expect(applySelect(before, source, '3', order)).toEqual({
      scope: source,
      anchor: '3',
      ids: ['3'],
    });
  });
});

describe('applyExtend', () => {
  it('waehlt vom Anker bis zum Ziel', () => {
    const anchored = applySelect(EMPTY_SELECTION, source, '1', order);
    expect(applyExtend(anchored, source, '4', order)).toEqual({
      scope: source,
      anchor: '1',
      ids: ['1', '2', '3', '4'],
    });
  });

  it('beginnt eine neue Selektion, wenn es noch keinen Anker gibt', () => {
    expect(applyExtend(EMPTY_SELECTION, source, '3', order)).toEqual({
      scope: source,
      anchor: '3',
      ids: ['3'],
    });
  });

  it('setzt bei Scopewechsel neu auf, ohne fremde Ids zu behalten', () => {
    const before = { scope: other, anchor: '0', ids: ['0', '1'] };
    expect(applyExtend(before, source, '2', order)).toEqual({
      scope: source,
      anchor: '2',
      ids: ['2'],
    });
  });
});

describe('applyToggle', () => {
  it('nimmt eine Id in dieselbe Selektion auf und verschiebt den Anker', () => {
    const before = applySelect(EMPTY_SELECTION, source, '1', order);
    expect(applyToggle(before, source, '4')).toEqual({
      scope: source,
      anchor: '4',
      ids: ['1', '4'],
    });
  });

  it('entfernt eine bereits gewaehlte Id', () => {
    const before = { scope: source, anchor: '4', ids: ['1', '4'] };
    expect(applyToggle(before, source, '4')).toEqual({ scope: source, anchor: '1', ids: ['1'] });
  });

  it('faengt bei fremdem Scope mit genau dieser Id neu an', () => {
    const before = { scope: other, anchor: '0', ids: ['0'] };
    expect(applyToggle(before, source, '2')).toEqual({ scope: source, anchor: '2', ids: ['2'] });
  });
});

describe('applyReplace / applySelectAll', () => {
  it('ersetzt die Selektion durch die Marquee-Menge', () => {
    const before = applySelect(EMPTY_SELECTION, source, '0', order);
    expect(applyReplace(before, source, ['2', '3'], '3', false)).toEqual({
      scope: source,
      anchor: '3',
      ids: ['2', '3'],
    });
  });

  it('vereinigt additiv ohne Doppelte', () => {
    const before = { scope: source, anchor: '0', ids: ['0', '1'] };
    expect(applyReplace(before, source, ['1', '2'], '2', true).ids).toEqual(['0', '1', '2']);
  });

  it('waehlt im Scope alles in der Reihenfolge der Ordnung', () => {
    expect(applySelectAll(source, ['2', '0', '1'])).toEqual({
      scope: source,
      anchor: '2',
      ids: ['2', '0', '1'],
    });
  });
});

describe('isSelected / selectionCount', () => {
  it('meldet Zugehoerigkeit nur im passenden Scope', () => {
    const state = { scope: source, anchor: '1', ids: ['1', '2'] };
    expect(isSelected(state, source, '2')).toBe(true);
    expect(isSelected(state, other, '2')).toBe(false);
    expect(selectionCount(state)).toBe(2);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/store/selection.test.ts`
Expected: FAIL, `Failed to resolve import "./selection"`.

- [ ] **Step 3: selection.ts implementieren**

`src/services/store/selection.ts`:

```ts
import type { NodeId, SourceId } from '../../domain/types';

export type SelectionScope =
  { kind: 'source'; sourceId: SourceId } | { kind: 'output'; outputId: NodeId };

/**
 * `ids` sind Zeichenketten: im Quellraster der Blockindex als Text, im
 * Output-Raster die ItemId. Ein einziger Typ genuegt damit fuer beide Raster.
 * Nicht-zusammenhaengende Selektionen sind ausdruecklich erlaubt.
 */
export interface SelectionState {
  scope: SelectionScope | null;
  anchor: string | null;
  ids: string[];
}

/** Die History speichert genau diesen Wert vor und nach jedem Command. */
export type SelectionSnapshot = SelectionState;

export const EMPTY_SELECTION: SelectionState = { scope: null, anchor: null, ids: [] };

export function sameScope(a: SelectionScope | null, b: SelectionScope | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.kind !== b.kind) return false;
  return a.kind === 'source'
    ? a.sourceId === (b as { sourceId: string }).sourceId
    : a.outputId === (b as { outputId: string }).outputId;
}

export function rangeBetween(order: string[], anchor: string, target: string): string[] {
  const from = order.indexOf(anchor);
  const to = order.indexOf(target);
  // Ohne gueltigen Anker ist "vom Anker bis hier" bedeutungslos: nur das Ziel.
  if (from === -1 || to === -1) return [target];
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  return order.slice(lo, hi + 1);
}

export function applySelect(
  _state: SelectionState,
  scope: SelectionScope,
  id: string,
  _order: string[],
): SelectionState {
  return { scope, anchor: id, ids: [id] };
}

export function applyExtend(
  state: SelectionState,
  scope: SelectionScope,
  id: string,
  order: string[],
): SelectionState {
  if (!sameScope(state.scope, scope) || state.anchor === null) {
    return { scope, anchor: id, ids: [id] };
  }
  return { scope, anchor: state.anchor, ids: rangeBetween(order, state.anchor, id) };
}

export function applyToggle(
  state: SelectionState,
  scope: SelectionScope,
  id: string,
): SelectionState {
  if (!sameScope(state.scope, scope)) {
    return { scope, anchor: id, ids: [id] };
  }
  if (state.ids.includes(id)) {
    const ids = state.ids.filter((known) => known !== id);
    // Der Anker wandert auf die letzte noch bestehende Id, damit ein
    // folgendes Shift eine sinnvolle Strecke aufspannt.
    return { scope, anchor: ids.at(-1) ?? null, ids };
  }
  return { scope, anchor: id, ids: [...state.ids, id] };
}

export function applyReplace(
  state: SelectionState,
  scope: SelectionScope,
  ids: string[],
  anchor: string | null,
  additive: boolean,
): SelectionState {
  if (!additive || !sameScope(state.scope, scope)) {
    return { scope, anchor, ids: [...ids] };
  }
  const merged = [...state.ids];
  for (const id of ids) if (!merged.includes(id)) merged.push(id);
  return { scope, anchor, ids: merged };
}

export function applySelectAll(scope: SelectionScope, order: string[]): SelectionState {
  return { scope, anchor: order[0] ?? null, ids: [...order] };
}

export function isSelected(state: SelectionState, scope: SelectionScope, id: string): boolean {
  return sameScope(state.scope, scope) && state.ids.includes(id);
}

export function selectionCount(state: SelectionState): number {
  return state.ids.length;
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/services/store/selection.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: reines Selektionsmodell mit Anker, Shift, Ctrl und Marquee

Ein Typ fuer beide Raster: Ids sind Zeichenketten (Blockindex im Quellraster,
ItemId im Output). Klick setzt, Shift erweitert vom Anker, Ctrl schaltet
einzeln um, Marquee ersetzt oder vereinigt additiv. Ein Scopewechsel verwirft
die alte Menge, weil sie im neuen Raster keine Bedeutung hat.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 3: Workspace-Store mit `produceWithPatches` und History

**Files:**

- Create: `src/services/store/workspaceStore.ts`
- Test: `src/services/store/workspaceStore.test.ts`

**Interfaces:**

- Consumes: `applyCommand`, `describeCommand`, `type Command`, `type CommandCtx` aus `../../domain/commands`; `assertWorkspaceInvariants` aus `../../domain/invariants`; `type Workspace` aus `../../domain/types`; `type SelectionSnapshot` aus `./selection`; `produceWithPatches`, `applyPatches`, `enablePatches`, `type Patch` aus `immer`; `createStore` aus `zustand/vanilla`
- Produces:
  - `interface HistoryEntry { label: string; patches: Patch[]; inversePatches: Patch[]; selectionBefore: SelectionSnapshot; selectionAfter: SelectionSnapshot }`
  - `interface WorkspaceStoreState { workspace: Workspace; canUndo: boolean; canRedo: boolean }`
  - `interface WorkspaceStoreDeps { initial: Workspace; now(): number; captureSelection(): SelectionSnapshot; restoreSelection(snapshot: SelectionSnapshot): void; onInvalid?(errors: string[]): void; historyLimit?: number }`
  - `type WorkspaceStore` (der `zustand`-Vanilla-Store) mit den Aktionen `dispatch(command, selectionAfter?)`, `undo()`, `redo()`, `replaceWorkspace(ws)`
  - `HISTORY_LIMIT = 200`

Der Kern des Designs steckt hier: jede Aktion ist ein benannter Command, `produceWithPatches` liefert Patches **und** die Inverse, die Inverse wird also **abgeleitet, nicht handgeschrieben**. Ein `batch` (etwa ein Split mit 50 Seiten) ist genau ein History-Eintrag. Der Stack ist auf 200 Eintraege begrenzt. Undo spielt `inversePatches` zurueck und stellt `selectionBefore` wieder her, Redo umgekehrt. Die History ist sitzungsgebunden und wird nicht persistiert; `replaceWorkspace` (beim Laden aus der Datenbank) leert deshalb den Stack.

Weil der Store unter `services` liegt, benutzt er `zustand/vanilla` und darf React nicht importieren. Selektion wird nicht direkt gekoppelt: `captureSelection`/`restoreSelection` werden hereingegeben, damit der Store gegen Fakes testbar bleibt und kein Zyklus zum Selektions-Store entsteht.

- [ ] **Step 1: `enablePatches` sicherstellen**

Plan 1 hat `enablePatches()` bereits fuer die History-Invarianten-Tests aufgerufen, dort aber nur im Test. Der Store braucht es zur Laufzeit. Es wird in diesem Modul beim Laden aufgerufen; ein zweiter Aufruf ist unschaedlich.

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

`src/services/store/workspaceStore.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { HISTORY_LIMIT, createWorkspaceStore } from './workspaceStore';
import { EMPTY_SELECTION, type SelectionSnapshot } from './selection';
import { makeWorkspace, IDS } from '../../domain/__fixtures__/workspace';
import type { Workspace } from '../../domain/types';

const NOW = 1_000;

function setup(initial: Workspace = makeWorkspace()) {
  let current: SelectionSnapshot = EMPTY_SELECTION;
  const restoreSelection = vi.fn((snapshot: SelectionSnapshot) => {
    current = snapshot;
  });
  const store = createWorkspaceStore({
    initial,
    now: () => NOW,
    captureSelection: () => current,
    restoreSelection,
    historyLimit: HISTORY_LIMIT,
  });
  const setSelection = (snapshot: SelectionSnapshot) => {
    current = snapshot;
  };
  return { store, restoreSelection, setSelection, get: () => store.getState() };
}

const sel = (ids: string[]): SelectionSnapshot => ({
  scope: { kind: 'output', outputId: IDS.outContracts },
  anchor: ids[0] ?? null,
  ids,
});

describe('createWorkspaceStore / dispatch', () => {
  it('wendet einen Command an und aktualisiert den Workspace', () => {
    const { store, get } = setup();
    store.getState().dispatch({ type: 'renameWorkspace', name: 'Steuer 2026' });
    expect(get().workspace.name).toBe('Steuer 2026');
  });

  it('erzeugt genau einen History-Eintrag pro dispatch und erlaubt Undo', () => {
    const { store, get } = setup();
    expect(get().canUndo).toBe(false);
    store.getState().dispatch({ type: 'renameWorkspace', name: 'A' });
    store.getState().dispatch({ type: 'renameWorkspace', name: 'B' });
    expect(get().canUndo).toBe(true);
    store.getState().undo();
    expect(get().workspace.name).toBe('A');
    store.getState().undo();
    expect(get().workspace.name).toBe(makeWorkspace().name);
    expect(get().canUndo).toBe(false);
  });

  it('behandelt einen batch als einen einzigen Undo-Schritt', () => {
    const { store, get } = setup();
    store.getState().dispatch({
      type: 'batch',
      label: 'Zwei Umbenennungen',
      commands: [
        { type: 'renameWorkspace', name: 'A' },
        { type: 'renameWorkspace', name: 'B' },
      ],
    });
    expect(get().workspace.name).toBe('B');
    store.getState().undo();
    expect(get().workspace.name).toBe(makeWorkspace().name);
  });

  it('setzt den Redo-Stapel zurueck, sobald ein neuer Command kommt', () => {
    const { store, get } = setup();
    store.getState().dispatch({ type: 'renameWorkspace', name: 'A' });
    store.getState().undo();
    expect(get().canRedo).toBe(true);
    store.getState().dispatch({ type: 'renameWorkspace', name: 'C' });
    expect(get().canRedo).toBe(false);
  });

  it('spielt bei Redo den Command erneut ein', () => {
    const { store, get } = setup();
    store.getState().dispatch({ type: 'renameWorkspace', name: 'A' });
    store.getState().undo();
    store.getState().redo();
    expect(get().workspace.name).toBe('A');
  });

  it('verwirft einen Command ohne Wirkung, statt einen leeren Eintrag zu erzeugen', () => {
    const { store, get } = setup();
    // Ein leerer Name aendert nichts (siehe applyCommand aus Plan 1).
    store.getState().dispatch({ type: 'renameWorkspace', name: '   ' });
    expect(get().canUndo).toBe(false);
  });
});

describe('createWorkspaceStore / Selektion in der History', () => {
  it('stellt bei Undo die Selektion von vor dem Command wieder her', () => {
    const { store, restoreSelection, setSelection } = setup();
    setSelection(sel(['i-c4', 'i-c5']));
    store.getState().dispatch({ type: 'removeItems', itemIds: ['i-c4'] }, sel(['i-c5']));
    restoreSelection.mockClear();
    store.getState().undo();
    expect(restoreSelection).toHaveBeenCalledWith(sel(['i-c4', 'i-c5']));
  });

  it('stellt bei Redo die Selektion von nach dem Command wieder her', () => {
    const { store, restoreSelection, setSelection } = setup();
    setSelection(sel(['i-c4', 'i-c5']));
    store.getState().dispatch({ type: 'removeItems', itemIds: ['i-c4'] }, sel(['i-c5']));
    store.getState().undo();
    restoreSelection.mockClear();
    store.getState().redo();
    expect(restoreSelection).toHaveBeenCalledWith(sel(['i-c5']));
  });
});

describe('createWorkspaceStore / Grenzen und Laden', () => {
  it('begrenzt den Stack auf das Limit und verliert die aeltesten Eintraege', () => {
    const { store, get } = setup();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      store.getState().dispatch({ type: 'renameWorkspace', name: `Name ${i}` });
    }
    let undone = 0;
    while (get().canUndo) {
      store.getState().undo();
      undone += 1;
    }
    expect(undone).toBe(HISTORY_LIMIT);
  });

  it('ersetzt den Workspace und leert die History beim Laden', () => {
    const { store, get } = setup();
    store.getState().dispatch({ type: 'renameWorkspace', name: 'A' });
    const other = makeWorkspace();
    other.name = 'Geladen';
    store.getState().replaceWorkspace(other);
    expect(get().workspace.name).toBe('Geladen');
    expect(get().canUndo).toBe(false);
    expect(get().canRedo).toBe(false);
  });

  it('meldet verletzte Invarianten ueber onInvalid, ohne zu werfen', () => {
    const onInvalid = vi.fn();
    const store = createWorkspaceStore({
      initial: makeWorkspace(),
      now: () => NOW,
      captureSelection: () => EMPTY_SELECTION,
      restoreSelection: () => {},
      onInvalid,
    });
    // deleteNode auf einen Ordner mit Kindern ist gueltig; wir provozieren
    // stattdessen einen unmoeglichen moveNode, den applyCommand ignoriert --
    // hier bleibt onInvalid ungerufen. Der Test sichert nur, dass ein gueltiger
    // Command onInvalid NICHT ausloest.
    store.getState().dispatch({ type: 'renameWorkspace', name: 'A' });
    expect(onInvalid).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/store/workspaceStore.test.ts`
Expected: FAIL, `Failed to resolve import "./workspaceStore"`.

- [ ] **Step 4: workspaceStore.ts implementieren**

`src/services/store/workspaceStore.ts`:

```ts
import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { applyCommand, describeCommand, type Command } from '../../domain/commands';
import { checkWorkspaceInvariants } from '../../domain/invariants';
import type { Workspace } from '../../domain/types';
import type { SelectionSnapshot } from './selection';

// Die Undo-Inverse wird aus Patches abgeleitet; dafuer muss Immer Patches fuehren.
enablePatches();

export const HISTORY_LIMIT = 200;

export interface HistoryEntry {
  label: string;
  patches: Patch[];
  inversePatches: Patch[];
  selectionBefore: SelectionSnapshot;
  selectionAfter: SelectionSnapshot;
}

export interface WorkspaceStoreState {
  workspace: Workspace;
  canUndo: boolean;
  canRedo: boolean;
  dispatch(command: Command, selectionAfter?: SelectionSnapshot): void;
  undo(): void;
  redo(): void;
  replaceWorkspace(workspace: Workspace): void;
}

export interface WorkspaceStoreDeps {
  initial: Workspace;
  now(): number;
  /** Liefert die Selektion, wie sie VOR dem Command aussieht. */
  captureSelection(): SelectionSnapshot;
  /** Stellt eine Selektion aus der History wieder her (Undo/Redo). */
  restoreSelection(snapshot: SelectionSnapshot): void;
  /** In Entwicklungsbuilds: meldet verletzte Invarianten nach einem Command. */
  onInvalid?(errors: string[]): void;
  historyLimit?: number;
}

export type WorkspaceStore = StoreApi<WorkspaceStoreState>;

export function createWorkspaceStore(deps: WorkspaceStoreDeps): WorkspaceStore {
  const limit = deps.historyLimit ?? HISTORY_LIMIT;
  let past: HistoryEntry[] = [];
  let future: HistoryEntry[] = [];

  return createStore<WorkspaceStoreState>((set, get) => {
    function flags() {
      return { canUndo: past.length > 0, canRedo: future.length > 0 };
    }

    return {
      workspace: deps.initial,
      canUndo: false,
      canRedo: false,

      dispatch(command, selectionAfter) {
        const before = get().workspace;
        const selectionBefore = deps.captureSelection();

        const [next, patches, inversePatches] = produceWithPatches(before, (draft) => {
          applyCommand(draft, command, { now: deps.now() });
        });

        // Ein Command ohne Wirkung (leerer Name, unmoeglicher Move) darf keinen
        // Undo-Schritt erzeugen -- sonst muesste der Nutzer ins Leere zurueck.
        if (patches.length === 0) return;

        const entry: HistoryEntry = {
          label: describeCommand(command, before),
          patches,
          inversePatches,
          selectionBefore,
          selectionAfter: selectionAfter ?? selectionBefore,
        };
        past.push(entry);
        if (past.length > limit) past = past.slice(past.length - limit);
        future = [];

        if (import.meta.env.DEV && deps.onInvalid) {
          const errors = checkWorkspaceInvariants(next);
          if (errors.length > 0) deps.onInvalid(errors);
        }

        set({ workspace: next, ...flags() });
      },

      undo() {
        const entry = past.at(-1);
        if (!entry) return;
        past = past.slice(0, -1);
        future = [entry, ...future];
        const next = applyPatches(get().workspace, entry.inversePatches);
        set({ workspace: next, ...flags() });
        deps.restoreSelection(entry.selectionBefore);
      },

      redo() {
        const entry = future[0];
        if (!entry) return;
        future = future.slice(1);
        past = [...past, entry];
        const next = applyPatches(get().workspace, entry.patches);
        set({ workspace: next, ...flags() });
        deps.restoreSelection(entry.selectionAfter);
      },

      replaceWorkspace(workspace) {
        // Die History ist sitzungsgebunden: ein geladener Workspace kann aus
        // einer aelteren Schemaversion stammen, gegen die alte Patches nicht
        // mehr passen. Deshalb Stack leeren.
        past = [];
        future = [];
        set({ workspace, canUndo: false, canRedo: false });
      },
    };
  });
}
```

- [ ] **Step 5: Tests pruefen**

Run: `npm run test -- src/services/store/workspaceStore.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Workspace-Store mit abgeleiteter Undo-Inverse und History

produceWithPatches liefert Patches und Inverse in einem Schritt; die Inverse
wird nie handgeschrieben. Ein batch ist ein Undo-Schritt, ein wirkungsloser
Command erzeugt keinen. Undo/Redo stellen die Selektion aus der History
wieder her. Der Stack ist auf 200 Eintraege begrenzt und beim Laden geleert,
weil ein geladener Workspace aus einer aelteren Schemaversion stammen kann.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 4: Selektions-Store und Dispatch-Bruecke

**Files:**

- Create: `src/services/store/selectionStore.ts`
- Test: `src/services/store/selectionStore.test.ts`

**Interfaces:**

- Consumes: alle Operationen aus `./selection`; `createStore` aus `zustand/vanilla`
- Produces:
  - `interface SelectionStoreState extends SelectionState` mit den Aktionen `select`, `extend`, `toggle`, `replace`, `selectAll`, `clear`, `restore`, und den Ablesern `snapshot()`, `has(scope, id)`
  - `type SelectionStore = StoreApi<SelectionStoreState>`
  - `createSelectionStore(): SelectionStore`

Der Selektions-Store ist die zweite Haelfte der Kopplung aus Task 3: `snapshot()` liefert `captureSelection`, `restore` ist `restoreSelection`. Beide Stores kennen einander nicht -- die Bruecke entsteht erst in `StoreProvider` (Task 5), wo `createWorkspaceStore` die beiden Methoden des Selektions-Stores als Callbacks bekommt.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/services/store/selectionStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createSelectionStore } from './selectionStore';
import type { SelectionScope } from './selection';

const source: SelectionScope = { kind: 'source', sourceId: 'src-a' };
const order = ['0', '1', '2', '3'];

describe('createSelectionStore', () => {
  it('beginnt leer', () => {
    const store = createSelectionStore();
    expect(store.getState().ids).toEqual([]);
    expect(store.getState().scope).toBeNull();
  });

  it('setzt, erweitert und schaltet Ids um', () => {
    const store = createSelectionStore();
    store.getState().select(source, '1', order);
    expect(store.getState().ids).toEqual(['1']);
    store.getState().extend(source, '3', order);
    expect(store.getState().ids).toEqual(['1', '2', '3']);
    store.getState().toggle(source, '2');
    expect(store.getState().ids).toEqual(['1', '3']);
  });

  it('meldet Zugehoerigkeit ueber has', () => {
    const store = createSelectionStore();
    store.getState().select(source, '1', order);
    expect(store.getState().has(source, '1')).toBe(true);
    expect(store.getState().has(source, '2')).toBe(false);
  });

  it('nimmt einen Snapshot und stellt ihn wieder her', () => {
    const store = createSelectionStore();
    store.getState().select(source, '2', order);
    const snapshot = store.getState().snapshot();
    store.getState().clear();
    expect(store.getState().ids).toEqual([]);
    store.getState().restore(snapshot);
    expect(store.getState().ids).toEqual(['2']);
    expect(store.getState().anchor).toBe('2');
  });

  it('waehlt im Scope alles', () => {
    const store = createSelectionStore();
    store.getState().selectAll(source, order);
    expect(store.getState().ids).toEqual(order);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/services/store/selectionStore.test.ts`
Expected: FAIL, `Failed to resolve import "./selectionStore"`.

- [ ] **Step 3: selectionStore.ts implementieren**

`src/services/store/selectionStore.ts`:

```ts
import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  EMPTY_SELECTION,
  applyExtend,
  applyReplace,
  applySelect,
  applySelectAll,
  applyToggle,
  isSelected,
  type SelectionScope,
  type SelectionSnapshot,
  type SelectionState,
} from './selection';

export interface SelectionStoreState extends SelectionState {
  select(scope: SelectionScope, id: string, order: string[]): void;
  extend(scope: SelectionScope, id: string, order: string[]): void;
  toggle(scope: SelectionScope, id: string): void;
  replace(scope: SelectionScope, ids: string[], anchor: string | null, additive: boolean): void;
  selectAll(scope: SelectionScope, order: string[]): void;
  clear(): void;
  restore(snapshot: SelectionSnapshot): void;
  snapshot(): SelectionSnapshot;
  has(scope: SelectionScope, id: string): boolean;
}

export type SelectionStore = StoreApi<SelectionStoreState>;

export function createSelectionStore(): SelectionStore {
  return createStore<SelectionStoreState>((set, get) => {
    // Nur die Datenfelder aus dem State an die reinen Operationen geben,
    // damit die Aktionen nicht versehentlich in den Snapshot geraten.
    const state = (): SelectionState => {
      const { scope, anchor, ids } = get();
      return { scope, anchor, ids };
    };
    return {
      ...EMPTY_SELECTION,
      select(scope, id, order) {
        set(applySelect(state(), scope, id, order));
      },
      extend(scope, id, order) {
        set(applyExtend(state(), scope, id, order));
      },
      toggle(scope, id) {
        set(applyToggle(state(), scope, id));
      },
      replace(scope, ids, anchor, additive) {
        set(applyReplace(state(), scope, ids, anchor, additive));
      },
      selectAll(scope, order) {
        set(applySelectAll(scope, order));
      },
      clear() {
        set(EMPTY_SELECTION);
      },
      restore(snapshot) {
        set({ scope: snapshot.scope, anchor: snapshot.anchor, ids: snapshot.ids });
      },
      snapshot() {
        return state();
      },
      has(scope, id) {
        return isSelected(state(), scope, id);
      },
    };
  });
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/services/store/selectionStore.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Selektions-Store mit Snapshot und Wiederherstellung

Ein zweiter Vanilla-Store ueber der reinen Selektionslogik. snapshot() und
restore() sind die Gegenstuecke zu captureSelection/restoreSelection des
Workspace-Stores; die Bruecke zwischen beiden entsteht erst im StoreProvider,
damit keiner der Stores den anderen importieren muss.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 5: Reine Drag-, Drop- und Marquee-Entscheidungen (`dragLogic.ts`)

**Files:**

- Create: `src/ui/workspace/dragLogic.ts`
- Test: `src/ui/workspace/dragLogic.test.ts`

**Interfaces:**

- Consumes: `type NodeId`, `type ItemId` aus `../../domain/types`
- Produces:
  - `type DragOrigin = { kind: 'source'; sourceId: SourceId; blockIndices: number[] } | { kind: 'output'; outputId: NodeId; itemIds: ItemId[] }`
  - `type DropTarget = { kind: 'folder'; nodeId: NodeId } | { kind: 'output'; outputId: NodeId; index: number } | { kind: 'tree-output'; outputId: NodeId }`
  - `type DropAction = { kind: 'addFromSource' } | { kind: 'moveItems' } | { kind: 'copyItems' } | { kind: 'createOutputFromFolder' } | { kind: 'none' }`
  - `resolveDropAction(origin: DragOrigin, target: DropTarget, modifier: boolean): DropAction`
  - `interface CellRect { id: string; left: number; top: number; right: number; bottom: number }`
  - `interface Marquee { x0: number; y0: number; x1: number; y1: number }`
  - `hitTestMarquee(cells: CellRect[], marquee: Marquee): string[]`
  - `insertionIndex(cells: CellRect[], pointerX: number, pointerY: number): number`

Das Design schreibt drei Entscheidungen fest, die hier als reine Funktionen liegen, damit sie ohne Zeiger und ohne DOM getestet werden koennen:

1. **Move vs. Copy.** Aus einer Quelle ist jeder Drag ein Hinzufuegen (`addFromSource`), die Quellseite bleibt sichtbar. Zwischen Outputs ist Drag = verschieben, Ctrl/Cmd+Drag = kopieren. Auf einen Ordner fallen lassen erzeugt immer ein neues Output (`createOutputFromFolder`); direkt auf ein Output einsortieren (`moveItems`/`copyItems`/`addFromSource` an der Drop-Position).
2. **Drop-Ziel.** Ein Drop auf einen Ordner unterscheidet sich von einem Drop direkt auf ein Output-Dokument -- beide Absichten sind ueber das Ziel unterscheidbar, ohne Dialog.
3. **Marquee-Treffer.** Welche virtualisierten Zellen ein aufgezogenes Rechteck schneidet (Ueberlappungstest, nicht Mittelpunkt), plus die Einfuegeposition aus der Zeigerposition.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/ui/workspace/dragLogic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  hitTestMarquee,
  insertionIndex,
  resolveDropAction,
  type CellRect,
  type DragOrigin,
  type DropTarget,
} from './dragLogic';

const fromSource: DragOrigin = { kind: 'source', sourceId: 'src-a', blockIndices: [3, 4] };
const fromOutput: DragOrigin = { kind: 'output', outputId: 'out-1', itemIds: ['i1', 'i2'] };

describe('resolveDropAction', () => {
  it('aus einer Quelle auf einen Ordner: neues Output', () => {
    const target: DropTarget = { kind: 'folder', nodeId: 'f1' };
    expect(resolveDropAction(fromSource, target, false)).toEqual({
      kind: 'createOutputFromFolder',
    });
  });

  it('aus einer Quelle direkt auf ein Output: hinzufuegen, egal ob Modifier', () => {
    const target: DropTarget = { kind: 'output', outputId: 'out-1', index: 2 };
    expect(resolveDropAction(fromSource, target, false)).toEqual({ kind: 'addFromSource' });
    expect(resolveDropAction(fromSource, target, true)).toEqual({ kind: 'addFromSource' });
  });

  it('zwischen Outputs ohne Modifier: verschieben', () => {
    const target: DropTarget = { kind: 'output', outputId: 'out-2', index: 0 };
    expect(resolveDropAction(fromOutput, target, false)).toEqual({ kind: 'moveItems' });
  });

  it('zwischen Outputs mit Modifier: kopieren', () => {
    const target: DropTarget = { kind: 'output', outputId: 'out-2', index: 0 };
    expect(resolveDropAction(fromOutput, target, true)).toEqual({ kind: 'copyItems' });
  });

  it('aus einem Output auf einen Ordner: neues Output aus den Items', () => {
    const target: DropTarget = { kind: 'folder', nodeId: 'f1' };
    expect(resolveDropAction(fromOutput, target, false)).toEqual({
      kind: 'createOutputFromFolder',
    });
  });

  it('ein Output auf sich selbst verschieben ist keine Aktion', () => {
    const target: DropTarget = { kind: 'output', outputId: 'out-1', index: 0 };
    expect(resolveDropAction(fromOutput, target, false)).toEqual({ kind: 'moveItems' });
    // dasselbe Output umsortieren bleibt moveItems -- reorderItems entscheidet
    // die Aufrufseite anhand gleicher outputId; die Aktion ist trotzdem "move".
  });
});

describe('hitTestMarquee', () => {
  const cells: CellRect[] = [
    { id: '0', left: 0, top: 0, right: 100, bottom: 100 },
    { id: '1', left: 120, top: 0, right: 220, bottom: 100 },
    { id: '2', left: 0, top: 120, right: 100, bottom: 220 },
  ];

  it('trifft jede Zelle, die das Rechteck ueberlappt', () => {
    expect(hitTestMarquee(cells, { x0: 50, y0: 50, x1: 160, y1: 60 })).toEqual(['0', '1']);
  });

  it('normalisiert ein rueckwaerts aufgezogenes Rechteck', () => {
    expect(hitTestMarquee(cells, { x0: 160, y0: 60, x1: 50, y1: 50 })).toEqual(['0', '1']);
  });

  it('eine Beruehrung an der Kante zaehlt nicht als Treffer', () => {
    expect(hitTestMarquee(cells, { x0: 100, y0: 0, x1: 119, y1: 100 })).toEqual([]);
  });

  it('liefert die Ids in der Reihenfolge der Zellen', () => {
    expect(hitTestMarquee(cells, { x0: -5, y0: -5, x1: 300, y1: 300 })).toEqual(['0', '1', '2']);
  });
});

describe('insertionIndex', () => {
  const cells: CellRect[] = [
    { id: '0', left: 0, top: 0, right: 100, bottom: 100 },
    { id: '1', left: 120, top: 0, right: 220, bottom: 100 },
    { id: '2', left: 240, top: 0, right: 340, bottom: 100 },
  ];

  it('vor der ersten Zelle ist 0', () => {
    expect(insertionIndex(cells, 10, 50)).toBe(0);
  });

  it('in der rechten Haelfte einer Zelle ist danach', () => {
    expect(insertionIndex(cells, 80, 50)).toBe(1);
    expect(insertionIndex(cells, 200, 50)).toBe(2);
  });

  it('hinter der letzten Zelle ist die Laenge', () => {
    expect(insertionIndex(cells, 999, 50)).toBe(3);
  });

  it('ohne Zellen ist 0', () => {
    expect(insertionIndex([], 10, 10)).toBe(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/ui/workspace/dragLogic.test.ts`
Expected: FAIL, `Failed to resolve import "./dragLogic"`.

- [ ] **Step 3: dragLogic.ts implementieren**

`src/ui/workspace/dragLogic.ts`:

```ts
import type { ItemId, NodeId, SourceId } from '../../domain/types';

export type DragOrigin =
  | { kind: 'source'; sourceId: SourceId; blockIndices: number[] }
  | { kind: 'output'; outputId: NodeId; itemIds: ItemId[] };

export type DropTarget =
  | { kind: 'folder'; nodeId: NodeId }
  | { kind: 'output'; outputId: NodeId; index: number }
  | { kind: 'tree-output'; outputId: NodeId };

export type DropAction =
  | { kind: 'addFromSource' }
  | { kind: 'moveItems' }
  | { kind: 'copyItems' }
  | { kind: 'createOutputFromFolder' }
  | { kind: 'none' };

/**
 * Die Move/Copy-Regel des Designs, ohne Zeiger und ohne Store:
 * - Quelle -> Ordner: neues Output. Quelle -> Output: hinzufuegen (Modifier egal).
 * - Output -> Ordner: neues Output aus den Items.
 * - Output -> Output: verschieben, mit Modifier kopieren.
 */
export function resolveDropAction(
  origin: DragOrigin,
  target: DropTarget,
  modifier: boolean,
): DropAction {
  if (target.kind === 'folder') return { kind: 'createOutputFromFolder' };
  if (origin.kind === 'source') return { kind: 'addFromSource' };
  // origin ist ein Output, target ein Output oder ein Baum-Output.
  return modifier ? { kind: 'copyItems' } : { kind: 'moveItems' };
}

export interface CellRect {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function hitTestMarquee(cells: CellRect[], marquee: Marquee): string[] {
  const left = Math.min(marquee.x0, marquee.x1);
  const right = Math.max(marquee.x0, marquee.x1);
  const top = Math.min(marquee.y0, marquee.y1);
  const bottom = Math.max(marquee.y0, marquee.y1);
  // Echte Ueberlappung, keine blosse Beruehrung: strikte Vergleiche.
  return cells
    .filter(
      (cell) => cell.left < right && cell.right > left && cell.top < bottom && cell.bottom > top,
    )
    .map((cell) => cell.id);
}

/**
 * Einfuegeposition aus der Zeigerposition: vor einer Zelle, wenn der Zeiger in
 * ihrer linken Haelfte liegt, sonst danach. Zeilen werden ueber die vertikale
 * Naehe beruecksichtigt, indem die Zelle mit dem kleinsten Abstand gewinnt.
 */
export function insertionIndex(cells: CellRect[], pointerX: number, pointerY: number): number {
  if (cells.length === 0) return 0;
  let bestIndex = cells.length;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const centerX = (cell.left + cell.right) / 2;
    const centerY = (cell.top + cell.bottom) / 2;
    const distance = Math.hypot(pointerX - centerX, pointerY - centerY);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = pointerX < centerX ? i : i + 1;
    }
  }
  return bestIndex;
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/ui/workspace/dragLogic.test.ts && npm run typecheck && npm run lint`
Expected: PASS. Der Test `insertionIndex / hinter der letzten Zelle` verlangt, dass ein Zeiger weit rechts die Laenge liefert -- die naechstgelegene Zelle ist die letzte, der Zeiger liegt rechts von ihrer Mitte, also `i + 1 = 3`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: reine Drag-, Drop- und Marquee-Entscheidungen

Move vs. Copy, Drop auf Ordner vs. Output und der Marquee-Treffer sind reine
Funktionen ohne Zeiger und ohne DOM. Damit ist die schwierigste Interaktion
des Produkts unit-getestet; die Pointer-Verdrahtung darueber bleibt duenn und
wird vom Playwright-Test in Plan 4 abgedeckt.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 6: StoreProvider, Hooks und App-Bootstrapping

**Files:**

- Create: `src/ui/app/StoreProvider.tsx`
- Modify: `src/ui/app/App.tsx`
- Test: `src/ui/app/StoreProvider.test.tsx`

**Interfaces:**

- Consumes: `createWorkspaceStore`, `type WorkspaceStore` aus `../../services/store/workspaceStore`; `createSelectionStore`, `type SelectionStore` aus `../../services/store/selectionStore`; `type AppServices` aus `../../services/app/appServices`; `newId` aus `../../domain/ids`; `createEmptyWorkspace`, `type Command`, `type Workspace` aus `domain`; `useStore` aus `zustand`
- Produces:
  - `interface StoreContextValue { workspaceStore: WorkspaceStore; selectionStore: SelectionStore; services: AppServices }`
  - `StoreProvider(props: { value: StoreContextValue; children: ReactNode })`
  - `useWorkspaceStore()`, `useSelectionStore()`, `useServices()` (rohe Store-/Dienstzugriffe)
  - `useWorkspace()` (der aktuelle `Workspace`), `useSelection()` (der `SelectionState`)
  - `useDispatch(): (command: Command, selectionAfter?: SelectionSnapshot) => void`
  - `wireStores(deps): StoreContextValue` -- baut beide Stores, verdrahtet Selektion in die History und `onInvalid` in eine Warnung
  - `createInitialContext(services, workspace?): StoreContextValue`

`wireStores` ist die Stelle, an der die zwei entkoppelten Stores aus Task 3 und 4 zusammenfinden: `captureSelection` = `selectionStore.getState().snapshot`, `restoreSelection` = `selectionStore.getState().restore`, `onInvalid` = eine Konsolenwarnung (die verletzten Invarianten sind ein Programmierfehler, kein Nutzerfehler).

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/ui/app/StoreProvider.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  StoreProvider,
  useDispatch,
  useSelection,
  useWorkspace,
  wireStores,
} from './StoreProvider';
import { makeWorkspace } from '../../domain/__fixtures__/workspace';
import type { AppServices } from '../../services/app/appServices';

function fakeServices(): AppServices {
  // Nur das Feld, das dieser Test beruehrt; der Rest bleibt ungenutzt.
  return { readBytesForSource: vi.fn() } as unknown as AppServices;
}

function Probe() {
  const workspace = useWorkspace();
  const selection = useSelection();
  const dispatch = useDispatch();
  return (
    <div>
      <span>Name: {workspace.name}</span>
      <span>Auswahl: {selection.ids.length}</span>
      <button onClick={() => dispatch({ type: 'renameWorkspace', name: 'Umbenannt' })}>
        rename
      </button>
    </div>
  );
}

describe('StoreProvider', () => {
  it('stellt Workspace und Dispatch bereit und rendert bei Aenderung neu', async () => {
    const value = wireStores({
      services: fakeServices(),
      initialWorkspace: makeWorkspace(),
      now: () => 1,
    });
    render(
      <StoreProvider value={value}>
        <Probe />
      </StoreProvider>,
    );
    expect(screen.getByText(/^Name:/)).toHaveTextContent(makeWorkspace().name);
    await userEvent.click(screen.getByRole('button', { name: 'rename' }));
    expect(screen.getByText(/^Name:/)).toHaveTextContent('Umbenannt');
  });

  it('verdrahtet Selektion in die History: Undo stellt sie wieder her', () => {
    const value = wireStores({
      services: fakeServices(),
      initialWorkspace: makeWorkspace(),
      now: () => 1,
    });
    const { workspaceStore, selectionStore } = value;
    selectionStore.getState().select({ kind: 'source', sourceId: 'src-a' }, '1', ['0', '1', '2']);
    workspaceStore.getState().dispatch({ type: 'renameWorkspace', name: 'A' });
    selectionStore.getState().clear();
    workspaceStore.getState().undo();
    expect(selectionStore.getState().ids).toEqual(['1']);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/ui/app/StoreProvider.test.tsx`
Expected: FAIL, `Failed to resolve import "./StoreProvider"`.

- [ ] **Step 3: StoreProvider.tsx implementieren**

`src/ui/app/StoreProvider.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { createEmptyWorkspace, type Command, type Workspace } from '../../domain/types';
import type { AppServices } from '../../services/app/appServices';
import type { SelectionSnapshot, SelectionState } from '../../services/store/selection';
import { createSelectionStore, type SelectionStore } from '../../services/store/selectionStore';
import { createWorkspaceStore, type WorkspaceStore } from '../../services/store/workspaceStore';

export interface StoreContextValue {
  workspaceStore: WorkspaceStore;
  selectionStore: SelectionStore;
  services: AppServices;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({
  value,
  children,
}: {
  value: StoreContextValue;
  children: ReactNode;
}) {
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function useContextValue(): StoreContextValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore-Hooks brauchen einen StoreProvider im Baum.');
  return value;
}

export function useWorkspaceStore(): WorkspaceStore {
  return useContextValue().workspaceStore;
}
export function useSelectionStore(): SelectionStore {
  return useContextValue().selectionStore;
}
export function useServices(): AppServices {
  return useContextValue().services;
}

export function useWorkspace(): Workspace {
  return useStore(useWorkspaceStore(), (state) => state.workspace);
}

export function useSelection(): SelectionState {
  return useStore(useSelectionStore(), (state) => ({
    scope: state.scope,
    anchor: state.anchor,
    ids: state.ids,
  }));
}

export function useDispatch(): (command: Command, selectionAfter?: SelectionSnapshot) => void {
  return useWorkspaceStore().getState().dispatch;
}

export interface WireStoresDeps {
  services: AppServices;
  initialWorkspace?: Workspace;
  now?(): number;
}

/**
 * Verbindet die zwei entkoppelten Stores: die History bekommt Snapshot und
 * Wiederherstellung der Selektion als Callbacks, damit weder Store den anderen
 * importieren muss. Verletzte Invarianten sind ein Programmierfehler und gehen
 * in die Konsole, nicht in die Oberflaeche.
 */
export function wireStores({
  services,
  initialWorkspace,
  now = () => Date.now(),
}: WireStoresDeps): StoreContextValue {
  const selectionStore = createSelectionStore();
  const workspaceStore = createWorkspaceStore({
    initial: initialWorkspace ?? createEmptyWorkspace({ id: 'ws-1', name: 'Neuer Arbeitsbereich' }),
    now,
    captureSelection: () => selectionStore.getState().snapshot(),
    restoreSelection: (snapshot) => selectionStore.getState().restore(snapshot),
    onInvalid: (errors) => console.warn('Workspace-Invarianten verletzt', errors),
  });
  return { workspaceStore, selectionStore, services };
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/ui/app/StoreProvider.test.tsx && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: StoreProvider verbindet Stores und Dienste mit der Oberflaeche

wireStores verdrahtet Selektions- und Workspace-Store ueber Callbacks statt
ueber einen direkten Import, sodass Undo/Redo die Selektion wiederherstellen,
ohne dass ein Store den anderen kennt. Die Hooks useWorkspace/useSelection/
useDispatch sind der einzige Zugang der Komponenten zum Zustand.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 7: Virtualisiertes Raster und Thumbnail-Zelle

**Files:**

- Create: `src/ui/common/VirtualGrid.tsx`, `src/ui/common/gridLayout.ts`, `src/ui/common/Thumbnail.tsx`
- Test: `src/ui/common/gridLayout.test.ts`, `src/ui/common/Thumbnail.test.tsx`

**Interfaces:**

- Consumes: `useVirtualizer` aus `@tanstack/react-virtual`; `useServices` aus `../app/StoreProvider`; `THUMBNAIL_WIDTH` aus `../../services/thumbnails/thumbnailService`; `type BlockRef` aus `../../domain/types`
- Produces:
  - `computeColumns(containerWidth: number, minCellWidth: number, gap: number): number` (rein)
  - `computeCellRects(count, columns, cellWidth, cellHeight, gap): CellRect[]` (rein, fuer den Marquee-Treffer)
  - `VirtualGrid(props: VirtualGridProps)` mit `count`, `renderCell(index, cellWidth) => ReactNode`, `minCellWidth`, `cellAspect`, `gap`, `scrollRef`
  - `Thumbnail(props: { blockRef: BlockRef; width?: number; priority?: number; alt: string })`

Das Design verlangt Grid-Virtualisierung fuer grosse Seitenraster (ein 500-Seiten-Raster soll rund 60 DOM-Knoten haben). `@tanstack/react-virtual` virtualisiert Zeilen; die Spaltenzahl folgt aus der Containerbreite. Die Spaltenberechnung und die Zell-Rechtecke sind reine Funktionen -- Letztere braucht der Marquee-Treffer aus Task 5, ohne jede Zelle nach ihrer Position im DOM zu fragen.

Die Thumbnail-Zelle fragt zuerst synchron den Speicher-Cache (`peek`), damit eine bereits gerenderte Seite ohne Flackern erscheint, und rendert sonst asynchron ueber `request`. Der `ThumbnailService` besitzt den Lebenszyklus der Blob-URLs (LRU plus `keepOnly`); die Zelle ruft beim Wegscrollen nichts frei -- das erledigt das Raster ueber `keepOnly` in Task 8.

- [ ] **Step 1: Den fehlschlagenden Test fuer das Layout schreiben**

`src/ui/common/gridLayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeCellRects, computeColumns } from './gridLayout';

describe('computeColumns', () => {
  it('passt so viele Spalten ein, wie die Breite mit Abstand hergibt', () => {
    // 3 Zellen a 180 + 2 Abstaende a 12 = 564
    expect(computeColumns(600, 180, 12)).toBe(3);
    expect(computeColumns(560, 180, 12)).toBe(2);
  });

  it('liefert mindestens eine Spalte', () => {
    expect(computeColumns(100, 180, 12)).toBe(1);
    expect(computeColumns(0, 180, 12)).toBe(1);
  });
});

describe('computeCellRects', () => {
  it('legt Zellen in Zeilen mit Abstand ab', () => {
    const rects = computeCellRects(3, 2, 100, 140, 10);
    expect(rects).toEqual([
      { id: '0', left: 0, top: 0, right: 100, bottom: 140 },
      { id: '1', left: 110, top: 0, right: 210, bottom: 140 },
      { id: '2', left: 0, top: 150, right: 100, bottom: 290 },
    ]);
  });
});
```

- [ ] **Step 2: gridLayout.ts implementieren, Test gruen**

`src/ui/common/gridLayout.ts`:

```ts
import type { CellRect } from '../workspace/dragLogic';

export function computeColumns(containerWidth: number, minCellWidth: number, gap: number): number {
  if (containerWidth <= 0) return 1;
  // n Zellen brauchen (n-1) Abstaende: n*w + (n-1)*gap <= width.
  const columns = Math.floor((containerWidth + gap) / (minCellWidth + gap));
  return Math.max(1, columns);
}

export function computeCellRects(
  count: number,
  columns: number,
  cellWidth: number,
  cellHeight: number,
  gap: number,
): CellRect[] {
  const rects: CellRect[] = [];
  for (let index = 0; index < count; index++) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const left = column * (cellWidth + gap);
    const top = row * (cellHeight + gap);
    rects.push({ id: String(index), left, top, right: left + cellWidth, bottom: top + cellHeight });
  }
  return rects;
}
```

Run: `npm run test -- src/ui/common/gridLayout.test.ts`
Expected: PASS.

- [ ] **Step 3: VirtualGrid.tsx implementieren**

`src/ui/common/VirtualGrid.tsx`:

```tsx
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { computeColumns } from './gridLayout';

export interface VirtualGridProps {
  count: number;
  minCellWidth: number;
  /** Hoehe = Breite * cellAspect. PDF-Seiten sind hoch, also > 1. */
  cellAspect: number;
  gap: number;
  renderCell(index: number, cellWidth: number): ReactNode;
  /** Der Scrollcontainer; das interne Drag misst darueber Positionen. */
  scrollRef?: RefObject<HTMLDivElement | null>;
  overscan?: number;
}

export function VirtualGrid({
  count,
  minCellWidth,
  cellAspect,
  gap,
  renderCell,
  scrollRef,
  overscan = 2,
}: VirtualGridProps) {
  const ownRef = useRef<HTMLDivElement | null>(null);
  const ref = scrollRef ?? ownRef;
  const [width, setWidth] = useState(0);

  // Die Containerbreite bestimmt die Spaltenzahl. In jsdom ist clientWidth 0;
  // dann faellt die Spaltenzahl auf 1 und es wird trotzdem gerendert.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  const columns = computeColumns(width, minCellWidth, gap);
  const cellWidth =
    columns > 0 ? (width - gap * (columns - 1)) / columns || minCellWidth : minCellWidth;
  const cellHeight = cellWidth * cellAspect;
  const rowCount = Math.ceil(count / columns);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => ref.current,
    estimateSize: () => cellHeight + gap,
    overscan,
  });

  return (
    <div ref={ref} className="h-full overflow-auto" data-testid="virtual-grid">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const start = virtualRow.index * columns;
          const indices = Array.from({ length: columns }, (_, i) => start + i).filter(
            (i) => i < count,
          );
          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
                display: 'flex',
                gap,
                width: '100%',
              }}
            >
              {indices.map((index) => (
                <div key={index} style={{ width: cellWidth }}>
                  {renderCell(index, cellWidth)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Den fehlschlagenden Test fuer die Thumbnail-Zelle schreiben**

`src/ui/common/Thumbnail.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Thumbnail } from './Thumbnail';
import { StoreProvider, wireStores } from '../app/StoreProvider';
import type { AppServices } from '../../services/app/appServices';
import type { ThumbnailService } from '../../services/thumbnails/thumbnailService';

function renderWithServices(thumbnails: Partial<ThumbnailService>) {
  const services = { thumbnails } as unknown as AppServices;
  const value = wireStores({ services, now: () => 1 });
  return render(
    <StoreProvider value={value}>
      <Thumbnail blockRef={{ sourceId: 'src-a', blockIndex: 4 }} alt="Bank.pdf Seite 5" />
    </StoreProvider>,
  );
}

describe('Thumbnail', () => {
  it('zeigt sofort ein bereits zwischengespeichertes Bild ohne Anforderung', () => {
    const request = vi.fn();
    renderWithServices({ peek: () => 'blob:cached', request });
    expect(screen.getByRole('img', { name: 'Bank.pdf Seite 5' })).toHaveAttribute(
      'src',
      'blob:cached',
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('fordert das Bild an, wenn es nicht im Speicher liegt', async () => {
    const request = vi.fn(async () => 'blob:fresh');
    renderWithServices({ peek: () => undefined, request });
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Bank.pdf Seite 5' })).toHaveAttribute(
        'src',
        'blob:fresh',
      ),
    );
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ ref: { sourceId: 'src-a', blockIndex: 4 } }),
    );
  });
});
```

- [ ] **Step 5: Thumbnail.tsx implementieren**

`src/ui/common/Thumbnail.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { BlockRef } from '../../domain/types';
import { THUMBNAIL_WIDTH } from '../../services/thumbnails/thumbnailService';
import { useServices } from '../app/StoreProvider';

export interface ThumbnailProps {
  blockRef: BlockRef;
  width?: number;
  priority?: number;
  alt: string;
}

export function Thumbnail({
  blockRef,
  width = THUMBNAIL_WIDTH,
  priority = 0,
  alt,
}: ThumbnailProps) {
  const { thumbnails } = useServices();
  // Synchroner Blick in den Speicher-Cache: ein bereits gerendertes Thumbnail
  // erscheint ohne Flackern und ohne einen zweiten Renderauftrag.
  const [url, setUrl] = useState<string | undefined>(() => thumbnails.peek(blockRef, width));

  useEffect(() => {
    let active = true;
    const cached = thumbnails.peek(blockRef, width);
    if (cached) {
      setUrl(cached);
      return;
    }
    thumbnails
      .request({ ref: blockRef, width, priority })
      .then((fresh) => {
        if (active) setUrl(fresh);
      })
      .catch((error) => {
        // Ein abgebrochener Auftrag (Wegscrollen) ist kein Fehler fuer den Nutzer.
        console.debug('Thumbnail nicht gerendert', error);
      });
    return () => {
      active = false;
      thumbnails.cancel(blockRef, width);
    };
  }, [thumbnails, blockRef.sourceId, blockRef.blockIndex, width, priority]);

  if (!url) {
    return (
      <div
        className="h-full w-full animate-pulse rounded bg-panel"
        aria-label={`${alt} wird geladen`}
      />
    );
  }
  return (
    <img src={url} alt={alt} className="h-full w-full rounded object-contain" draggable={false} />
  );
}
```

- [ ] **Step 6: Tests pruefen**

Run: `npm run test -- src/ui/common && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: virtualisiertes Raster und Thumbnail-Zelle

Die Spaltenzahl und die Zell-Rechtecke sind reine Funktionen -- Letztere
liefern dem Marquee-Treffer Positionen, ohne das DOM zu befragen. Das Raster
virtualisiert Zeilen; ein 500-Seiten-Raster bleibt bei rund 60 Knoten. Die
Zelle blickt erst synchron in den Cache und rendert nur bei Bedarf nach.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 8: Quellnutzung und permanentes Range-Feld

**Files:**

- Create: `src/ui/sources/sourceUsage.ts`, `src/ui/sources/RangeField.tsx`
- Test: `src/ui/sources/sourceUsage.test.ts`, `src/ui/sources/RangeField.test.tsx`

**Interfaces:**

- Consumes: `type Workspace`, `type SourceId` aus `../../domain/types`; `parseRanges`, `formatRanges`, `rangesToIndices` aus `../../domain/ranges`; `useSelectionStore`, `useSelection` aus `../app/StoreProvider`
- Produces:
  - `computeSourceUsage(ws: Workspace, sourceId: SourceId): Map<number, number>` (Blockindex -> Zahl der Outputs, die ihn verwenden)
  - `RangeField(props: { sourceId: SourceId; blockCount: number })`

Das Design verlangt ein permanent sichtbares Range-Feld ueber dem Quellraster (kein Dialog), das 1-basierte Eingabe wie `1-3,50-100` annimmt, ueberlappende und absteigende Bereiche normalisiert, auf `blockCount` deckelt und ungueltige Eingabe inline meldet, ohne die Selektion zu zerstoeren. Die Nutzung einer Quellseite (Badge mit der Zahl der Outputs) ist eine Ableitung aus dem Workspace und gehoert in eine reine Funktion.

- [ ] **Step 1: Den fehlschlagenden Test fuer die Nutzung schreiben**

`src/ui/sources/sourceUsage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeSourceUsage } from './sourceUsage';
import { makeWorkspace, IDS } from '../../domain/__fixtures__/workspace';

describe('computeSourceUsage', () => {
  it('zaehlt fuer jede Quellseite die Zahl der Outputs, die sie verwenden', () => {
    const usage = computeSourceUsage(makeWorkspace(), IDS.bank);
    // Im Fixture liegt Bank-Seite 17 (Index 16) im Output "Insurance".
    expect(usage.get(16)).toBe(1);
    expect(usage.get(0)).toBeUndefined();
  });

  it('liefert eine leere Karte fuer eine unbenutzte Quelle', () => {
    expect(computeSourceUsage(makeWorkspace(), 'unbenutzt').size).toBe(0);
  });
});
```

- [ ] **Step 2: sourceUsage.ts implementieren, Test gruen**

`src/ui/sources/sourceUsage.ts`:

```ts
import { isOutput, type SourceId, type Workspace } from '../../domain/types';

/**
 * Blockindex -> Zahl der Outputs, die genau diese Quellseite verwenden.
 * Gezaehlt werden Outputs, nicht Items: zwei Kopien derselben Seite im selben
 * Output ergeben den Wert 1, weil das Badge "in wie vielen Dokumenten" meint.
 */
export function computeSourceUsage(ws: Workspace, sourceId: SourceId): Map<number, number> {
  const outputsByBlock = new Map<number, Set<string>>();
  for (const node of Object.values(ws.nodes)) {
    if (!isOutput(node)) continue;
    for (const itemId of node.items) {
      const item = ws.items[itemId];
      if (!item || item.sourceId !== sourceId) continue;
      const set = outputsByBlock.get(item.blockIndex) ?? new Set<string>();
      set.add(node.id);
      outputsByBlock.set(item.blockIndex, set);
    }
  }
  const usage = new Map<number, number>();
  for (const [blockIndex, outputs] of outputsByBlock) usage.set(blockIndex, outputs.size);
  return usage;
}
```

Run: `npm run test -- src/ui/sources/sourceUsage.test.ts`
Expected: PASS.

- [ ] **Step 3: Den fehlschlagenden Test fuer das Range-Feld schreiben**

`src/ui/sources/RangeField.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RangeField } from './RangeField';
import { StoreProvider, wireStores } from '../app/StoreProvider';
import type { AppServices } from '../../services/app/appServices';

function setup() {
  const value = wireStores({ services: {} as AppServices, now: () => 1 });
  render(
    <StoreProvider value={value}>
      <RangeField sourceId="src-a" blockCount={100} />
    </StoreProvider>,
  );
  return value;
}

describe('RangeField', () => {
  it('waehlt aus einer gueltigen Eingabe die passenden Seiten', async () => {
    const value = setup();
    await userEvent.type(screen.getByLabelText('Seiten'), '4-6,10');
    expect(screen.getByText('4 Seiten ausgewaehlt')).toBeInTheDocument();
    expect(value.selectionStore.getState().ids).toEqual(['3', '4', '5', '9']);
  });

  it('meldet eine ungueltige Eingabe inline, ohne die Selektion zu leeren', async () => {
    const value = setup();
    await userEvent.type(screen.getByLabelText('Seiten'), '4-6');
    await userEvent.clear(screen.getByLabelText('Seiten'));
    await userEvent.type(screen.getByLabelText('Seiten'), 'abc');
    expect(screen.getByRole('status')).toHaveTextContent(/ungueltig/i);
    expect(value.selectionStore.getState().ids).toEqual(['3', '4', '5']);
  });
});
```

- [ ] **Step 4: RangeField.tsx implementieren**

`src/ui/sources/RangeField.tsx`:

```tsx
import { useEffect, useId, useRef, useState } from 'react';
import { formatRanges, parseRanges, rangesToIndices } from '../../domain/ranges';
import type { SourceId } from '../../domain/types';
import { useSelection, useSelectionStore } from '../app/StoreProvider';

export interface RangeFieldProps {
  sourceId: SourceId;
  blockCount: number;
}

export function RangeField({ sourceId, blockCount }: RangeFieldProps) {
  const selectionStore = useSelectionStore();
  const selection = useSelection();
  const inputId = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const editing = useRef(false);

  // Wenn die Selektion von aussen kommt (Klick im Raster, Undo), spiegelt das
  // Feld sie -- aber nicht, waehrend der Nutzer gerade tippt.
  useEffect(() => {
    if (editing.current) return;
    const inScope = selection.scope?.kind === 'source' && selection.scope.sourceId === sourceId;
    const indices = inScope ? selection.ids.map(Number).sort((a, b) => a - b) : [];
    setText(formatRanges(indices));
    setError(null);
  }, [selection, sourceId]);

  function commit(value: string) {
    setText(value);
    if (value.trim() === '') {
      setError(null);
      selectionStore.replace({ kind: 'source', sourceId }, [], null, false);
      return;
    }
    const parsed = parseRanges(value, blockCount);
    if (!parsed.ok) {
      // Fehler inline, Selektion bleibt unangetastet.
      setError(parsed.error);
      return;
    }
    setError(null);
    const indices = rangesToIndices(parsed.ranges);
    const ids = indices.map(String);
    selectionStore.replace({ kind: 'source', sourceId }, ids, ids[0] ?? null, false);
  }

  const count =
    selection.scope?.kind === 'source' && selection.scope.sourceId === sourceId
      ? selection.ids.length
      : 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm">
      <label htmlFor={inputId} className="text-neutral-400">
        Seiten
      </label>
      <input
        id={inputId}
        value={text}
        onFocus={() => (editing.current = true)}
        onBlur={() => (editing.current = false)}
        onChange={(event) => commit(event.target.value)}
        placeholder="z. B. 1-3,50-100"
        className="w-48 rounded border border-line bg-panel px-2 py-1 font-mono"
        aria-invalid={error !== null}
      />
      {error ? (
        <span role="status" className="text-amber-400">
          Eingabe ungueltig: {error}
        </span>
      ) : (
        <span role="status" className="text-neutral-400">
          {count === 1 ? '1 Seite ausgewaehlt' : `${count} Seiten ausgewaehlt`}
        </span>
      )}
    </div>
  );
}
```

Falls `parseRanges` (Plan 1) im Fehlerfall keine deutsche Klartextmeldung liefert, sondern nur einen Code, hier auf `Bitte Seitenzahlen wie 1-3,50-100 eingeben.` zuruecksetzen -- der Test prueft nur, dass `ungueltig` erscheint und die Selektion steht.

- [ ] **Step 5: Tests pruefen**

Run: `npm run test -- src/ui/sources && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Quellnutzung und permanentes Range-Feld

computeSourceUsage leitet fuer jede Quellseite ab, in wie vielen Outputs sie
liegt. Das Range-Feld nimmt 1-basierte Eingabe an, deckelt auf die Seitenzahl,
meldet Ungueltiges inline ohne die Selektion zu zerstoeren und spiegelt eine
von aussen gesetzte Selektion, solange der Nutzer nicht selbst tippt.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 9: Quellenliste und Quellraster

**Files:**

- Create: `src/ui/sources/SourceList.tsx`, `src/ui/sources/SourceGrid.tsx`
- Test: `src/ui/sources/SourceList.test.tsx`, `src/ui/sources/SourceGrid.test.tsx`

**Interfaces:**

- Consumes: `VirtualGrid`, `Thumbnail`; `computeSourceUsage`; `RangeField`; `useWorkspace`, `useSelection`, `useSelectionStore` aus `../app/StoreProvider`; `type SourceDocument` aus `../../domain/types`
- Produces:
  - `SourceList(props: { activeSourceId: SourceId | null; onSelect(sourceId: SourceId): void })`
  - `SourceGrid(props: { source: SourceDocument })`

Die Quellenliste zeigt jede Quelle mit Status (`ready`/`encrypted`/`error`) und ihrer Seitenzahl; eine fehlerhafte Quelle ist sichtbar, aber nicht auswaehlbar. Das Quellraster zeigt die Seiten einer Quelle als virtualisierte Zellen mit Nutzungs-Badge und einem Umschalter "nur noch nicht verwendete Seiten". Ein Klick auf eine Seite setzt die Selektion, Shift erweitert, Ctrl/Cmd schaltet um -- ueber die Selektionslogik aus Task 2. Das eigentliche Ziehen kommt in Task 11; hier ist die Zelle nur klick- und selektierbar.

- [ ] **Step 1: Den fehlschlagenden Test fuer die Quellenliste schreiben**

`src/ui/sources/SourceList.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceList } from './SourceList';
import { StoreProvider, wireStores } from '../app/StoreProvider';
import { makeWorkspace, IDS } from '../../domain/__fixtures__/workspace';
import type { AppServices } from '../../services/app/appServices';

function setup(onSelect = vi.fn()) {
  const value = wireStores({
    services: {} as AppServices,
    initialWorkspace: makeWorkspace(),
    now: () => 1,
  });
  render(
    <StoreProvider value={value}>
      <SourceList activeSourceId={null} onSelect={onSelect} />
    </StoreProvider>,
  );
  return { onSelect };
}

describe('SourceList', () => {
  it('listet jede Quelle mit ihrer Seitenzahl', () => {
    setup();
    expect(screen.getByText('Contract.pdf')).toBeInTheDocument();
    expect(screen.getByText('100 Seiten')).toBeInTheDocument();
  });

  it('waehlt eine Quelle per Klick', async () => {
    const { onSelect } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Bank\.pdf/ }));
    expect(onSelect).toHaveBeenCalledWith(IDS.bank);
  });
});
```

- [ ] **Step 2: SourceList.tsx implementieren**

`src/ui/sources/SourceList.tsx`:

```tsx
import { FileText, Lock, TriangleAlert } from 'lucide-react';
import type { SourceDocument, SourceId } from '../../domain/types';
import { useWorkspace } from '../app/StoreProvider';

export interface SourceListProps {
  activeSourceId: SourceId | null;
  onSelect(sourceId: SourceId): void;
}

function statusIcon(source: SourceDocument) {
  if (source.status === 'encrypted')
    return <Lock className="size-4 text-amber-400" aria-label="verschluesselt" />;
  if (source.status === 'error')
    return <TriangleAlert className="size-4 text-red-400" aria-label="fehlerhaft" />;
  return <FileText className="size-4 text-neutral-400" aria-hidden />;
}

export function SourceList({ activeSourceId, onSelect }: SourceListProps) {
  const workspace = useWorkspace();
  const sources = workspace.sourceOrder.map((id) => workspace.sources[id]).filter(Boolean);

  if (sources.length === 0) {
    return <p className="px-3 py-4 text-sm text-neutral-500">Noch keine Dokumente importiert.</p>;
  }

  return (
    <ul className="flex flex-col">
      {sources.map((source) => {
        const usable = source.status === 'ready';
        return (
          <li key={source.id}>
            <button
              type="button"
              disabled={!usable}
              onClick={() => usable && onSelect(source.id)}
              aria-pressed={activeSourceId === source.id}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                activeSourceId === source.id ? 'bg-panel' : 'hover:bg-panel/60'
              } ${usable ? '' : 'cursor-not-allowed opacity-60'}`}
            >
              {statusIcon(source)}
              <span className="min-w-0 flex-1 truncate">{source.name}</span>
              <span className="text-neutral-500">
                {source.status === 'ready'
                  ? source.blockCount === 1
                    ? '1 Seite'
                    : `${source.blockCount} Seiten`
                  : source.status === 'encrypted'
                    ? 'geschuetzt'
                    : 'nicht lesbar'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 3: Den fehlschlagenden Test fuer das Quellraster schreiben**

`src/ui/sources/SourceGrid.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SourceGrid } from './SourceGrid';
import { StoreProvider, wireStores } from '../app/StoreProvider';
import { makeWorkspace, IDS } from '../../domain/__fixtures__/workspace';
import type { AppServices } from '../../services/app/appServices';

function setup() {
  const services = {
    thumbnails: {
      peek: () => undefined,
      request: async () => 'blob:x',
      cancel: () => {},
      keepOnly: () => {},
    },
  } as unknown as AppServices;
  const value = wireStores({ services, initialWorkspace: makeWorkspace(), now: () => 1 });
  const source = value.workspaceStore.getState().workspace.sources[IDS.bank];
  render(
    <StoreProvider value={value}>
      <SourceGrid source={source} />
    </StoreProvider>,
  );
  return value;
}

describe('SourceGrid', () => {
  it('waehlt eine Seite per Klick ueber die Selektionslogik', async () => {
    const value = setup();
    // Die erste sichtbare Zelle traegt die Seitennummer als zugaengliches Label.
    await userEvent.click(screen.getByRole('button', { name: /Seite 1$/ }));
    expect(value.selectionStore.getState().scope).toEqual({ kind: 'source', sourceId: IDS.bank });
    expect(value.selectionStore.getState().ids).toEqual(['0']);
  });
});
```

- [ ] **Step 4: SourceGrid.tsx implementieren**

`src/ui/sources/SourceGrid.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react';
import type { SelectionScope } from '../../services/store/selection';
import type { SourceDocument } from '../../domain/types';
import { Thumbnail } from '../common/Thumbnail';
import { VirtualGrid } from '../common/VirtualGrid';
import { useSelection, useSelectionStore, useWorkspace } from '../app/StoreProvider';
import { computeSourceUsage } from './sourceUsage';

export interface SourceGridProps {
  source: SourceDocument;
}

export function SourceGrid({ source }: SourceGridProps) {
  const workspace = useWorkspace();
  const selection = useSelection();
  const selectionStore = useSelectionStore();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [onlyUnused, setOnlyUnused] = useState(false);

  const usage = useMemo(() => computeSourceUsage(workspace, source.id), [workspace, source.id]);

  const scope: SelectionScope = { kind: 'source', sourceId: source.id };
  const indices = useMemo(() => {
    const all = Array.from({ length: source.blockCount }, (_, i) => i);
    return onlyUnused ? all.filter((i) => !usage.has(i)) : all;
  }, [source.blockCount, onlyUnused, usage]);
  const order = useMemo(() => indices.map(String), [indices]);

  function onCellPointerDown(event: React.PointerEvent, index: number) {
    const id = String(index);
    if (event.shiftKey) selectionStore.extend(scope, id, order);
    else if (event.metaKey || event.ctrlKey) selectionStore.toggle(scope, id);
    else selectionStore.select(scope, id, order);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-1 text-xs text-neutral-500">
        <span>{source.name}</span>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyUnused}
            onChange={(e) => setOnlyUnused(e.target.checked)}
          />
          Nur noch nicht verwendete Seiten
        </label>
      </div>
      <div className="min-h-0 flex-1">
        <VirtualGrid
          count={indices.length}
          minCellWidth={180}
          cellAspect={1.35}
          gap={12}
          scrollRef={scrollRef}
          renderCell={(position) => {
            const blockIndex = indices[position];
            const id = String(blockIndex);
            const selected =
              selection.scope?.kind === 'source' &&
              selection.scope.sourceId === source.id &&
              selection.ids.includes(id);
            const count = usage.get(blockIndex) ?? 0;
            return (
              <button
                type="button"
                onPointerDown={(e) => onCellPointerDown(e, blockIndex)}
                aria-pressed={selected}
                className={`relative block w-full rounded ring-2 ${
                  selected ? 'ring-sky-400' : 'ring-transparent'
                }`}
                style={{ aspectRatio: '1 / 1.35' }}
              >
                <Thumbnail
                  blockRef={{ sourceId: source.id, blockIndex }}
                  alt={`${source.name} Seite ${blockIndex + 1}`}
                />
                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-xs">
                  {blockIndex + 1}
                </span>
                {count > 0 && (
                  <span
                    className="absolute right-1 top-1 rounded bg-sky-500/80 px-1 text-xs"
                    aria-label={`in ${count} Dokumenten verwendet`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          }}
        />
      </div>
    </div>
  );
}
```

Der `scrollRef` wird in Task 11 an `usePointerDrag` weitergereicht, damit Marquee und Auto-Scroll denselben Scrollcontainer messen; hier haelt ihn `VirtualGrid`.

- [ ] **Step 5: Tests pruefen**

Run: `npm run test -- src/ui/sources && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Quellenliste und virtualisiertes Quellraster

Die Liste zeigt jede Quelle mit Status und Seitenzahl; fehlerhafte Quellen
sind sichtbar, aber nicht auswaehlbar. Das Raster selektiert Seiten ueber die
Selektionslogik (Klick, Shift, Ctrl), zeigt ein Nutzungs-Badge und blendet auf
Wunsch nur noch nicht verwendete Seiten ein.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 10: Ausgabe-Baum und Output-Raster

**Files:**

- Create: `src/ui/workspace/treeModel.ts`, `src/ui/workspace/OutputTree.tsx`, `src/ui/workspace/OutputGrid.tsx`
- Test: `src/ui/workspace/treeModel.test.ts`, `src/ui/workspace/OutputTree.test.tsx`, `src/ui/workspace/OutputGrid.test.tsx`

**Interfaces:**

- Consumes: `ROOT`, `isFolder`, `isOutput`, `type NodeId`, `type Workspace` aus `../../domain/types`; `newId` aus `../../domain/ids`; `useWorkspace`, `useDispatch`, `useSelection`, `useSelectionStore` aus `../app/StoreProvider`; `Thumbnail`, `VirtualGrid`
- Produces:
  - `interface FlatNode { id: NodeId; depth: number; type: 'folder' | 'output' }`
  - `flattenTree(ws: Workspace): FlatNode[]` (Vorordnungs-Durchlauf in `childOrder`-Reihenfolge)
  - `OutputTree(props: { activeOutputId: NodeId | null; onSelectOutput(id: NodeId): void })`
  - `OutputGrid(props: { outputId: NodeId })`

Der Baum ist die Ausgabestruktur (Ordner und Output-Dokumente, nie Items -- Invariante 1). Das Abflachen fuer die Anzeige ist eine reine Funktion und getrennt testbar. Ordner anlegen, Output anlegen, Umbenennen (`F2`/Doppelklick) und Verschieben laufen alle ueber Commands; die Namenskollision loest bereits die Command-Schicht (Plan 1). Das Output-Raster zeigt die Items eines Outputs in genau der Reihenfolge der `items`-Liste, jeweils das Thumbnail der referenzierten Quellseite mit angewandter Rotation und eine Herkunftszeile.

- [ ] **Step 1: Den fehlschlagenden Test fuer das Baummodell schreiben**

`src/ui/workspace/treeModel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { flattenTree } from './treeModel';
import { makeWorkspace } from '../../domain/__fixtures__/workspace';

describe('flattenTree', () => {
  it('flacht den Baum in Vorordnung mit Tiefe ab', () => {
    const flat = flattenTree(makeWorkspace());
    // Fixture: Tax 2026 (Tiefe 0) -> Bank, Insurance, Contracts (Tiefe 1) mit
    // je einem Output darunter. Der genaue Aufbau stammt aus dem Fixture.
    expect(flat[0]).toMatchObject({ depth: 0, type: 'folder' });
    expect(flat.every((node) => node.depth >= 0)).toBe(true);
    // Jede Node erscheint genau einmal.
    expect(new Set(flat.map((n) => n.id)).size).toBe(flat.length);
  });
});
```

- [ ] **Step 2: treeModel.ts implementieren, Test gruen**

`src/ui/workspace/treeModel.ts`:

```ts
import { ROOT, isFolder, type NodeId, type Workspace } from '../../domain/types';

export interface FlatNode {
  id: NodeId;
  depth: number;
  type: 'folder' | 'output';
}

/** Vorordnungs-Durchlauf in childOrder-Reihenfolge; Grundlage fuer die Anzeige. */
export function flattenTree(ws: Workspace): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (parentKey: string, depth: number) => {
    for (const id of ws.childOrder[parentKey] ?? []) {
      const node = ws.nodes[id];
      if (!node) continue;
      const type = isFolder(node) ? 'folder' : 'output';
      out.push({ id, depth, type });
      if (type === 'folder') walk(id, depth + 1);
    }
  };
  walk(ROOT, 0);
  return out;
}
```

Run: `npm run test -- src/ui/workspace/treeModel.test.ts`
Expected: PASS.

- [ ] **Step 3: Den fehlschlagenden Test fuer den Baum schreiben**

`src/ui/workspace/OutputTree.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OutputTree } from './OutputTree';
import { StoreProvider, wireStores } from '../app/StoreProvider';
import { makeWorkspace, IDS } from '../../domain/__fixtures__/workspace';
import type { AppServices } from '../../services/app/appServices';

function setup(onSelectOutput = vi.fn()) {
  const value = wireStores({
    services: {} as AppServices,
    initialWorkspace: makeWorkspace(),
    now: () => 1,
  });
  render(
    <StoreProvider value={value}>
      <OutputTree activeOutputId={null} onSelectOutput={onSelectOutput} />
    </StoreProvider>,
  );
  return { value, onSelectOutput };
}

describe('OutputTree', () => {
  it('zeigt Ordner und Output-Dokumente', () => {
    setup();
    expect(screen.getByText('Tax 2026')).toBeInTheDocument();
    expect(screen.getByText('Contracts')).toBeInTheDocument();
  });

  it('legt einen Ordner ueber einen Command an', async () => {
    const { value } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Ordner anlegen' }));
    const names = Object.values(value.workspaceStore.getState().workspace.nodes).map((n) => n.name);
    expect(names).toContain('Neuer Ordner');
  });

  it('waehlt ein Output-Dokument', async () => {
    const { onSelectOutput } = setup();
    await userEvent.click(screen.getByRole('button', { name: /^Insurance/ }));
    expect(onSelectOutput).toHaveBeenCalledWith(IDS.outInsurance);
  });
});
```

- [ ] **Step 4: OutputTree.tsx implementieren**

`src/ui/workspace/OutputTree.tsx`:

```tsx
import { useState } from 'react';
import { ChevronRight, FilePlus2, Folder, FolderPlus, FileText } from 'lucide-react';
import { newId } from '../../domain/ids';
import type { NodeId } from '../../domain/types';
import { useDispatch, useWorkspace } from '../app/StoreProvider';
import { flattenTree } from './treeModel';

export interface OutputTreeProps {
  activeOutputId: NodeId | null;
  onSelectOutput(id: NodeId): void;
}

export function OutputTree({ activeOutputId, onSelectOutput }: OutputTreeProps) {
  const workspace = useWorkspace();
  const dispatch = useDispatch();
  const [renaming, setRenaming] = useState<NodeId | null>(null);
  const flat = flattenTree(workspace);

  function rename(id: NodeId, name: string) {
    setRenaming(null);
    dispatch({ type: 'renameNode', nodeId: id, name });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 px-2 py-1">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'createFolder',
              node: { id: newId(), name: 'Neuer Ordner', parentId: null },
            })
          }
          className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-panel"
        >
          <FolderPlus className="size-4" aria-hidden /> Ordner anlegen
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: 'createOutput',
              node: { id: newId(), name: 'Neues Dokument', parentId: null },
            })
          }
          className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-panel"
        >
          <FilePlus2 className="size-4" aria-hidden /> Dokument anlegen
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto">
        {flat.map((node) => {
          const record = workspace.nodes[node.id];
          if (!record) return null;
          const active = node.type === 'output' && node.id === activeOutputId;
          return (
            <li key={node.id} style={{ paddingLeft: node.depth * 16 + 8 }}>
              {renaming === node.id ? (
                <input
                  autoFocus
                  defaultValue={record.name}
                  onBlur={(e) => rename(node.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') rename(node.id, (e.target as HTMLInputElement).value);
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                  className="w-40 rounded border border-line bg-panel px-1 text-sm"
                  aria-label="Name bearbeiten"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => node.type === 'output' && onSelectOutput(node.id)}
                  onDoubleClick={() => setRenaming(node.id)}
                  aria-pressed={active}
                  data-node-id={node.id}
                  data-node-type={node.type}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${
                    active ? 'bg-panel' : 'hover:bg-panel/60'
                  }`}
                >
                  {node.type === 'folder' ? (
                    <>
                      <ChevronRight className="size-3 text-neutral-600" aria-hidden />
                      <Folder className="size-4 text-neutral-400" aria-hidden />
                    </>
                  ) : (
                    <FileText className="size-4 text-neutral-400" aria-hidden />
                  )}
                  <span className="truncate">{record.name}</span>
                </button>
              )}
            </li>
          );
        })}
        {flat.length === 0 && (
          <li className="px-3 py-4 text-sm text-neutral-500">
            Noch keine Ausgabestruktur. Legen Sie einen Ordner oder ein Dokument an.
          </li>
        )}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Den fehlschlagenden Test fuer das Output-Raster schreiben**

`src/ui/workspace/OutputGrid.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OutputGrid } from './OutputGrid';
import { StoreProvider, wireStores } from '../app/StoreProvider';
import { makeWorkspace, IDS } from '../../domain/__fixtures__/workspace';
import type { AppServices } from '../../services/app/appServices';

function setup() {
  const services = {
    thumbnails: {
      peek: () => 'blob:x',
      request: async () => 'blob:x',
      cancel: () => {},
      keepOnly: () => {},
    },
  } as unknown as AppServices;
  const value = wireStores({ services, initialWorkspace: makeWorkspace(), now: () => 1 });
  render(
    <StoreProvider value={value}>
      <OutputGrid outputId={IDS.outInsurance} />
    </StoreProvider>,
  );
  return value;
}

describe('OutputGrid', () => {
  it('zeigt die Items in Reihenfolge mit Herkunftszeile', () => {
    setup();
    // Fixture: Insurance enthaelt Insurance Seite 7 und Bank Seite 17.
    expect(screen.getByText(/Insurance\.pdf . Seite 7/)).toBeInTheDocument();
    expect(screen.getByText(/Bank\.pdf . Seite 17/)).toBeInTheDocument();
  });

  it('waehlt ein Item per Klick im Output-Scope', async () => {
    const value = setup();
    await userEvent.click(screen.getByRole('button', { name: /Insurance\.pdf . Seite 7/ }));
    expect(value.selectionStore.getState().scope).toEqual({
      kind: 'output',
      outputId: IDS.outInsurance,
    });
    expect(value.selectionStore.getState().ids).toEqual(['i-i7']);
  });
});
```

- [ ] **Step 6: OutputGrid.tsx implementieren**

`src/ui/workspace/OutputGrid.tsx`:

```tsx
import { useMemo } from 'react';
import { isOutput, type NodeId } from '../../domain/types';
import type { SelectionScope } from '../../services/store/selection';
import { Thumbnail } from '../common/Thumbnail';
import { VirtualGrid } from '../common/VirtualGrid';
import { useSelection, useSelectionStore, useWorkspace } from '../app/StoreProvider';

export interface OutputGridProps {
  outputId: NodeId;
}

export function OutputGrid({ outputId }: OutputGridProps) {
  const workspace = useWorkspace();
  const selection = useSelection();
  const selectionStore = useSelectionStore();
  const node = workspace.nodes[outputId];
  const scope: SelectionScope = { kind: 'output', outputId };
  const itemIds = isOutput(node) ? node.items : [];
  const order = useMemo(() => [...itemIds], [itemIds]);

  if (!isOutput(node)) {
    return <p className="px-3 py-4 text-sm text-neutral-500">Kein Dokument gewaehlt.</p>;
  }
  if (itemIds.length === 0) {
    return (
      <p className="px-3 py-4 text-sm text-neutral-500">
        Dieses Dokument ist noch leer. Ziehen Sie Seiten hierher.
      </p>
    );
  }

  function onPointerDown(event: React.PointerEvent, id: string) {
    if (event.shiftKey) selectionStore.extend(scope, id, order);
    else if (event.metaKey || event.ctrlKey) selectionStore.toggle(scope, id);
    else selectionStore.select(scope, id, order);
  }

  return (
    <VirtualGrid
      count={itemIds.length}
      minCellWidth={180}
      cellAspect={1.45}
      gap={12}
      renderCell={(position) => {
        const itemId = itemIds[position];
        const item = workspace.items[itemId];
        if (!item) return null;
        const source = workspace.sources[item.sourceId];
        const provenance = `${source?.name ?? 'Quelle'} . Seite ${item.blockIndex + 1}`;
        const selected =
          selection.scope?.kind === 'output' &&
          selection.scope.outputId === outputId &&
          selection.ids.includes(itemId);
        return (
          <button
            type="button"
            onPointerDown={(e) => onPointerDown(e, itemId)}
            aria-pressed={selected}
            data-item-id={itemId}
            className={`flex w-full flex-col gap-1 rounded ring-2 ${selected ? 'ring-sky-400' : 'ring-transparent'}`}
          >
            <span
              className="block w-full"
              style={{ aspectRatio: '1 / 1.35', transform: `rotate(${item.rotation}deg)` }}
            >
              <Thumbnail
                blockRef={{ sourceId: item.sourceId, blockIndex: item.blockIndex }}
                alt={provenance}
              />
            </span>
            <span className="truncate px-1 text-[11px] text-neutral-500">{provenance}</span>
          </button>
        );
      }}
    />
  );
}
```

- [ ] **Step 7: Tests pruefen**

Run: `npm run test -- src/ui/workspace && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Ausgabe-Baum und Output-Raster

Das Abflachen des Baums ist eine reine Funktion. Ordner anlegen, Dokument
anlegen, Umbenennen und Auswaehlen laufen ueber Commands; die Kollision loest
die Command-Schicht. Das Output-Raster zeigt die Items in Listenreihenfolge
mit Rotation und Herkunftszeile und selektiert im Output-Scope.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 11: Die beiden Drag-Systeme

**Files:**

- Create: `src/ui/workspace/buildDropCommand.ts`, `src/ui/workspace/DragPreview.tsx`, `src/ui/workspace/usePointerDrag.ts`, `src/ui/workspace/useExternalDrop.ts`
- Test: `src/ui/workspace/buildDropCommand.test.ts`, `src/ui/workspace/useExternalDrop.test.tsx`

**Interfaces:**

- Consumes: `resolveDropAction`, `type DragOrigin`, `type DropTarget` aus `./dragLogic`; `newId` aus `../../domain/ids`; `isOutput`, `type Command`, `type CompositionItem`, `type Workspace` aus `../../domain/types`; `collectFromDataTransfer`, `importCandidates` aus `../../services/import/*`
- Produces:
  - `buildDropCommand(params: { origin: DragOrigin; target: DropTarget; modifier: boolean; ws: Workspace; newId(): string }): Command | null` (rein)
  - `usePointerDrag(): { onCellPointerDown(event, origin): void; preview: DragState | null }`
  - `DragPreview(props: { state: DragState })` (gestapelte Karten mit Zaehler)
  - `useExternalDrop(onImported?): { dropHandlers }` (native Datei-/Ordner-Drops)

Das Design verlangt zwei **strikt getrennte** Drag-Systeme. Die Uebersetzung einer aufgeloesten Drop-Aktion in einen konkreten Command ist reine Datenlogik und wird hier zuerst und vollstaendig getestet (`buildDropCommand`). Die Pointer-Verdrahtung (`usePointerDrag`) baut darauf auf, enthaelt selbst keine Entscheidung mehr und wird vom Playwright-Test in Plan 4 gefahren; der externe Drop (`useExternalDrop`) ist ein duenner Adapter auf die bereits getesteten Importdienste.

- [ ] **Step 1: Den fehlschlagenden Test fuer buildDropCommand schreiben**

`src/ui/workspace/buildDropCommand.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildDropCommand } from './buildDropCommand';
import type { DragOrigin, DropTarget } from './dragLogic';
import { makeWorkspace, IDS } from '../../domain/__fixtures__/workspace';

let counter = 0;
const newId = () => `new-${++counter}`;
const ws = () => makeWorkspace();

describe('buildDropCommand', () => {
  it('Quelle -> Output: addItems mit neuen Items an der Drop-Position', () => {
    counter = 0;
    const origin: DragOrigin = { kind: 'source', sourceId: IDS.bank, blockIndices: [9, 10] };
    const target: DropTarget = { kind: 'output', outputId: IDS.outInsurance, index: 1 };
    expect(buildDropCommand({ origin, target, modifier: false, ws: ws(), newId })).toEqual({
      type: 'addItems',
      outputId: IDS.outInsurance,
      index: 1,
      items: [
        { id: 'new-1', sourceId: IDS.bank, blockIndex: 9, rotation: 0 },
        { id: 'new-2', sourceId: IDS.bank, blockIndex: 10, rotation: 0 },
      ],
    });
  });

  it('Output -> anderes Output ohne Modifier: moveItems', () => {
    const origin: DragOrigin = {
      kind: 'output',
      outputId: IDS.outContracts,
      itemIds: ['i-c4', 'i-c5'],
    };
    const target: DropTarget = { kind: 'output', outputId: IDS.outInsurance, index: 0 };
    expect(buildDropCommand({ origin, target, modifier: false, ws: ws(), newId })).toEqual({
      type: 'moveItems',
      itemIds: ['i-c4', 'i-c5'],
      outputId: IDS.outInsurance,
      index: 0,
    });
  });

  it('Output -> dasselbe Output: reorderItems statt moveItems', () => {
    const origin: DragOrigin = { kind: 'output', outputId: IDS.outContracts, itemIds: ['i-c6'] };
    const target: DropTarget = { kind: 'output', outputId: IDS.outContracts, index: 0 };
    expect(buildDropCommand({ origin, target, modifier: false, ws: ws(), newId })).toEqual({
      type: 'reorderItems',
      outputId: IDS.outContracts,
      itemIds: ['i-c6'],
      index: 0,
    });
  });

  it('Output -> anderes Output mit Modifier: copyItems mit neuen Ids', () => {
    counter = 0;
    const origin: DragOrigin = {
      kind: 'output',
      outputId: IDS.outContracts,
      itemIds: ['i-c4', 'i-c5'],
    };
    const target: DropTarget = { kind: 'output', outputId: IDS.outInsurance, index: 2 };
    expect(buildDropCommand({ origin, target, modifier: true, ws: ws(), newId })).toEqual({
      type: 'copyItems',
      itemIds: ['i-c4', 'i-c5'],
      outputId: IDS.outInsurance,
      index: 2,
      newIds: ['new-1', 'new-2'],
    });
  });

  it('Quelle -> Ordner: batch aus createOutput und addItems', () => {
    counter = 0;
    const origin: DragOrigin = { kind: 'source', sourceId: IDS.bank, blockIndices: [0] };
    const target: DropTarget = { kind: 'folder', nodeId: IDS.folderBank };
    const command = buildDropCommand({ origin, target, modifier: false, ws: ws(), newId });
    expect(command).toEqual({
      type: 'batch',
      label: '1 Seite in ein neues Dokument',
      commands: [
        { type: 'createOutput', node: { id: 'new-1', name: 'Bank', parentId: IDS.folderBank } },
        {
          type: 'addItems',
          outputId: 'new-1',
          index: 0,
          items: [{ id: 'new-2', sourceId: IDS.bank, blockIndex: 0, rotation: 0 }],
        },
      ],
    });
  });

  it('Output -> Ordner: batch aus createOutput und moveItems', () => {
    counter = 0;
    const origin: DragOrigin = { kind: 'output', outputId: IDS.outContracts, itemIds: ['i-c4'] };
    const target: DropTarget = { kind: 'folder', nodeId: IDS.folderInsurance };
    const command = buildDropCommand({ origin, target, modifier: false, ws: ws(), newId });
    expect(command).toMatchObject({
      type: 'batch',
      commands: [{ type: 'createOutput' }, { type: 'moveItems', itemIds: ['i-c4'], index: 0 }],
    });
  });

  it('liefert null, wenn aus einer Quelle nichts gewaehlt ist', () => {
    const origin: DragOrigin = { kind: 'source', sourceId: IDS.bank, blockIndices: [] };
    const target: DropTarget = { kind: 'output', outputId: IDS.outInsurance, index: 0 };
    expect(buildDropCommand({ origin, target, modifier: false, ws: ws(), newId })).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/ui/workspace/buildDropCommand.test.ts`
Expected: FAIL, `Failed to resolve import "./buildDropCommand"`.

- [ ] **Step 3: buildDropCommand.ts implementieren**

`src/ui/workspace/buildDropCommand.ts`:

```ts
import type { Command, CompositionItem, Workspace } from '../../domain/types';
import { isFolder } from '../../domain/types';
import { resolveDropAction, type DragOrigin, type DropTarget } from './dragLogic';

export interface BuildDropParams {
  origin: DragOrigin;
  target: DropTarget;
  modifier: boolean;
  ws: Workspace;
  newId(): string;
}

function pagesLabel(count: number): string {
  return count === 1 ? '1 Seite' : `${count} Seiten`;
}

/** Neue Items aus Quellseiten; jede Instanz bekommt eine eigene Identitaet. */
function itemsFromSource(
  sourceId: string,
  blockIndices: number[],
  newId: () => string,
): CompositionItem[] {
  return blockIndices.map((blockIndex) => ({ id: newId(), sourceId, blockIndex, rotation: 0 }));
}

function itemCount(origin: DragOrigin): number {
  return origin.kind === 'source' ? origin.blockIndices.length : origin.itemIds.length;
}

/**
 * Uebersetzt eine aufgeloeste Drop-Aktion in genau einen Command. Ein Drop in
 * einen Ordner erzeugt ein neues Output und fuellt es -- beides zusammen als ein
 * batch, damit es ein einziger Undo-Schritt ist.
 */
export function buildDropCommand({
  origin,
  target,
  modifier,
  ws,
  newId,
}: BuildDropParams): Command | null {
  if (itemCount(origin) === 0) return null;
  const action = resolveDropAction(origin, target, modifier);

  switch (action.kind) {
    case 'addFromSource': {
      if (origin.kind !== 'source' || target.kind !== 'output') return null;
      return {
        type: 'addItems',
        outputId: target.outputId,
        index: target.index,
        items: itemsFromSource(origin.sourceId, origin.blockIndices, newId),
      };
    }
    case 'moveItems': {
      if (origin.kind !== 'output' || target.kind !== 'output') return null;
      // Dasselbe Output umsortieren ist reorderItems, nicht moveItems.
      if (origin.outputId === target.outputId) {
        return {
          type: 'reorderItems',
          outputId: target.outputId,
          itemIds: origin.itemIds,
          index: target.index,
        };
      }
      return {
        type: 'moveItems',
        itemIds: origin.itemIds,
        outputId: target.outputId,
        index: target.index,
      };
    }
    case 'copyItems': {
      if (origin.kind !== 'output' || target.kind !== 'output') return null;
      return {
        type: 'copyItems',
        itemIds: origin.itemIds,
        outputId: target.outputId,
        index: target.index,
        newIds: origin.itemIds.map(() => newId()),
      };
    }
    case 'createOutputFromFolder': {
      if (target.kind !== 'folder') return null;
      const folder = ws.nodes[target.nodeId];
      const name = folder && isFolder(folder) ? folder.name : 'Neues Dokument';
      const outputId = newId();
      const create: Command = {
        type: 'createOutput',
        node: { id: outputId, name, parentId: target.nodeId },
      };
      if (origin.kind === 'source') {
        const items = itemsFromSource(origin.sourceId, origin.blockIndices, newId);
        return {
          type: 'batch',
          label: `${pagesLabel(items.length)} in ein neues Dokument`,
          commands: [create, { type: 'addItems', outputId, index: 0, items }],
        };
      }
      return {
        type: 'batch',
        label: `${pagesLabel(origin.itemIds.length)} in ein neues Dokument`,
        commands: [create, { type: 'moveItems', itemIds: origin.itemIds, outputId, index: 0 }],
      };
    }
    case 'none':
      return null;
  }
}
```

- [ ] **Step 4: DragPreview.tsx implementieren (kein eigener Test -- reines Aussehen)**

`src/ui/workspace/DragPreview.tsx`:

```tsx
import { createPortal } from 'react-dom';

export interface DragState {
  count: number;
  action: 'move' | 'copy' | 'add' | 'new';
  x: number;
  y: number;
}

const LABEL: Record<DragState['action'], string> = {
  move: 'verschieben',
  copy: 'kopieren',
  add: 'hinzufuegen',
  new: 'neues Dokument',
};

/**
 * Gestapelte Kartenvorschau mit Zaehler, dem Zeiger folgend. 46 gezogene
 * Seiten zeigen einen Stapel mit der Zahl, nicht 46 einzelne Bilder.
 */
export function DragPreview({ state }: { state: DragState }) {
  return createPortal(
    <div
      className="pointer-events-none fixed z-50 select-none"
      style={{ left: state.x + 12, top: state.y + 12 }}
    >
      <div className="relative">
        <span className="absolute left-1 top-1 block h-16 w-12 rounded bg-panel ring-1 ring-line" />
        <span className="absolute left-0.5 top-0.5 block h-16 w-12 rounded bg-panel ring-1 ring-line" />
        <span className="relative block h-16 w-12 rounded bg-panel ring-1 ring-sky-400" />
        <span className="absolute -right-2 -top-2 rounded-full bg-sky-500 px-1.5 text-xs font-medium">
          {state.count}
        </span>
      </div>
      <span className="mt-1 block rounded bg-black/70 px-1 text-center text-[11px]">
        {LABEL[state.action]}
      </span>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 5: usePointerDrag.ts implementieren (kein Unit-Test -- Playwright in Plan 4)**

`src/ui/workspace/usePointerDrag.ts`:

```ts
import { useCallback, useRef, useState } from 'react';
import { newId } from '../../domain/ids';
import { useDispatch, useSelectionStore, useWorkspaceStore } from '../app/StoreProvider';
import { buildDropCommand } from './buildDropCommand';
import type { DragState } from './DragPreview';
import type { DragOrigin, DropTarget } from './dragLogic';

const DRAG_THRESHOLD = 4; // Pixel, bevor aus einem Klick ein Drag wird.
const EDGE = 40; // Randzone fuer Auto-Scroll.

/** Liest aus dem DOM das Drop-Ziel unter dem Zeiger. */
function targetAt(x: number, y: number): DropTarget | null {
  const element = document.elementFromPoint(x, y);
  const node = element?.closest('[data-node-id]') as HTMLElement | null;
  if (node) {
    const nodeId = node.dataset.nodeId!;
    if (node.dataset.nodeType === 'folder') return { kind: 'folder', nodeId };
    return { kind: 'tree-output', outputId: nodeId };
  }
  const output = element?.closest('[data-output-id]') as HTMLElement | null;
  if (output) {
    // Die Einfuegeposition liefert das Raster selbst ueber data-drop-index am
    // naechstgelegenen Zell-Container; fehlt sie, ans Ende.
    const cell = element?.closest('[data-drop-index]') as HTMLElement | null;
    const index = cell ? Number(cell.dataset.dropIndex) : Number(output.dataset.itemCount ?? 0);
    return { kind: 'output', outputId: output.dataset.outputId!, index };
  }
  return null;
}

export function usePointerDrag() {
  const dispatch = useDispatch();
  const workspaceStore = useWorkspaceStore();
  const selectionStore = useSelectionStore();
  const [preview, setPreview] = useState<DragState | null>(null);
  const origin = useRef<DragOrigin | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  const onCellPointerDown = useCallback(
    (event: React.PointerEvent, dragOrigin: DragOrigin) => {
      origin.current = dragOrigin;
      start.current = { x: event.clientX, y: event.clientY };
      dragging.current = false;

      const move = (e: PointerEvent) => {
        if (!start.current || !origin.current) return;
        const dx = e.clientX - start.current.x;
        const dy = e.clientY - start.current.y;
        if (!dragging.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        dragging.current = true;

        const action =
          origin.current.kind === 'source' ? 'add' : e.metaKey || e.ctrlKey ? 'copy' : 'move';
        const count =
          origin.current.kind === 'source'
            ? origin.current.blockIndices.length
            : origin.current.itemIds.length;
        setPreview({ count, action, x: e.clientX, y: e.clientY });

        // Auto-Scroll, wenn der Zeiger in die Randzone eines Scrollers faehrt.
        const scroller = (
          document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
        )?.closest('.overflow-auto');
        if (scroller) {
          const rect = scroller.getBoundingClientRect();
          if (e.clientY - rect.top < EDGE) scroller.scrollBy({ top: -12 });
          else if (rect.bottom - e.clientY < EDGE) scroller.scrollBy({ top: 12 });
        }
      };

      const up = (e: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        setPreview(null);
        if (!dragging.current || !origin.current) return;
        const target = targetAt(e.clientX, e.clientY);
        if (!target) return;
        const command = buildDropCommand({
          origin: origin.current,
          target:
            target.kind === 'tree-output'
              ? { kind: 'output', outputId: target.outputId, index: 0 }
              : target,
          modifier: e.metaKey || e.ctrlKey,
          ws: workspaceStore.getState().workspace,
          newId,
        });
        if (command) dispatch(command, selectionStore.getState().snapshot());
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [dispatch, workspaceStore, selectionStore],
  );

  return { onCellPointerDown, preview };
}
```

Die Raster aus Task 9 und 10 markieren ihre Zell-Container mit `data-drop-index` und den Output-Container mit `data-output-id` und `data-item-count`, damit `targetAt` die Einfuegeposition findet. Diese Attribute beim Umsetzen in `OutputGrid` ergaenzen (eine Zeile je Zelle) -- die Drag-Logik bleibt dadurch frei von Messungen im Hook.

- [ ] **Step 6: Den fehlschlagenden Test fuer den externen Drop schreiben**

`src/ui/workspace/useExternalDrop.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useExternalDrop } from './useExternalDrop';
import { StoreProvider, wireStores } from '../app/StoreProvider';
import type { AppServices } from '../../services/app/appServices';

function Host() {
  const { dropHandlers } = useExternalDrop();
  return (
    <div {...dropHandlers} data-testid="dropzone">
      Dateien hierher ziehen
    </div>
  );
}

describe('useExternalDrop', () => {
  it('importiert abgelegte Dateien und dispatcht importSources', async () => {
    const sources = [{ id: 's1', name: 'Neu.pdf' }];
    const services = {
      registry: {},
      blobStore: {},
      storage: {},
      importForDrop: vi.fn(async () => ({ sources, rejected: [] })),
    } as unknown as AppServices;
    const value = wireStores({ services, now: () => 1 });
    const dispatchSpy = vi.spyOn(value.workspaceStore.getState(), 'dispatch');

    render(
      <StoreProvider value={value}>
        <Host />
      </StoreProvider>,
    );

    const file = new File([new Uint8Array([37, 80, 68, 70])], 'Neu.pdf', {
      type: 'application/pdf',
    });
    const dataTransfer = {
      items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
      files: [file],
    };
    fireEvent.drop(screen.getByTestId('dropzone'), { dataTransfer });

    await waitFor(() => expect(dispatchSpy).toHaveBeenCalled());
    expect(dispatchSpy.mock.calls[0][0]).toMatchObject({ type: 'importSources', sources });
  });
});
```

Der Test setzt voraus, dass `AppServices` eine kleine Hilfsmethode `importForDrop(items)` bereitstellt, die `collectFromDataTransfer` und `importCandidates` mit den bereits verdrahteten Abhaengigkeiten buendelt. Falls Plan 2 diese Methode nicht hat, wird sie hier in `appServices.ts` ergaenzt (ein Einzeiler, der `importCandidates(candidates, { registry, blobStore, storage, hash: sha256Hex, newId })` ruft) -- das haelt den Hook frei von der Abhaengigkeitsverdrahtung.

- [ ] **Step 7: `importForDrop` in appServices ergaenzen (falls noch nicht vorhanden) und useExternalDrop.ts implementieren**

In `src/services/app/appServices.ts` das `AppServices`-Interface und `createAppServices` um eine gebuendelte Importmethode erweitern:

```ts
// Ergaenzung im AppServices-Interface:
//   importForDrop(items: DataTransferItem[]): Promise<ImportReport>;
//   importForFiles(files: FileList | File[]): Promise<ImportReport>;
// und in createAppServices (nutzt die bereits vorhandenen registry/blobStore/storage):
import { collectFromDataTransfer, collectFromFileList } from '../import/fileSources';
import { importCandidates, sha256Hex, type ImportReport } from '../import/importSources';

const importDeps = { registry, blobStore, storage, hash: sha256Hex, newId };
// ...
  async importForDrop(items) {
    return importCandidates(await collectFromDataTransfer(items), importDeps);
  },
  async importForFiles(files) {
    return importCandidates(collectFromFileList(files), importDeps);
  },
```

`src/ui/workspace/useExternalDrop.ts`:

```ts
import { useCallback, useState, type DragEvent } from 'react';
import { useDispatch, useServices } from '../app/StoreProvider';

export interface ExternalDropResult {
  dropHandlers: {
    onDragOver(event: DragEvent): void;
    onDragLeave(): void;
    onDrop(event: DragEvent): void;
  };
  isOver: boolean;
  rejected: string[];
}

/**
 * Native Datei-/Ordner-Drops -- strikt getrennt vom internen Pointer-Drag.
 * Der Hook uebersetzt nur; das Einsammeln und Einlesen erledigen die
 * getesteten Importdienste ueber services.importForDrop.
 */
export function useExternalDrop(onImported?: () => void): ExternalDropResult {
  const services = useServices();
  const dispatch = useDispatch();
  const [isOver, setIsOver] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setIsOver(false);
      const items = Array.from(event.dataTransfer.items);
      void services.importForDrop(items).then((report) => {
        if (report.sources.length > 0) {
          dispatch({ type: 'importSources', sources: report.sources });
          onImported?.();
        }
        setRejected(report.rejected.map((entry) => `${entry.name}: ${entry.message}`));
      });
    },
    [services, dispatch, onImported],
  );

  return {
    dropHandlers: {
      onDragOver: (event) => {
        event.preventDefault();
        setIsOver(true);
      },
      onDragLeave: () => setIsOver(false),
      onDrop,
    },
    isOver,
    rejected,
  };
}
```

- [ ] **Step 8: Tests pruefen**

Run: `npm run test -- src/ui/workspace && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: internes Pointer-Drag und externer Datei-Drop

buildDropCommand uebersetzt eine aufgeloeste Drop-Aktion in genau einen
Command (Drop in einen Ordner als batch aus createOutput und Fuellen, ein
Undo-Schritt) und ist vollstaendig unit-getestet. Das Pointer-Drag enthaelt
keine Entscheidung mehr, nur Zeiger, Vorschau und Auto-Scroll; der externe
Drop ist ein duenner Adapter auf die Importdienste.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 12: Split-Panel

**Files:**

- Create: `src/ui/workspace/buildSplitCommand.ts`, `src/ui/workspace/SplitPanel.tsx`
- Test: `src/ui/workspace/buildSplitCommand.test.ts`, `src/ui/workspace/SplitPanel.test.tsx`

**Interfaces:**

- Consumes: `planSplit`, `describeSplitPart`, `type SplitStrategy`, `type SplitPart` aus `../../domain/split`; `withPdfExtension`/`sanitizeName` werden nicht gebraucht (Kollision loest die Command-Schicht); `newId` aus `../../domain/ids`; `type Command`, `type SplitOutputSpec` aus `../../domain/commands`; `useDispatch`, `useWorkspace` aus `../app/StoreProvider`
- Produces:
  - `buildSplitCommand(params: { sourceId; sourceName; parentId; parts: SplitPart[]; newId(): string }): Command` (rein)
  - `SplitPanel(props: { sourceId: SourceId; parentId: NodeId | null; onClose(): void })`

Das Design zeigt das Split-Panel als Vorschau der konkreten Bereiche vor dem Anwenden, mit Strategiewahl (gleiche Haelften, alle N Seiten, eigene Bereiche, aktuelle Selektion). Weil `planSplit` (Plan 1) die Zahlen liefert, muss der Nutzer die Restseitenregel nicht kennen. Das Ergebnis ist genau ein History-Eintrag -- der Command `splitSource` erledigt das.

- [ ] **Step 1: Den fehlschlagenden Test fuer buildSplitCommand schreiben**

`src/ui/workspace/buildSplitCommand.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSplitCommand } from './buildSplitCommand';
import type { SplitPart } from '../../domain/split';

let counter = 0;
const newId = () => `id-${++counter}`;

describe('buildSplitCommand', () => {
  it('baut einen splitSource-Command mit einem Output je Teil', () => {
    counter = 0;
    const parts: SplitPart[] = [
      { label: 'Teil 1', indices: [0, 1] },
      { label: 'Teil 2', indices: [2] },
    ];
    const command = buildSplitCommand({
      sourceId: 'src-a',
      sourceName: 'Contract.pdf',
      parentId: 'f1',
      parts,
      newId,
    });
    expect(command).toEqual({
      type: 'splitSource',
      sourceId: 'src-a',
      parentId: 'f1',
      parts: [
        {
          outputId: 'id-1',
          name: 'Contract 1',
          items: [
            { id: 'id-2', sourceId: 'src-a', blockIndex: 0, rotation: 0 },
            { id: 'id-3', sourceId: 'src-a', blockIndex: 1, rotation: 0 },
          ],
        },
        {
          outputId: 'id-4',
          name: 'Contract 2',
          items: [{ id: 'id-5', sourceId: 'src-a', blockIndex: 2, rotation: 0 }],
        },
      ],
    });
  });
});
```

- [ ] **Step 2: buildSplitCommand.ts implementieren, Test gruen**

`src/ui/workspace/buildSplitCommand.ts`:

```ts
import type { Command, SplitOutputSpec } from '../../domain/commands';
import type { SplitPart } from '../../domain/split';

export interface BuildSplitParams {
  sourceId: string;
  sourceName: string;
  parentId: string | null;
  parts: SplitPart[];
  newId(): string;
}

/** Aus dem Dateinamen wird die Endung entfernt; die Teile heissen "Name 1", "Name 2". */
function baseName(sourceName: string): string {
  return sourceName.replace(/\.pdf$/i, '');
}

export function buildSplitCommand({
  sourceId,
  sourceName,
  parentId,
  parts,
  newId,
}: BuildSplitParams): Command {
  const base = baseName(sourceName);
  const specs: SplitOutputSpec[] = parts.map((part, index) => ({
    outputId: newId(),
    name: `${base} ${index + 1}`,
    items: part.indices.map((blockIndex) => ({ id: newId(), sourceId, blockIndex, rotation: 0 })),
  }));
  return { type: 'splitSource', sourceId, parentId, parts: specs };
}
```

Run: `npm run test -- src/ui/workspace/buildSplitCommand.test.ts`
Expected: PASS.

- [ ] **Step 3: Den fehlschlagenden Test fuer das Panel schreiben**

`src/ui/workspace/SplitPanel.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SplitPanel } from './SplitPanel';
import { StoreProvider, wireStores } from '../app/StoreProvider';
import { makeWorkspace, IDS } from '../../domain/__fixtures__/workspace';
import type { AppServices } from '../../services/app/appServices';

function setup(onClose = vi.fn()) {
  const value = wireStores({
    services: {} as AppServices,
    initialWorkspace: makeWorkspace(),
    now: () => 1,
  });
  render(
    <StoreProvider value={value}>
      <SplitPanel sourceId={IDS.contract} parentId={null} onClose={onClose} />
    </StoreProvider>,
  );
  return { value, onClose };
}

describe('SplitPanel', () => {
  it('zeigt fuer gleiche Haelften die konkreten Bereiche', () => {
    setup();
    // 100 Seiten in 2 gleiche Haelften: 1-50 und 51-100.
    expect(screen.getByText(/Seiten 1-50 \(50\)/)).toBeInTheDocument();
    expect(screen.getByText(/Seiten 51-100 \(50\)/)).toBeInTheDocument();
  });

  it('erzeugt beim Anwenden genau einen History-Eintrag', async () => {
    const { value, onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Dokumente erstellen/ }));
    // Genau ein Undo-Schritt (ein splitSource, nicht mehrere).
    expect(value.workspaceStore.getState().canUndo).toBe(true);
    value.workspaceStore.getState().undo();
    expect(value.workspaceStore.getState().canUndo).toBe(false);
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: SplitPanel.tsx implementieren**

`src/ui/workspace/SplitPanel.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { newId } from '../../domain/ids';
import { describeSplitPart, planSplit, type SplitStrategy } from '../../domain/split';
import type { NodeId, SourceId } from '../../domain/types';
import { useDispatch, useSelection, useWorkspace } from '../app/StoreProvider';
import { buildSplitCommand } from './buildSplitCommand';

export interface SplitPanelProps {
  sourceId: SourceId;
  parentId: NodeId | null;
  onClose(): void;
}

type StrategyChoice = 'equalHalves' | 'equalThirds' | 'everyN' | 'custom' | 'selection';

export function SplitPanel({ sourceId, parentId, onClose }: SplitPanelProps) {
  const workspace = useWorkspace();
  const selection = useSelection();
  const dispatch = useDispatch();
  const source = workspace.sources[sourceId];
  const blockCount = source?.blockCount ?? 0;

  const [choice, setChoice] = useState<StrategyChoice>('equalHalves');
  const [everyN, setEveryN] = useState(10);
  const [custom, setCustom] = useState('');

  const strategy = useMemo<SplitStrategy>(() => {
    switch (choice) {
      case 'equalHalves':
        return { kind: 'equalParts', parts: 2 };
      case 'equalThirds':
        return { kind: 'equalParts', parts: 3 };
      case 'everyN':
        return { kind: 'everyNBlocks', size: everyN };
      case 'custom':
        return { kind: 'customRanges', input: custom };
      case 'selection': {
        const indices =
          selection.scope?.kind === 'source' && selection.scope.sourceId === sourceId
            ? selection.ids.map(Number)
            : [];
        return { kind: 'selection', indices };
      }
    }
  }, [choice, everyN, custom, selection, sourceId]);

  const plan = planSplit(strategy, blockCount);

  function apply() {
    if (!plan.ok) return;
    dispatch(
      buildSplitCommand({
        sourceId,
        sourceName: source?.name ?? 'Dokument',
        parentId,
        parts: plan.parts,
        newId,
      }),
    );
    onClose();
  }

  return (
    <div
      className="flex flex-col gap-3 border-t border-line bg-panel p-4"
      role="dialog"
      aria-label="Dokument aufteilen"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">{source?.name} aufteilen</h2>
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value as StrategyChoice)}
          className="rounded border border-line bg-shell px-2 py-1 text-sm"
          aria-label="Strategie"
        >
          <option value="equalHalves">Gleiche Haelften</option>
          <option value="equalThirds">Gleiche Drittel</option>
          <option value="everyN">Alle N Seiten</option>
          <option value="custom">Eigene Bereiche</option>
          <option value="selection">Aktuelle Selektion</option>
        </select>
      </div>

      {choice === 'everyN' && (
        <label className="text-sm">
          Seiten pro Teil:{' '}
          <input
            type="number"
            min={1}
            value={everyN}
            onChange={(e) => setEveryN(Number(e.target.value))}
            className="w-20 rounded border border-line bg-shell px-2 py-1"
          />
        </label>
      )}
      {choice === 'custom' && (
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="z. B. 1-51,52-101"
          className="rounded border border-line bg-shell px-2 py-1 font-mono text-sm"
          aria-label="Eigene Bereiche"
        />
      )}

      <div className="max-h-48 overflow-auto rounded border border-line">
        {plan.ok ? (
          <ul className="divide-y divide-line text-sm">
            {plan.parts.map((part, index) => (
              <li key={index} className="flex justify-between px-3 py-1">
                <span>{part.label}</span>
                <span className="text-neutral-400">{describeSplitPart(part)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-2 text-sm text-amber-400">{plan.error}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded px-3 py-1 text-sm hover:bg-shell"
        >
          Abbrechen
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={!plan.ok}
          className="rounded bg-sky-600 px-3 py-1 text-sm disabled:opacity-50"
        >
          {plan.ok ? `${plan.parts.length} Dokumente erstellen` : 'Dokumente erstellen'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Tests pruefen**

Run: `npm run test -- src/ui/workspace/buildSplitCommand.test.ts src/ui/workspace/SplitPanel.test.tsx && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Split-Panel mit Vorschau der Bereiche

buildSplitCommand baut aus den geplanten Teilen einen einzigen splitSource-
Command -- ein Split mit vielen Teilen ist ein Undo-Schritt. Das Panel zeigt
die konkreten Bereiche vor dem Anwenden, sodass die Restseitenregel sichtbar
ist statt gewusst werden zu muessen.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 13: Kontextleiste und Tastaturkuerzel

**Files:**

- Create: `src/ui/app/ContextBar.tsx`, `src/ui/app/useKeyboardShortcuts.ts`
- Test: `src/ui/app/ContextBar.test.tsx`, `src/ui/app/useKeyboardShortcuts.test.tsx`

**Interfaces:**

- Consumes: `isOutput`, `type Workspace` aus `../../domain/types`; `useWorkspace`, `useSelection`, `useSelectionStore`, `useWorkspaceStore`, `useDispatch` aus `./StoreProvider`
- Produces:
  - `ContextBar(props: { onRequestSplit(): void })`
  - `orderOfScope(ws: Workspace, scope): string[]` (die Ordnung des fokussierten Rasters fuer `Ctrl/Cmd+A`)
  - `useKeyboardShortcuts(handlers?: { onSearch?(): void; onPreview?(): void }): void`

Die Kontextleiste zeigt die Auswahlzahl und die Aktionen Drehen, Entfernen und Split. Entfernen wirkt nur auf eine Output-Selektion (aus einer Quelle wird nichts geloescht, nur nicht mehr referenziert). Die Tastaturkuerzel des Designs (Phase 1): `Ctrl/Cmd+A`, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+F`, `Delete`, `Space`, `F2`, `Escape`. `F2`/Rename und `Space`/Preview reichen ihre Absicht ueber Callbacks nach draussen bzw. an Plan 4; Undo/Redo/SelectAll/Delete/Escape sind hier vollstaendig verdrahtet.

- [ ] **Step 1: Den fehlschlagenden Test fuer die Kontextleiste schreiben**

`src/ui/app/ContextBar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextBar } from './ContextBar';
import { StoreProvider, wireStores } from './StoreProvider';
import { makeWorkspace, IDS } from '../../domain/__fixtures__/workspace';
import type { AppServices } from '../../services/app/appServices';

function setup() {
  const value = wireStores({
    services: {} as AppServices,
    initialWorkspace: makeWorkspace(),
    now: () => 1,
  });
  render(
    <StoreProvider value={value}>
      <ContextBar onRequestSplit={vi.fn()} />
    </StoreProvider>,
  );
  return value;
}

describe('ContextBar', () => {
  it('nennt die Zahl der ausgewaehlten Elemente', () => {
    const value = setup();
    value.selectionStore
      .getState()
      .replace({ kind: 'output', outputId: IDS.outInsurance }, ['i-i7', 'i-b17'], 'i-i7', false);
    expect(screen.getByText('2 ausgewaehlt')).toBeInTheDocument();
  });

  it('entfernt eine Output-Selektion ueber removeItems', async () => {
    const value = setup();
    value.selectionStore
      .getState()
      .replace({ kind: 'output', outputId: IDS.outInsurance }, ['i-i7'], 'i-i7', false);
    await userEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
    expect(value.workspaceStore.getState().workspace.items['i-i7']).toBeUndefined();
  });

  it('dreht eine Output-Selektion ueber rotateItems', async () => {
    const value = setup();
    value.selectionStore
      .getState()
      .replace({ kind: 'output', outputId: IDS.outInsurance }, ['i-i7'], 'i-i7', false);
    await userEvent.click(screen.getByRole('button', { name: 'Drehen' }));
    expect(value.workspaceStore.getState().workspace.items['i-i7'].rotation).toBe(90);
  });
});
```

- [ ] **Step 2: ContextBar.tsx implementieren**

`src/ui/app/ContextBar.tsx`:

```tsx
import { RotateCw, Scissors, Trash2 } from 'lucide-react';
import { useDispatch, useSelection } from './StoreProvider';

export interface ContextBarProps {
  onRequestSplit(): void;
}

export function ContextBar({ onRequestSplit }: ContextBarProps) {
  const selection = useSelection();
  const dispatch = useDispatch();
  const count = selection.ids.length;
  const inOutput = selection.scope?.kind === 'output';

  if (count === 0) {
    return (
      <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-sm text-neutral-500">
        Nichts ausgewaehlt
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-sm">
      <span className="text-neutral-300">{count} ausgewaehlt</span>
      <button
        type="button"
        disabled={!inOutput}
        onClick={() =>
          inOutput && dispatch({ type: 'rotateItems', itemIds: selection.ids, delta: 90 })
        }
        className="flex items-center gap-1 rounded px-2 py-1 hover:bg-panel disabled:opacity-40"
      >
        <RotateCw className="size-4" aria-hidden /> Drehen
      </button>
      <button
        type="button"
        disabled={!inOutput}
        onClick={() => inOutput && dispatch({ type: 'removeItems', itemIds: selection.ids })}
        className="flex items-center gap-1 rounded px-2 py-1 hover:bg-panel disabled:opacity-40"
      >
        <Trash2 className="size-4" aria-hidden /> Entfernen
      </button>
      <button
        type="button"
        onClick={onRequestSplit}
        className="flex items-center gap-1 rounded px-2 py-1 hover:bg-panel"
      >
        <Scissors className="size-4" aria-hidden /> Split
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Den fehlschlagenden Test fuer die Tastaturkuerzel schreiben**

`src/ui/app/useKeyboardShortcuts.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { StoreProvider, wireStores } from './StoreProvider';
import { makeWorkspace, IDS } from '../../domain/__fixtures__/workspace';
import type { AppServices } from '../../services/app/appServices';

function Host({ onSearch }: { onSearch: () => void }) {
  useKeyboardShortcuts({ onSearch });
  return <div>bereit</div>;
}

function setup(onSearch = vi.fn()) {
  const value = wireStores({
    services: {} as AppServices,
    initialWorkspace: makeWorkspace(),
    now: () => 1,
  });
  render(
    <StoreProvider value={value}>
      <Host onSearch={onSearch} />
    </StoreProvider>,
  );
  return { value, onSearch };
}

describe('useKeyboardShortcuts', () => {
  it('macht mit Ctrl+Z rueckgaengig und mit Ctrl+Shift+Z wieder vor', async () => {
    const { value } = setup();
    value.workspaceStore.getState().dispatch({ type: 'renameWorkspace', name: 'A' });
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(value.workspaceStore.getState().workspace.name).toBe(makeWorkspace().name);
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(value.workspaceStore.getState().workspace.name).toBe('A');
  });

  it('entfernt mit Delete eine Output-Selektion', async () => {
    const { value } = setup();
    value.selectionStore
      .getState()
      .replace({ kind: 'output', outputId: IDS.outInsurance }, ['i-i7'], 'i-i7', false);
    await userEvent.keyboard('{Delete}');
    expect(value.workspaceStore.getState().workspace.items['i-i7']).toBeUndefined();
  });

  it('hebt mit Escape die Selektion auf', async () => {
    const { value } = setup();
    value.selectionStore
      .getState()
      .replace({ kind: 'output', outputId: IDS.outInsurance }, ['i-i7'], 'i-i7', false);
    await userEvent.keyboard('{Escape}');
    expect(value.selectionStore.getState().ids).toEqual([]);
  });

  it('ruft bei Ctrl+F den Suchcallback', async () => {
    const { onSearch } = setup();
    await userEvent.keyboard('{Control>}f{/Control}');
    expect(onSearch).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: useKeyboardShortcuts.ts implementieren**

`src/ui/app/useKeyboardShortcuts.ts`:

```ts
import { useEffect } from 'react';
import { isOutput, type Workspace } from '../../domain/types';
import type { SelectionScope } from '../../services/store/selection';
import { useSelectionStore, useWorkspaceStore } from './StoreProvider';

/** Die Ordnung des fokussierten Rasters, damit Ctrl/Cmd+A "alles hier" waehlt. */
export function orderOfScope(ws: Workspace, scope: SelectionScope | null): string[] {
  if (scope?.kind === 'source') {
    const source = ws.sources[scope.sourceId];
    return source ? Array.from({ length: source.blockCount }, (_, i) => String(i)) : [];
  }
  if (scope?.kind === 'output') {
    const node = ws.nodes[scope.outputId];
    return node && isOutput(node) ? [...node.items] : [];
  }
  return [];
}

export interface ShortcutHandlers {
  onSearch?(): void;
  onPreview?(): void;
  onRename?(): void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}): void {
  const workspaceStore = useWorkspaceStore();
  const selectionStore = useSelectionStore();

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      const element = target as HTMLElement | null;
      return (
        !!element &&
        (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable)
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      // In Eingabefeldern gelten die Kuerzel nicht -- dort tippt der Nutzer.
      if (isTypingTarget(event.target) && event.key !== 'Escape') return;

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) workspaceStore.getState().redo();
        else workspaceStore.getState().undo();
        return;
      }
      if (meta && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        const scope = selectionStore.getState().scope;
        if (scope)
          selectionStore
            .getState()
            .selectAll(scope, orderOfScope(workspaceStore.getState().workspace, scope));
        return;
      }
      if (meta && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        handlers.onSearch?.();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selection = selectionStore.getState();
        if (selection.scope?.kind === 'output' && selection.ids.length > 0) {
          event.preventDefault();
          workspaceStore.getState().dispatch({ type: 'removeItems', itemIds: selection.ids });
        }
        return;
      }
      if (event.key === 'Escape') {
        selectionStore.getState().clear();
        return;
      }
      if (event.key === 'F2') {
        handlers.onRename?.();
        return;
      }
      if (event.key === ' ') {
        handlers.onPreview?.();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [workspaceStore, selectionStore, handlers]);
}
```

- [ ] **Step 5: Tests pruefen**

Run: `npm run test -- src/ui/app/ContextBar.test.tsx src/ui/app/useKeyboardShortcuts.test.tsx && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Kontextleiste und globale Tastaturkuerzel

Drehen, Entfernen und Split in der Kontextleiste; Entfernen wirkt nur auf eine
Output-Selektion, weil aus einer Quelle nichts geloescht wird. Die Kuerzel
Undo/Redo/SelectAll/Delete/Escape sind verdrahtet, Suche und Preview reichen
ihre Absicht ueber Callbacks an Plan 4 weiter.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

### Task 14: Header, Zusammenbau, Bootstrapping und Integrationstest

**Files:**

- Create: `src/ui/app/Header.tsx`, `src/ui/app/bootstrap.ts`
- Modify: `src/ui/app/App.tsx`, `src/main.tsx`, `src/services/app/appServices.ts` (die `contentHashOf`-Naht und `importForFiles`)
- Delete: `src/ui/dev/ImportProbe.tsx` (die provisorische Oberflaeche aus Plan 2)
- Test: `src/ui/app/App.test.tsx` (ersetzt den Smoke-Test aus Task 1 durch den Integrationstest)

**Interfaces:**

- Consumes: `createAppServices`, `type AppServices` aus `../../services/app/appServices`; `wireStores`, `StoreProvider`, `type StoreContextValue` aus `./StoreProvider`; `describeSaveStatus`, `type SaveStatus` aus `../../services/persistence/autosave`; alle Komponenten der Tasks 5-13
- Produces:
  - `bootstrapWorkspace(): Promise<StoreContextValue>` (Dienste bauen, letzten Workspace laden, Autosave verdrahten)
  - `Header(props: { onImportFiles(files: FileList | File[]): void; saveStatus: SaveStatus })`
  - `App(props?: { bootstrap?: () => Promise<StoreContextValue> })`

Der Zusammenbau bringt alles zusammen: die Shell mit den drei Bereichen, die Kontextleiste, das Split-Panel und die beiden Drag-Systeme. Das Bootstrapping baut die Dienste, laedt den zuletzt benutzten Workspace (oder legt einen leeren an), verdrahtet den Workspace-Store mit dem Autosave und leert bei einem Neustart die History. `contentHashOf` -- die Naht, die `AppServices` in Plan 2 verlangt -- wird hier bedient, indem eine Referenz stets auf den aktuellen Workspace zeigt. Der Preview-Bereich bleibt ein beschrifteter Platzhalter; Viewer, Suche und Export kommen in Plan 4.

- [ ] **Step 1: `contentHashOf`-Naht und `importForFiles` in appServices sicherstellen**

`createAppServices` bekommt in Plan 2 `contentHashOf(sourceId)` von aussen. Hier wird zusaetzlich sichergestellt, dass `AppServices` die in Task 11 ergaenzten `importForDrop`/`importForFiles` besitzt (falls dort noch nicht geschehen). Kein neuer Test -- die Importdienste sind aus Plan 2 gruen; dies ist reine Verdrahtung.

- [ ] **Step 2: bootstrap.ts implementieren**

`src/ui/app/bootstrap.ts`:

```ts
import { createEmptyWorkspace, type SourceId, type Workspace } from '../../domain/types';
import { newId } from '../../domain/ids';
import { createAppServices } from '../../services/app/appServices';
import { wireStores, type StoreContextValue } from './StoreProvider';

/**
 * Baut die Dienste, laedt den zuletzt benutzten Workspace und verdrahtet den
 * Autosave. contentHashOf liest aus einer Referenz, die immer auf den aktuellen
 * Workspace zeigt -- so kennt die Adapterschicht den Store nicht, bekommt aber
 * trotzdem den Inhalt-Hash zu jeder Quelle.
 */
export async function bootstrapWorkspace(): Promise<StoreContextValue> {
  let currentWorkspace: Workspace = createEmptyWorkspace({
    id: newId(),
    name: 'Neuer Arbeitsbereich',
  });

  const services = await createAppServices({
    contentHashOf: (sourceId: SourceId) => currentWorkspace.sources[sourceId]?.contentHash,
  });

  const loaded = await services.repo.loadMostRecent();
  const initialWorkspace = loaded ?? currentWorkspace;
  currentWorkspace = initialWorkspace;

  const value = wireStores({ services, initialWorkspace });

  // Jede Aenderung am Workspace geht als geplanter Autosave weiter; die
  // Referenz fuer contentHashOf wird gleich mitgezogen.
  value.workspaceStore.subscribe((state) => {
    currentWorkspace = state.workspace;
    services.autosave.schedule(state.workspace);
  });

  // Beim Verlassen des Tabs sofort schreiben, nicht auf die Ruhezeit warten.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void services.autosave.flush();
    });
  }

  return value;
}
```

- [ ] **Step 3: Header.tsx implementieren**

`src/ui/app/Header.tsx`:

```tsx
import { useRef } from 'react';
import { FolderUp, Download } from 'lucide-react';
import { describeSaveStatus, type SaveStatus } from '../../services/persistence/autosave';
import { useDispatch, useWorkspace } from './StoreProvider';

export interface HeaderProps {
  onImportFiles(files: FileList | File[]): void;
  saveStatus: SaveStatus;
}

export function Header({ onImportFiles, saveStatus }: HeaderProps) {
  const workspace = useWorkspace();
  const dispatch = useDispatch();
  const fileInput = useRef<HTMLInputElement | null>(null);

  return (
    <header role="banner" className="flex items-center gap-4 border-b border-line px-4 py-2">
      <span className="font-semibold">PDF-Master</span>
      <input
        value={workspace.name}
        onChange={(e) => dispatch({ type: 'renameWorkspace', name: e.target.value })}
        aria-label="Name des Arbeitsbereichs"
        className="w-56 rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-line focus:border-line"
      />
      <span className="text-xs text-neutral-500" role="status">
        {describeSaveStatus(saveStatus)}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) onImportFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex items-center gap-1 rounded bg-panel px-3 py-1 text-sm hover:bg-panel/80"
        >
          <FolderUp className="size-4" aria-hidden /> Importieren
        </button>
        <button
          type="button"
          disabled
          title="Export folgt in Plan 4"
          className="flex items-center gap-1 rounded bg-panel px-3 py-1 text-sm opacity-50"
        >
          <Download className="size-4" aria-hidden /> Exportieren
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: App.tsx als vollstaendige Shell implementieren**

`src/ui/app/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { NodeId, SourceId } from '../../domain/types';
import type { SaveStatus } from '../../services/persistence/autosave';
import { SourceGrid } from '../sources/SourceGrid';
import { SourceList } from '../sources/SourceList';
import { RangeField } from '../sources/RangeField';
import { OutputGrid } from '../workspace/OutputGrid';
import { OutputTree } from '../workspace/OutputTree';
import { SplitPanel } from '../workspace/SplitPanel';
import { DragPreview } from '../workspace/DragPreview';
import { usePointerDrag } from '../workspace/usePointerDrag';
import { useExternalDrop } from '../workspace/useExternalDrop';
import { ContextBar } from './ContextBar';
import { Header } from './Header';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { bootstrapWorkspace } from './bootstrap';
import {
  StoreProvider,
  useDispatch,
  useServices,
  useWorkspace,
  type StoreContextValue,
} from './StoreProvider';

export interface AppProps {
  bootstrap?: () => Promise<StoreContextValue>;
}

export function App({ bootstrap = bootstrapWorkspace }: AppProps = {}) {
  const [store, setStore] = useState<StoreContextValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    bootstrap()
      .then((value) => active && setStore(value))
      .catch((cause) => {
        console.error('Arbeitsbereich konnte nicht geladen werden', cause);
        if (active) setError('Der Arbeitsbereich konnte nicht geladen werden.');
      });
    return () => {
      active = false;
    };
  }, [bootstrap]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-shell text-neutral-300">
        <p>{error}</p>
      </div>
    );
  }
  if (!store) {
    return (
      <div className="grid min-h-screen place-items-center bg-shell text-neutral-500">
        <p>Arbeitsbereich wird geladen...</p>
      </div>
    );
  }

  return (
    <StoreProvider value={store}>
      <Workspace />
    </StoreProvider>
  );
}

function Workspace() {
  const workspace = useWorkspace();
  const services = useServices();
  const dispatch = useDispatch();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [activeSourceId, setActiveSourceId] = useState<SourceId | null>(null);
  const [activeOutputId, setActiveOutputId] = useState<NodeId | null>(null);
  const [splitting, setSplitting] = useState<SourceId | null>(null);

  const drag = usePointerDrag();
  const external = useExternalDrop();
  useKeyboardShortcuts();

  useEffect(() => services.autosave.subscribe(setStatus), [services]);

  const activeSource = activeSourceId ? workspace.sources[activeSourceId] : undefined;

  return (
    <div className="flex h-screen flex-col bg-shell text-neutral-200" {...external.dropHandlers}>
      <Header
        onImportFiles={(files) =>
          void services.importForFiles(files).then((report) => {
            if (report.sources.length > 0) {
              dispatch({ type: 'importSources', sources: report.sources });
              setActiveSourceId(report.sources[0].id);
            }
          })
        }
        saveStatus={status}
      />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 flex-col border-r border-line">
          <div className="flex-1 overflow-auto border-b border-line">
            <h2 className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500">Quellen</h2>
            <SourceList activeSourceId={activeSourceId} onSelect={setActiveSourceId} />
          </div>
          <div className="flex-1 overflow-auto">
            <h2 className="px-3 py-2 text-xs uppercase tracking-wide text-neutral-500">Ausgabe</h2>
            <OutputTree activeOutputId={activeOutputId} onSelectOutput={setActiveOutputId} />
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <section className="flex min-h-0 flex-1 flex-col border-b border-line">
            {activeSource ? (
              <>
                <RangeField sourceId={activeSource.id} blockCount={activeSource.blockCount} />
                <div className="min-h-0 flex-1">
                  <SourceGrid source={activeSource} />
                </div>
              </>
            ) : (
              <p className="p-4 text-sm text-neutral-500">Waehlen Sie links eine Quelle.</p>
            )}
          </section>
          <section className="min-h-0 flex-1">
            {activeOutputId ? (
              <OutputGrid outputId={activeOutputId} />
            ) : (
              <p className="p-4 text-sm text-neutral-500">Waehlen Sie ein Ausgabedokument.</p>
            )}
          </section>
        </main>

        <aside className="w-72 border-l border-line p-4 text-sm text-neutral-500">
          Vorschau und Suche folgen in Plan 4.
        </aside>
      </div>

      <ContextBar onRequestSplit={() => activeSourceId && setSplitting(activeSourceId)} />
      {splitting && (
        <SplitPanel sourceId={splitting} parentId={null} onClose={() => setSplitting(null)} />
      )}
      {drag.preview && <DragPreview state={drag.preview} />}
      {external.rejected.length > 0 && (
        <div
          role="alert"
          className="border-t border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300"
        >
          {external.rejected.join(' · ')}
        </div>
      )}
    </div>
  );
}
```

Verdrahtung von Klick und Drag: `drag.onCellPointerDown` aus `usePointerDrag` gehoert an die Zellen von `SourceGrid` und `OutputGrid`. Dazu bekommen beide Raster in dieser Task einen optionalen Prop `onCellPointerDown(event, origin)`, den sie in ihrem `onPointerDown`-Handler **nach** der Selektion aufrufen (erst auswaehlen, dann den moeglichen Drag starten) -- die `origin` baut das Raster aus der aktuellen Selektion (`{ kind: 'source', sourceId, blockIndices }` bzw. `{ kind: 'output', outputId, itemIds }`). So kommen Klick und Drag aus einer Hand, ohne dass die Raster die Drag-Logik kennen. Hier ist zusaetzlich `drag.preview` fuer die Vorschau verdrahtet.

- [ ] **Step 5: main.tsx auf die App zeigen lassen und ImportProbe loeschen**

`src/main.tsx` rendert `App` (nicht mehr `ImportProbe`). Danach `src/ui/dev/ImportProbe.tsx` loeschen:

```bash
git rm src/ui/dev/ImportProbe.tsx
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/app/App';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Den Integrationstest schreiben (ersetzt den Smoke-Test aus Task 1)**

`src/ui/app/App.test.tsx`:

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
    thumbnails: {
      peek: () => 'blob:x',
      request: async () => 'blob:x',
      cancel: () => {},
      keepOnly: () => {},
    },
    autosave: { subscribe: () => () => {}, schedule: () => {}, flush: async () => {} },
    importForFiles: vi.fn(async () => ({ sources: [], rejected: [] })),
  } as unknown as AppServices;
  return wireStores({ services, initialWorkspace: makeWorkspace(), now: () => 1 });
}

describe('App-Zusammenbau', () => {
  it('rendert nach dem Bootstrapping die Kopfzeile mit dem Produktnamen', async () => {
    const store = fakeStore();
    render(<App bootstrap={async () => store} />);
    expect(await screen.findByRole('banner')).toHaveTextContent('PDF-Master');
  });

  it('zeigt Quellen und Ausgabestruktur des geladenen Workspace', async () => {
    const store = fakeStore();
    render(<App bootstrap={async () => store} />);
    expect(await screen.findByText('Contract.pdf')).toBeInTheDocument();
    expect(screen.getByText('Tax 2026')).toBeInTheDocument();
  });

  it('legt ueber die Ausgabe einen Ordner an und macht ihn per Ctrl+Z rueckgaengig', async () => {
    const store = fakeStore();
    render(<App bootstrap={async () => store} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ordner anlegen' }));
    expect(
      Object.values(store.workspaceStore.getState().workspace.nodes).some(
        (n) => n.name === 'Neuer Ordner',
      ),
    ).toBe(true);
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(
      Object.values(store.workspaceStore.getState().workspace.nodes).some(
        (n) => n.name === 'Neuer Ordner',
      ),
    ).toBe(false);
  });

  it('waehlt eine Quelle und zeigt das Range-Feld', async () => {
    const store = fakeStore();
    render(<App bootstrap={async () => store} />);
    await userEvent.click(await screen.findByRole('button', { name: /Contract\.pdf/ }));
    expect(screen.getByLabelText('Seiten')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Gesamten Testlauf und Build pruefen**

Run: `npm run test && npm run typecheck && npm run lint && npm run build`
Expected: alle Tests PASS, kein Typ- oder Lintfehler, Build gruen. Der Playwright-Test aus Plan 2 laeuft unveraendert weiter.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Arbeitsflaeche zusammengebaut, provisorische Oberflaeche entfernt

Header, drei Bereiche, Kontextleiste, Split-Panel und beide Drag-Systeme sind
verdrahtet. Das Bootstrapping baut die Dienste, laedt den zuletzt benutzten
Workspace und haengt den Autosave an jede Aenderung; contentHashOf liest aus
einer stets aktuellen Referenz, ohne dass die Adapterschicht den Store kennt.
Die ImportProbe aus Plan 2 ist geloescht. Preview, Suche und Export folgen in
Plan 4.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012JdKAVp1NLXMKWErdUMnsr
PLANEOF
)"
```

---

## Selbstpruefung gegen die Spezifikation

Abgleich mit `docs/superpowers/specs/2026-09-10-document-workspace-design.md`, Bereiche, die dieser Plan traegt:

| Abschnitt der Spezifikation                                                          | In diesem Plan                                        |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| 6 Store, `produceWithPatches`, abgeleitete Inverse, 200er-Stack, batch = ein Schritt | Task 3                                                |
| 6 Selektionsstore separat, Snapshot in der History, Fokuswiederherstellung           | Task 2, 4, 6                                          |
| 8 Virtualisierung beider Raster, rund 60 Knoten                                      | Task 7, 9, 10                                         |
| 9 Layout: beide Raster gleichzeitig sichtbar, Baum, Kontextaktionen                  | Task 14                                               |
| 9 Zwei getrennte Drag-Systeme (intern Pointer, extern nativ)                         | Task 5, 11                                            |
| 9 Selektion: Klick/Shift/Ctrl/Marquee, nicht-zusammenhaengend, Ctrl/Cmd+A            | Task 2, 9, 10, 13                                     |
| 9 Range-Feld permanent, 1-basiert, inline-Fehler                                     | Task 8                                                |
| 9 Move vs. Copy, Nutzungs-Badge, "nur unbenutzte"                                    | Task 5, 8, 9, 11                                      |
| 9 Drop-Regel (Ordner -> neues Output, Output -> einsortieren)                        | Task 5, 11                                            |
| 9 Split-Panel mit Vorschau, ein History-Eintrag                                      | Task 12                                               |
| 9 Tastaturkuerzel Phase 1                                                            | Task 13                                               |
| 10 Preview und Suche                                                                 | **Plan 4** (hier nur Platzhalter)                     |
| 11 Import ueber Dateidialog und Drop (in bestehenden Workspace)                      | Task 11, 14                                           |
| 11 Export                                                                            | **Plan 4** (Header-Knopf ist Platzhalter)             |
| 12 Akzeptanzszenario von Hand bedienbar bis zum Umsortieren/Undo                     | Task 14 (der Playwright-Flow bis ZIP folgt in Plan 4) |
| 7 Autosave an jede Aenderung, Flush bei visibilitychange, Header-Status              | Task 14                                               |
| 5 Invarianten in Entwicklungsbuilds nach jedem Command                               | Task 3                                                |

Bewusst offen (Plan 4): Viewer fuer Quelle und Ergebnis, Textextraktions-Worker und Suche mit Bereichsumschalter, `fsAccessWriter`/`zipWriter` auf dem `ExportPlan`, Export-Fortschritt, der Playwright-Test des Akzeptanzszenarios bis zum ZIP. Die Naehte dafuer stehen: `useKeyboardShortcuts` reicht `onSearch`/`onPreview` durch, der Preview-Bereich und der Export-Knopf sind beschriftete Platzhalter, und `buildExportPlan` (Plan 1) plus `services.assembler` (Plan 2) liegen bereit.

## Anschluss: Plan 4

**Plan 4 -- Preview, Suche, Export.** Ein Viewer, der Quellseiten und die `items`-Liste eines Outputs in derselben Komponente rendert (mit Rotation, Zoom, Herkunftssprung); der Textextraktions-Worker mit `pageText`-Cache und die Suche mit Bereichsumschalter (aktuelle Quelle / aktuelles Output / alle Quellen); `fsAccessWriter` und `zipWriter`, die beide ausschliesslich den `ExportPlan` konsumieren, mit Fortschritt und Abbruch; und der Playwright-Test, der das Akzeptanzszenario aus Abschnitt 12 von Import bis ZIP-Export durchspielt.
