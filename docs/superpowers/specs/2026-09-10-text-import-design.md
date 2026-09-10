# Design: Text-Import TXT/MD (Phase 2, Teilprojekt 8)

Datum: 2026-09-10
Status: zur Umsetzung freigegeben

## Zweck und Abgrenzung

Textdateien (`.txt`, `.md`) werden importiert und als paginierte Seiten
komponiert/exportiert. v1 rendert **einfachen Text** in Monospace mit fester
Seitengeometrie (A4). Markdown wird als Rohtext angezeigt -- **keine**
Markdown-Formatierung in v1. Textquellen sind in v1 **nicht durchsuchbar**
(die Suche bleibt PDF-fokussiert). Erweitert die bewaehrte Adapter-Naht
(wie der Bild-Import), spiegelt dessen Muster.

## Architektur

Geteilte, deterministische Pagination (`src/adapters/text/textLayout.ts`, neu,
rein):

```ts
export const TEXT_PAGE = { width: 595, height: 842, margin: 48, fontSize: 11, lineHeight: 15 } as const; // A4 @72dpi, Courier
export const CHARS_PER_LINE = 90;   // aus Seitenbreite/Monospace-Breite abgeleitet, fest
export function paginateText(text: string): string[][];  // Seiten -> Zeilen; \n bricht um, lange Zeilen bei CHARS_PER_LINE
```

`paginateText`: normalisiert Zeilenenden, bricht jede Zeile hart bei
`CHARS_PER_LINE`, verteilt auf Seiten zu `LINES_PER_PAGE = floor((height -
2*margin)/lineHeight)` Zeilen. Ergebnis mindestens eine (ggf. leere) Seite.

Text-Adapter (`src/adapters/text/textAdapter.ts`, neu):
- `kind: 'text'`; `accepts`: `.txt`/`.md` bzw. `text/plain`/`text/markdown`.
- `probe(blob)`: `paginateText(await blob.text())` -> `blockCount =
  pages.length`, `blockKind:'page'`, `blockRotations` mit `0`, `status:'ready'`.
- `renderBlock(ref, opts)`: Text lesen, paginieren, die Zeilen der Seite
  `ref.blockIndex` auf `OffscreenCanvas` (helle Flaeche, dunkler Monospace-Text)
  in Zielbreite zeichnen -> WebP. Braucht `readBytes` + `createSurface`.
- Kein `extractText` (Suche bleibt v1 aussen vor).

`AssembleCtx` (erweitern): `textData(sourceId): Promise<string[][]>` (die
paginierten Zeilen). Der `PdfAssembler` bekommt eine dritte Verzweigung: fuer
`ctx.sourceKind === 'text'` einmal `ctx.textData(sourceId)` holen; im Item-Loop
pro Item eine A4-Seite (`TEXT_PAGE`) anlegen und die Zeilen der Seite
`item.blockIndex` mit `StandardFonts.Courier` zeichnen. Dazu traegt der interne
Plan des Assemblers zusaetzlich `blockIndex` je Item (heute nur `slot`).

## Aenderungen und neue Dateien

| Datei | Aenderung |
| --- | --- |
| `src/domain/types.ts` | `SourceKind` += `'text'` |
| `src/adapters/registry.ts` | `ACCEPT_BY_KIND.text = 'text/plain,text/markdown,.txt,.md'` |
| `src/adapters/text/textLayout.ts` | neu: `paginateText`, Konstanten |
| `src/adapters/text/textAdapter.ts` | neu: `createTextAdapter` |
| `src/adapters/types.ts` | `AssembleCtx.textData` |
| `src/adapters/pdf/pdfAssembler.ts` | Text-Verzweigung; Plan traegt `blockIndex` |
| `src/services/app/appServices.ts` | Text-Adapter bauen + registrieren + Dispatcher `byKind.text`; `textPages(sourceId)` exponieren |
| `src/services/export/exportRunner.ts` | `ExportRunDeps.textData` in den Ctx |
| `src/ui/export/useExport.tsx` | `textData: services.textPages` durchreichen |

`SourceList` zeigt fuer `blockKind:'page'` weiterhin "N Seiten"; ein eigenes
Text-Icon ist optional (nicht erforderlich).

## Robustheit / Tests

- Sehr grosse Textdateien: v1 paginiert vollstaendig im Speicher (bewusste
  Grenze).
- Deutsch, nie das scharfe s. Ohne Testlaeufe; Pruefung via
  `tsc`/`eslint`/`vite build`. `paginateText` ist rein und spaeter testbar.

## Bewusst nicht in v1

Markdown-Formatierung/Rendering; Syntax-Highlight; Durchsuchbarkeit von Text;
Zeilenumbruch an Wortgrenzen (v1 bricht hart bei fester Spaltenzahl); DOCX/
PPTX/XLSX (brauchen schwere Konvertierung -- eigenes Teilprojekt).
