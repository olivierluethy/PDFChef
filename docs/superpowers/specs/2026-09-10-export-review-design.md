# Design: Export-Review mit Warnungen (Phase 2, Teilprojekt 3)

Datum: 2026-09-10
Status: zur Umsetzung freigegeben
Baut auf: Phase 1 + Bild-Import + Kapitel-Navigation (`main`)

## 1. Zweck und Abgrenzung

Der Export-Dialog zeigt heute den Plan, analysiert ihn aber nicht (Anforderung
29). Neu ist eine **reine Analyse** des `ExportPlan`, die vor dem Export klare
Hinweise gibt: welche Dokumente leer uebergangen werden und welche Dateinamen
wegen Kollision automatisch umbenannt wurden. Es sind Hinweise, keine Blocker
-- der Export bleibt jederzeit moeglich.

Bewusst **nicht** in v1: Warnungen zu sehr grossen Dokumenten; blockierende
Fehler; Analyse des Quellstatus (verschluesselte/fehlerhafte Quellen koennen in
Phase 1 gar nicht in eine Komposition gelangen -- sie sind nicht auswaehlbar).

## 2. Architektur (klein, additiv)

### 2.1 `ExportEntry` merkt sich eine Umbenennung

`src/domain/exportPlan.ts`: `ExportEntry` bekommt ein optionales Feld.

```ts
export interface ExportEntry {
  outputId: NodeId;
  path: string[];
  fileName: string;
  items: CompositionItem[];
  renamedFrom?: string;   // NEU: der gewuenschte Dateiname vor Kollisionsaufloesung
}
```

In `walk()` beim Anlegen eines Output-Eintrags:

```ts
const desired = sanitizeName(node.name);
const base = claim(desired, usedFileNames);         // loest die Kollision auf
const fileName = withPdfExtension(base);
const entry: ExportEntry = { outputId: nodeId, path, fileName, items };
if (base !== desired) entry.renamedFrom = withPdfExtension(desired);
plan.entries.push(entry);
```

Rueckwaertskompatibel: das Feld ist optional, der Plan selbst und alle
bestehenden Konsumenten (Writer, Runner) bleiben unveraendert.

### 2.2 Reine Analyse

Neu `src/domain/exportWarnings.ts`:

```ts
export interface ExportWarning {
  severity: 'warn' | 'info';
  kind: 'empty' | 'renamed';
  message: string;
  outputId?: NodeId;
}

export function analyzeExport(plan: ExportPlan): ExportWarning[];
```

- Pro `skipped`-Eintrag: `{ severity:'warn', kind:'empty', outputId, message:
  '"<name>" ist leer und wird nicht exportiert.' }`.
- Pro `entry` mit `renamedFrom`: `{ severity:'info', kind:'renamed', outputId,
  message: '"<renamedFrom>" heisst wie ein anderes Dokument im selben Ordner
  und wird als "<fileName>" exportiert.' }`.
- Reihenfolge: erst Warnungen (`warn`), dann Hinweise (`info`); innerhalb
  stabil zur Plan-Reihenfolge. Framework-frei, unabhaengig testbar.

### 2.3 Anzeige

`src/ui/export/ExportDialog.tsx`: neues Prop `warnings: ExportWarning[]`.
Ueber den Zielknoepfen ein Hinweis-Block, `warn` und `info` farblich
unterschieden (z. B. `warn` bernstein, `info` gedaempft). Die bisherige
Zeile "Uebergangen (leer): …" geht in diesen Block auf (die `empty`-Warnungen
ersetzen sie). Kein Blocker -- die Export-Knoepfe bleiben aktiv.

`src/ui/export/useExport.tsx`: `const warnings = analyzeExport(plan)` und als
Prop an `ExportDialog` durchreichen (fuer den geoeffneten Plan).

## 3. Geaenderte und neue Dateien

| Datei | Aenderung |
| --- | --- |
| `src/domain/exportPlan.ts` | `ExportEntry.renamedFrom?`; Erkennung in `walk()` |
| `src/domain/exportWarnings.ts` | neu: `ExportWarning`, `analyzeExport` |
| `src/ui/export/ExportDialog.tsx` | `warnings`-Prop + Hinweis-Block, alte skipped-Zeile faellt weg |
| `src/ui/export/useExport.tsx` | `analyzeExport(plan)` berechnen und durchreichen |

## 4. Fehler/Robustheit

- `analyzeExport` ist total: leerer Plan -> leere Liste.
- Deutsch, nie das scharfe s (immer `ss`).
- Kollisionsaufloesung selbst bleibt unveraendert -- nur die Herkunft wird
  zusaetzlich vermerkt.

## 5. Tests

Umsetzung ohne Testlaeufe (Nutzervorgabe); Kompilierpruefung via
`tsc --noEmit`, `eslint .`, `vite build`. `analyzeExport` und die
`renamedFrom`-Erkennung sind reine Funktionen und spaeter ohne Umbau
unit-testbar.
