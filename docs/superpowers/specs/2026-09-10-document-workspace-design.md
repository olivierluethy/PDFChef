# Design: Local-First Visual Document Workspace (Phase 1)

Datum: 2026-09-10
Status: zur Umsetzung freigegeben (Design), Implementierungsplan folgt
Repository-Zustand bei Designbeginn: leer (kein package.json, kein Git-Repo, keine Quellen)

## 1. Zweck und Abgrenzung

Die Anwendung erlaubt es, mehrere Dokumente zu importieren und deren Seiten wie
verschiebbare Bausteine in voellig neue Dokumente und Ordnerstrukturen zu
reorganisieren -- ohne Zwischenexporte. Sie ist ausdruecklich kein
PDF-Merger/Splitter, sondern ein Dateimanager fuer Dokumentseiten.

Phase 1 setzt genau das Akzeptanzszenario um (Abschnitt 12 dieses Dokuments).
Die Architektur ist so geschnitten, dass die Sekundaerfunktionen aus Phase 2
(Abschnitt 13) ohne Umbau ergaenzt werden koennen.

### Produktprinzipien

- Local-first: kein Account, kein Backend, keine Datenbank auf einem Server,
  kein Upload von Dokumentinhalten, keine serverseitige Verarbeitung.
- Quelldokumente sind konzeptionell unveraenderlich. Die Arbeit des Nutzers ist
  eine Kompositionsschicht aus Referenzen auf Quellinhalte.
- Exporte werden aus der Komposition erzeugt, nie aus Zwischendateien.
- Direkte Manipulation vor Dialogen: Select -> Drag -> Drop -> Preview -> Export.

## 2. Technischer Rahmen

| Bereich           | Entscheidung                           | Begruendung                                                           |
| ----------------- | -------------------------------------- | --------------------------------------------------------------------- |
| Build             | Vite                                   | Native Unterstuetzung fuer Web Worker und WASM, statisches Deployment |
| UI                | React 19 + TypeScript (strict)         | Groesstes Oekosystem fuer die benoetigten Bausteine                   |
| Styling           | Tailwind CSS v4, Lucide Icons          | Kein eigenes Designsystem, dunkles Thema als Standard                 |
| Store             | Zustand + Immer (`produceWithPatches`) | Benannte Commands mit abgeleiteter Undo-Inverse                       |
| PDF lesen/rendern | `pdfjs-dist`                           | Etabliert, Worker- und OffscreenCanvas-faehig                         |
| PDF schreiben     | `pdf-lib`                              | Seitenkopie ohne Rasterung, laeuft im Browser                         |
| Virtualisierung   | `@tanstack/react-virtual`              | Grid-Virtualisierung fuer grosse Seitenraster                         |
| ZIP               | `fflate`                               | Klein, streaming-faehig                                               |
| IndexedDB         | `idb`                                  | Duenne, typisierte Huelle                                             |
| Tests             | Vitest, Playwright                     | Domain-Logik per TDD, ein Ende-zu-Ende-Flow                           |
| Paketmanager      | npm                                    | Einzig installiert (npm 11, Node 26)                                  |

Kein Server-Framework: die App hat bewusst keinen Server, ein solches Framework
wuerde nur Build-Komplexitaet einkaufen.

## 3. Schichtung und Modulschnitt

Abhaengigkeitsregel: `domain` kennt niemanden, `adapters` kennen nur `domain`,
`services` kennen `domain` und `adapters`, `ui` kennt alles -- und nichts zeigt
zurueck. Die Regel wird per ESLint-`import/no-restricted-paths` erzwungen.

