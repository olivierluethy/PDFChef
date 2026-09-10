# Phase 1 / Plan 1: Fundament und Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein lauffaehiges Vite/React/TypeScript-Projekt mit einer vollstaendig unit-getesteten, framework-freien Domain-Schicht (Ids, Ranges, Split, Naming, Komposition, Commands, Undo-Invarianten, ExportPlan), auf der die drei folgenden Meilensteine aufbauen.

**Architecture:** Alle Datenoperationen des Produkts sind reine Funktionen unter `src/domain`, die auf einem `Workspace`-Objekt arbeiten. Sie werden als Immer-Draft-Mutatoren geschrieben, damit der Store (Plan 3) sie mit `produceWithPatches` ausfuehren und die Undo-Inverse ableiten kann, statt sie handzuschreiben. Ids und Zeitstempel werden immer von aussen hereingegeben, nie in der Domain erzeugt -- nur so sind Commands deterministisch, testbar und als Patches wiederholbar.

**Tech Stack:** Vite, React 19, TypeScript (strict), Vitest, Immer 10, Tailwind CSS v4, ESLint (flat config) mit `import/no-restricted-paths`, npm.

**Spec:** `docs/superpowers/specs/2026-09-10-document-workspace-design.md`

## Global Constraints

- Local-first: kein Backend, kein Account, kein Upload von Dokumentinhalten, kein Analytics, keine externen Laufzeit-Requests. Auch keine externen Fonts oder CDN-Skripte.
- Schichtregel: `domain` importiert nichts aus `src` ausser `domain`; `adapters` nur `domain`; `services` nur `domain` und `adapters`; `ui` darf alles. Erzwungen per ESLint `import/no-restricted-paths` (Task 2).
- `src/domain` ist framework-frei: kein React, kein Zustand, kein pdf.js, kein Browser-API-Zugriff (Ausnahme: `crypto.getRandomValues` in `ids.ts`).
- TypeScript `strict: true`. `noUncheckedIndexedAccess` wird bewusst **nicht** aktiviert (Record-Zugriffe bleiben lesbar); fehlende Eintraege werden stattdessen explizit geprueft.
- `verbatimModuleSyntax: true` -- typ-only Importe muessen `import type` verwenden.
- Deterministische Domain: keine `Date.now()`- oder Id-Erzeugung innerhalb von `applyCommand` oder den Kompositionsoperationen. Zeit kommt als `ctx.now`, Ids kommen als Payload.
- Alle nutzersichtbaren Texte sind deutsch und verwenden **nie das scharfe s**, sondern immer `ss` (Schweizer Schreibweise). Das gilt auch fuer Fehlermeldungen und History-Labels in `domain`.
- Node 26.8.1, npm 11.19.0 (verifiziert). Paketmanager ist npm; kein yarn/pnpm/bun.
- Tests importieren `describe/it/expect` explizit aus `vitest`; keine globalen Test-APIs.
- `schemaVersion: 1` ist in jedem Workspace-Record vorhanden.
- Jeder Task endet mit gruenen Tests und einem Commit. Commit-Messages beginnen mit `feat:`, `test:`, `chore:` oder `docs:` und enden mit der Attributionszeile aus der Repo-Konvention.

## Dateistruktur dieses Plans

| Datei                                                           | Verantwortung                                            |
| --------------------------------------------------------------- | -------------------------------------------------------- |
| `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` | Build, Typen, Testrunner                                 |
| `eslint.config.js`, `.prettierrc.json`                          | Lint inkl. Schichtregel, Formatierung                    |
| `src/main.tsx`, `src/ui/app/App.tsx`, `src/ui/styles.css`       | minimale Shell, damit `npm run build` etwas ausliefert   |
| `src/domain/ids.ts`                                             | ULID-Erzeugung                                           |
| `src/domain/types.ts`                                           | Datenmodell, Typwaechter, `createEmptyWorkspace`         |
| `src/domain/invariants.ts`                                      | die sechs Workspace-Invarianten                          |
| `src/domain/__fixtures__/workspace.ts`                          | Test-Workspace (Contract/Bank/Insurance + Tax-2026-Baum) |
| `src/domain/ranges.ts`                                          | `"1-3,50-100"` parsen, normalisieren, formatieren        |
| `src/domain/split.ts`                                           | Split-Strategien -> konkrete Indexlisten                 |
| `src/domain/naming.ts`                                          | Dateinamen-Sanitisierung, Kollisionsaufloesung           |
| `src/domain/composition.ts`                                     | Item- und Node-Operationen auf dem Draft                 |
| `src/domain/commands.ts`                                        | Command-Union, `applyCommand`, `describeCommand`         |
| `src/domain/exportPlan.ts`                                      | Workspace -> `ExportPlan`                                |

Ein Barrel (`src/domain/index.ts`) wird bewusst nicht angelegt: die Konsumenten importieren modulscharf, das haelt die Abhaengigkeiten im Diff sichtbar.

---

### Task 1: Projektfundament und Ids

**Files:**

- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.prettierrc.json`
- Create: `src/main.tsx`, `src/ui/app/App.tsx`, `src/ui/styles.css`
- Create: `src/domain/ids.ts`
- Test: `src/domain/ids.test.ts`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: nichts (erster Task)
- Produces: `newId(time?: number): string` aus `src/domain/ids.ts`; npm-Skripte `dev`, `build`, `preview`, `typecheck`, `test`, `test:watch`

- [ ] **Step 1: package.json anlegen**

`npm create vite` wird nicht verwendet -- es fragt in einem nicht-leeren Verzeichnis interaktiv nach und ist damit nicht automatisierbar. Datei `package.json`:

```json
{
  "name": "pdf-master",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "npm run typecheck && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Abhaengigkeiten installieren**

```bash
npm install react@^19 react-dom@^19 immer@^10
npm install -D typescript vite @vitejs/plugin-react vitest tailwindcss@^4 @tailwindcss/vite@^4 @types/react@^19 @types/react-dom@^19
```

- [ ] **Step 3: tsconfig.json anlegen**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: vite.config.ts anlegen**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

`environment: 'node'` genuegt fuer diesen Plan -- die Domain braucht kein DOM. Plan 3 ergaenzt jsdom fuer die UI-Tests.

- [ ] **Step 5: Shell und Styles anlegen**

`index.html`:

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PDF-Master</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/ui/styles.css`:

```css
@import 'tailwindcss';

@theme {
  --color-shell: #0f1115;
  --color-panel: #171a21;
  --color-line: #262b36;
}
```

`src/ui/app/App.tsx`:

```tsx
export function App() {
  return (
    <div className="min-h-screen bg-shell text-slate-200">
      <header className="border-b border-line px-4 py-3 text-sm font-medium">PDF-Master</header>
      <main className="p-4 text-sm text-slate-400">
        Die Arbeitsflaeche entsteht in Plan 3. Die Domain-Logik liegt unter <code>src/domain</code>.
      </main>
    </div>
  );
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/app/App';
import './ui/styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root fehlt in index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`.prettierrc.json`:

```json
{
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "all"
}
```

`.gitignore` um zwei Zeilen ergaenzen (`coverage/`, `*.tsbuildinfo`).

- [ ] **Step 6: Den fehlschlagenden Test fuer die Ids schreiben**

`src/domain/ids.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { newId } from './ids';

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe('newId', () => {
  it('erzeugt 26 Zeichen aus dem Crockford-Base32-Alphabet', () => {
    expect(newId()).toMatch(ULID_PATTERN);
  });

  it('ist bei 10000 Aufrufen kollisionsfrei', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) ids.add(newId());
    expect(ids.size).toBe(10_000);
  });

  it('sortiert lexikografisch nach Entstehungszeit', () => {
    const earlier = newId(1_700_000_000_000);
    const later = newId(1_700_000_000_001);
    expect(earlier < later).toBe(true);
  });

  it('kodiert dieselbe Zeit in denselben ersten zehn Zeichen', () => {
    const a = newId(1_700_000_000_000);
    const b = newId(1_700_000_000_000);
    expect(a.slice(0, 10)).toBe(b.slice(0, 10));
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 7: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/domain/ids.test.ts`
Expected: FAIL, `Failed to resolve import "./ids"`.

- [ ] **Step 8: ids.ts implementieren**

`src/domain/ids.ts`:

```ts
// ULID: 48 Bit Zeit (10 Zeichen) + 80 Bit Zufall (16 Zeichen) in Crockford-Base32.
// Lexikografische Sortierung entspricht der Entstehungsreihenfolge, was Debugging und
// stabile Reihenfolgen in Tests erleichtert.
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

function encodeTime(time: number): string {
  let rest = Math.floor(time);
  let out = '';
  for (let i = 0; i < TIME_LENGTH; i++) {
    const digit = rest % 32;
    out = ENCODING.charAt(digit) + out;
    rest = (rest - digit) / 32;
  }
  return out;
}

function encodeRandom(): string {
  const bytes = new Uint8Array(RANDOM_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  // 256 ist ohne Rest durch 32 teilbar, der Modulo bleibt gleichverteilt.
  for (let i = 0; i < RANDOM_LENGTH; i++) out += ENCODING.charAt(bytes[i] % 32);
  return out;
}

export function newId(time: number = Date.now()): string {
  return encodeTime(time) + encodeRandom();
}
```

- [ ] **Step 9: Tests, Typecheck und Build pruefen**

Run: `npm run test && npm run typecheck && npm run build`
Expected: 4 Tests PASS, kein Typfehler, `dist/` wird geschrieben.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: Projektfundament (Vite, React 19, TS strict, Vitest) und ULID-Erzeugung

Kein npm create vite: das Verzeichnis ist nicht leer und der Generator fragt
interaktiv nach. Konfiguration daher von Hand, dafuer exakt und wiederholbar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Lint, Formatierung und Schichtregel

**Files:**

- Create: `eslint.config.js`
- Modify: `package.json` (Skripte `lint`, `format`)

**Interfaces:**

- Consumes: Projektfundament aus Task 1
- Produces: npm-Skripte `lint` und `format`; die Schichtregel, gegen die alle folgenden Tasks und Plaene verstossen koennen, ohne es zu merken

- [ ] **Step 1: Lint-Abhaengigkeiten installieren**

```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-import eslint-import-resolver-typescript prettier
```

- [ ] **Step 2: Skripte ergaenzen**

In `package.json` unter `scripts`:

```json
{
  "lint": "eslint .",
  "format": "prettier --write ."
}
```

- [ ] **Step 3: eslint.config.js anlegen**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
    },
    rules: {
      // Abhaengigkeitsrichtung der Architektur. `except` ist relativ zu `from`.
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/domain',
              from: './src',
              except: ['./domain'],
              message: 'domain darf nichts ausserhalb von domain importieren.',
            },
            {
              target: './src/adapters',
              from: './src',
              except: ['./adapters', './domain'],
              message: 'adapters darf nur domain importieren.',
            },
            {
              target: './src/services',
              from: './src',
              except: ['./services', './adapters', './domain'],
              message: 'services darf nur domain und adapters importieren.',
            },
            {
              target: './src/workers',
              from: './src',
              except: ['./workers', './adapters', './domain'],
              message: 'workers darf nur domain und adapters importieren.',
            },
          ],
        },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
```

- [ ] **Step 4: Sauberen Zustand pruefen**

Run: `npm run lint`
Expected: PASS, keine Meldung.

- [ ] **Step 5: Die Regel gegen einen echten Verstoss pruefen**

Eine nicht aufloesbare Import-Angabe wuerde von `import/no-restricted-paths` uebersprungen, deshalb muessen beide Dateien wirklich existieren:

```bash
mkdir -p src/services
printf 'export const marker = 1;\n' > src/services/layering-probe.ts
printf "import { marker } from '../services/layering-probe';\nexport const probe = marker;\n" > src/domain/layering-probe.ts
npm run lint
```

Expected: FAIL mit `domain darf nichts ausserhalb von domain importieren` (`import/no-restricted-paths`).

- [ ] **Step 6: Probe entfernen und erneut pruefen**

```bash
rm src/domain/layering-probe.ts src/services/layering-probe.ts
rmdir src/services
npm run lint && npm run format
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: ESLint mit erzwungener Schichtregel und Prettier

import/no-restricted-paths haelt die Abhaengigkeitsrichtung
domain <- adapters <- services <- ui ein. Die Regel wurde gegen einen
absichtlichen Verstoss geprueft, weil unaufloesbare Importe stillschweigend
uebersprungen werden und die Konfiguration sonst wirkungslos waere.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Datenmodell, Invarianten und Test-Fixture

**Files:**

- Create: `src/domain/types.ts`, `src/domain/invariants.ts`, `src/domain/__fixtures__/workspace.ts`
- Test: `src/domain/invariants.test.ts`

**Interfaces:**

- Consumes: nichts
- Produces:
  - Typen `SourceId`, `NodeId`, `ItemId`, `ParentKey`, `BlockKind`, `SourceKind`, `TargetFormat`, `Rotation`, `SourceStatus`, `BlockRef`, `OutlineNode`, `SourceDocument`, `CompositionItem`, `FolderNode`, `OutputDocument`, `WorkspaceNode`, `Workspace`
  - `ROOT: ParentKey`, `parentKey(parentId: NodeId | null): ParentKey`, `isFolder(node): node is FolderNode`, `isOutput(node): node is OutputDocument`, `createEmptyWorkspace(input: { id: string; name: string; now?: number }): Workspace`
  - `checkWorkspaceInvariants(ws: Workspace): string[]`, `assertWorkspaceInvariants(ws: Workspace): void`
  - Fixture: `makeWorkspace(): Workspace`, `makeSource(id, name, blockCount): SourceDocument`, `makeItem(id, sourceId, blockIndex, rotation?): CompositionItem`, `IDS`

- [ ] **Step 1: types.ts schreiben**

Kein Test-first fuer reine Typdeklarationen -- es gibt kein Verhalten zu pruefen. Das Verhalten in dieser Datei (`createEmptyWorkspace`, `parentKey`) wird durch die Invariantentests in Schritt 3 abgedeckt.

`src/domain/types.ts`:

```ts
export type SourceId = string;
export type NodeId = string;
export type ItemId = string;

/** Schluessel in `Workspace.childOrder`: die Node-Id des Ordners oder 'root'. */
export type ParentKey = NodeId | 'root';
export const ROOT: ParentKey = 'root';

export type BlockKind = 'page' | 'slide' | 'sheet' | 'image' | 'section';
export type SourceKind = 'pdf';
export type TargetFormat = 'pdf';
export type Rotation = 0 | 90 | 180 | 270;
export type SourceStatus = 'ready' | 'error' | 'encrypted';

/** Herkunft eines Blocks: welches Quelldokument, welcher 0-basierte Index. */
export interface BlockRef {
  sourceId: SourceId;
  blockIndex: number;
}

export interface OutlineNode {
  title: string;
  blockIndex: number | null;
  children: OutlineNode[];
}

export interface SourceDocument {
  id: SourceId;
  kind: SourceKind;
  name: string;
  importPath?: string;
  blobKey: string;
  byteSize: number;
  contentHash: string;
  blockKind: BlockKind;
  blockCount: number;
  blockRotations: number[];
  outline?: OutlineNode[];
  status: SourceStatus;
  statusDetail?: string;
}

/** Eine Instanz einer Quellseite in genau einem Output. Eine Kopie ist ein zweites Item. */
export interface CompositionItem {
  id: ItemId;
  sourceId: SourceId;
  blockIndex: number;
  /** Additiv zur Rotation der Quellseite. */
  rotation: Rotation;
}

export interface FolderNode {
  id: NodeId;
  type: 'folder';
  name: string;
  parentId: NodeId | null;
}

export interface OutputDocument {
  id: NodeId;
  type: 'output';
  name: string;
  parentId: NodeId | null;
  targetFormat: TargetFormat;
  /** Die Reihenfolge dieser Liste IST die Seitenreihenfolge des Exports. */
  items: ItemId[];
}

export type WorkspaceNode = FolderNode | OutputDocument;

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
  sources: Record<SourceId, SourceDocument>;
  sourceOrder: SourceId[];
  nodes: Record<NodeId, WorkspaceNode>;
  childOrder: Record<ParentKey, NodeId[]>;
  items: Record<ItemId, CompositionItem>;
}

export function parentKey(parentId: NodeId | null): ParentKey {
  return parentId ?? ROOT;
}

export function isFolder(node: WorkspaceNode): node is FolderNode {
  return node.type === 'folder';
}

export function isOutput(node: WorkspaceNode): node is OutputDocument {
  return node.type === 'output';
}

export interface CreateWorkspaceInput {
  id: string;
  name: string;
  now?: number;
}

export function createEmptyWorkspace({
  id,
  name,
  now = Date.now(),
}: CreateWorkspaceInput): Workspace {
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    sources: {},
    sourceOrder: [],
    nodes: {},
    childOrder: { root: [] },
    items: {},
  };
}
```

