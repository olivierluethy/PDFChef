# Design: Kapitel-/Bookmark-Navigation (Phase 2, Teilprojekt 2)

Datum: 2026-09-10
Status: zur Umsetzung freigegeben
Baut auf: Phase 1 + Bild-Import (`main`)

## 1. Zweck und Abgrenzung

Fuer Quellen mit Inhaltsverzeichnis (PDF-Bookmarks) wird ein Kapitelbaum
angezeigt; ein Klick springt im Quellraster zur Kapitelseite und waehlt sie
aus. Von dort kann der Nutzer die Seiten direkt komponieren (ziehen). Das
Inhaltsverzeichnis wird bereits beim Import gelesen und gespeichert
(`SourceDocument.outline`) -- dieses Teilprojekt ist **reines UI**: keine
Aenderung an Import, Probe, Domain, Store oder Persistenz.

Bilder und PDFs ohne Outline zeigen kein Panel. Bewusst **nicht** in v1: den
Preview-Viewer per Kapitel steuern (der Sprung zielt aufs Arbeitsraster),
Kapitel im Output-Raster, Umbenennen/Bearbeiten von Bookmarks.

## 2. Vorhandene Daten (unveraendert)

```ts
// domain/types.ts (bereits vorhanden)
interface OutlineNode { title: string; blockIndex: number; children: OutlineNode[] }
interface SourceDocument { /* ... */ outline?: OutlineNode[]; blockCount: number; /* ... */ }
```

`pdfjsEngine` loest die Bookmark-Ziele beim Import zu `blockIndex` auf;
`importSources` uebernimmt `outline` in das `SourceDocument`. Es sind keine
Aenderungen an diesem Pfad noetig.

## 3. Architektur (klein und additiv)

### 3.1 `OutlinePanel` (neu: `src/ui/sources/OutlinePanel.tsx`)

```ts
export interface OutlinePanelProps {
  outline: OutlineNode[];
  blockCount: number;
  onNavigate(blockIndex: number): void;
}
export function OutlinePanel(props: OutlinePanelProps): JSX.Element;
```

- Rendert den Baum rekursiv: pro Knoten eine Schaltflaeche mit Titel und
  Seitenzahl (`Seite {blockIndex+1}`), Kinder eingerueckt (Tiefe * Einzug).
- Klick ruft `onNavigate(clamp(blockIndex, 0, blockCount-1))`.
- Einklappbar (lokaler `useState`), Standard eingeklappt oder offen -- Details
  im UI, aber ohne persistenten Zustand.
- Rein darstellend; kein Store-Zugriff.

### 3.2 `VirtualGrid` bekommt optionales `scrollTo`

```ts
export interface VirtualGridProps {
  /* ... bestehend ... */
  scrollTo?: { index: number; nonce: number };  // NEU
}
```

- `useEffect` auf `scrollTo?.nonce`: `rowVirtualizer.scrollToIndex(
  Math.floor(scrollTo.index / columns), { align: 'start' })`.
- Der `nonce` erlaubt wiederholtes Anspringen desselben Kapitels.
- Rein additiv; ohne `scrollTo` bleibt das Verhalten unveraendert.

### 3.3 Verdrahtung in `SourceGrid` und `App`

- `SourceGrid` bekommt ein optionales Prop `scrollTo?: { index: number; nonce:
  number }` und reicht es an `VirtualGrid` weiter. Beachtet den
  `onlyUnused`-Filter: liegt die Zielseite im aktuell gefilterten Satz, wird
  ihre Position im gefilterten Index gescrollt; sonst wird der Filter fuer den
  Sprung ignoriert (einfachste Loesung: `scrollTo.index` bezieht sich auf die
  Rasterposition; `SourceGrid` uebersetzt `blockIndex` -> aktuelle
  Rasterposition, oder schaltet `onlyUnused` beim Sprung ab). v1: beim Sprung
  `onlyUnused` **nicht** automatisch aendern; die Rasterposition wird aus dem
  ungefilterten `blockIndex` bestimmt, wenn der Filter aus ist (Normalfall).
- `App` haelt `const [sourceSeek, setSourceSeek] = useState<{ blockIndex: number;
  nonce: number } | null>(null)`. Beim Kapitelklick:
  - Selektion setzen: `selectionStore.getState().select({ kind: 'source',
    sourceId: activeSource.id }, String(blockIndex), [String(blockIndex)])`.
  - `setSourceSeek({ blockIndex, nonce: Date.now() })`.
  - `SourceGrid` erhaelt `scrollTo={sourceSeek}`.
- Das `OutlinePanel` wird im mittleren Bereich ueber dem Quellraster gerendert,
  **nur** wenn `activeSource?.outline?.length` vorhanden ist.

Kein neuer Zustand in Store/Domain/Persistenz; `sourceSeek` ist fluechtiger
UI-Zustand in `App`.

## 4. Geaenderte und neue Dateien

| Datei | Aenderung |
| --- | --- |
| `src/ui/sources/OutlinePanel.tsx` | neu: rekursiver Kapitelbaum |
| `src/ui/common/VirtualGrid.tsx` | optionales `scrollTo` via `scrollToIndex` |
| `src/ui/sources/SourceGrid.tsx` | `scrollTo`-Prop durchreichen |
| `src/ui/app/App.tsx` | `OutlinePanel` einhaengen, `sourceSeek`-Zustand + Kapitelklick verdrahten |

## 5. Fehler/Robustheit

- Nicht aufloesbare Ziele werden auf `[0, blockCount)` geklemmt.
- Kein Inhaltsverzeichnis -> kein Panel (die Bedingung `outline?.length`).
- Deutsch, nie das scharfe s (immer `ss`).

## 6. Tests

Umsetzung ohne Testlaeufe (Nutzervorgabe); Kompilierpruefung via
`tsc --noEmit`, `eslint .`, `vite build`. Der Kapitelbaum und die
Scroll-Uebersetzung sind so geschnitten, dass sie spaeter ohne Umbau
unit-getestet werden koennen.