```
src/
  domain/                framework-frei, rein, vollstaendig unit-getestet
    types.ts               SourceDocument, BlockRef, CompositionItem, FolderNode, OutputDocument
    ids.ts                 ULID-Erzeugung
    ranges.ts              "1-3,50-100" parsen/formatieren/normalisieren
    split.ts               Split-Strategien -> konkrete Range-Listen
    composition.ts         reine Operationen: insert, move, copy, remove, reorder, rename
    naming.ts              Dateinamen-Sanitisierung, Kollisionsaufloesung
    exportPlan.ts          Workspace -> ExportPlan
    commands.ts            Command-Definitionen (Name, Payload, reine Anwendung)
  adapters/
    types.ts               DocumentAdapter, BlockAssembler, Registry
    pdf/
      pdfAdapter.ts        probe, renderBlock, extractText
      pdfPool.ts           LRU-Pool offener PDFDocumentProxy
      pdfAssembler.ts      Komposition -> PDF-Bytes (pdf-lib)
  services/
    store/                 Workspace-Store, History, Selektions-Store
    persistence/           idb-Schema, sourceBlobStore, workspaceRepo, autosave
    thumbnails/            Render-Queue, LRU-Cache, Blob-URL-Lifecycle
    import/                Datei-/Ordner-Import, Dateityp-Erkennung
    export/                fsAccessWriter, zipWriter, exportRunner
  ui/
    app/                   Shell, Layout, Header, Tastaturkuerzel
    sources/               Quellenliste, Quellraster, Range-Feld, Split-Panel
    workspace/             Ordner-/Output-Baum, Output-Raster
    preview/               Viewer (Quelle und Ergebnis), Suchpanel
    common/                Buttons, Menues, Zustandsanzeigen
  workers/
    pdfText.worker.ts      Textextraktion
```

Der Grund fuer das eigene `domain`: jede in der Anforderung genannte Operation
(Ranges, Split-Verteilung, Move/Copy-Semantik, Namenskollisionen) ist reine
Datenlogik und ohne Browser testbar. Das macht auch Undo/Redo verlaesslich --
die History kennt nur Daten, kein React.

## 4. Erweiterbarkeits-Naht

Die Einheit im Modell heisst nicht `Page`, sondern `ContentBlock` mit einem
`blockKind`. Formate haben ausdruecklich keine identische Seitensemantik:
PDF -> Seiten, PPTX -> Slides, XLSX -> Arbeitsblaetter, Bilder -> Bildobjekte,
DOCX -> Dokumentstruktur plus gerenderte Seiten.

```ts
type BlockKind = 'page' | 'slide' | 'sheet' | 'image' | 'section';
type SourceKind = 'pdf'; // Phase 1

interface BlockRef {
  sourceId: SourceId;
  blockIndex: number;
}

interface DocumentAdapter {
  readonly kind: SourceKind;
  accepts(file: { name: string; type: string }): boolean;
  probe(blob: Blob): Promise<SourceProbeResult>; // blockCount, blockKind, Rotationen, Outline, Status
  renderBlock(ref: BlockRef, opts: RenderOpts): Promise<RenderedBitmap>;
  extractText?(ref: BlockRef): Promise<PageText>;
}

interface BlockAssembler {
  // pro Zielformat, nicht pro Quellformat
  readonly targetFormat: 'pdf';
  assemble(items: CompositionItem[], ctx: AssembleCtx): Promise<Uint8Array>;
}
```

Phase 1 registriert genau einen Adapter und einen Assembler, aber ueber die
Registry -- kein `if (isPdf)` im UI. Ein spaeterer Bild-Adapter liefert
`blockKind: 'image'`; der `PdfAssembler` rastert solche Bloecke dann zu Seiten,
waehrend PDF-Bloecke weiterhin objektweise kopiert werden.

## 5. Datenmodell

```ts
interface SourceDocument {
  id: SourceId; // ULID, stabil ueber Sessions
  kind: SourceKind;
  name: string; // Anzeigename, aus Dateiname abgeleitet
  importPath?: string; // relativer Pfad bei Ordner-Import ("2026/Bank/UBS.pdf")
  blobKey: string; // = contentHash, Schluessel im sourceBlobStore
  byteSize: number;
  contentHash: string; // SHA-256 der Bytes
  blockKind: BlockKind;
  blockCount: number;
  blockRotations: number[]; // Rotation der Quellseite laut PDF /Rotate
  outline?: OutlineNode[]; // Bookmarks: Daten in Phase 1, UI in Phase 2
  status: 'ready' | 'error' | 'encrypted';
  statusDetail?: string;
}

interface CompositionItem {
  // eine Instanz einer Quellseite in einem Output
  id: ItemId; // eigene Identitaet: eine Kopie ist ein zweites Item
  sourceId: SourceId;
  blockIndex: number; // 0-basiert
  rotation: 0 | 90 | 180 | 270; // additiv zur Quellrotation
}

interface FolderNode {
  id: NodeId;
  type: 'folder';
  name: string;
  parentId: NodeId | null;
}
interface OutputDocument {
  id: NodeId;
  type: 'output';
  name: string;
  parentId: NodeId | null;
  targetFormat: 'pdf';
  items: ItemId[]; // die Reihenfolge IST diese Liste
}

interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: 1;
  sources: Record<SourceId, SourceDocument>;
  sourceOrder: SourceId[];
  nodes: Record<NodeId, FolderNode | OutputDocument>;
  childOrder: Record<string, NodeId[]>; // Key = parentId oder 'root'
  items: Record<ItemId, CompositionItem>;
}
```

