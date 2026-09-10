# Design: Bild-Import (Phase 2, Teilprojekt 1)

Datum: 2026-09-10
Status: zur Umsetzung freigegeben
Baut auf: Phase 1 (vollstaendig implementiert, `main`)

## 1. Zweck und Abgrenzung

Bilder (PNG, JPEG, WebP, GIF) werden wie PDFs importiert und ihre Bloecke wie
Seiten komponiert. Jede Bilddatei ist eine Quelle mit genau einem Block
(`blockKind: 'image'`). Beim Export wird jeder Bild-Block zu einer PDF-Seite in
**natuerlicher Bildgroesse**. Das aktiviert die in Phase 1 angelegte
Erweiterbarkeits-Naht (Adapter-Registry, `BlockKind`) ohne Umbau der Domain-,
Store- oder Persistenzschicht.

Bewusst **nicht** in v1: mehrseitige Bild-Container (animiertes GIF wird als
Einzelbild behandelt), HEIC/TIFF, EXIF-Auto-Rotation, OCR auf Bildern (eigenes
Teilprojekt).

## 2. Die drei Kernentscheidungen

### 2.1 Render-Dispatch statt eines fest verdrahteten Adapters

Phase 1 gab `thumbnailService` und dem Viewer genau einen PDF-Adapter. Neu ist
ein `createDispatchingAdapter({ sourceKindOf, byKind })`, der das
`DocumentAdapter`-Interface erfuellt und `renderBlock`/`extractText` anhand der
Quellart an den richtigen Unter-Adapter leitet. `thumbnailService`,
`usePageImage` und `services.adapter` bleiben dadurch unveraendert -- sie
bekommen einfach den Dispatcher statt des PDF-Adapters. `sourceKindOf(sourceId)`
wird wie schon `contentHashOf` aus dem aktuellen Workspace injiziert (in
`bootstrap.ts`).

```ts
// adapters/dispatchAdapter.ts
export interface DispatchDeps {
  sourceKindOf(sourceId: SourceId): SourceKind | undefined;
  byKind: Partial<Record<SourceKind, DocumentAdapter>>;
}
export function createDispatchingAdapter(deps: DispatchDeps): DocumentAdapter;
```

`renderBlock(ref, opts)` und `extractText?(ref)` schlagen die Quellart ueber
`sourceKindOf(ref.sourceId)` nach und delegieren an `byKind[kind]`. Fehlt die
Art oder der Adapter, wird ein verstaendlicher Fehler geworfen (Programmier-
oder Datenfehler, nicht Nutzerfehler). `accepts`/`probe` werden ueber den
Dispatcher nicht benutzt (Import geht direkt ueber die Registry) und werfen
entsprechend.

### 2.2 `imageAdapter` kapselt alles Bild-Spezifische

```ts
// adapters/image/imageAdapter.ts
export interface ImageAdapterDeps {
  readBytes(sourceId: SourceId): Promise<Uint8Array>;
  createSurface: CreateSurface;      // dieselbe OffscreenCanvas-Fassade wie pdfjsEngine
  decode(blob: Blob): Promise<ImageBitmap>;  // = createImageBitmap, injiziert fuer Testbarkeit
}
export function createImageAdapter(deps: ImageAdapterDeps): ImageAdapter;

export interface ImageAdapter extends DocumentAdapter {
  /** Einbettbare PNG/JPEG-Bytes + Masse fuer den Assembler. */
  toEmbeddable(bytes: Uint8Array): Promise<ImageEmbeddable>;
}
```

- `kind: 'image'`.
- `accepts(file)`: MIME `image/png`, `image/jpeg`, `image/webp`, `image/gif`
  oder Endung `.png` / `.jpg` / `.jpeg` / `.webp` / `.gif`.