- [ ] **Step 2: Fixture schreiben**

Die Fixture baut den Workspace absichtlich von Hand auf, ohne `composition.ts` zu benutzen: ein Testdatensatz, der die zu testende Einheit verwendet, verdeckt deren Fehler.

`src/domain/__fixtures__/workspace.ts`:

```ts
import type {
  CompositionItem,
  ItemId,
  NodeId,
  Rotation,
  SourceDocument,
  SourceId,
  Workspace,
} from '../types';
import { createEmptyWorkspace, parentKey } from '../types';

export const IDS = {
  contract: 'src-contract',
  bank: 'src-bank',
  insurance: 'src-insurance',
  tax: 'n-tax',
  folderBank: 'n-folder-bank',
  folderInsurance: 'n-folder-insurance',
  folderContracts: 'n-folder-contracts',
  outContracts: 'n-out-contracts',
  outInsurance: 'n-out-insurance',
} as const;

export const FIXED_NOW = 1_700_000_000_000;

export function makeSource(id: SourceId, name: string, blockCount: number): SourceDocument {
  return {
    id,
    kind: 'pdf',
    name,
    blobKey: `hash-${id}`,
    byteSize: blockCount * 1024,
    contentHash: `hash-${id}`,
    blockKind: 'page',
    blockCount,
    blockRotations: new Array<number>(blockCount).fill(0),
    status: 'ready',
  };
}

export function makeItem(
  id: ItemId,
  sourceId: SourceId,
  blockIndex: number,
  rotation: Rotation = 0,
): CompositionItem {
  return { id, sourceId, blockIndex, rotation };
}

function addFolder(ws: Workspace, id: NodeId, name: string, parentId: NodeId | null): void {
  ws.nodes[id] = { id, type: 'folder', name, parentId };
  ws.childOrder[id] = [];
  (ws.childOrder[parentKey(parentId)] ??= []).push(id);
}

function addOutput(
  ws: Workspace,
  id: NodeId,
  name: string,
  parentId: NodeId | null,
  items: CompositionItem[],
): void {
  ws.nodes[id] = {
    id,
    type: 'output',
    name,
    parentId,
    targetFormat: 'pdf',
    items: items.map((i) => i.id),
  };
  for (const item of items) ws.items[item.id] = item;
  (ws.childOrder[parentKey(parentId)] ??= []).push(id);
}

/**
 * Der Workspace aus dem Akzeptanzszenario, kurz nach dem Import:
 * drei Quellen, der Ordnerbaum `Tax 2026/{Bank,Insurance,Contracts}`
 * und zwei bereits gefuellte Outputs.
 */
export function makeWorkspace(): Workspace {
  const ws = createEmptyWorkspace({ id: 'ws-test', name: 'Testablage', now: FIXED_NOW });

  for (const source of [
    makeSource(IDS.contract, 'Contract.pdf', 100),
    makeSource(IDS.bank, 'Bank.pdf', 50),
    makeSource(IDS.insurance, 'Insurance.pdf', 30),
  ]) {
    ws.sources[source.id] = source;
    ws.sourceOrder.push(source.id);
  }

  addFolder(ws, IDS.tax, 'Tax 2026', null);
  addFolder(ws, IDS.folderBank, 'Bank', IDS.tax);
  addFolder(ws, IDS.folderInsurance, 'Insurance', IDS.tax);
  addFolder(ws, IDS.folderContracts, 'Contracts', IDS.tax);

  addOutput(ws, IDS.outContracts, 'Contracts', IDS.folderContracts, [
    makeItem('i-c4', IDS.contract, 3),
    makeItem('i-c5', IDS.contract, 4),
    makeItem('i-c6', IDS.contract, 5),
  ]);
  addOutput(ws, IDS.outInsurance, 'Insurance', IDS.folderInsurance, [
    makeItem('i-i7', IDS.insurance, 6),
    makeItem('i-b17', IDS.bank, 16),
  ]);

  return ws;
}
```

- [ ] **Step 3: Den fehlschlagenden Test fuer die Invarianten schreiben**

`src/domain/invariants.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { IDS, makeItem, makeWorkspace } from './__fixtures__/workspace';
import { assertWorkspaceInvariants, checkWorkspaceInvariants } from './invariants';
import type { OutputDocument } from './types';

function output(ws: ReturnType<typeof makeWorkspace>, id: string): OutputDocument {
  const node = ws.nodes[id];
  if (!node || node.type !== 'output') throw new Error(`Fixture kaputt: ${id}`);
  return node;
}

describe('checkWorkspaceInvariants', () => {
  it('meldet fuer die Fixture nichts', () => {
    expect(checkWorkspaceInvariants(makeWorkspace())).toEqual([]);
  });

  it('meldet ein Item, das in zwei Outputs steht (Invariante 2)', () => {
    const ws = makeWorkspace();
    output(ws, IDS.outInsurance).items.push('i-c4');
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain('i-c4');
  });

  it('meldet ein Item ohne Output (Invariante 2)', () => {
    const ws = makeWorkspace();
    ws.items['i-waise'] = makeItem('i-waise', IDS.bank, 1);
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain('i-waise');
  });

  it('meldet ein Item mit unbekannter Quelle (Invariante 3)', () => {
    const ws = makeWorkspace();
    ws.items['i-c4'].sourceId = 'src-weg';
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain('src-weg');
  });

  it('meldet einen blockIndex ausserhalb des Dokuments (Invariante 4)', () => {
    const ws = makeWorkspace();
    ws.items['i-b17'].blockIndex = 50;
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain('blockIndex 50');
  });

  it('meldet eine Node, die in childOrder fehlt (Invariante 5)', () => {
    const ws = makeWorkspace();
    ws.childOrder[IDS.tax] = ws.childOrder[IDS.tax].filter((id) => id !== IDS.folderBank);
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain(IDS.folderBank);
  });

  it('meldet einen Ordner, der sein eigener Vorfahre ist (Invariante 6)', () => {
    const ws = makeWorkspace();
    ws.nodes[IDS.tax].parentId = IDS.folderBank;
    ws.childOrder[IDS.folderBank] = [IDS.tax];
    ws.childOrder['root'] = [];
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain('Vorfahre');
  });

  it('meldet eine Node, die in einem Output statt in einem Ordner liegt (Invariante 1)', () => {
    const ws = makeWorkspace();
    ws.nodes[IDS.folderBank].parentId = IDS.outInsurance;
    ws.childOrder[IDS.tax] = ws.childOrder[IDS.tax].filter((id) => id !== IDS.folderBank);
    ws.childOrder[IDS.outInsurance] = [IDS.folderBank];
    expect(checkWorkspaceInvariants(ws).join('\n')).toContain('kein Ordner');
  });
});

describe('assertWorkspaceInvariants', () => {
  it('wirft mit allen Verletzungen im Text', () => {
    const ws = makeWorkspace();
    ws.items['i-c4'].blockIndex = 999;
    expect(() => assertWorkspaceInvariants(ws)).toThrow(/Workspace-Invarianten verletzt/);
  });

  it('wirft nicht fuer einen gesunden Workspace', () => {
    expect(() => assertWorkspaceInvariants(makeWorkspace())).not.toThrow();
  });
});
```

- [ ] **Step 4: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/domain/invariants.test.ts`
Expected: FAIL, `Failed to resolve import "./invariants"`.

- [ ] **Step 5: invariants.ts implementieren**

`src/domain/invariants.ts`:

```ts
import type { ItemId, NodeId, ParentKey, Workspace } from './types';
import { parentKey } from './types';

/**
 * Prueft die sechs Invarianten aus dem Design und liefert die Verletzungen als Text.
 * Rueckgabe statt Wurf, damit Tests alle Probleme auf einmal sehen.
 */
export function checkWorkspaceInvariants(ws: Workspace): string[] {
  const problems: string[] = [];
  const ownerOfItem = new Map<ItemId, NodeId>();

  for (const node of Object.values(ws.nodes)) {
    if (node.parentId !== null) {
      const parent = ws.nodes[node.parentId];
      if (!parent) {
        problems.push(`Node ${node.id} verweist auf den unbekannten Ordner ${node.parentId}`);
      } else if (parent.type !== 'folder') {
        problems.push(`Node ${node.id} liegt in ${parent.id}, das kein Ordner ist`);
      }
    }

    if (node.type !== 'output') continue;

    for (const itemId of node.items) {
      const owner = ownerOfItem.get(itemId);
      if (owner !== undefined) {
        problems.push(`Item ${itemId} steht in ${owner} und in ${node.id}`);
      } else {
        ownerOfItem.set(itemId, node.id);
      }

      const item = ws.items[itemId];
      if (!item) {
        problems.push(`Item ${itemId} steht in ${node.id}, fehlt aber in items`);
        continue;
      }

      const source = ws.sources[item.sourceId];
      if (!source) {
        problems.push(`Item ${itemId} verweist auf die unbekannte Quelle ${item.sourceId}`);
        continue;
      }
      if (item.blockIndex < 0 || item.blockIndex >= source.blockCount) {
        problems.push(
          `Item ${itemId} hat blockIndex ${item.blockIndex} ausserhalb von [0, ${source.blockCount})`,
        );
      }
    }
  }

  for (const itemId of Object.keys(ws.items)) {
    if (!ownerOfItem.has(itemId)) problems.push(`Item ${itemId} liegt in keinem Output`);
  }

  const placed = new Set<NodeId>();
  for (const [key, children] of Object.entries(ws.childOrder) as [ParentKey, NodeId[]][]) {
    for (const childId of children) {
      if (placed.has(childId)) problems.push(`Node ${childId} steht mehrfach in childOrder`);
      placed.add(childId);
      const child = ws.nodes[childId];
      if (!child) {
        problems.push(`childOrder[${key}] nennt die unbekannte Node ${childId}`);
        continue;
      }
      if (parentKey(child.parentId) !== key) {
        problems.push(`Node ${childId} steht unter ${key}, hat aber parentId ${child.parentId}`);
      }
    }
  }
  for (const node of Object.values(ws.nodes)) {
    if (!placed.has(node.id)) problems.push(`Node ${node.id} fehlt in childOrder`);
  }

  for (const node of Object.values(ws.nodes)) {
    const seen = new Set<NodeId>([node.id]);
    let current = node.parentId;
    while (current !== null) {
      if (seen.has(current)) {
        problems.push(`Node ${node.id} ist ihr eigener Vorfahre`);
        break;
      }
      seen.add(current);
      const parent = ws.nodes[current];
      if (!parent) break;
      current = parent.parentId;
    }
  }

  for (const sourceId of ws.sourceOrder) {
    if (!ws.sources[sourceId]) problems.push(`sourceOrder nennt die unbekannte Quelle ${sourceId}`);
  }
  for (const sourceId of Object.keys(ws.sources)) {
    if (!ws.sourceOrder.includes(sourceId))
      problems.push(`Quelle ${sourceId} fehlt in sourceOrder`);
  }

  return problems;
}

/** In Entwicklungsbuilds nach jedem Command aufzurufen (siehe Plan 3). */
export function assertWorkspaceInvariants(ws: Workspace): void {
  const problems = checkWorkspaceInvariants(ws);
  if (problems.length > 0) {
    throw new Error(`Workspace-Invarianten verletzt:\n- ${problems.join('\n- ')}`);
  }
}
```

- [ ] **Step 6: Tests pruefen**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: alle Tests PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: Datenmodell, Workspace-Invarianten und Test-Fixture

Die sechs Invarianten aus dem Design als pruefbare Funktion. Die Fixture baut
den Workspace des Akzeptanzszenarios ohne die zu testenden Operationen auf.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Seitenbereiche (`ranges.ts`)

**Files:**

- Create: `src/domain/ranges.ts`
- Test: `src/domain/ranges.test.ts`

**Interfaces:**

- Consumes: nichts
- Produces:
  - `interface RangeSpec { start: number; end: number }` (1-basiert, inklusiv)
  - `type ParseRangesResult = { ok: true; ranges: RangeSpec[]; indices: number[] } | { ok: false; error: string }`
  - `parseRanges(input: string, blockCount: number): ParseRangesResult`
  - `mergeRanges(ranges: RangeSpec[]): RangeSpec[]`
  - `normalizeRanges(ranges: RangeSpec[], blockCount: number): RangeSpec[]`
  - `rangesToIndices(ranges: RangeSpec[]): number[]` (0-basiert)
  - `indicesToRanges(indices: number[]): RangeSpec[]`
  - `formatRanges(indices: number[]): string`

Konvention, die im ganzen Projekt gilt: **Eingabe und Anzeige sind 1-basiert, alles Interne ist 0-basiert.** Die Umrechnung passiert ausschliesslich hier.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/domain/ranges.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatRanges, indicesToRanges, mergeRanges, normalizeRanges, parseRanges } from './ranges';

describe('parseRanges', () => {
  it('liest einen einfachen Bereich 1-basiert und liefert 0-basierte Indizes', () => {
    const result = parseRanges('4-49', 100);
    expect(result).toEqual({
      ok: true,
      ranges: [{ start: 4, end: 49 }],
      indices: expect.any(Array),
    });
    if (!result.ok) throw new Error('unerwartet');
    expect(result.indices).toHaveLength(46);
    expect(result.indices[0]).toBe(3);
    expect(result.indices.at(-1)).toBe(48);
  });

  it('liest mehrere Bereiche', () => {
    const result = parseRanges('1-3,50-100', 100);
    if (!result.ok) throw new Error('unerwartet');
    expect(result.indices).toHaveLength(54);
    expect(result.ranges).toEqual([
      { start: 1, end: 3 },
      { start: 50, end: 100 },
    ]);
  });

  it('liest eine einzelne Seite', () => {
    const result = parseRanges('7', 30);
    if (!result.ok) throw new Error('unerwartet');
    expect(result.indices).toEqual([6]);
  });

  it('akzeptiert Leerzeichen um Zahlen und Kommas', () => {
    const result = parseRanges(' 1 - 3 , 7 ', 30);
    if (!result.ok) throw new Error('unerwartet');
    expect(result.ranges).toEqual([
      { start: 1, end: 3 },
      { start: 7, end: 7 },
    ]);
  });

  it('dreht absteigende Bereiche um', () => {
    const result = parseRanges('50-10', 100);
    if (!result.ok) throw new Error('unerwartet');
    expect(result.ranges).toEqual([{ start: 10, end: 50 }]);
  });

  it('fuehrt ueberlappende und angrenzende Bereiche zusammen', () => {
    const result = parseRanges('1-5,4-8,9-10', 100);
    if (!result.ok) throw new Error('unerwartet');
    expect(result.ranges).toEqual([{ start: 1, end: 10 }]);
  });

  it('deckelt das Ende auf die Seitenzahl', () => {
    const result = parseRanges('90-500', 100);
    if (!result.ok) throw new Error('unerwartet');
    expect(result.ranges).toEqual([{ start: 90, end: 100 }]);
  });

  it('liefert fuer leere Eingabe eine leere Auswahl statt eines Fehlers', () => {
    expect(parseRanges('   ', 100)).toEqual({ ok: true, ranges: [], indices: [] });
  });

  it('meldet einen Bereich, der ganz hinter dem Dokument liegt', () => {
    expect(parseRanges('120-140', 100)).toEqual({
      ok: false,
      error: 'Das Dokument hat nur 100 Seiten.',
    });
  });

  it('meldet Seite 0', () => {
    expect(parseRanges('0-5', 100)).toEqual({
      ok: false,
      error: 'Seitenzahlen beginnen bei 1.',
    });
  });

  it('meldet unlesbare Eingabe mit dem stoerenden Teil', () => {
    const result = parseRanges('4-49,abc', 100);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unerwartet');
    expect(result.error).toContain('abc');
  });

  it('meldet ein leeres Glied', () => {
    expect(parseRanges('1-3,,7', 100).ok).toBe(false);
  });
});

describe('mergeRanges', () => {
  it('sortiert und verschmilzt unabhaengig von der Eingabereihenfolge', () => {
    expect(
      mergeRanges([
        { start: 50, end: 60 },
        { start: 1, end: 3 },
        { start: 55, end: 70 },
      ]),
    ).toEqual([
      { start: 1, end: 3 },
      { start: 50, end: 70 },
    ]);
  });
});

describe('normalizeRanges', () => {
  it('deckelt, dreht und verwirft Bereiche hinter dem Dokument', () => {
    expect(
      normalizeRanges(
        [
          { start: 8, end: 2 },
          { start: 200, end: 300 },
          { start: 25, end: 40 },
        ],
        30,
      ),
    ).toEqual([
      { start: 2, end: 8 },
      { start: 25, end: 30 },
    ]);
  });
});

describe('indicesToRanges / formatRanges', () => {
  it('fasst zusammenhaengende Indizes zusammen und schreibt 1-basiert', () => {
    expect(formatRanges([3, 4, 5, 6, 49, 50])).toBe('4-7,50-51');
  });

  it('schreibt Einzelseiten ohne Bindestrich', () => {
    expect(formatRanges([6])).toBe('7');
  });

  it('sortiert und entdoppelt vorher', () => {
    expect(indicesToRanges([5, 3, 4, 3])).toEqual([{ start: 4, end: 6 }]);
  });

  it('liefert fuer eine leere Auswahl den leeren Text', () => {
    expect(formatRanges([])).toBe('');
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/domain/ranges.test.ts`
Expected: FAIL, `Failed to resolve import "./ranges"`.