Begruendungen:

- **Seitenidentitaet vs. Item-Identitaet.** Die Herkunft ist `(sourceId,
blockIndex)`, wodurch die App immer "Bank.pdf Seite 17" kennt (Herkunft
  anzeigen, Original oeffnen, Mehrfachverwendung finden). Die Item-`id` macht
  zwei Kopien derselben Quellseite unterscheidbar, sodass eine davon einzeln
  gedreht oder entfernt werden kann.
- **Reihenfolge in Arrays statt `order`-Feldern.** Multi-Selektion umsortieren
  ist ein Array-Splice; Sortierindizes muessten neu vergeben und normalisiert
  werden. Die Immer-Patches bleiben ausserdem klein.
- **Kein `Page`-Objekt im Store.** 500 Seiten waeren 500 Eintraege ohne
  Information, die nicht aus `blockCount` folgt. Quellseiten werden als
  virtuelle Indizes gerendert.
- **`contentHash`** dient in Phase 1 nur der Blob-Deduplizierung beim
  Doppelimport derselben Datei und ist der Anknuepfungspunkt fuer eine spaetere
  Duplikaterkennung.

### Invarianten

1. Ordner enthalten ausschliesslich Ordner und Output-Dokumente, niemals Items.
2. Jede Item-Id erscheint in genau einer `items`-Liste eines Outputs.
3. `items` enthaelt keine Eintraege, deren `sourceId` fehlt.
4. `blockIndex` liegt in `[0, blockCount)`.
5. `childOrder` enthaelt jede Node genau einmal, passend zu ihrem `parentId`.
6. Kein Ordner ist sein eigener Vorfahre (Zykluspruefung beim Verschieben).

Die Invarianten werden nach jedem Command in Entwicklungsbuilds geprueft
(`assertWorkspaceInvariants`).

## 6. State, Commands, Undo/Redo

Jede Nutzeraktion ist ein benannter Command mit Payload. Der Store wendet ihn
ueber `produceWithPatches` an und legt einen History-Eintrag ab:

```ts
interface HistoryEntry {
  label: string; // "46 Seiten verschoben"
  patches: Patch[];
  inversePatches: Patch[];
  selectionBefore: SelectionState;
  selectionAfter: SelectionState;
}
```

Undo spielt `inversePatches` zurueck und stellt `selectionBefore` wieder her;
Redo umgekehrt. Der Stack ist auf 200 Eintraege begrenzt. Zusammengehoerige
Aenderungen laufen in einer Transaktion und ergeben genau einen Eintrag (ein
Split mit 50 Seiten ist ein Undo-Schritt, nicht 50).

Die Inverse wird **abgeleitet, nicht handgeschrieben**. Damit existiert die
Fehlerklasse "Undo fuer Operation X vergessen" nicht.

Commands in Phase 1: `importSources`, `removeSource`, `createFolder`,
`renameNode`, `moveNode`, `deleteNode`, `createOutput`, `addItems`,
`moveItems`, `copyItems`, `removeItems`, `reorderItems`, `rotateItems`,
`splitSource`, `renameWorkspace`.

Der Selektionszustand liegt in einem separaten Store und wird nicht persistiert
-- ausser als Snapshot in der History, damit Undo den Fokus zurueckstellt.