- `probe(blob)`: dekodiert einmal zur Pruefung; Erfolg -> `{ kind:'image',
  blockKind:'image', blockCount:1, blockRotations:[0], status:'ready' }`.
  Dekodierfehler -> `{ ...leer, status:'error', statusDetail: 'Dieses Bild
  konnte nicht gelesen werden. Es ist moeglicherweise beschaedigt.' }`. Ein
  Fehler blockiert den uebrigen Import nicht (die Import-Schleife faengt ihn
  bereits ab).
- `renderBlock(ref, opts)`: `readBytes` -> Blob -> `decode` -> auf
  `OffscreenCanvas` der berechneten Zielbreite zeichnen -> WebP-Blob. Deckelung
  der Geraeteaufloesung wie beim PDF-Adapter (`computeRenderScale`
  wiederverwenden). Kein Pool -- Bilder sind billig zu dekodieren.
- `extractText`: **nicht implementiert** (Bilder haben keinen Text).
- `toEmbeddable(bytes)`: dekodiert; ist der Inhalt bereits PNG oder JPEG
  (Magic-Bytes-Pruefung), werden die Original-Bytes verlustfrei
  durchgereicht (`{ format, bytes, width, height }`); WebP/GIF werden auf
  `OffscreenCanvas` gezeichnet und via `convertToBlob({ type:'image/png' })`
  zu PNG gerastert. Die Canvas-Kopplung liegt damit im Adapter, nicht im
  Assembler.

```ts
// adapters/types.ts (neu)
export interface ImageEmbeddable {
  format: 'png' | 'jpeg';
  bytes: Uint8Array;
  width: number;   // Pixel = Punkte bei 72 dpi
  height: number;
}
```

### 2.3 `PdfAssembler` verzweigt nach Quellart

`AssembleCtx` wird erweitert; der Assembler bleibt die einzige Stelle, die aus
der Komposition PDF-Bytes baut:

```ts
// adapters/types.ts (erweitert)
export interface AssembleCtx {
  readBytes(sourceId: SourceId): Promise<Uint8Array>;         // PDF-Pfad, unveraendert
  sourceKind(sourceId: SourceId): SourceKind;                 // NEU
  imageData(sourceId: SourceId): Promise<ImageEmbeddable>;    // NEU, nur fuer Bildquellen
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}
```

Ablauf in `assemble(items, ctx)`:

- Items je `sourceId` gruppieren (wie bisher). Pro Quelle `ctx.sourceKind`:
  - `'pdf'`: bestehender Pfad -- ein `PDFDocument.load`, ein gebuendelter
    `copyPages` mit allen Indizes der Quelle.
  - `'image'`: `ctx.imageData(sourceId)` einmal -> `embedPng`/`embedJpg`.
- Danach in Item-Reihenfolge Seiten anlegen:
  - PDF-Item: kopierte Seite wie bisher, Item-Rotation additiv zur
    Quellrotation.
  - Bild-Item: neue Seite in `[width, height]` der Bildmasse, das eingebettete
    Bild ganzflaechig zeichnen (`page.drawImage(embedded, { x:0, y:0, width,
    height })`), `page.setRotation(degrees(item.rotation))` (uniform zum
    PDF-Pfad; die Rotation ist Seiten-Metadatum, nicht Massaenderung).
  - Fortschritt je Seite wie bisher.
- Der Blockindex einer Bildquelle ist immer `0`; mehrere Items auf dieselbe
  Bildquelle ergeben mehrere Seiten aus **einem** eingebetteten Bild.

## 3. Aenderungen an bestehendem Code (chirurgisch)