- [ ] **Step 3: ranges.ts implementieren**

`src/domain/ranges.ts`:

```ts
/** Ein Seitenbereich in der Schreibweise des Nutzers: 1-basiert und inklusiv. */
export interface RangeSpec {
  start: number;
  end: number;
}

export type ParseRangesResult =
  { ok: true; ranges: RangeSpec[]; indices: number[] } | { ok: false; error: string };

/**
 * Liest Eingaben wie `4-49` oder `1-3,50-100`.
 * Absteigende Bereiche werden gedreht, ueberlappende und angrenzende verschmolzen,
 * das Ende auf `blockCount` gedeckelt. Ein Bereich, der vollstaendig hinter dem
 * Dokument liegt, ist ein Fehler statt einer stillen Leerauswahl -- sonst haette
 * der Nutzer keinen Hinweis auf seinen Tippfehler.
 */
export function parseRanges(input: string, blockCount: number): ParseRangesResult {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: true, ranges: [], indices: [] };
  if (blockCount <= 0) return { ok: false, error: 'Das Dokument hat keine Seiten.' };

  const parsed: RangeSpec[] = [];
  for (const part of trimmed.split(',')) {
    const token = part.trim();
    if (token === '') return { ok: false, error: `Leerer Bereich in "${trimmed}".` };

    const segments = token.split('-').map((segment) => segment.trim());
    if (segments.length > 2 || segments.some((segment) => !/^\d+$/.test(segment))) {
      return {
        ok: false,
        error: `"${token}" ist kein Seitenbereich. Erlaubt sind z. B. 7 oder 4-49.`,
      };
    }

    const first = Number(segments[0]);
    const second = segments.length === 2 ? Number(segments[1]) : first;
    if (first === 0 || second === 0) return { ok: false, error: 'Seitenzahlen beginnen bei 1.' };

    const start = Math.min(first, second);
    const end = Math.max(first, second);
    if (start > blockCount)
      return { ok: false, error: `Das Dokument hat nur ${blockCount} Seiten.` };

    parsed.push({ start, end: Math.min(end, blockCount) });
  }

  const ranges = mergeRanges(parsed);
  return { ok: true, ranges, indices: rangesToIndices(ranges) };
}

export function mergeRanges(ranges: RangeSpec[]): RangeSpec[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: RangeSpec[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    // `last.end + 1`: 1-3 und 4-8 sind zusammenhaengend und werden zu 1-8.
    if (last && range.start <= last.end + 1) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

export function normalizeRanges(ranges: RangeSpec[], blockCount: number): RangeSpec[] {
  const clamped: RangeSpec[] = [];
  for (const range of ranges) {
    const start = Math.max(1, Math.min(range.start, range.end));
    const end = Math.min(Math.max(range.start, range.end), blockCount);
    if (start <= end) clamped.push({ start, end });
  }
  return mergeRanges(clamped);
}

export function rangesToIndices(ranges: RangeSpec[]): number[] {
  const indices: number[] = [];
  for (const range of ranges) {
    for (let page = range.start; page <= range.end; page++) indices.push(page - 1);
  }
  return indices;
}

export function indicesToRanges(indices: number[]): RangeSpec[] {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  const ranges: RangeSpec[] = [];
  for (const index of sorted) {
    const page = index + 1;
    const last = ranges[ranges.length - 1];
    if (last && page === last.end + 1) last.end = page;
    else ranges.push({ start: page, end: page });
  }
  return ranges;
}

/** Gegenrichtung zu `parseRanges`: 0-basierte Indizes -> `4-49` fuer das Range-Feld. */
export function formatRanges(indices: number[]): string {
  return indicesToRanges(indices)
    .map((range) => (range.start === range.end ? `${range.start}` : `${range.start}-${range.end}`))
    .join(',');
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/domain/ranges.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: Seitenbereiche parsen, normalisieren und formatieren

Eingabe und Anzeige 1-basiert, alles Interne 0-basiert; die Umrechnung liegt
nur in diesem Modul. Ein Bereich hinter dem Dokumentende meldet einen Fehler,
statt still nichts auszuwaehlen.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Split-Strategien (`split.ts`)

**Files:**

- Create: `src/domain/split.ts`
- Test: `src/domain/split.test.ts`

**Interfaces:**

- Consumes: `parseRanges`, `rangesToIndices`, `formatRanges` aus `./ranges`
- Produces:
  - `type SplitStrategy = { kind: 'equalParts'; parts: number } | { kind: 'everyNBlocks'; size: number } | { kind: 'customRanges'; input: string } | { kind: 'selection'; indices: number[] }`
  - `interface SplitPart { label: string; indices: number[] }`
  - `type SplitPlanResult = { ok: true; parts: SplitPart[] } | { ok: false; error: string }`
  - `planSplit(strategy: SplitStrategy, blockCount: number): SplitPlanResult`
  - `describeSplitPart(part: SplitPart): string`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/domain/split.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { describeSplitPart, planSplit } from './split';

function sizes(result: ReturnType<typeof planSplit>): number[] {
  if (!result.ok) throw new Error(`unerwarteter Fehler: ${result.error}`);
  return result.parts.map((part) => part.indices.length);
}

describe('planSplit / equalParts', () => {
  it('teilt 100 Seiten in zwei gleiche Haelften', () => {
    expect(sizes(planSplit({ kind: 'equalParts', parts: 2 }, 100))).toEqual([50, 50]);
  });

  it('gibt bei 101 Seiten die Restseite an den vorderen Teil', () => {
    expect(sizes(planSplit({ kind: 'equalParts', parts: 2 }, 101))).toEqual([51, 50]);
  });

  it('verteilt zwei Restseiten auf die ersten beiden Drittel', () => {
    expect(sizes(planSplit({ kind: 'equalParts', parts: 3 }, 101))).toEqual([34, 34, 33]);
  });

  it('liefert lueckenlos aufsteigende Indizes', () => {
    const result = planSplit({ kind: 'equalParts', parts: 2 }, 101);
    if (!result.ok) throw new Error('unerwartet');
    expect(result.parts[0].indices[0]).toBe(0);
    expect(result.parts[0].indices.at(-1)).toBe(50);
    expect(result.parts[1].indices[0]).toBe(51);
    expect(result.parts[1].indices.at(-1)).toBe(100);
  });

  it('nummeriert die Teile ab 1', () => {
    const result = planSplit({ kind: 'equalParts', parts: 2 }, 10);
    if (!result.ok) throw new Error('unerwartet');
    expect(result.parts.map((part) => part.label)).toEqual(['Teil 1', 'Teil 2']);
  });

  it('lehnt weniger als zwei Teile ab', () => {
    expect(planSplit({ kind: 'equalParts', parts: 1 }, 10).ok).toBe(false);
  });

  it('lehnt mehr Teile als Seiten ab', () => {
    expect(planSplit({ kind: 'equalParts', parts: 11 }, 10)).toEqual({
      ok: false,
      error: 'Bei 10 Seiten sind hoechstens 10 Teile moeglich.',
    });
  });
});

describe('planSplit / everyNBlocks', () => {
  it('bildet Bloecke fester Groesse mit kuerzerem Rest', () => {
    expect(sizes(planSplit({ kind: 'everyNBlocks', size: 20 }, 50))).toEqual([20, 20, 10]);
  });

  it('bildet bei Groesse 1 ein Dokument pro Seite', () => {
    expect(sizes(planSplit({ kind: 'everyNBlocks', size: 1 }, 3))).toEqual([1, 1, 1]);
  });

  it('lehnt Groesse 0 ab', () => {
    expect(planSplit({ kind: 'everyNBlocks', size: 0 }, 10).ok).toBe(false);
  });
});

describe('planSplit / customRanges', () => {
  it('macht aus jedem Bereich einen Teil', () => {
    const result = planSplit({ kind: 'customRanges', input: '1-3,50-100' }, 100);
    expect(sizes(result)).toEqual([3, 51]);
  });

  it('reicht die Fehlermeldung des Range-Parsers durch', () => {
    expect(planSplit({ kind: 'customRanges', input: '0-3' }, 100)).toEqual({
      ok: false,
      error: 'Seitenzahlen beginnen bei 1.',
    });
  });

  it('lehnt eine leere Eingabe ab', () => {
    expect(planSplit({ kind: 'customRanges', input: '' }, 100).ok).toBe(false);
  });
});

describe('planSplit / selection', () => {
  it('macht aus der Auswahl genau einen Teil', () => {
    const result = planSplit({ kind: 'selection', indices: [5, 1, 2] }, 100);
    if (!result.ok) throw new Error('unerwartet');
    expect(result.parts).toEqual([{ label: 'Teil 1', indices: [1, 2, 5] }]);
  });

  it('verwirft Indizes ausserhalb des Dokuments', () => {
    expect(sizes(planSplit({ kind: 'selection', indices: [0, 99, 500] }, 30))).toEqual([1]);
  });

  it('lehnt eine leere Auswahl ab', () => {
    expect(planSplit({ kind: 'selection', indices: [] }, 30).ok).toBe(false);
  });
});

describe('planSplit', () => {
  it('lehnt ein Dokument ohne Seiten ab', () => {
    expect(planSplit({ kind: 'equalParts', parts: 2 }, 0).ok).toBe(false);
  });
});

describe('describeSplitPart', () => {
  it('beschreibt einen Teil so, wie ihn das Split-Panel zeigt', () => {
    expect(describeSplitPart({ label: 'Teil 1', indices: [0, 1, 2] })).toBe('Seiten 1-3 (3)');
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/domain/split.test.ts`
Expected: FAIL, `Failed to resolve import "./split"`.

- [ ] **Step 3: split.ts implementieren**

`src/domain/split.ts`:

```ts
import { formatRanges, parseRanges, rangesToIndices } from './ranges';

export type SplitStrategy =
  | { kind: 'equalParts'; parts: number }
  | { kind: 'everyNBlocks'; size: number }
  | { kind: 'customRanges'; input: string }
  | { kind: 'selection'; indices: number[] };

/** Ein geplantes Ergebnisdokument: 0-basierte Blockindizes der Quelle. */
export interface SplitPart {
  label: string;
  indices: number[];
}

export type SplitPlanResult = { ok: true; parts: SplitPart[] } | { ok: false; error: string };

export function planSplit(strategy: SplitStrategy, blockCount: number): SplitPlanResult {
  if (blockCount <= 0) return { ok: false, error: 'Das Dokument hat keine Seiten.' };
  switch (strategy.kind) {
    case 'equalParts':
      return equalParts(strategy.parts, blockCount);
    case 'everyNBlocks':
      return everyNBlocks(strategy.size, blockCount);
    case 'customRanges':
      return customRanges(strategy.input, blockCount);
    case 'selection':
      return selection(strategy.indices, blockCount);
  }
}

/** Beschriftung im Split-Panel, z. B. `Seiten 1-51 (51)`. */
export function describeSplitPart(part: SplitPart): string {
  return `Seiten ${formatRanges(part.indices)} (${part.indices.length})`;
}

function label(index: number): string {
  return `Teil ${index + 1}`;
}

function blockRange(start: number, size: number): number[] {
  return Array.from({ length: size }, (_, offset) => start + offset);
}

function equalParts(parts: number, blockCount: number): SplitPlanResult {
  if (!Number.isInteger(parts) || parts < 2) return { ok: false, error: 'Mindestens 2 Teile.' };
  if (parts > blockCount) {
    return {
      ok: false,
      error: `Bei ${blockCount} Seiten sind hoechstens ${blockCount} Teile moeglich.`,
    };
  }

  // Restseiten gehen an die vorderen Teile: 101 Seiten in 2 Teile ergibt 51/50.
  const base = Math.floor(blockCount / parts);
  const remainder = blockCount % parts;
  const result: SplitPart[] = [];
  let cursor = 0;
  for (let index = 0; index < parts; index++) {
    const size = base + (index < remainder ? 1 : 0);
    result.push({ label: label(index), indices: blockRange(cursor, size) });
    cursor += size;
  }
  return { ok: true, parts: result };
}

function everyNBlocks(size: number, blockCount: number): SplitPlanResult {
  if (!Number.isInteger(size) || size < 1)
    return { ok: false, error: 'Mindestens 1 Seite pro Teil.' };
  const result: SplitPart[] = [];
  for (let cursor = 0; cursor < blockCount; cursor += size) {
    result.push({
      label: label(result.length),
      indices: blockRange(cursor, Math.min(size, blockCount - cursor)),
    });
  }
  return { ok: true, parts: result };
}

function customRanges(input: string, blockCount: number): SplitPlanResult {
  const parsed = parseRanges(input, blockCount);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (parsed.ranges.length === 0) return { ok: false, error: 'Keine Bereiche angegeben.' };
  return {
    ok: true,
    parts: parsed.ranges.map((range, index) => ({
      label: label(index),
      indices: rangesToIndices([range]),
    })),
  };
}

function selection(indices: number[], blockCount: number): SplitPlanResult {
  const usable = [...new Set(indices)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < blockCount)
    .sort((a, b) => a - b);
  if (usable.length === 0) return { ok: false, error: 'Keine Seiten ausgewaehlt.' };
  return { ok: true, parts: [{ label: label(0), indices: usable }] };
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/domain/split.test.ts && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: Split-Strategien als reine Planung

planSplit liefert die konkreten Indexlisten, die das Split-Panel vor dem
Anwenden anzeigt. Restseiten gehen an die vorderen Teile; weil das Panel die
Zahlen zeigt, muss der Nutzer diese Regel nicht kennen.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Namen und Kollisionen (`naming.ts`)

**Files:**

- Create: `src/domain/naming.ts`
- Test: `src/domain/naming.test.ts`

**Interfaces:**

- Consumes: nichts
- Produces:
  - `FALLBACK_NAME: string` (`'Unbenannt'`)
  - `sanitizeName(name: string): string`
  - `resolveCollision(desired: string, taken: Iterable<string>): string`
  - `uniqueNames(desired: string[], taken?: Iterable<string>): string[]`
  - `withPdfExtension(name: string): string`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/domain/naming.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveCollision, sanitizeName, uniqueNames, withPdfExtension } from './naming';

describe('sanitizeName', () => {
  it('laesst unauffaellige Namen unveraendert', () => {
    expect(sanitizeName('Insurance Contract')).toBe('Insurance Contract');
  });

  it('ersetzt unter Windows verbotene Zeichen', () => {
    expect(sanitizeName('Rechnung 1/2 <final>')).toBe('Rechnung 1 2 final');
  });

  it('entfernt Steuerzeichen', () => {
    expect(sanitizeName(`Bank${String.fromCharCode(1)}Auszug`)).toBe('Bank Auszug');
  });

  it('entfernt fuehrende und abschliessende Punkte und Leerzeichen', () => {
    expect(sanitizeName('  ..Bericht..  ')).toBe('Bericht');
  });

  it('haengt an unter Windows reservierte Namen einen Unterstrich', () => {
    expect(sanitizeName('CON')).toBe('CON_');
    expect(sanitizeName('com1')).toBe('com1_');
    expect(sanitizeName('LPT9.pdf')).toBe('LPT9.pdf_');
  });

  it('laesst Namen in Ruhe, die nur mit einem reservierten Wort beginnen', () => {
    expect(sanitizeName('Container')).toBe('Container');
  });

  it('kuerzt sehr lange Namen auf 120 Zeichen', () => {
    expect(sanitizeName('a'.repeat(400))).toHaveLength(120);
  });

  it('faellt auf Unbenannt zurueck, wenn nichts uebrig bleibt', () => {
    expect(sanitizeName('   ...   ')).toBe('Unbenannt');
    expect(sanitizeName('')).toBe('Unbenannt');
  });
});

describe('resolveCollision', () => {
  it('gibt den Wunschnamen zurueck, wenn er frei ist', () => {
    expect(resolveCollision('Insurance', ['Bank'])).toBe('Insurance');
  });

  it('haengt bei Kollision eine Zahl ab 2 an', () => {
    expect(resolveCollision('Insurance', ['Insurance'])).toBe('Insurance 2');
  });

  it('zaehlt weiter, bis ein Name frei ist', () => {
    expect(resolveCollision('Insurance', ['Insurance', 'Insurance 2', 'Insurance 3'])).toBe(
      'Insurance 4',
    );
  });

  it('vergleicht ohne Ruecksicht auf Gross- und Kleinschreibung', () => {
    expect(resolveCollision('Insurance', ['insurance'])).toBe('Insurance 2');
  });
});

describe('uniqueNames', () => {
  it('macht eine ganze Liste kollisionsfrei', () => {
    expect(uniqueNames(['Bank', 'Bank', 'Bank'])).toEqual(['Bank', 'Bank 2', 'Bank 3']);
  });

  it('beruecksichtigt bereits vergebene Namen', () => {
    expect(uniqueNames(['Bank'], ['bank'])).toEqual(['Bank 2']);
  });
});

describe('withPdfExtension', () => {
  it('haengt die Endung an', () => {
    expect(withPdfExtension('Insurance Contract')).toBe('Insurance Contract.pdf');
  });

  it('verdoppelt eine vorhandene Endung nicht', () => {
    expect(withPdfExtension('Contract.pdf')).toBe('Contract.pdf');
    expect(withPdfExtension('Contract.PDF')).toBe('Contract.pdf');
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/domain/naming.test.ts`
Expected: FAIL, `Failed to resolve import "./naming"`.