Die History selbst ist sitzungsgebunden und wird **nicht** persistiert: nach
einem Neustart ist die Komposition vollstaendig da, der Undo-Stack aber leer.
Ein persistenter Stack wuerde bedeuten, Patches gegen einen Zustand
zurueckzuspielen, der aus einer aelteren Schemaversion stammen kann.

`removeSource` entfernt zusammen mit der Quelle auch alle Items, die sie
referenzieren (Invariante 3), und zwar als ein einziger History-Eintrag mit
Label `Quelle entfernt (n Seiten aus m Dokumenten)`. Der Quell-Blob wird erst
geloescht, wenn keine Quelle mehr auf seinen `contentHash` verweist.

Verworfene Alternativen: handgeschriebenes `undo()` pro Command (zwei korrekte
Implementierungen pro Operation noetig, fehleranfaellig bei
Mehrfach-Output-Operationen) und Event-Sourcing (unbegrenztes Log,
Migrationspflicht bei jeder Modelaenderung, kein Gegenwert ohne Sync).

## 7. Persistenz und Autosave

IndexedDB `pdf-master`, vier Object Stores:

| Store         | Key                     | Wert                        | Lebensdauer       |
| ------------- | ----------------------- | --------------------------- | ----------------- |
| `workspaces`  | Workspace-Id            | kompletter Workspace-Record | permanent         |
| `sourceBlobs` | `contentHash`           | `Blob` der Originaldatei    | referenzgezaehlt  |
| `thumbs`      | `sourceId:index:breite` | WebP-Blob                   | Cache, verwerfbar |
| `pageText`    | `sourceId:index`        | extrahierter Text           | Cache, verwerfbar |

Die Quell-Bytes werden beim Import als Blob nach IndexedDB kopiert. Das
funktioniert in allen Browsern und bei jedem Importweg, und der Workspace
oeffnet nach einem Neustart ohne Nachfrage vollstaendig. Der Preis ist eine
zweite Kopie der Dokumente im Browser-Storage; Zugriff laeuft ueber ein
`SourceBlobStore`-Interface, damit spaeter `FileSystemFileHandle`-basierte
Persistenz ergaenzt werden kann.

Autosave schreibt den Workspace-Record komplett, debounced 400 ms nach der
letzten Aenderung, plus sofortiger Flush bei `visibilitychange`. Kein
Save-Button. Header-Status: `Speichern...` / `Lokal gespeichert` /
`Nicht gespeichert -- Speicher voll`.

Composition-State und Blobs liegen getrennt, weil der State bei jeder Bewegung
geschrieben wird, die grossen Blobs aber genau einmal.

Beim Import wird `navigator.storage.persist()` angefragt (schuetzt den
Workspace vor Verdraengung unter Speicherdruck) und `estimate()` geprueft.
Reicht das Kontingent nicht, wird der Import mit klarer Meldung abgelehnt statt
in einem `QuotaExceededError` zu enden; die Caches (`thumbs`, `pageText`) sind
das erste, was zur Freigabe angeboten wird.

`schemaVersion` ist von Anfang an im Record, damit Phase 2 migrieren kann statt
Workspaces zu verlieren.

## 8. PDF-Engine, Performance, Speicher

Zielgroesse sind Dokumente mit 100, 200 und 500+ Seiten. Vier Mechanismen:

1. **Dokument-Pool.** LRU-Pool mit maximal vier offenen `PDFDocumentProxy`;
   Verdraengung ruft `destroy()`. Ohne ihn bleiben bei acht importierten Scans
   acht geparste PDFs samt internen Caches im Speicher.
2. **Render-Queue mit Prioritaet und Abbruch.** Eine Queue, maximal drei
   parallele Renders. Sichtbare Thumbnails haben Prioritaet; beim Wegscrollen
   wird der Task verworfen bzw. `RenderTask.cancel()` gerufen. Rendering auf
   `OffscreenCanvas`, Ergebnis ein WebP-Blob.
3. **Zweistufiger Thumbnail-Cache.** In-Memory-LRU (~300 Blob-URLs, Freigabe
   per `URL.revokeObjectURL` bei Verdraengung und Unmount ueber eine
   `useBlobUrl`-Hook) ueber dem `thumbs`-Store. Feste Zielbreite 180 px,
   DPR gedeckelt auf 2 -- keine Originalaufloesung fuer Thumbnails.