| Datei | Aenderung |
| --- | --- |
| `src/domain/types.ts` | `SourceKind = 'pdf' \| 'image'` |
| `src/adapters/registry.ts` | `ACCEPT_BY_KIND.image = 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif'` |
| `src/adapters/types.ts` | `AssembleCtx` um `sourceKind`/`imageData` erweitern; `ImageEmbeddable` |
| `src/adapters/pdf/pdfAssembler.ts` | Verzweigung nach `ctx.sourceKind` |
| `src/adapters/pdf/pdfAdapter.ts` | `computeRenderScale` exportiert (falls noch nicht) fuer Wiederverwendung im Bild-Adapter |
| `src/services/app/appServices.ts` | Bild-Adapter bauen + `registry.register`, Dispatcher bauen und als `services.adapter` fuehren; `AppServicesDeps.sourceKindOf` erganzen; Helfer `imageEmbeddable(sourceId)` exponieren |
| `src/services/export/exportRunner.ts` | `ExportRunDeps` + der gebaute `AssembleCtx` um `sourceKind`/`imageData` erweitern |
| `src/ui/export/useExport.tsx` | `sourceKind` aus `workspace.sources[id].kind`, `imageData` aus `services.imageEmbeddable` in die Runner-Deps geben |
| `src/ui/app/bootstrap.ts` | `sourceKindOf` (liest aktuellen Workspace) an `createAppServices` geben |
| `src/ui/app/Header.tsx` | Datei-Dialog-`accept` aus `services.registry.acceptAttribute()` statt hart `application/pdf` |
| `src/ui/sources/SourceList.tsx` | Bild-Icon (lucide `Image`) und Beschriftung "1 Bild" bei `blockKind:'image'` |
| `src/services/search/searchScope.ts` | Bildquellen (kein Text) aus den Suchzielen ausschliessen |

Neue Dateien: `src/adapters/image/imageAdapter.ts`, `src/adapters/dispatchAdapter.ts`.

## 4. Datenfluss

Import (unveraendert im Kern): Datei -> `registry.adapterFor(file)` findet den
Bild-Adapter -> `probe` -> `SourceDocument{ kind:'image', blockKind:'image',
blockCount:1 }` -> Blob nach `contentHash` abgelegt. Der Command `importSources`
und der Store bleiben unberuehrt (die Naht war fuer genau das gebaut).

Anzeige: `thumbnailService`/`usePageImage` rufen `services.adapter.renderBlock`
-> Dispatcher -> `imageAdapter.renderBlock`.

Export: `useExport` baut den `ExportPlan` (unveraendert) und uebergibt dem
Runner `sourceKind`/`imageData`; der Runner reicht sie in den `AssembleCtx`;
der `PdfAssembler` bettet Bild-Bloecke ein und kopiert PDF-Bloecke.

## 5. Fehlerbehandlung und Sicherheit

- Bilder sind unvertraute Eingabe: Verarbeitung ausschliesslich ueber
  `createImageBitmap`/Canvas, nie als HTML.
- Defekte Bilder -> Status `error`, blockieren den uebrigen Import nicht.
- Nutzertexte deutsch, nie das scharfe s (immer `ss`).
- Bildquellen liefern keinen durchsuchbaren Text; die Suche schliesst sie aus
  (kein Wortergebnis, keine leere Extraktion ueber den PDF-Worker).

## 6. Tests

Die Arbeit wird gemaess Nutzervorgabe **ohne** Testlaeufe umgesetzt; als
Kompilierpruefung dienen `tsc --noEmit`, `eslint .` und `vite build`. Die
reinen Entscheidungen (Magic-Byte-Erkennung PNG/JPEG, `toEmbeddable`-Routing,
Dispatch nach Quellart, Assembler-Verzweigung) sind so geschnitten, dass sie
spaeter ohne Umbau unit-getestet werden koennen, falls Tests wieder aktiviert
werden.

## 7. Bekannte Einschraenkungen

- WebP/GIF werden beim Export zu PNG gerastert (verlustfrei fuer den sichtbaren
  Inhalt, aber groesser als das Original); PNG/JPEG werden verlustfrei
  eingebettet.
- Keine EXIF-Rotation: ein mit EXIF-Orientierung gedrehtes JPEG erscheint in
  seiner gespeicherten Pixelorientierung (der Nutzer kann per Item-Rotation
  korrigieren).
- Animiertes GIF wird als Einzelbild (erster Frame) behandelt.
