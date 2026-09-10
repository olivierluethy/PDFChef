# Design: OCR (Phase 2, Teilprojekt 9)

Datum: 2026-09-10
Status: zur Umsetzung freigegeben

## Zweck und Abgrenzung

Gescannte PDFs und Bildquellen ohne Textschicht werden auf Wunsch per OCR
(tesseract.js) in durchsuchbaren Text ueberfuehrt. Der erkannte Text landet im
bestehenden `pageText`-Cache; die vorhandene Suche findet ihn danach.

**Local-first bleibt gewahrt:** tesseract-Assets (Worker, Core-WASM,
Sprachdaten `deu`+`eng`) werden zur **Build-Zeit** nach `public/tesseract`
gebuendelt (kein Laufzeit-Request an ein CDN). Der Build-Zeit-Download der
Sprachdaten ist wie `npm install` zu behandeln.

Bewusst **nicht** in v1: Trefferrechtecke (Spans) aus OCR (die Suche hebt
OCR-Seiten ohne Rechtecke hervor); automatische OCR beim Import (nur auf
Aktion); Sprachauswahl-UI (fest `deu+eng`).

## Architektur

### Assets (Build-Zeit)

`scripts/sync-tesseract-assets.mjs` (neu) kopiert nach `public/tesseract/`:
- `worker.min.js` aus `node_modules/tesseract.js/dist/`.
- den Inhalt von `node_modules/tesseract.js-core/` nach `public/tesseract/core/`
  (die `tesseract-core*.wasm` + `.js`-Varianten; tesseract.js waehlt die
  passende zur Laufzeit).
- `lang/eng.traineddata.gz` und `lang/deu.traineddata.gz`, per `fetch` von
  `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/<lang>.traineddata.gz`
  heruntergeladen (nur wenn noch nicht vorhanden).

`package.json`: Skript `sync:tesseract-assets` und Aufnahme in die bestehenden
`predev`/`prebuild`-Hooks (neben `sync:pdf-assets`). `.gitignore` um
`public/tesseract/` ergaenzen.

### OCR-Dienst

`src/services/search/ocrService.ts` (neu), framework-frei:

```ts
export interface OcrDeps {
  adapter: DocumentAdapter;              // der Dispatcher: rendert jede Seite
  store: PageTextStore;                  // schreibt den erkannten Text
  createOcrWorker(): Promise<OcrWorker>; // injizierte tesseract-Fassade
}
export interface OcrWorker { recognize(image: Blob): Promise<string>; terminate(): Promise<void> }
export function createOcrService(deps: OcrDeps): {
  run(sourceId: SourceId, blockCount: number, onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<void>;
};
```

`run`: einen Worker erzeugen; je Seite `adapter.renderBlock(ref, { targetWidth:
1500 })` -> Blob -> `worker.recognize` -> `store.put(sourceId, { blockIndex,
text, spans: [] })`; Fortschritt melden; am Ende `worker.terminate()`.
Abbruch ueber `signal`.

Die tesseract-Fassade (`src/adapters/ocr/tesseractWorker.ts`, neu; **einzige**
Datei, die tesseract.js kennt und mit den lokalen Asset-Pfaden konfiguriert --
`workerPath`, `corePath`, `langPath` unter `${BASE_URL}tesseract/…`,
`workerBlobURL: false`, Sprache `deu+eng`).

### Such-Integration

- `SearchTarget` bekommt `kind: SourceKind`.
- `targetsForScope`: nimmt **alle** `ready`-Quellen auf (nicht nur PDF) und
  traegt deren `kind` ein.
- `searchService`: ruft `extractUncached` (den PDF-Worker) nur fuer
  `kind === 'pdf'`-Ziele mit fehlenden Seiten; Nicht-PDF-Ziele beziehen ihren
  Text ausschliesslich aus dem `pageText`-Cache (den OCR gefuellt hat).
  `searchable` bleibt `false`, wenn eine Quelle keinen Text (weder PDF-Layer
  noch OCR) hat.

### UI

- `src/ui/preview/useOcr.tsx` (neu): Hook `useOcr()` -> `{ runForSource(sourceId,
  blockCount), progress }`; baut den Dienst aus `services` und der Fassade.
- Command-Palette-Aktion "Text erkennen (aktuelle Quelle)" (nutzt
  `activeSourceId`); ausserdem ein kleiner Fortschrittsbalken/Statusstreifen in
  `App`, solange OCR laeuft ("Seite X von N erkannt").
- `appServices` exponiert die Fassade nicht direkt; `useOcr` importiert
  `createTesseractWorker` (ui darf adapters importieren) und `services.adapter`
  + `createPageTextStore(services.db)`.

## Dateien

| Datei | Aenderung |
| --- | --- |
| `scripts/sync-tesseract-assets.mjs` | neu: Assets buendeln |
| `package.json`, `.gitignore` | Sync-Skript, Hooks, Ignore |
| `src/adapters/ocr/tesseractWorker.ts` | neu: tesseract-Fassade mit lokalen Pfaden |
| `src/services/search/ocrService.ts` | neu: Seiten rendern -> erkennen -> Cache |
| `src/services/search/searchScope.ts` | alle Quellen + `kind` als Ziele |
| `src/services/search/searchService.ts` | `SearchTarget.kind`; Worker nur fuer PDF |
| `src/ui/preview/useOcr.tsx` | neu: OCR-Hook |
| `src/ui/app/App.tsx` | Palette-Aktion + Fortschrittsstreifen |

## Robustheit / Tests

- Fehlt die Sprachdatei (Download fehlgeschlagen), meldet der Sync-Skript einen
  klaren Fehler; OCR ist dann nicht verfuegbar.
- OCR ist rechenintensiv und laeuft in tesseracts eigenem Worker (Oberflaeche
  bleibt bedienbar); Fortschritt sichtbar.
- Deutsch, nie das scharfe s. Ohne Testlaeufe; Pruefung via
  `tsc`/`eslint`/`vite build` (der prebuild-Hook laedt die Assets).

## Bewusst nicht in v1

OCR-Spans/Trefferrechtecke; automatische OCR; Sprachwahl-UI; OCR im
Hintergrund fuer alle Quellen.