4. **Virtualisierung.** Beide Raster als virtualisiertes Grid; nur sichtbare
   Zellen plus Overscan im DOM. Ein 500-Seiten-Raster hat damit rund 60
   DOM-Knoten.

Textextraktion laeuft in einem separaten Worker, seitenweise, lazy beim ersten
Suchlauf ueber ein Dokument, mit Fortschrittsanzeige und Cache in `pageText`.

Der `PdfAssembler` laedt jedes benoetigte Quell-PDF beim Export **einmal** in
pdf-lib und ruft `copyPages` gebuendelt pro Quelle, nicht pro Seite -- jeder
`copyPages`-Aufruf bettet die referenzierten Objektgraphen erneut ein.

## 9. Layout und Interaktion

### Layout

```
+-- Header: Workspace-Name . Speicherstatus . Suche . Export ------------+
+---------------+------------------------------------+-------------------+
| QUELLEN       | Contract.pdf   Seiten: [4-49]      |                   |
|  Contract.pdf | [1][2][3][4][5][6][7][8][9][10]... |  PREVIEW          |
|  Bank.pdf     | [11][12][13]...                    |  (Quelle oder     |
|  Insurance.pdf|                                    |   Ergebnis,       |
|               +----------- ziehen ---------------- +   einklappbar)    |
| AUSGABE       | OUTPUT: Vertraege.pdf              |                   |
|  Tax 2026     | [C4][C5][C6][B17][I7]...           |  Bank.pdf         |
|   Bank        |                                    |  Seite 17         |
|   Insurance   |                                    |                   |
|   Receipts    |                                    |                   |
+---------------+------------------------------------+-------------------+
| Kontextaktionen: 46 ausgewaehlt . Drehen . Entfernen . Split . Export  |
+------------------------------------------------------------------------+
```

Beide Raster sind gleichzeitig sichtbar: Drag nach unten heisst einsortieren,
Drag auf den Baum heisst in einen Ordner oder ein anderes Output, und
Umsortieren innerhalb eines Outputs braucht keinen Ansichtswechsel. Die Panels
sind per Splitter groessenveraenderlich; unter 1024 px Breite werden Baum und
Preview zu einklappbaren Overlays, wobei Desktop das primaere
Interaktionsmodell bleibt.

Visuelle Richtung: dunkles Thema als Standard, zurueckhaltende Typografie,
klare Selektionszustaende, Bewegung nur wo sie Zustandsaenderungen erklaert.

### Zwei getrennte Drag-Systeme

**Intern (Seiten, Outputs, Ordner): Pointer-Events, selbst gebaut.** Nicht
HTML5-DnD und nicht dnd-kit. Gruende: die Marquee-Selektion braucht ohnehin
eine eigene Pointer-Schicht mit Treffertest gegen virtualisierte Zellen; der
Ctrl/Cmd-Modifier fuer Copy kann sich waehrend eines Drags aendern und ist bei
OS-Drag unzuverlaessig auslesbar; die Drag-Vorschau fuer 46 gleichzeitig
gezogene Seiten muss ein gestapeltes Kartenbild mit Zaehler sein. Dazu
Auto-Scroll an den Randzonen beider Raster und des Baums.

**Extern (Dateien aus dem Betriebssystem): native Drop-Events.**
`DataTransferItem.getAsFileSystemHandle()` bzw. `webkitGetAsEntry()` mit
Rekursion fuer Ordner-Drops. Strikt getrennt vom internen System.

### Selektion

`{ scope: 'source:<id>' | 'output:<id>', anchor, ids }`. Klick setzt, Shift
erweitert vom Anker, Ctrl/Cmd schaltet einzeln um, Marquee ersetzt (mit Shift
additiv), `Ctrl/Cmd+A` waehlt im fokussierten Raster alles. Nicht-zusammen-
haengende Selektionen sind ausdruecklich unterstuetzt.

Das Range-Feld ist permanent ueber dem Quellraster sichtbar, nicht in einem
Dialog:

```
Seiten:  4-49         ->  46 Seiten ausgewaehlt
Seiten:  1-3,50-100   ->  54 Seiten ausgewaehlt
```