- [ ] **Step 3: naming.ts implementieren**

`src/domain/naming.ts`:

```ts
// Windows ist das strengste der drei Zielsysteme; wer dessen Regeln einhaelt,
// kann auch auf macOS und Linux schreiben. \p{Cc} deckt alle Steuerzeichen ab.
const FORBIDDEN = /[<>:"/\\|?*]|\p{Cc}/gu;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const MAX_LENGTH = 120;

export const FALLBACK_NAME = 'Unbenannt';

export function sanitizeName(name: string): string {
  let out = name.replace(FORBIDDEN, ' ').replace(/\s+/g, ' ');
  // Erst kuerzen, dann die Raender saeubern: der Schnitt kann selbst einen
  // abschliessenden Punkt erzeugen, den Windows wieder verbietet.
  if (out.length > MAX_LENGTH) out = out.slice(0, MAX_LENGTH);
  out = out.replace(/^[.\s]+/, '').replace(/[.\s]+$/, '');
  if (out === '') return FALLBACK_NAME;

  // Reservierte Namen gelten auch mit Endung: aus CON.pdf wird CON.pdf_.
  const base = out.split('.')[0];
  if (RESERVED.test(base)) return `${out}_`;
  return out;
}

/**
 * Dieselbe Regel wie bei neuen Outputs im UI: `Insurance` -> `Insurance 2`.
 * Der Vergleich ist case-insensitiv, weil Windows und macOS es auch sind.
 */
export function resolveCollision(desired: string, taken: Iterable<string>): string {
  const used = new Set<string>();
  for (const name of taken) used.add(name.toLowerCase());
  if (!used.has(desired.toLowerCase())) return desired;
  for (let counter = 2; ; counter++) {
    const candidate = `${desired} ${counter}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

export function uniqueNames(desired: string[], taken: Iterable<string> = []): string[] {
  const used = new Set<string>();
  for (const name of taken) used.add(name.toLowerCase());
  return desired.map((name) => {
    const resolved = resolveCollision(name, used);
    used.add(resolved.toLowerCase());
    return resolved;
  });
}

