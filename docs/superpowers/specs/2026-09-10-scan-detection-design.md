# Design: Automatische Dokumenterkennung in Scans (Phase 2, Teilprojekt 10)

Datum: 2026-09-10
Status: zur Umsetzung freigegeben

## Zweck und Abgrenzung

Ein Stapel-Scan (viele Seiten in einer Quelle) laesst sich automatisch an
**nahezu leeren Trennseiten** in einzelne Dokumente aufteilen. Die Erkennung
ist bewusst eine **Heuristik** (Anteil dunkler Pixel je Seite); die Trefferquote
haengt vom Scan ab. Ergebnis ist ein normaler Split ueber den vorhandenen
`splitSource`-Command -- der Nutzer sieht die vorgeschlagenen Teile vor dem
Anwenden.

Bewusst **nicht** in v1: Barcode-/Trennblatt-Codes; Inhalts-/Layoutanalyse;
automatisches Anwenden ohne Vorschau; Erkennung von Dokumentgrenzen ohne
Trennseiten.

## Architektur (baut auf dem bestehenden Split-Panel auf)

1. Rein (`src/domain/scanSplit.ts`, neu):
   `export function groupNonBlank(blockCount: number, blankIndices: Iterable<number>): number[][]`
   -- liefert die Segmente aufeinanderfolgender **nicht**-leerer Seitenindizes,
   die leeren Trennseiten werden verworfen; leere Segmente entfallen. Rein,
   testbar. (Beispiel: blockCount 6, blank {2} -> [[0,1],[3,4,5]].)

2. Erkennung (`src/ui/workspace/detectBlankPages.ts`, neu, UI-nah, nutzt den
   Adapter + Canvas):
   `export async function detectBlankPages(adapter: DocumentAdapter, sourceId:
   SourceId, blockCount: number, opts?: { threshold?: number; onProgress?(done,
   total): void }): Promise<number[]>` -- je Seite `adapter.renderBlock({
   sourceId, blockIndex }, { targetWidth: 120 })` -> Blob -> `createImageBitmap`
   -> kleines `OffscreenCanvas` -> `getImageData` -> Anteil "dunkler" Pixel
   (Luminanz unter Schwelle). Seite gilt als leer, wenn der dunkle Anteil unter
   `threshold` (Standard z. B. 0.004) liegt. Liefert die Indizes leerer Seiten.
   Reine Schwellenpruefung in einer kleinen Hilfsfunktion `isBlank(darkFraction,
   threshold)`.

3. `src/ui/workspace/SplitPanel.tsx` (erweitern): neue Strategie
   "An leeren Trennseiten" (`blankSeparators`). Bei Auswahl ein Knopf
   "Trennseiten erkennen", der `detectBlankPages` laeuft (Fortschritt sichtbar),
   danach `groupNonBlank(blockCount, blank)` -> `SplitPart[]` (Label "Teil N",
   `indices` = Segment) in den lokalen Zustand legt und wie die anderen
   Strategien in der Vorschau zeigt. "N Dokumente erstellen" wendet ueber das
   vorhandene `buildSplitCommand(parts)` an (unveraendert). Findet die Heuristik
   keine Trennseiten, bleibt es ein Teil (die ganze Quelle) mit Hinweis.

## Dateien

| Datei | Aenderung |
| --- | --- |
| `src/domain/scanSplit.ts` | neu: `groupNonBlank` (rein) |
| `src/ui/workspace/detectBlankPages.ts` | neu: Blank-Erkennung via Adapter+Canvas |
| `src/ui/workspace/SplitPanel.tsx` | Strategie "blankSeparators" mit Erkennen-Schritt |

Kein neuer Command (nutzt `splitSource`/`buildSplitCommand`), keine
Domain-/Store-/Persistenz-Aenderung ausser der reinen `groupNonBlank`.

## Robustheit / Tests

- Grosse Scans: die Erkennung rendert jede Seite klein (120 px) -- linear, mit
  Fortschritt; bewusste Grenze.
- Heuristik: die Schwelle ist ein pragmatischer Standard; echte leere Seiten mit
  starkem Scanrauschen koennen uebersehen werden (ehrlich als Heuristik
  benannt).
- Deutsch, nie das scharfe s. Ohne Testlaeufe; Pruefung via
  `tsc`/`eslint`/`vite build`. `groupNonBlank`/`isBlank` sind rein und spaeter
  testbar.