`domain/ranges.ts` akzeptiert 1-basierte Eingabe, normalisiert ueberlappende
und absteigende Bereiche, deckelt auf `blockCount` und meldet ungueltige
Eingabe inline, ohne die bestehende Selektion zu zerstoeren.

### Move vs. Copy

Aus einer Quelle ist jeder Drag ein Referenz-Hinzufuegen: die Seite bleibt im
Quellraster sichtbar, erhaelt aber ein Badge mit der Zahl der Outputs, die sie
verwenden, und ein Umschalter blendet auf "nur noch nicht verwendete Seiten".
Damit ist der Scan-Workflow ("147 Seiten einsortieren") ueberschaubar, ohne
dass das Quellraster zu einer Bearbeitungsansicht wird.

Zwischen Outputs gilt: Drag = verschieben (im Quell-Output entfernt),
Ctrl/Cmd+Drag = kopieren. Die Drag-Vorschau zeigt an, welche der beiden
Aktionen laeuft. Nichts wird stillschweigend dupliziert oder geloescht.

### Drop-Regel

Drop auf einen **Ordner** erzeugt immer ein neues Output-Dokument (Name =
Ordnername, bei Kollision `Insurance 2`). Drop direkt auf ein
**Output-Dokument** fuegt die Seiten an der Drop-Position ein. Vollstaendig
vorhersehbar, keine Dialoge, beide Absichten ueber das Ziel unterscheidbar.

### Split

Ein Panel, das die konkreten Bereiche vor dem Anwenden zeigt:

```
Contract.pdf aufteilen           Strategie: [Gleiche Haelften v]

   Teil 1    Seiten 1-51    (51)
   Teil 2    Seiten 52-101  (50)

   [Abbrechen]  [2 Dokumente erstellen]
```

Strategien: gleiche Haelften, gleiche Drittel, alle N Seiten, eigene Bereiche,
aktuelle Selektion. Bei ungerader Seitenzahl gehen die Restseiten an die
vorderen Teile (101 -> 51/50); weil das Panel die Zahlen zeigt, muss der Nutzer
die Regel nicht kennen. Ergebnis ist ein History-Eintrag.

### Tastaturkuerzel (Phase 1)

`Ctrl/Cmd+A` alles auswaehlen, `Ctrl/Cmd+Z` Undo, `Ctrl/Cmd+Shift+Z` Redo,
`Ctrl/Cmd+F` Suche, `Delete` aus Output entfernen, `Space` Preview der
fokussierten Seite, `F2` umbenennen, `Escape` Selektion/Overlay aufheben.

## 10. Preview und Suche

Der Ergebnis-Preview rendert **kein** assembliertes PDF, sondern die
referenzierten Quellseiten in der Reihenfolge der `items`-Liste, mit
angewandter Rotation. Deshalb aktualisiert er sofort, wenn eine Seite
verschoben wird: es gibt nichts neu zu bauen, nur eine andere Liste zu rendern.
Dieselbe Viewer-Komponente zeigt Quelldokumente -- der Unterschied ist nur die
uebergebene Liste von `BlockRef`.

Viewer-Funktionen in Phase 1: Zoom in/out, Seite einpassen, Breite einpassen,
Originalgroesse, Seitennavigation mit Nummernfeld, Vollbild, Rotation, und pro
Seite eine Herkunftszeile `Bank.pdf . Seite 17` mit Sprung zur Originalseite im
Quellraster.

Suche (`Ctrl/Cmd+F`) mit Bereichsumschalter: aktuelle Quelle / aktuelles Output
/ alle Quellen. Ergebnis ist eine nach Dokument gruppierte Trefferliste mit
Textausschnitt und Seitenzahl; Klick springt im Viewer dorthin und hebt die
Trefferrechtecke hervor. Kein OCR: gescannte PDFs ohne Textschicht liefern
keine Treffer, und die App sagt das (`Dieses Dokument enthaelt keinen
durchsuchbaren Text`) statt still nichts zu finden.

## 11. Import und Export

### Import