export function withPdfExtension(name: string): string {
  return `${name.replace(/\.pdf$/i, '')}.pdf`;
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/domain/naming.test.ts && npm run typecheck && npm run lint`
Expected: PASS. Sollte `a`.repeat(400) nicht exakt 120 Zeichen ergeben, liegt es an der Reihenfolge von Kuerzen und Saeubern -- siehe Kommentar im Code.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Namenssanitisierung und Kollisionsaufloesung

Windows-Regeln als strengster gemeinsamer Nenner, Kollisionen als "Name 2" --
dieselbe Regel fuer neue Outputs im UI und fuer Dateinamen beim Export.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 7: Item-Operationen (`composition.ts`, Teil 1)

**Files:**

- Create: `src/domain/composition.ts`
- Test: `src/domain/composition.items.test.ts`

**Interfaces:**

- Consumes: Typen aus `./types`, Fixture aus `./__fixtures__/workspace`, `checkWorkspaceInvariants` aus `./invariants` (nur im Test)
- Produces (alle mutieren einen Immer-Draft **in place** und liefern `void`):
  - `requireOutput(ws: Workspace, outputId: NodeId): OutputDocument`
  - `clampIndex(index: number, length: number): number`
  - `buildItems(sourceId: SourceId, blockIndices: number[], ids: ItemId[]): CompositionItem[]`
  - `insertItems(ws, outputId: NodeId, items: CompositionItem[], index: number): void`
  - `removeItems(ws, itemIds: ItemId[]): void`
  - `moveItems(ws, itemIds: ItemId[], targetOutputId: NodeId, index: number): void`
  - `reorderItems(ws, outputId: NodeId, itemIds: ItemId[], index: number): void`
  - `copyItems(ws, itemIds: ItemId[], targetOutputId: NodeId, index: number, newIds: ItemId[]): void`
  - `rotateItems(ws, itemIds: ItemId[], delta: 90 | 180 | 270): void`

**Zwei Festlegungen, die den Rest des Projekts binden:**

1. Die Funktionen sind **Draft-Mutatoren**, keine kopierenden Funktionen. Der Store fuehrt sie in `produceWithPatches` aus, Tests in `produce`. Ohne diese Form gibt es keine abgeleitete Undo-Inverse.
2. **Ids kommen von aussen.** `copyItems` erhaelt die neuen Ids als Parameter, statt `newId()` zu rufen. Nur so ist ein Command reproduzierbar und ein Test ohne Mock lesbar.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/domain/composition.items.test.ts`:

```ts
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  buildItems,
  copyItems,
  insertItems,
  moveItems,
  removeItems,
  reorderItems,
  rotateItems,
} from './composition';
import { IDS, makeItem, makeWorkspace } from './__fixtures__/workspace';
import { checkWorkspaceInvariants } from './invariants';
import type { OutputDocument, Workspace } from './types';

/** Fuehrt eine Operation auf einem Draft aus und prueft dabei die Invarianten. */
function apply(recipe: (draft: Workspace) => void, base: Workspace = makeWorkspace()): Workspace {
  const next = produce(base, recipe);
  expect(checkWorkspaceInvariants(next)).toEqual([]);
  return next;
}

function itemsOf(ws: Workspace, outputId: string): string[] {
  const node = ws.nodes[outputId] as OutputDocument;
  return node.items;
}

describe('buildItems', () => {
  it('erzeugt zu jedem Blockindex ein Item mit der uebergebenen Id', () => {
    expect(buildItems(IDS.bank, [9, 10], ['i-a', 'i-b'])).toEqual([
      { id: 'i-a', sourceId: IDS.bank, blockIndex: 9, rotation: 0 },
      { id: 'i-b', sourceId: IDS.bank, blockIndex: 10, rotation: 0 },
    ]);
  });

  it('wirft, wenn Ids und Indizes nicht gleich viele sind', () => {
    expect(() => buildItems(IDS.bank, [1, 2], ['i-a'])).toThrow();
  });
});

describe('insertItems', () => {
  it('fuegt an der angegebenen Position ein', () => {
    const ws = apply((draft) => {
      insertItems(draft, IDS.outContracts, [makeItem('i-neu', IDS.bank, 0)], 1);
    });
    expect(itemsOf(ws, IDS.outContracts)).toEqual(['i-c4', 'i-neu', 'i-c5', 'i-c6']);
  });

  it('haengt bei zu grossem Index hinten an', () => {
    const ws = apply((draft) => {
      insertItems(draft, IDS.outContracts, [makeItem('i-neu', IDS.bank, 0)], 99);
    });
    expect(itemsOf(ws, IDS.outContracts).at(-1)).toBe('i-neu');
  });

  it('registriert die Items im Workspace', () => {
    const ws = apply((draft) => {
      insertItems(draft, IDS.outContracts, [makeItem('i-neu', IDS.bank, 4)], 0);
    });
    expect(ws.items['i-neu']).toEqual({
      id: 'i-neu',
      sourceId: IDS.bank,
      blockIndex: 4,
      rotation: 0,
    });
  });

  it('wirft bei einer bereits vergebenen Item-Id', () => {
    expect(() =>
      apply((draft) => {
        insertItems(draft, IDS.outContracts, [makeItem('i-c4', IDS.bank, 0)], 0);
      }),
    ).toThrow(/bereits vergeben/);
  });

  it('wirft, wenn das Ziel kein Output ist', () => {
    expect(() =>
      apply((draft) => {
        insertItems(draft, IDS.folderBank, [makeItem('i-neu', IDS.bank, 0)], 0);
      }),
    ).toThrow(/Kein Output-Dokument/);
  });
});

describe('removeItems', () => {
  it('entfernt aus der Liste und aus items', () => {
    const ws = apply((draft) => removeItems(draft, ['i-c5']));
    expect(itemsOf(ws, IDS.outContracts)).toEqual(['i-c4', 'i-c6']);
    expect(ws.items['i-c5']).toBeUndefined();
  });

  it('entfernt ueber mehrere Outputs hinweg', () => {
    const ws = apply((draft) => removeItems(draft, ['i-c4', 'i-b17']));
    expect(itemsOf(ws, IDS.outContracts)).toEqual(['i-c5', 'i-c6']);
    expect(itemsOf(ws, IDS.outInsurance)).toEqual(['i-i7']);
  });

  it('laesst unbekannte Ids wirkungslos', () => {
    const ws = apply((draft) => removeItems(draft, ['gibt-es-nicht']));
    expect(itemsOf(ws, IDS.outContracts)).toHaveLength(3);
  });
});

describe('moveItems', () => {
  it('verschiebt zwischen zwei Outputs und behaelt die uebergebene Reihenfolge', () => {
    const ws = apply((draft) => moveItems(draft, ['i-c4', 'i-c6'], IDS.outInsurance, 1));
    expect(itemsOf(ws, IDS.outContracts)).toEqual(['i-c5']);
    expect(itemsOf(ws, IDS.outInsurance)).toEqual(['i-i7', 'i-c4', 'i-c6', 'i-b17']);
  });

  it('sortiert innerhalb eines Outputs an das Ende um', () => {
    const ws = apply((draft) => moveItems(draft, ['i-c4'], IDS.outContracts, 3));
    expect(itemsOf(ws, IDS.outContracts)).toEqual(['i-c5', 'i-c6', 'i-c4']);
  });

  it('sortiert innerhalb eines Outputs nach vorne um', () => {
    const ws = apply((draft) => moveItems(draft, ['i-c6'], IDS.outContracts, 0));
    expect(itemsOf(ws, IDS.outContracts)).toEqual(['i-c6', 'i-c4', 'i-c5']);
  });

  it('bleibt bei einer Verschiebung auf die eigene Position unveraendert', () => {
    const ws = apply((draft) => moveItems(draft, ['i-c5'], IDS.outContracts, 1));
    expect(itemsOf(ws, IDS.outContracts)).toEqual(['i-c4', 'i-c5', 'i-c6']);
  });

  it('haelt einen Mehrfachblock beim Umsortieren zusammen', () => {
    const ws = apply((draft) => moveItems(draft, ['i-c4', 'i-c5'], IDS.outContracts, 3));
    expect(itemsOf(ws, IDS.outContracts)).toEqual(['i-c6', 'i-c4', 'i-c5']);
  });

  it('ignoriert unbekannte Ids', () => {
    const ws = apply((draft) => moveItems(draft, ['gibt-es-nicht'], IDS.outInsurance, 0));
    expect(itemsOf(ws, IDS.outInsurance)).toEqual(['i-i7', 'i-b17']);
  });
});

describe('reorderItems', () => {
  it('ist das Umsortieren innerhalb eines Outputs', () => {
    const ws = apply((draft) => reorderItems(draft, IDS.outContracts, ['i-c6'], 0));
    expect(itemsOf(ws, IDS.outContracts)).toEqual(['i-c6', 'i-c4', 'i-c5']);
  });
});

describe('copyItems', () => {
  it('legt Kopien mit neuen Ids an und laesst die Originale liegen', () => {
    const ws = apply((draft) =>
      copyItems(draft, ['i-c4', 'i-c5'], IDS.outInsurance, 0, ['i-k1', 'i-k2']),
    );
    expect(itemsOf(ws, IDS.outContracts)).toEqual(['i-c4', 'i-c5', 'i-c6']);
    expect(itemsOf(ws, IDS.outInsurance)).toEqual(['i-k1', 'i-k2', 'i-i7', 'i-b17']);
    expect(ws.items['i-k1']).toEqual({ ...ws.items['i-c4'], id: 'i-k1' });
  });

  it('uebernimmt die Rotation des Originals', () => {
    const base = makeWorkspace();
    base.items['i-c4'].rotation = 90;
    const ws = apply((draft) => copyItems(draft, ['i-c4'], IDS.outInsurance, 0, ['i-k1']), base);
    expect(ws.items['i-k1'].rotation).toBe(90);
  });

  it('wirft, wenn die Zahl der neuen Ids nicht passt', () => {
    expect(() =>
      apply((draft) => copyItems(draft, ['i-c4', 'i-c5'], IDS.outInsurance, 0, ['i-k1'])),
    ).toThrow();
  });
});

describe('rotateItems', () => {
  it('dreht additiv und rechnet modulo 360', () => {
    const ws = apply((draft) => {
      rotateItems(draft, ['i-c4'], 90);
      rotateItems(draft, ['i-c4'], 270);
      rotateItems(draft, ['i-c5'], 180);
    });
    expect(ws.items['i-c4'].rotation).toBe(0);
    expect(ws.items['i-c5'].rotation).toBe(180);
  });

  it('dreht eine Kopie unabhaengig vom Original', () => {
    const ws = apply((draft) => {
      copyItems(draft, ['i-c4'], IDS.outInsurance, 0, ['i-k1']);
      rotateItems(draft, ['i-k1'], 90);
    });
    expect(ws.items['i-k1'].rotation).toBe(90);
    expect(ws.items['i-c4'].rotation).toBe(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/domain/composition.items.test.ts`
Expected: FAIL, `Failed to resolve import "./composition"`.

- [ ] **Step 3: composition.ts implementieren (Item-Teil)**

`src/domain/composition.ts`:

```ts
import type {
  CompositionItem,
  ItemId,
  NodeId,
  OutputDocument,
  Rotation,
  SourceId,
  Workspace,
} from './types';

/**
 * Alle Funktionen dieses Moduls mutieren einen Immer-Draft in place.
 * Der Store fuehrt sie in `produceWithPatches` aus und leitet daraus die
 * Undo-Inverse ab; Tests fuehren sie in `produce` aus.
 * Ids und Zeitstempel werden nie hier erzeugt, sondern immer hereingegeben.
 */

export function requireOutput(ws: Workspace, outputId: NodeId): OutputDocument {
  const node = ws.nodes[outputId];
  if (!node || node.type !== 'output') throw new Error(`Kein Output-Dokument: ${outputId}`);
  return node;
}

export function clampIndex(index: number, length: number): number {
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.trunc(index), length);
}

export function buildItems(
  sourceId: SourceId,
  blockIndices: number[],
  ids: ItemId[],
): CompositionItem[] {
  if (ids.length !== blockIndices.length) {
    throw new Error('Zu jedem Block muss genau eine Item-Id vorliegen.');
  }
  return blockIndices.map((blockIndex, position) => ({
    id: ids[position],
    sourceId,
    blockIndex,
    rotation: 0,
  }));
}

export function insertItems(
  ws: Workspace,
  outputId: NodeId,
  items: CompositionItem[],
  index: number,
): void {
  const output = requireOutput(ws, outputId);
  // Erst alle Ids pruefen, dann schreiben: ein Teil-Einfuegen waere schlimmer
  // als ein sauberer Abbruch.
  for (const item of items) {
    if (ws.items[item.id]) throw new Error(`Item-Id bereits vergeben: ${item.id}`);
  }
  for (const item of items) ws.items[item.id] = item;
  output.items.splice(clampIndex(index, output.items.length), 0, ...items.map((item) => item.id));
}

export function removeItems(ws: Workspace, itemIds: ItemId[]): void {
  const doomed = new Set(itemIds);
  if (doomed.size === 0) return;
  for (const node of Object.values(ws.nodes)) {
    if (node.type !== 'output') continue;
    if (!node.items.some((id) => doomed.has(id))) continue;
    node.items = node.items.filter((id) => !doomed.has(id));
  }
  for (const id of doomed) delete ws.items[id];
}

/**
 * Verschiebt Items an Position `index` im Ziel-Output. Die Reihenfolge in
 * `itemIds` ist die Reihenfolge im Ziel -- das UI uebergibt sie in Lesereihenfolge.
 */
export function moveItems(
  ws: Workspace,
  itemIds: ItemId[],
  targetOutputId: NodeId,
  index: number,
): void {
  const target = requireOutput(ws, targetOutputId);
  const moving = itemIds.filter((id) => ws.items[id] !== undefined);
  if (moving.length === 0) return;
  const movingSet = new Set(moving);

  // Die Einfuegeposition wird gegen den Zustand VOR dem Entfernen bestimmt und
  // um die Items korrigiert, die vor ihr herausgenommen werden. Sonst
  // verrutscht jedes Umsortieren um die Zahl der gezogenen Seiten.
  const desired = clampIndex(index, target.items.length);
  const removedBefore = target.items.slice(0, desired).filter((id) => movingSet.has(id)).length;

  for (const node of Object.values(ws.nodes)) {
    if (node.type !== 'output') continue;
    if (!node.items.some((id) => movingSet.has(id))) continue;
    node.items = node.items.filter((id) => !movingSet.has(id));
  }

  target.items.splice(desired - removedBefore, 0, ...moving);
}

/** Umsortieren ist ein Verschieben mit gleichem Quell- und Zieldokument. */
export function reorderItems(
  ws: Workspace,
  outputId: NodeId,
  itemIds: ItemId[],
  index: number,
): void {
  moveItems(ws, itemIds, outputId, index);
}

export function copyItems(
  ws: Workspace,
  itemIds: ItemId[],
  targetOutputId: NodeId,
  index: number,
  newIds: ItemId[],
): void {
  if (newIds.length !== itemIds.length) {
    throw new Error('Zu jeder Kopie muss genau eine neue Item-Id vorliegen.');
  }
  const copies: CompositionItem[] = [];
  itemIds.forEach((itemId, position) => {
    const original = ws.items[itemId];
    if (!original) return;
    copies.push({ ...original, id: newIds[position] });
  });
  insertItems(ws, targetOutputId, copies, index);
}

export function rotateItems(ws: Workspace, itemIds: ItemId[], delta: 90 | 180 | 270): void {
  for (const itemId of itemIds) {
    const item = ws.items[itemId];
    if (!item) continue;
    // Zweimal modulo: die erste Rechnung kann bei negativen Zwischenwerten
    // negativ bleiben, die zweite bringt 360 wieder auf 0.
    item.rotation = ((((item.rotation + delta) % 360) + 360) % 360) as Rotation;
  }
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test -- src/domain/composition.items.test.ts && npm run typecheck && npm run lint`
Expected: PASS, inklusive der Invariantenpruefung, die in `apply` nach jeder Operation laeuft.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Item-Operationen der Komposition als Immer-Draft-Mutatoren

insert/remove/move/reorder/copy/rotate. Die Einfuegeposition wird gegen den
Zustand vor dem Entfernen bestimmt, damit Umsortieren innerhalb eines
Dokuments nicht um die Zahl der gezogenen Seiten verrutscht. Neue Ids kommen
als Parameter herein, damit Commands reproduzierbar bleiben.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 8: Ordner-, Output- und Quellen-Operationen (`composition.ts`, Teil 2)

**Files:**

- Modify: `src/domain/composition.ts` (anhaengen)
- Test: `src/domain/composition.nodes.test.ts`

**Interfaces:**

- Consumes: `clampIndex`, `removeItems` aus Teil 1; `parentKey` aus `./types`
- Produces:
  - `interface CreateNodeInput { id: NodeId; name: string; parentId: NodeId | null; index?: number }`
  - `createFolder(ws, input: CreateNodeInput): void`
  - `createOutput(ws, input: CreateNodeInput): void`
  - `renameNode(ws, nodeId: NodeId, name: string): void`
  - `isDescendant(ws, nodeId: NodeId, maybeAncestorId: NodeId): boolean`
  - `canMoveNode(ws, nodeId: NodeId, newParentId: NodeId | null): boolean`
  - `moveNode(ws, nodeId: NodeId, newParentId: NodeId | null, index: number): void`
  - `collectSubtree(ws, nodeId: NodeId): NodeId[]`
  - `deleteNode(ws, nodeId: NodeId): void`
  - `removeSourceAndItems(ws, sourceId: SourceId): void`
  - `siblingNames(ws, parentId: NodeId | null, exceptId?: NodeId): string[]`
  - `itemsOfSource(ws, sourceId: SourceId): ItemId[]`

Namenskollisionen werden hier **nicht** aufgeloest: diese Funktionen sind mechanisch. Die Regel `Insurance` -> `Insurance 2` wendet Task 9 an, damit sie an genau einer Stelle steht.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/domain/composition.nodes.test.ts`:

```ts
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import {
  canMoveNode,
  collectSubtree,
  createFolder,
  createOutput,
  deleteNode,
  isDescendant,
  itemsOfSource,
  moveNode,
  removeSourceAndItems,
  renameNode,
  siblingNames,
} from './composition';
import { IDS, makeWorkspace } from './__fixtures__/workspace';
import { checkWorkspaceInvariants } from './invariants';
import type { Workspace } from './types';

function apply(recipe: (draft: Workspace) => void, base: Workspace = makeWorkspace()): Workspace {
  const next = produce(base, recipe);
  expect(checkWorkspaceInvariants(next)).toEqual([]);
  return next;
}

describe('createFolder', () => {
  it('legt einen Ordner unter root an', () => {
    const ws = apply((draft) =>
      createFolder(draft, { id: 'n-neu', name: 'Belege', parentId: null }),
    );
    expect(ws.nodes['n-neu']).toEqual({
      id: 'n-neu',
      type: 'folder',
      name: 'Belege',
      parentId: null,
    });
    expect(ws.childOrder['root']).toEqual([IDS.tax, 'n-neu']);
    expect(ws.childOrder['n-neu']).toEqual([]);
  });

  it('legt einen Ordner an der gewuenschten Position im Elternordner an', () => {
    const ws = apply((draft) =>
      createFolder(draft, { id: 'n-neu', name: 'Belege', parentId: IDS.tax, index: 1 }),
    );
    expect(ws.childOrder[IDS.tax]).toEqual([
      IDS.folderBank,
      'n-neu',
      IDS.folderInsurance,
      IDS.folderContracts,
    ]);
  });

  it('wirft, wenn das Elternteil kein Ordner ist', () => {
    expect(() =>
      apply((draft) => createFolder(draft, { id: 'n-neu', name: 'X', parentId: IDS.outInsurance })),
    ).toThrow(/kein Ordner/);
  });

  it('wirft bei einer bereits vergebenen Node-Id', () => {
    expect(() =>
      apply((draft) => createFolder(draft, { id: IDS.tax, name: 'X', parentId: null })),
    ).toThrow(/bereits vergeben/);
  });
});

describe('createOutput', () => {
  it('legt ein leeres Output-Dokument im Ordner an', () => {
    const ws = apply((draft) =>
      createOutput(draft, { id: 'n-out-neu', name: 'Quittungen', parentId: IDS.folderBank }),
    );
    expect(ws.nodes['n-out-neu']).toEqual({
      id: 'n-out-neu',
      type: 'output',
      name: 'Quittungen',
      parentId: IDS.folderBank,
      targetFormat: 'pdf',
      items: [],
    });
    expect(ws.childOrder[IDS.folderBank]).toEqual(['n-out-neu']);
  });

  it('legt keinen childOrder-Eintrag fuer ein Output an', () => {
    const ws = apply((draft) =>
      createOutput(draft, { id: 'n-out-neu', name: 'Quittungen', parentId: null }),
    );
    expect(ws.childOrder['n-out-neu']).toBeUndefined();
  });
});

describe('renameNode', () => {
  it('benennt um', () => {
    const ws = apply((draft) => renameNode(draft, IDS.outInsurance, 'Versicherung 2026'));
    expect(ws.nodes[IDS.outInsurance].name).toBe('Versicherung 2026');
  });

  it('laesst unbekannte Nodes wirkungslos', () => {
    const ws = apply((draft) => renameNode(draft, 'gibt-es-nicht', 'X'));
    expect(Object.keys(ws.nodes)).toHaveLength(6);
  });
});

describe('isDescendant / canMoveNode', () => {
  it('erkennt Nachkommen', () => {
    const ws = makeWorkspace();
    expect(isDescendant(ws, IDS.outInsurance, IDS.tax)).toBe(true);
    expect(isDescendant(ws, IDS.tax, IDS.outInsurance)).toBe(false);
  });

  it('verbietet das Verschieben eines Ordners in sich selbst', () => {
    const ws = makeWorkspace();
    expect(canMoveNode(ws, IDS.tax, IDS.tax)).toBe(false);
  });

  it('verbietet das Verschieben eines Ordners in seinen eigenen Nachkommen', () => {
    const ws = makeWorkspace();
    expect(canMoveNode(ws, IDS.tax, IDS.folderBank)).toBe(false);
  });

  it('erlaubt das Verschieben nach root und in fremde Ordner', () => {
    const ws = makeWorkspace();
    expect(canMoveNode(ws, IDS.folderBank, null)).toBe(true);
    expect(canMoveNode(ws, IDS.folderBank, IDS.folderInsurance)).toBe(true);
  });

  it('verbietet ein Output als Ziel', () => {
    const ws = makeWorkspace();
    expect(canMoveNode(ws, IDS.folderBank, IDS.outInsurance)).toBe(false);
  });
});

describe('moveNode', () => {
  it('verschiebt in einen anderen Ordner', () => {
    const ws = apply((draft) => moveNode(draft, IDS.outInsurance, IDS.folderBank, 0));
    expect(ws.nodes[IDS.outInsurance].parentId).toBe(IDS.folderBank);
    expect(ws.childOrder[IDS.folderBank]).toEqual([IDS.outInsurance]);
    expect(ws.childOrder[IDS.folderInsurance]).toEqual([]);
  });

  it('sortiert innerhalb des Elternordners an das Ende um', () => {
    const ws = apply((draft) => moveNode(draft, IDS.folderBank, IDS.tax, 3));
    expect(ws.childOrder[IDS.tax]).toEqual([
      IDS.folderInsurance,
      IDS.folderContracts,
      IDS.folderBank,
    ]);
  });

  it('sortiert innerhalb des Elternordners nach vorne um', () => {
    const ws = apply((draft) => moveNode(draft, IDS.folderContracts, IDS.tax, 0));
    expect(ws.childOrder[IDS.tax]).toEqual([
      IDS.folderContracts,
      IDS.folderBank,
      IDS.folderInsurance,
    ]);
  });

  it('nimmt den Unterbaum mit', () => {
    const ws = apply((draft) => moveNode(draft, IDS.folderInsurance, null, 0));
    expect(ws.childOrder['root']).toEqual([IDS.folderInsurance, IDS.tax]);
    expect(ws.nodes[IDS.outInsurance].parentId).toBe(IDS.folderInsurance);
  });

  it('wirft bei einem Zyklus', () => {
    expect(() => apply((draft) => moveNode(draft, IDS.tax, IDS.folderBank, 0))).toThrow(
      /nicht erlaubt/,
    );
  });
});

describe('collectSubtree', () => {
  it('liefert die Node selbst und alle Nachkommen', () => {
    const ws = makeWorkspace();
    expect(collectSubtree(ws, IDS.tax).sort()).toEqual(
      [
        IDS.tax,
        IDS.folderBank,
        IDS.folderInsurance,
        IDS.folderContracts,
        IDS.outContracts,
        IDS.outInsurance,
      ].sort(),
    );
  });
});

describe('deleteNode', () => {
  it('loescht ein Output samt seiner Items', () => {
    const ws = apply((draft) => deleteNode(draft, IDS.outContracts));
    expect(ws.nodes[IDS.outContracts]).toBeUndefined();
    expect(ws.childOrder[IDS.folderContracts]).toEqual([]);
    expect(ws.items['i-c4']).toBeUndefined();
    expect(Object.keys(ws.items)).toEqual(['i-i7', 'i-b17']);
  });

  it('loescht einen Ordner samt Unterbaum und Items', () => {
    const ws = apply((draft) => deleteNode(draft, IDS.tax));
    expect(Object.keys(ws.nodes)).toEqual([]);
    expect(Object.keys(ws.items)).toEqual([]);
    expect(ws.childOrder['root']).toEqual([]);
    expect(ws.childOrder[IDS.tax]).toBeUndefined();
  });

  it('laesst die Quellen unberuehrt', () => {
    const ws = apply((draft) => deleteNode(draft, IDS.tax));
    expect(ws.sourceOrder).toHaveLength(3);
    expect(ws.sources[IDS.contract].blockCount).toBe(100);
  });

  it('laesst unbekannte Nodes wirkungslos', () => {
    const ws = apply((draft) => deleteNode(draft, 'gibt-es-nicht'));
    expect(Object.keys(ws.nodes)).toHaveLength(6);
  });
});

describe('itemsOfSource / removeSourceAndItems', () => {
  it('findet alle Items einer Quelle', () => {
    expect(itemsOfSource(makeWorkspace(), IDS.contract)).toEqual(['i-c4', 'i-c5', 'i-c6']);
  });

  it('entfernt die Quelle und alle Items, die sie verwenden', () => {
    const ws = apply((draft) => removeSourceAndItems(draft, IDS.bank));
    expect(ws.sources[IDS.bank]).toBeUndefined();
    expect(ws.sourceOrder).toEqual([IDS.contract, IDS.insurance]);
    expect(ws.items['i-b17']).toBeUndefined();
    expect((ws.nodes[IDS.outInsurance] as { items: string[] }).items).toEqual(['i-i7']);
  });

  it('laesst die Outputs selbst stehen, auch wenn sie leer werden', () => {
    const ws = apply((draft) => removeSourceAndItems(draft, IDS.contract));
    expect((ws.nodes[IDS.outContracts] as { items: string[] }).items).toEqual([]);
  });
});

describe('siblingNames', () => {
  it('liefert die Namen der Geschwister', () => {
    expect(siblingNames(makeWorkspace(), IDS.tax)).toEqual(['Bank', 'Insurance', 'Contracts']);
  });

  it('laesst eine Node auf Wunsch aus', () => {
    expect(siblingNames(makeWorkspace(), IDS.tax, IDS.folderBank)).toEqual([
      'Insurance',
      'Contracts',
    ]);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/domain/composition.nodes.test.ts`
Expected: FAIL, `createFolder is not exported by src/domain/composition.ts`.

- [ ] **Step 3: Node-Operationen an composition.ts anhaengen**

Der Import-Kopf von `src/domain/composition.ts` wird um `FolderNode` und `parentKey` ergaenzt:

```ts
import type {
  CompositionItem,
  FolderNode,
  ItemId,
  NodeId,
  OutputDocument,
  Rotation,
  SourceId,
  Workspace,
} from './types';
import { parentKey } from './types';
```

Danach ans Dateiende:

```ts
export interface CreateNodeInput {
  id: NodeId;
  name: string;
  parentId: NodeId | null;
  /** Position im Elternordner; ohne Angabe hinten anfuegen. */
  index?: number;
}

function requireFolder(ws: Workspace, nodeId: NodeId): FolderNode {
  const node = ws.nodes[nodeId];
  if (!node || node.type !== 'folder') throw new Error(`Ziel ist kein Ordner: ${nodeId}`);
  return node;
}

function assertFreeNodeId(ws: Workspace, nodeId: NodeId): void {
  if (ws.nodes[nodeId]) throw new Error(`Node-Id bereits vergeben: ${nodeId}`);
}

/** Kinderliste eines Elternteils, bei Bedarf angelegt. */
function childList(ws: Workspace, parentId: NodeId | null): NodeId[] {
  const key = parentKey(parentId);
  const existing = ws.childOrder[key];
  if (existing) return existing;
  ws.childOrder[key] = [];
  return ws.childOrder[key];
}

export function createFolder(ws: Workspace, input: CreateNodeInput): void {
  assertFreeNodeId(ws, input.id);
  if (input.parentId !== null) requireFolder(ws, input.parentId);
  ws.nodes[input.id] = { id: input.id, type: 'folder', name: input.name, parentId: input.parentId };
  // Ordner bekommen sofort eine eigene Kinderliste, Outputs nie (Invariante 1).
  ws.childOrder[input.id] = [];
  const siblings = childList(ws, input.parentId);
  siblings.splice(clampIndex(input.index ?? siblings.length, siblings.length), 0, input.id);
}

export function createOutput(ws: Workspace, input: CreateNodeInput): void {
  assertFreeNodeId(ws, input.id);
  if (input.parentId !== null) requireFolder(ws, input.parentId);
  ws.nodes[input.id] = {
    id: input.id,
    type: 'output',
    name: input.name,
    parentId: input.parentId,
    targetFormat: 'pdf',
    items: [],
  };
  const siblings = childList(ws, input.parentId);
  siblings.splice(clampIndex(input.index ?? siblings.length, siblings.length), 0, input.id);
}

export function renameNode(ws: Workspace, nodeId: NodeId, name: string): void {
  const node = ws.nodes[nodeId];
  if (!node) return;
  node.name = name;
}

export function isDescendant(ws: Workspace, nodeId: NodeId, maybeAncestorId: NodeId): boolean {
  const seen = new Set<NodeId>([nodeId]);
  let current = ws.nodes[nodeId]?.parentId ?? null;
  while (current !== null) {
    if (current === maybeAncestorId) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    current = ws.nodes[current]?.parentId ?? null;
  }
  return false;
}

/** Invariante 6: kein Ordner darf sein eigener Vorfahre werden. */
export function canMoveNode(ws: Workspace, nodeId: NodeId, newParentId: NodeId | null): boolean {
  if (!ws.nodes[nodeId]) return false;
  if (newParentId === null) return true;
  const parent = ws.nodes[newParentId];
  if (!parent || parent.type !== 'folder') return false;
  if (newParentId === nodeId) return false;
  return !isDescendant(ws, newParentId, nodeId);
}

export function moveNode(
  ws: Workspace,
  nodeId: NodeId,
  newParentId: NodeId | null,
  index: number,
): void {
  if (!canMoveNode(ws, nodeId, newParentId)) {
    throw new Error(`Verschieben nicht erlaubt: ${nodeId} -> ${String(newParentId)}`);
  }
  const node = ws.nodes[nodeId];
  if (!node) return;

  const fromKey = parentKey(node.parentId);
  const toKey = parentKey(newParentId);
  const fromList = ws.childOrder[fromKey] ?? [];
  const targetBefore = fromKey === toKey ? fromList : (ws.childOrder[toKey] ?? []);

  // Wie bei moveItems: Position gegen den Zustand vor dem Entfernen bestimmen.
  const desired = clampIndex(index, targetBefore.length);
  const removedBefore =
    fromKey === toKey ? targetBefore.slice(0, desired).filter((id) => id === nodeId).length : 0;

  ws.childOrder[fromKey] = fromList.filter((id) => id !== nodeId);
  node.parentId = newParentId;
  const targetList = childList(ws, newParentId);
  targetList.splice(desired - removedBefore, 0, nodeId);
}

export function collectSubtree(ws: Workspace, nodeId: NodeId): NodeId[] {
  const collected: NodeId[] = [];
  const stack: NodeId[] = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) break;
    if (!ws.nodes[current]) continue;
    collected.push(current);
    stack.push(...(ws.childOrder[current] ?? []));
  }
  return collected;
}

export function deleteNode(ws: Workspace, nodeId: NodeId): void {
  const node = ws.nodes[nodeId];
  if (!node) return;

  const subtree = collectSubtree(ws, nodeId);
  const doomedItems: ItemId[] = [];
  for (const id of subtree) {
    const current = ws.nodes[id];
    if (current && current.type === 'output') doomedItems.push(...current.items);
  }
  for (const itemId of doomedItems) delete ws.items[itemId];
  for (const id of subtree) {
    delete ws.nodes[id];
    delete ws.childOrder[id];
  }

  // Die inneren Nodes verschwinden mit ihren geloeschten Kinderlisten,
  // nur der Elternordner der obersten Node muss noch bereinigt werden.
  const parentList = ws.childOrder[parentKey(node.parentId)];
  if (parentList) {
    ws.childOrder[parentKey(node.parentId)] = parentList.filter((id) => id !== nodeId);
  }
}

export function itemsOfSource(ws: Workspace, sourceId: SourceId): ItemId[] {
  return Object.values(ws.items)
    .filter((item) => item.sourceId === sourceId)
    .map((item) => item.id);
}

/** Invariante 3: ohne Quelle kann kein Item bestehen bleiben. */
export function removeSourceAndItems(ws: Workspace, sourceId: SourceId): void {
  removeItems(ws, itemsOfSource(ws, sourceId));
  delete ws.sources[sourceId];
  ws.sourceOrder = ws.sourceOrder.filter((id) => id !== sourceId);
}

export function siblingNames(ws: Workspace, parentId: NodeId | null, exceptId?: NodeId): string[] {
  return (ws.childOrder[parentKey(parentId)] ?? [])
    .filter((id) => id !== exceptId)
    .map((id) => ws.nodes[id]?.name ?? '')
    .filter((name) => name !== '');
}
```

`CompositionItem` und `OutputDocument` bleiben im Import-Kopf, weil Teil 1 sie verwendet.

- [ ] **Step 4: Tests pruefen**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: alle Tests PASS (Item- und Node-Operationen).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Ordner-, Output- und Quellen-Operationen der Komposition

createFolder/createOutput/renameNode/moveNode/deleteNode samt Zykluspruefung,
plus removeSourceAndItems, das mit der Quelle auch deren Items entfernt
(Invariante 3). Namenskollisionen loest bewusst erst die Command-Schicht auf.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 9: Commands (`commands.ts`)

**Files:**

- Create: `src/domain/commands.ts`
- Test: `src/domain/commands.test.ts`

**Interfaces:**

- Consumes: alle Operationen aus `./composition`, `sanitizeName`/`resolveCollision` aus `./naming`, Typen aus `./types`
- Produces:
  - `type Command` (die 15 Commands aus dem Design plus `batch`)
  - `interface SplitOutputSpec { outputId: NodeId; name: string; items: CompositionItem[] }`
  - `interface CommandCtx { now: number }`
  - `applyCommand(ws: Workspace, command: Command, ctx: CommandCtx): void`
  - `describeCommand(command: Command, before: Workspace): string`

Warum eine Command-Union und nicht direkte Store-Methoden: der Store (Plan 3) fuehrt jeden Command in `produceWithPatches` aus, legt Patches und Inverse in die History und braucht dazu genau einen Einsprungpunkt. `batch` gibt es, weil zusammengehoerige Aenderungen (Ordner-Drop = neues Output plus Seiten einfuegen) ein einziger Undo-Schritt sein muessen.

Namen werden **hier** saniert und kollisionsfrei gemacht -- an genau einer Stelle, damit `Insurance 2` beim Anlegen, Umbenennen und Splitten dieselbe Regel benutzt.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/domain/commands.test.ts`:

```ts
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { applyCommand, describeCommand, type Command } from './commands';
import { FIXED_NOW, IDS, makeItem, makeSource, makeWorkspace } from './__fixtures__/workspace';
import { checkWorkspaceInvariants } from './invariants';
import type { OutputDocument, Workspace } from './types';

const LATER = FIXED_NOW + 60_000;

function run(command: Command, base: Workspace = makeWorkspace()): Workspace {
  const next = produce(base, (draft) => applyCommand(draft, command, { now: LATER }));
  expect(checkWorkspaceInvariants(next)).toEqual([]);
  return next;
}

function itemsOf(ws: Workspace, outputId: string): string[] {
  return (ws.nodes[outputId] as OutputDocument).items;
}

describe('applyCommand / Quellen', () => {
  it('importiert neue Quellen und haengt sie an die Reihenfolge an', () => {
    const ws = run({
      type: 'importSources',
      sources: [makeSource('src-neu', 'Receipts.pdf', 12)],
    });
    expect(ws.sourceOrder).toEqual([IDS.contract, IDS.bank, IDS.insurance, 'src-neu']);
    expect(ws.sources['src-neu'].blockCount).toBe(12);
  });

  it('ersetzt eine erneut importierte Quelle ohne sie zu verdoppeln', () => {
    const ws = run({
      type: 'importSources',
      sources: [makeSource(IDS.bank, 'Bank.pdf', 50)],
    });
    expect(ws.sourceOrder).toEqual([IDS.contract, IDS.bank, IDS.insurance]);
  });

  it('entfernt eine Quelle samt ihrer Items', () => {
    const ws = run({ type: 'removeSource', sourceId: IDS.bank });
    expect(ws.items['i-b17']).toBeUndefined();
    expect(itemsOf(ws, IDS.outInsurance)).toEqual(['i-i7']);
  });
});

describe('applyCommand / Nodes und Namen', () => {
  it('legt einen Ordner an und saniert den Namen', () => {
    const ws = run({
      type: 'createFolder',
      node: { id: 'n-neu', name: '  Steuern/2026  ', parentId: null },
    });
    expect(ws.nodes['n-neu'].name).toBe('Steuern 2026');
  });

  it('loest Namenskollisionen unter Geschwistern auf', () => {
    const ws = run({
      type: 'createOutput',
      node: { id: 'n-out-neu', name: 'Insurance', parentId: IDS.folderInsurance },
    });
    expect(ws.nodes['n-out-neu'].name).toBe('Insurance 2');
  });

  it('laesst beim Umbenennen den eigenen Namen zu', () => {
    const ws = run({ type: 'renameNode', nodeId: IDS.outInsurance, name: 'Insurance' });
    expect(ws.nodes[IDS.outInsurance].name).toBe('Insurance');
  });

  it('weicht beim Umbenennen einem Geschwisternamen aus', () => {
    const base = makeWorkspace();
    const withSecond = produce(base, (draft) =>
      applyCommand(
        draft,
        {
          type: 'createOutput',
          node: { id: 'n-out-2', name: 'Police', parentId: IDS.folderInsurance },
        },
        { now: LATER },
      ),
    );
    const ws = run({ type: 'renameNode', nodeId: 'n-out-2', name: 'Insurance' }, withSecond);
    expect(ws.nodes['n-out-2'].name).toBe('Insurance 2');
  });

  it('verschiebt und loescht Nodes', () => {
    const moved = run({
      type: 'moveNode',
      nodeId: IDS.outInsurance,
      parentId: IDS.folderBank,
      index: 0,
    });
    expect(moved.nodes[IDS.outInsurance].parentId).toBe(IDS.folderBank);

    const deleted = run({ type: 'deleteNode', nodeId: IDS.folderContracts });
    expect(deleted.nodes[IDS.outContracts]).toBeUndefined();
    expect(deleted.items['i-c4']).toBeUndefined();
  });
});

describe('applyCommand / Items', () => {
  it('fuegt Seiten ein, verschiebt, kopiert, entfernt und dreht sie', () => {
    let ws = run({
      type: 'addItems',
      outputId: IDS.outInsurance,
      items: [makeItem('i-neu', IDS.bank, 20)],
      index: 0,
    });
    expect(itemsOf(ws, IDS.outInsurance)).toEqual(['i-neu', 'i-i7', 'i-b17']);

    ws = run({ type: 'moveItems', itemIds: ['i-neu'], outputId: IDS.outContracts, index: 0 }, ws);
    expect(itemsOf(ws, IDS.outContracts)).toEqual(['i-neu', 'i-c4', 'i-c5', 'i-c6']);

    ws = run(
      {
        type: 'copyItems',
        itemIds: ['i-neu'],
        outputId: IDS.outInsurance,
        index: 0,
        newIds: ['i-kopie'],
      },
      ws,
    );
    expect(itemsOf(ws, IDS.outInsurance)).toEqual(['i-kopie', 'i-i7', 'i-b17']);

    ws = run({ type: 'rotateItems', itemIds: ['i-kopie'], delta: 90 }, ws);
    expect(ws.items['i-kopie'].rotation).toBe(90);
    expect(ws.items['i-neu'].rotation).toBe(0);

    ws = run({ type: 'removeItems', itemIds: ['i-kopie'] }, ws);
    expect(itemsOf(ws, IDS.outInsurance)).toEqual(['i-i7', 'i-b17']);
  });

  it('sortiert innerhalb eines Outputs um', () => {
    const ws = run({
      type: 'reorderItems',
      outputId: IDS.outContracts,
      itemIds: ['i-c6'],
      index: 0,
    });
    expect(itemsOf(ws, IDS.outContracts)).toEqual(['i-c6', 'i-c4', 'i-c5']);
  });
});

describe('applyCommand / splitSource', () => {
  it('legt pro Teil ein Output mit den Seiten an', () => {
    const ws = run({
      type: 'splitSource',
      sourceId: IDS.insurance,
      parentId: IDS.folderInsurance,
      parts: [
        {
          outputId: 'n-split-1',
          name: 'Insurance Teil 1',
          items: [makeItem('i-s1', IDS.insurance, 0), makeItem('i-s2', IDS.insurance, 1)],
        },
        {
          outputId: 'n-split-2',
          name: 'Insurance Teil 2',
          items: [makeItem('i-s3', IDS.insurance, 2)],
        },
      ],
    });
    expect(itemsOf(ws, 'n-split-1')).toEqual(['i-s1', 'i-s2']);
    expect(itemsOf(ws, 'n-split-2')).toEqual(['i-s3']);
    expect(ws.childOrder[IDS.folderInsurance]).toEqual([
      IDS.outInsurance,
      'n-split-1',
      'n-split-2',
    ]);
  });
});

describe('applyCommand / batch und Workspace', () => {
  it('fuehrt einen Ordner-Drop als eine Aenderung aus', () => {
    const ws = run({
      type: 'batch',
      label: '46 Seiten hinzugefuegt',
      commands: [
        {
          type: 'createOutput',
          node: { id: 'n-out-neu', name: 'Contracts', parentId: IDS.folderBank },
        },
        {
          type: 'addItems',
          outputId: 'n-out-neu',
          items: [makeItem('i-neu', IDS.contract, 3)],
          index: 0,
        },
      ],
    });
    expect(itemsOf(ws, 'n-out-neu')).toEqual(['i-neu']);
  });

  it('benennt den Workspace um und ignoriert leere Namen', () => {
    expect(run({ type: 'renameWorkspace', name: 'Steuern 2026' }).name).toBe('Steuern 2026');
    expect(run({ type: 'renameWorkspace', name: '   ' }).name).toBe('Testablage');
  });

  it('setzt updatedAt auf die Zeit aus dem Kontext', () => {
    const ws = run({ type: 'rotateItems', itemIds: ['i-c4'], delta: 180 });
    expect(ws.updatedAt).toBe(LATER);
    expect(ws.createdAt).toBe(FIXED_NOW);
  });
});

describe('describeCommand', () => {
  const before = makeWorkspace();

  it('beschreibt Seitenoperationen mit Anzahl', () => {
    expect(
      describeCommand(
        { type: 'moveItems', itemIds: ['i-c4', 'i-c5'], outputId: IDS.outInsurance, index: 0 },
        before,
      ),
    ).toBe('2 Seiten verschoben');
    expect(describeCommand({ type: 'removeItems', itemIds: ['i-c4'] }, before)).toBe(
      '1 Seite entfernt',
    );
  });

  it('beschreibt das Entfernen einer Quelle mit Wirkung', () => {
    expect(describeCommand({ type: 'removeSource', sourceId: IDS.contract }, before)).toBe(
      'Quelle entfernt (3 Seiten aus 1 Dokument)',
    );
  });

  it('beschreibt Node-Operationen mit Namen', () => {
    expect(describeCommand({ type: 'deleteNode', nodeId: IDS.folderBank }, before)).toBe(
      'Ordner "Bank" geloescht',
    );
    expect(
      describeCommand(
        { type: 'createOutput', node: { id: 'x', name: 'Belege', parentId: null } },
        before,
      ),
    ).toBe('Dokument "Belege" erstellt');
  });

  it('nimmt bei batch das mitgegebene Label', () => {
    expect(
      describeCommand({ type: 'batch', label: '46 Seiten hinzugefuegt', commands: [] }, before),
    ).toBe('46 Seiten hinzugefuegt');
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/domain/commands.test.ts`
Expected: FAIL, `Failed to resolve import "./commands"`.

- [ ] **Step 3: commands.ts implementieren**

`src/domain/commands.ts`:

```ts
import {
  copyItems,
  createFolder,
  createOutput,
  deleteNode,
  insertItems,
  itemsOfSource,
  moveItems,
  moveNode,
  removeItems,
  removeSourceAndItems,
  renameNode,
  reorderItems,
  rotateItems,
  siblingNames,
  type CreateNodeInput,
} from './composition';
import { resolveCollision, sanitizeName } from './naming';
import type { CompositionItem, ItemId, NodeId, SourceDocument, SourceId, Workspace } from './types';

/** Ein Teil eines Splits: das neue Output und seine fertigen Items. */
export interface SplitOutputSpec {
  outputId: NodeId;
  name: string;
  items: CompositionItem[];
}

export type Command =
  | { type: 'importSources'; sources: SourceDocument[] }
  | { type: 'removeSource'; sourceId: SourceId }
  | { type: 'createFolder'; node: CreateNodeInput }
  | { type: 'createOutput'; node: CreateNodeInput }
  | { type: 'renameNode'; nodeId: NodeId; name: string }
  | { type: 'moveNode'; nodeId: NodeId; parentId: NodeId | null; index: number }
  | { type: 'deleteNode'; nodeId: NodeId }
  | { type: 'addItems'; outputId: NodeId; items: CompositionItem[]; index: number }
  | { type: 'moveItems'; itemIds: ItemId[]; outputId: NodeId; index: number }
  | { type: 'copyItems'; itemIds: ItemId[]; outputId: NodeId; index: number; newIds: ItemId[] }
  | { type: 'removeItems'; itemIds: ItemId[] }
  | { type: 'reorderItems'; outputId: NodeId; itemIds: ItemId[]; index: number }
  | { type: 'rotateItems'; itemIds: ItemId[]; delta: 90 | 180 | 270 }
  | { type: 'splitSource'; sourceId: SourceId; parentId: NodeId | null; parts: SplitOutputSpec[] }
  | { type: 'renameWorkspace'; name: string }
  | { type: 'batch'; label: string; commands: Command[] };

export interface CommandCtx {
  /** Zeitstempel von aussen, damit ein Command deterministisch bleibt. */
  now: number;
}

function freeName(
  ws: Workspace,
  parentId: NodeId | null,
  wanted: string,
  exceptId?: NodeId,
): string {
  return resolveCollision(sanitizeName(wanted), siblingNames(ws, parentId, exceptId));
}

export function applyCommand(ws: Workspace, command: Command, ctx: CommandCtx): void {
  switch (command.type) {
    case 'importSources':
      for (const source of command.sources) {
        if (!ws.sources[source.id]) ws.sourceOrder.push(source.id);
        ws.sources[source.id] = source;
      }
      break;
    case 'removeSource':
      removeSourceAndItems(ws, command.sourceId);
      break;
    case 'createFolder':
      createFolder(ws, {
        ...command.node,
        name: freeName(ws, command.node.parentId, command.node.name),
      });
      break;
    case 'createOutput':
      createOutput(ws, {
        ...command.node,
        name: freeName(ws, command.node.parentId, command.node.name),
      });
      break;
    case 'renameNode': {
      const node = ws.nodes[command.nodeId];
      if (node) renameNode(ws, node.id, freeName(ws, node.parentId, command.name, node.id));
      break;
    }
    case 'moveNode':
      moveNode(ws, command.nodeId, command.parentId, command.index);
      break;
    case 'deleteNode':
      deleteNode(ws, command.nodeId);
      break;
    case 'addItems':
      insertItems(ws, command.outputId, command.items, command.index);
      break;
    case 'moveItems':
      moveItems(ws, command.itemIds, command.outputId, command.index);
      break;
    case 'copyItems':
      copyItems(ws, command.itemIds, command.outputId, command.index, command.newIds);
      break;
    case 'removeItems':
      removeItems(ws, command.itemIds);
      break;
    case 'reorderItems':
      reorderItems(ws, command.outputId, command.itemIds, command.index);
      break;
    case 'rotateItems':
      rotateItems(ws, command.itemIds, command.delta);
      break;
    case 'splitSource':
      for (const part of command.parts) {
        createOutput(ws, {
          id: part.outputId,
          name: freeName(ws, command.parentId, part.name),
          parentId: command.parentId,
        });
        insertItems(ws, part.outputId, part.items, 0);
      }
      break;
    case 'renameWorkspace': {
      const name = command.name.trim();
      if (name !== '') ws.name = name;
      break;
    }
    case 'batch':
      for (const inner of command.commands) applyCommand(ws, inner, ctx);
      break;
  }
  ws.updatedAt = ctx.now;
}

function pages(count: number): string {
  return count === 1 ? '1 Seite' : `${count} Seiten`;
}

function documents(count: number): string {
  return count === 1 ? '1 Dokument' : `${count} Dokumente`;
}

function nodeLabel(ws: Workspace, nodeId: NodeId): string {
  const node = ws.nodes[nodeId];
  if (!node) return 'Element';
  return node.type === 'folder' ? `Ordner "${node.name}"` : `Dokument "${node.name}"`;
}

/**
 * Das Label des History-Eintrags. Es wird gegen den Zustand VOR dem Command
 * gebildet, weil geloeschte Nodes danach keinen Namen mehr haben.
 */
export function describeCommand(command: Command, before: Workspace): string {
  switch (command.type) {
    case 'importSources':
      return `${documents(command.sources.length)} importiert`;
    case 'removeSource': {
      const items = itemsOfSource(before, command.sourceId);
      const outputs = new Set<NodeId>();
      for (const node of Object.values(before.nodes)) {
        if (node.type !== 'output') continue;
        if (node.items.some((id) => items.includes(id))) outputs.add(node.id);
      }
      return `Quelle entfernt (${pages(items.length)} aus ${documents(outputs.size)})`;
    }
    case 'createFolder':
      return `Ordner "${sanitizeName(command.node.name)}" erstellt`;
    case 'createOutput':
      return `Dokument "${sanitizeName(command.node.name)}" erstellt`;
    case 'renameNode':
      return `In "${sanitizeName(command.name)}" umbenannt`;
    case 'moveNode':
      return `${nodeLabel(before, command.nodeId)} verschoben`;
    case 'deleteNode':
      return `${nodeLabel(before, command.nodeId)} geloescht`;
    case 'addItems':
      return `${pages(command.items.length)} hinzugefuegt`;
    case 'moveItems':
      return `${pages(command.itemIds.length)} verschoben`;
    case 'copyItems':
      return `${pages(command.itemIds.length)} kopiert`;
    case 'removeItems':
      return `${pages(command.itemIds.length)} entfernt`;
    case 'reorderItems':
      return `${pages(command.itemIds.length)} umsortiert`;
    case 'rotateItems':
      return `${pages(command.itemIds.length)} gedreht`;
    case 'splitSource': {
      const source = before.sources[command.sourceId];
      const name = source ? source.name : 'Quelle';
      return `"${name}" in ${documents(command.parts.length)} aufgeteilt`;
    }
    case 'renameWorkspace':
      return 'Workspace umbenannt';
    case 'batch':
      return command.label;
  }
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: alle Tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: Command-Union mit applyCommand und History-Labels

Genau ein Einsprungpunkt fuer jede Nutzeraktion, damit der Store sie in
produceWithPatches ausfuehren und die Undo-Inverse ableiten kann. batch fasst
zusammengehoerige Aenderungen zu einem Undo-Schritt zusammen. Namen werden nur
hier saniert und kollisionsfrei gemacht.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 10: History-Invarianten fuer jeden Command

**Files:**

- Test: `src/domain/history.invariants.test.ts`

**Interfaces:**

- Consumes: `applyCommand`, `Command` aus `./commands`; `produceWithPatches`, `applyPatches`, `enablePatches` aus `immer`
- Produces: kein Produktionscode -- dieser Task ist der Nachweis, dass die Undo-Strategie des Designs traegt, **bevor** Plan 3 den Store darauf baut

Das Design begruendet die abgeleitete Inverse damit, dass die Fehlerklasse "Undo fuer Operation X vergessen" dadurch nicht existiert. Dieser Task macht diese Behauptung pruefbar: eine Tabelle aller Commands, fuer jeden `undo(do(s)) == s` und `redo(undo(do(s))) == do(s)`. Faellt spaeter ein Command aus der Tabelle, faellt der Vollstaendigkeitstest auf.

- [ ] **Step 1: Den Test schreiben**

`src/domain/history.invariants.test.ts`:

```ts
import { applyPatches, enablePatches, produceWithPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { applyCommand, type Command } from './commands';
import { FIXED_NOW, IDS, makeItem, makeSource, makeWorkspace } from './__fixtures__/workspace';
import { checkWorkspaceInvariants } from './invariants';

// Immer liefert Patches nur, wenn das Plugin aktiviert ist. Plan 3 ruft dies
// beim Store-Aufbau; hier steht es fuer den Test.
enablePatches();

const NOW = FIXED_NOW + 60_000;

const CASES: Array<{ name: string; command: Command }> = [
  {
    name: 'importSources',
    command: { type: 'importSources', sources: [makeSource('src-neu', 'Receipts.pdf', 12)] },
  },
  { name: 'removeSource', command: { type: 'removeSource', sourceId: IDS.bank } },
  {
    name: 'createFolder',
    command: { type: 'createFolder', node: { id: 'n-neu', name: 'Belege', parentId: IDS.tax } },
  },
  {
    name: 'createOutput',
    command: {
      type: 'createOutput',
      node: { id: 'n-out-neu', name: 'Quittungen', parentId: IDS.folderBank },
    },
  },
  { name: 'renameNode', command: { type: 'renameNode', nodeId: IDS.outInsurance, name: 'Police' } },
  {
    name: 'moveNode',
    command: { type: 'moveNode', nodeId: IDS.outInsurance, parentId: IDS.folderBank, index: 0 },
  },
  {
    name: 'moveNode (umsortieren)',
    command: { type: 'moveNode', nodeId: IDS.folderBank, parentId: IDS.tax, index: 3 },
  },
  { name: 'deleteNode (Output)', command: { type: 'deleteNode', nodeId: IDS.outContracts } },
  { name: 'deleteNode (Unterbaum)', command: { type: 'deleteNode', nodeId: IDS.tax } },
  {
    name: 'addItems',
    command: {
      type: 'addItems',
      outputId: IDS.outInsurance,
      items: [makeItem('i-neu', IDS.bank, 20), makeItem('i-neu2', IDS.bank, 21)],
      index: 1,
    },
  },
  {
    name: 'moveItems (zwischen Outputs)',
    command: { type: 'moveItems', itemIds: ['i-c4', 'i-c6'], outputId: IDS.outInsurance, index: 1 },
  },
  {
    name: 'moveItems (innerhalb eines Outputs)',
    command: { type: 'moveItems', itemIds: ['i-c4'], outputId: IDS.outContracts, index: 3 },
  },
  {
    name: 'copyItems',
    command: {
      type: 'copyItems',
      itemIds: ['i-c4', 'i-c5'],
      outputId: IDS.outInsurance,
      index: 0,
      newIds: ['i-k1', 'i-k2'],
    },
  },
  { name: 'removeItems', command: { type: 'removeItems', itemIds: ['i-c4', 'i-b17'] } },
  {
    name: 'reorderItems',
    command: { type: 'reorderItems', outputId: IDS.outContracts, itemIds: ['i-c6'], index: 0 },
  },
  { name: 'rotateItems', command: { type: 'rotateItems', itemIds: ['i-c4', 'i-c5'], delta: 90 } },
  {
    name: 'splitSource',
    command: {
      type: 'splitSource',
      sourceId: IDS.insurance,
      parentId: IDS.folderInsurance,
      parts: [
        {
          outputId: 'n-split-1',
          name: 'Insurance Teil 1',
          items: [makeItem('i-s1', IDS.insurance, 0)],
        },
        {
          outputId: 'n-split-2',
          name: 'Insurance Teil 2',
          items: [makeItem('i-s2', IDS.insurance, 1)],
        },
      ],
    },
  },
  { name: 'renameWorkspace', command: { type: 'renameWorkspace', name: 'Steuern 2026' } },
  {
    name: 'batch (Ordner-Drop)',
    command: {
      type: 'batch',
      label: '1 Seite hinzugefuegt',
      commands: [
        {
          type: 'createOutput',
          node: { id: 'n-out-neu', name: 'Contracts', parentId: IDS.folderBank },
        },
        {
          type: 'addItems',
          outputId: 'n-out-neu',
          items: [makeItem('i-neu', IDS.contract, 3)],
          index: 0,
        },
      ],
    },
  },
];

describe('History-Invarianten', () => {
  it.each(CASES)('$name: undo(do(s)) == s und redo danach == do(s)', ({ command }) => {
    const before = makeWorkspace();
    const [after, patches, inversePatches] = produceWithPatches(before, (draft) => {
      applyCommand(draft, command, { now: NOW });
    });

    expect(checkWorkspaceInvariants(after)).toEqual([]);
    expect(after).not.toEqual(before);

    const undone = applyPatches(after, inversePatches);
    expect(undone).toEqual(before);

    const redone = applyPatches(undone, patches);
    expect(redone).toEqual(after);
  });

  it('deckt jeden Command-Typ ab', () => {
    const covered = new Set(CASES.map(({ command }) => command.type));
    const expected: Array<Command['type']> = [
      'importSources',
      'removeSource',
      'createFolder',
      'createOutput',
      'renameNode',
      'moveNode',
      'deleteNode',
      'addItems',
      'moveItems',
      'copyItems',
      'removeItems',
      'reorderItems',
      'rotateItems',
      'splitSource',
      'renameWorkspace',
      'batch',
    ];
    expect([...covered].sort()).toEqual([...expected].sort());
  });
});
```

- [ ] **Step 2: Test laufen lassen**

Run: `npm run test -- src/domain/history.invariants.test.ts`
Expected: PASS fuer alle Faelle. Schlaegt ein Fall fehl, liegt der Fehler **nicht** im Test: dann mutiert die betroffene Operation den Draft an einer Stelle, die Immer nicht mitschreibt (typischer Grund: ein Objekt wird vor dem Einhaengen mutiert oder ausserhalb des Drafts erzeugt und geteilt). Die Operation korrigieren, nicht den Test.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
test: undo/redo-Invarianten fuer jeden Command

Tabellengetriebener Nachweis, dass die abgeleitete Immer-Inverse fuer alle 16
Commands zurueckfuehrt. Ein Vollstaendigkeitstest schlaegt fehl, wenn ein
neuer Command-Typ nicht in der Tabelle steht.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

### Task 11: ExportPlan (`exportPlan.ts`)

**Files:**

- Create: `src/domain/exportPlan.ts`
- Test: `src/domain/exportPlan.test.ts`

**Interfaces:**

- Consumes: `sanitizeName`, `resolveCollision`, `withPdfExtension` aus `./naming`; Typen aus `./types`
- Produces:
  - `interface ExportEntry { outputId: NodeId; path: string[]; fileName: string; items: CompositionItem[] }`
  - `interface SkippedOutput { outputId: NodeId; name: string; reason: 'empty' }`
  - `interface ExportPlan { entries: ExportEntry[]; skipped: SkippedOutput[]; totalBlocks: number }`
  - `type ExportScope = { kind: 'workspace' } | { kind: 'node'; nodeId: NodeId }`
  - `buildExportPlan(ws: Workspace, scope?: ExportScope): ExportPlan`

Beide Writer aus Plan 4 (Verzeichnis und ZIP) konsumieren ausschliesslich diesen Plan. `path` ist relativ und enthaelt bereits sanitisierte, kollisionsfreie Namen; leere Outputs landen in `skipped`, weil ein PDF ohne Seiten keine gueltige Datei ist.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/domain/exportPlan.test.ts`:

```ts
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { applyCommand } from './commands';
import { buildExportPlan } from './exportPlan';
import { FIXED_NOW, IDS, makeItem, makeWorkspace } from './__fixtures__/workspace';
import type { Workspace } from './types';

function withOutput(
  base: Workspace,
  id: string,
  name: string,
  parentId: string | null,
  itemId?: string,
) {
  return produce(base, (draft) => {
    applyCommand(draft, { type: 'createOutput', node: { id, name, parentId } }, { now: FIXED_NOW });
    if (itemId) {
      applyCommand(
        draft,
        { type: 'addItems', outputId: id, items: [makeItem(itemId, IDS.bank, 0)], index: 0 },
        { now: FIXED_NOW },
      );
    }
  });
}

describe('buildExportPlan / Workspace-Umfang', () => {
  it('bildet die Ordnerstruktur als relative Pfade ab', () => {
    const plan = buildExportPlan(makeWorkspace());
    expect(plan.entries).toEqual([
      {
        outputId: IDS.outInsurance,
        path: ['Tax 2026', 'Insurance'],
        fileName: 'Insurance.pdf',
        items: [
          { id: 'i-i7', sourceId: IDS.insurance, blockIndex: 6, rotation: 0 },
          { id: 'i-b17', sourceId: IDS.bank, blockIndex: 16, rotation: 0 },
        ],
      },
      {
        outputId: IDS.outContracts,
        path: ['Tax 2026', 'Contracts'],
        fileName: 'Contracts.pdf',
        items: [
          { id: 'i-c4', sourceId: IDS.contract, blockIndex: 3, rotation: 0 },
          { id: 'i-c5', sourceId: IDS.contract, blockIndex: 4, rotation: 0 },
          { id: 'i-c6', sourceId: IDS.contract, blockIndex: 5, rotation: 0 },
        ],
      },
    ]);
    expect(plan.totalBlocks).toBe(5);
    expect(plan.skipped).toEqual([]);
  });

  it('haelt die Reihenfolge von childOrder ein', () => {
    const plan = buildExportPlan(makeWorkspace());
    expect(plan.entries.map((entry) => entry.fileName)).toEqual(['Insurance.pdf', 'Contracts.pdf']);
  });

  it('uebergeht leere Outputs und nennt sie in skipped', () => {
    const ws = withOutput(makeWorkspace(), 'n-leer', 'Leeres Dokument', IDS.folderBank);
    const plan = buildExportPlan(ws);
    expect(plan.entries.map((entry) => entry.outputId)).not.toContain('n-leer');
    expect(plan.skipped).toEqual([
      { outputId: 'n-leer', name: 'Leeres Dokument', reason: 'empty' },
    ]);
  });

  it('uebergeht Ordner ohne Outputs, ohne Eintrag zu erzeugen', () => {
    const plan = buildExportPlan(makeWorkspace());
    expect(plan.entries.some((entry) => entry.path.includes('Bank'))).toBe(false);
  });
});

describe('buildExportPlan / Namen', () => {
  it('loest Dateinamenkollisionen im selben Ordner auf', () => {
    // Der Name wird hier direkt gesetzt, nicht ueber applyCommand: sonst
    // loeste bereits die Command-Schicht die Kollision auf und dieser Test
    // pruefte den Export gar nicht.
    const ws = produce(
      withOutput(makeWorkspace(), 'n-zwei', 'Police', IDS.folderInsurance, 'i-x'),
      (draft) => {
        draft.nodes['n-zwei'].name = 'Insurance';
      },
    );
    const plan = buildExportPlan(ws);
    const names = plan.entries
      .filter((entry) => entry.path.at(-1) === 'Insurance')
      .map((entry) => entry.fileName);
    expect(names).toEqual(['Insurance.pdf', 'Insurance 2.pdf']);
  });

  it('laesst gleiche Namen in verschiedenen Ordnern unangetastet', () => {
    const ws = withOutput(makeWorkspace(), 'n-zwei', 'Insurance', IDS.folderBank, 'i-x');
    const plan = buildExportPlan(ws);
    expect(plan.entries.filter((entry) => entry.fileName === 'Insurance.pdf')).toHaveLength(2);
  });

  it('saniert Ordner- und Dateinamen', () => {
    const ws = produce(makeWorkspace(), (draft) => {
      draft.nodes[IDS.folderBank].name = 'Bank/Konten';
      draft.nodes[IDS.outInsurance].name = 'CON';
    });
    const plan = buildExportPlan(ws);
    expect(plan.entries[0].fileName).toBe('CON_.pdf');
    expect(buildExportPlan(ws, { kind: 'node', nodeId: IDS.folderBank }).entries).toEqual([]);
  });

  it('verdoppelt eine vorhandene Endung nicht', () => {
    const ws = produce(makeWorkspace(), (draft) => {
      draft.nodes[IDS.outContracts].name = 'Vertraege.pdf';
    });
    const plan = buildExportPlan(ws);
    expect(plan.entries.map((entry) => entry.fileName)).toContain('Vertraege.pdf');
  });
});

describe('buildExportPlan / einzelne Knoten', () => {
  it('exportiert einen Ordner mit sich selbst als oberstem Verzeichnis', () => {
    const plan = buildExportPlan(makeWorkspace(), { kind: 'node', nodeId: IDS.folderContracts });
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].path).toEqual(['Contracts']);
    expect(plan.entries[0].fileName).toBe('Contracts.pdf');
  });

  it('exportiert ein einzelnes Output ohne Pfad', () => {
    const plan = buildExportPlan(makeWorkspace(), { kind: 'node', nodeId: IDS.outInsurance });
    expect(plan.entries).toHaveLength(1);
    expect(plan.entries[0].path).toEqual([]);
    expect(plan.entries[0].fileName).toBe('Insurance.pdf');
    expect(plan.totalBlocks).toBe(2);
  });

  it('liefert fuer eine unbekannte Node einen leeren Plan', () => {
    const plan = buildExportPlan(makeWorkspace(), { kind: 'node', nodeId: 'gibt-es-nicht' });
    expect(plan).toEqual({ entries: [], skipped: [], totalBlocks: 0 });
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag pruefen**

Run: `npm run test -- src/domain/exportPlan.test.ts`
Expected: FAIL, `Failed to resolve import "./exportPlan"`.

- [ ] **Step 3: exportPlan.ts implementieren**

`src/domain/exportPlan.ts`:

```ts
import { resolveCollision, sanitizeName, withPdfExtension } from './naming';
import type { CompositionItem, NodeId, Workspace } from './types';
import { ROOT } from './types';

/** Eine zu schreibende Datei. `path` ist relativ zum gewaehlten Ziel. */
export interface ExportEntry {
  outputId: NodeId;
  path: string[];
  fileName: string;
  items: CompositionItem[];
}

export interface SkippedOutput {
  outputId: NodeId;
  name: string;
  reason: 'empty';
}

export interface ExportPlan {
  entries: ExportEntry[];
  skipped: SkippedOutput[];
  totalBlocks: number;
}

export type ExportScope = { kind: 'workspace' } | { kind: 'node'; nodeId: NodeId };

/**
 * Uebersetzt den Workspace in eine flache Liste zu schreibender Dateien.
 * Beide Writer (Verzeichnis und ZIP) konsumieren ausschliesslich dieses
 * Ergebnis -- damit koennen sie sich nur noch im Schreibweg unterscheiden,
 * nicht in Struktur oder Benennung.
 */
export function buildExportPlan(
  ws: Workspace,
  scope: ExportScope = { kind: 'workspace' },
): ExportPlan {
  const plan: ExportPlan = { entries: [], skipped: [], totalBlocks: 0 };

  if (scope.kind === 'workspace') {
    walk(ws, ws.childOrder[ROOT] ?? [], [], plan);
    return plan;
  }

  const node = ws.nodes[scope.nodeId];
  if (!node) return plan;
  // Ein einzelner Ordner wird zum obersten Verzeichnis, ein einzelnes Output
  // zu einer Datei ohne Pfad.
  walk(ws, [node.id], [], plan);
  return plan;
}

function walk(ws: Workspace, nodeIds: NodeId[], path: string[], plan: ExportPlan): void {
  // Ordner- und Dateinamen kollidieren nicht miteinander ("Bank" vs. "Bank.pdf"),
  // deshalb zwei getrennte Namensraeume pro Verzeichnis.
  const usedFolderNames = new Set<string>();
  const usedFileNames = new Set<string>();

  for (const nodeId of nodeIds) {
    const node = ws.nodes[nodeId];
    if (!node) continue;

    if (node.type === 'folder') {
      const folderName = claim(sanitizeName(node.name), usedFolderNames);
      walk(ws, ws.childOrder[nodeId] ?? [], [...path, folderName], plan);
      continue;
    }

    if (node.items.length === 0) {
      plan.skipped.push({ outputId: nodeId, name: node.name, reason: 'empty' });
      continue;
    }

    const items = node.items
      .map((itemId) => ws.items[itemId])
      .filter((item): item is CompositionItem => item !== undefined);
    if (items.length === 0) {
      plan.skipped.push({ outputId: nodeId, name: node.name, reason: 'empty' });
      continue;
    }

    const base = claim(sanitizeName(node.name), usedFileNames);
    plan.entries.push({ outputId: nodeId, path, fileName: withPdfExtension(base), items });
    plan.totalBlocks += items.length;
  }
}

function claim(name: string, used: Set<string>): string {
  const resolved = resolveCollision(name, used);
  used.add(resolved.toLowerCase());
  return resolved;
}
```

- [ ] **Step 4: Tests pruefen**

Run: `npm run test && npm run typecheck && npm run lint && npm run build`
Expected: alle Tests PASS, kein Typ- oder Lintfehler, Build gruen.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'PLANEOF'
feat: ExportPlan aus dem Workspace

Eine flache Liste zu schreibender Dateien mit relativen, sanitisierten und
kollisionsfreien Pfaden. Verzeichnis- und ZIP-Writer koennen sich damit nur
noch im Schreibweg unterscheiden. Leere Outputs werden uebergangen und
gemeldet, weil ein PDF ohne Seiten keine gueltige Datei ist.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
PLANEOF
)"
```

---

## Selbstpruefung gegen die Spezifikation

Abgleich mit `docs/superpowers/specs/2026-09-10-document-workspace-design.md`:

| Abschnitt der Spezifikation                                                   | In diesem Plan                                                                      |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 2 Technischer Rahmen (Vite, React 19, TS strict, Immer, Vitest, npm)          | Task 1                                                                              |
| 2 Technischer Rahmen (pdfjs, pdf-lib, react-virtual, fflate, idb, Playwright) | Plan 2-4                                                                            |
| 3 Schichtung, ESLint-Regel `import/no-restricted-paths`                       | Task 2                                                                              |
| 4 Erweiterbarkeits-Naht (`BlockKind`, `BlockRef`)                             | Task 3 (Typen); Adapter-Interfaces in Plan 2                                        |
| 5 Datenmodell und die sechs Invarianten                                       | Task 3                                                                              |
| 6 Commands, `batch` als ein Undo-Schritt, abgeleitete Inverse                 | Task 9, Task 10                                                                     |
| 6 Store, History-Stack, Selektionsstore                                       | Plan 3                                                                              |
| 7 Persistenz und Autosave                                                     | Plan 2                                                                              |
| 8 PDF-Engine, Pool, Render-Queue, Thumbnails, Virtualisierung                 | Plan 2 (Engine), Plan 3 (Virtualisierung)                                           |
| 9 Layout, Drag-Systeme, Selektion, Move/Copy, Drop-Regel, Tastaturkuerzel     | Plan 3                                                                              |
| 9 Range-Feld (`domain/ranges.ts`)                                             | Task 4                                                                              |
| 9 Split-Panel (`domain/split.ts`, Restseiten nach vorn)                       | Task 5                                                                              |
| 10 Preview und Suche                                                          | Plan 4                                                                              |
| 11 Import                                                                     | Plan 2                                                                              |
| 11 Export: `ExportPlan`, Namensregeln, Kollisionen                            | Task 6, Task 11                                                                     |
| 11 Export: Verzeichnis-Writer, ZIP-Writer, Fortschritt                        | Plan 4                                                                              |
| 12 Akzeptanzszenario                                                          | Datenseitig in Task 9-11 abgedeckt, als Playwright-Flow in Plan 4                   |
| 14 Fehlerbehandlung und Sicherheit                                            | Plan 2 (Parsing), Plan 3 (Anzeige); hier nur verstaendliche Fehlertexte in `domain` |
| 15 Tests: Domain per TDD, History-Invarianten                                 | Task 3-11                                                                           |

Offen und bewusst nicht in Plan 1: alles unter `adapters`, `services`, `workers` und alles Sichtbare unter `ui` ausser der Shell aus Task 1.

## Anschluss: die drei folgenden Plaene

Die Reihenfolge ist bindend, weil jeder Plan die Naht des vorherigen benutzt:

1. **Plan 2 -- PDF-Engine, Persistenz, Import.** `adapters/pdf` (probe, renderBlock, Pool), `adapters/types.ts` mit `DocumentAdapter`/`BlockAssembler` und Registry, `services/persistence` (idb-Schema, `SourceBlobStore`, `workspaceRepo`, Autosave), `services/import`, `services/thumbnails`. Ergebnis: Dokumente importieren, Seitenraster mit Thumbnails sehen, Neustart ohne Datenverlust.
2. **Plan 3 -- Workspace-UI und Interaktion.** Zustand-Store mit `produceWithPatches` und History auf `applyCommand`, Selektionsstore, virtualisierte Raster, Baum, Range-Feld, Split-Panel, die beiden getrennten Drag-Systeme, Tastaturkuerzel, `assertWorkspaceInvariants` in Entwicklungsbuilds.
3. **Plan 4 -- Preview, Suche, Export.** Viewer fuer Quelle und Ergebnis, Textextraktions-Worker mit Cache, Suche mit Bereichsumschalter, `fsAccessWriter` und `zipWriter` auf dem `ExportPlan`, Export-Fortschritt, Playwright-Test des Akzeptanzszenarios bis zum ZIP.