- Drag & Drop einzelner Dateien und ganzer Ordner (wo unterstuetzt).
- Betriebssystem-Dateidialog fuer eine oder mehrere Dateien
  (`showOpenFilePicker` mit `<input type="file" multiple>` als Fallback).
- Ordnerauswahl (`showDirectoryPicker` mit `webkitdirectory` als Fallback).
- Nachtraeglicher Import in einen bestehenden Workspace ist der Normalfall und
  erfordert nie einen neuen Workspace.

Beim Ordnerimport wird der relative Pfad als `importPath` gespeichert, aber
nicht automatisch in die Ausgabestruktur uebernommen -- Quell- und
Ausgabestruktur sind getrennt.

### Export

`domain/exportPlan.ts` erzeugt aus dem Workspace einen `ExportPlan`: eine
flache Liste von `{ pfad: string[], dateiname: string, items: CompositionItem[] }`
mit sanitisierten Namen und aufgeloesten Kollisionen. Beide Writer konsumieren
ausschliesslich diesen Plan:

- **Direkt in einen Ordner** wo `showDirectoryPicker()` verfuegbar ist:
  Verzeichnisse rekursiv per `getDirectoryHandle(name, { create: true })`,
  Dateien per `createWritable()`.
- **ZIP** per `fflate`, vollstaendige Hierarchie erhalten -- als Fallback und
  als jederzeit waehlbare Alternative, nicht als Zwangsweg.

Fehlt die Directory-Picker-API (Safari, Firefox), ist der ZIP-Button primaer
und ein einzeiliger Hinweis erklaert den Grund. Kein Feature verschwindet
stillschweigend.

Exportierbar sind einzelne Outputs, einzelne Ordner (Kontextmenue) und der
ganze Workspace. Der Export laeuft Output fuer Output mit Fortschritt und
Abbruch. Vor dem Start zeigt er den Plan als Baum mit Seitenzahlen; die
Warnungsanalyse aus Abschnitt 29 der Anforderung folgt in Phase 2.

`domain/naming.ts`: verbotene Zeichen, fuehrende/abschliessende Punkte und
Leerzeichen, unter Windows reservierte Namen (`CON`, `PRN`, `AUX`, `NUL`,
`COM1`...), Laengenbegrenzung, Kollisionen als `Name 2` (dieselbe Regel wie
bei der Benennung neuer Outputs, Abschnitt 9). Aus
`Insurance Contract` wird `Insurance Contract.pdf`, niemals
`merged_final_2.pdf`.

## 12. Akzeptanzszenario

Import: `Contract.pdf` (100 Seiten), `Bank.pdf` (50), `Insurance.pdf` (30).
Anlegen von `Tax 2026/` mit `Bank/`, `Insurance/`, `Contracts/`. Dann:

| Schritt                                                 | Umsetzung                                                                                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Contract.pdf` 4-49 -> `Tax 2026/Contracts`             | Range-Feld `4-49`, Drag auf Ordner -> neues Output                                                                                                               |
| `Contract.pdf` 1-3 und 50-100 -> weiteres Output        | Range-Feld `1-3,50-100`, Drag auf Ordner                                                                                                                         |
| `Bank.pdf` 10-20 -> `Tax 2026/Bank`                     | Range-Feld, Drag auf Ordner                                                                                                                                      |
| `Insurance.pdf` Seite 7 -> `Tax 2026/Insurance`         | Klick, Drag auf Ordner -> Output `Insurance`                                                                                                                     |
| `Bank.pdf` Seite 17 zusaetzlich -> `Tax 2026/Insurance` | Drag auf das bestehende Output `Insurance` (aus einer Quelle ist jeder Drag ein Hinzufuegen; die Seite bleibt in `Bank.pdf` und zeigt danach ein Nutzungs-Badge) |
| Seiten umsortieren                                      | Drag im Output-Raster, quellenuebergreifend                                                                                                                      |
| Outputs umbenennen                                      | `F2` oder Doppelklick im Baum                                                                                                                                    |
| Jedes Ergebnis pruefen                                  | Output im Baum waehlen -> Ergebnis-Preview                                                                                                                       |
| Text suchen                                             | `Ctrl/Cmd+F`, Bereich waehlen, Treffer anspringen                                                                                                                |
| Korrektur, Undo, erneute Korrektur                      | Command-History mit Selektionswiederherstellung                                                                                                                  |
| Ordnerstruktur exportieren                              | `showDirectoryPicker` -> rekursives Schreiben                                                                                                                    |
| Dieselbe Struktur als ZIP                               | derselbe `ExportPlan`, `fflate`-Writer                                                                                                                           |

Zu keinem Zeitpunkt entsteht eine Zwischendatei. Das Entfernen einer Seite aus
einem Output aendert ausschliesslich die `items`-Liste; der Quell-Blob bleibt
unberuehrt.

## 13. Bewusst nicht in Phase 1

Jeder Punkt hat in der Architektur eine Naht, wird aber in Phase 1 nicht
gebaut:

- ZIP-**Import** (Anforderung 23)
- Bookmark-/Kapitel-Navigation im UI (20) -- die Outline wird beim Import
  bereits gelesen und gespeichert
- Command Palette (39)
- Papierkorb / `Kuerzlich entfernt` (32) -- Undo/Redo deckt Wiederherstellung ab
- Export-Review mit Warnungsanalyse (29) -- der Plan wird gezeigt, nicht analysiert
- PWA-Installierbarkeit und Offline-Betrieb (4)
- Automatische Dokumenterkennung in Scans (22)
- Duplikaterkennung (33) -- `contentHash` ist der Anknuepfungspunkt
- DOCX, PPTX, XLSX, Bilder, Markdown, TXT (34-37)
- LaTeX-Rekonstruktion (38)
- OCR (19)

## 14. Fehlerbehandlung und Sicherheit

Importierte Dateien sind unvertraute Eingabe:

- PDFs werden ausschliesslich mit pdf.js geparst (`isEvalSupported: false`),
  niemals in `<iframe>` oder `<embed>` gegeben.
- Dateinamen und PDF-Metadaten werden nie als HTML gerendert und fuer Pfade
  immer sanitisiert.
- Verschluesselte oder defekte Dateien erhalten Status `encrypted`/`error` und
  blockieren den Import der uebrigen Dateien nicht.
- Nutzertexte sind verstaendlich (`Diese PDF konnte nicht gelesen werden. Sie
ist moeglicherweise beschaedigt oder verschluesselt.`); Stacktraces gehen in
  die Konsole.
- Kein Netzwerkverkehr mit Dokumentinhalten, kein Analytics, keine externen
  Laufzeit-Requests. pdf.js-Worker und Schriften werden mit dem Bundle
  ausgeliefert.

Fehlende Browser-APIs fuehren nie zu einem Bruch, sondern zu einem Fallback
(siehe Import und Export).

## 15. Tests

- `domain` wird per TDD entwickelt und vollstaendig mit Vitest getestet:
  Ranges, Split-Verteilung, Kompositions-Operationen, Namenskollisionen,
  ExportPlan, Invarianten.
- Eigene Testgruppe **History-Invarianten**: fuer jeden Command gilt
  `undo(do(s)) == s` und `redo(undo(do(s))) == do(s)`, geprueft ueber eine
  Tabelle aller Commands.
- Adapter- und Assembler-Tests gegen kleine, im Test-Setup mit pdf-lib
  erzeugte PDFs.
- Ein Playwright-Test fuer den Akzeptanz-Flow aus Abschnitt 12 bis zum
  ZIP-Export (der Directory-Picker ist nicht automatisierbar).

## 16. Bekannte Einschraenkungen des Designs

- Quell-Bytes liegen doppelt (Platte und IndexedDB). Bei sehr grossen
  Importmengen ist das Browser-Kontingent die Grenze; der Import lehnt sauber
  ab, statt zu scheitern.
- Direkter Ordner-Export nur in Chromium-Browsern; sonst ZIP.
- Ohne OCR bleiben rein gescannte PDFs unsuchbar.
- Der Ergebnis-Preview rendert Quellseiten in Reihenfolge; er zeigt damit
  exakt den Inhalt des Exports, aber nicht dessen Dateigroesse oder interne
  PDF-Struktur.
- Die Textextraktion eines 500-Seiten-Dokuments dauert beim ersten Suchlauf
  einige Sekunden (danach gecacht).
