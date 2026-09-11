# Handoff: Offene Punkte & nächste Schritte (Stand 2026-09-10)

Dieses Dokument sagt der KI von morgen **genau**, was noch offen ist und wie sie es umsetzt.
Reihenfolge = empfohlene Priorität. Jeder Punkt ist so beschrieben, dass er ohne Rückfrage
angefangen werden kann.

---

## Fortschritt (Stand 2026-09-11)

- ✅ **P1 erledigt** — `xlsx` auf gepatchte SheetJS-CDN-Version `0.20.3` gehoben; `npm audit`
  meldet **0 Vulnerabilities**. Wichtig: der Fix ist **nicht** über die npm-Registry verfügbar,
  nur über `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (steht so in `package.json`).
  API (`XLSX.read` / `sheet_to_csv`) unverändert; Smoke-Test bestätigt.
- ✅ **P2 erledigt** — DOCX-Seitenumbrüche (`\f`) werden erkannt; `paginateText` + neue reine
  Funktion `docxXmlToText`. Playwright: DOCX mit 1 Umbruch → 2 Quellseiten.
- ✅ **P3 erledigt** — `htmlToLatex` (reiner HTML-Tokenizer im domain-Layer); DOCX-Export via
  `mammoth.convertToHtml` → `\section`/`\subsection`/`itemize`/`\textbf`/`\emph`. Playwright:
  `.tex` enthält `\section{…}` und korrektes Escaping.
- ✅ **P4 erledigt** — konstante Griffzone (`data-marquee-handle`, 56px) am unteren Rand jedes
  Rasters; Marquee lässt sich auch bei vollem Raster aufziehen. Playwright + Screenshot bestätigt.
- ✅ **P5 erledigt** — im Export-Dialog kann jedes Dokument einzeln über „Eigener Ordner" an ein
  frei gewähltes Ziel geschrieben werden (`omitExportedEntries`, `onExportEntry`); danach ist es aus
  dem Sammel-Export ausgeklammert. Nur bei File-System-Access (Chromium). Playwright (Picker gemockt):
  Einzel-Export schreibt genau ein gültiges PDF, Rest-ZIP enthält nur das übrige Dokument.
- 🟡 **P6 teilweise** — verifiziert: PDF-/DOCX-Import, Text-Pipeline, LaTeX-Export, Marquee,
  **Kern-Export (Auswahl → Dokument → ZIP)** liefert gültiges PDF mit korrekter Seitenzahl,
  Einzel-Ziel-Export (siehe P5). **Noch nicht frisch verifiziert:** OCR, PWA/Offline,
  Ordner-Import (`webkitRelativePath`), Suche (`Ctrl/Cmd+F`), Bild-/PPTX-/XLSX-Import.

Alle 50 Vitest-Tests grün, `typecheck` + `lint` sauber, 8/8 + 5/5 Playwright-Checks grün.

**Hinweis zu P1/Dependabot:** GitHub kann `xlsx` trotz gepatchter CDN-Version weiter als verwundbar
melden, weil die gefixte Version **nicht** in der npm-Registry liegt (SheetJS verteilt nur über die
eigene CDN). `npm audit` meldet lokal 0 Findings — der installierte Code (0.20.3) ist gepatcht. Falls
Dependabot weiter meldet, ist das eine Erkennungs-Einschränkung, kein echtes Risiko.

---

## 0. Ausgangslage (was schon fertig ist)

Alles Folgende ist auf `main` gemergt, getestet (21 Vitest-Tests grün), typecheck + lint sauber:

- **Kernmechanik repariert**: Seiten-Drag/Drop zuverlässig (auf Dokument, Ordner, quellenübergreifend);
  leere Dokumente haben eine echte Drop-Zone; Thumbnails rendern alle (Render-Queue-Race behoben);
  keine native Textmarkierung beim Ziehen, Drop-Ziel wird hervorgehoben.
- **UI „Leuchttisch-Werkbank"**: Graphit-Grund, ein Bernstein-Akzent (`--color-accent`), höhen-
  verstellbarer Splitter (Quelle/Ausgabe), einklappbare Vorschau, Section-Header mit Zählern,
  Leerzustand, ContextBar-Aktion „Neues Dokument aus Auswahl".
- **Benannte Split-Parts + Export**: Part-Namen im Split-Panel und im Export-Dialog editierbar;
  „In Ordner speichern" (File System Access) schreibt die ganze Struktur in einem Schritt; ZIP-Fallback;
  Teil-Export einzelner Ordner/Dokumente über das Baum-Symbol.
- **Marquee-Auswahl** in beiden Rastern; **Ordner-Import-Button** (webkitdirectory); **ZIP-Import**
  verifiziert; **LaTeX aus PDF** (Text wird bei Bedarf extrahiert).

Wichtige Architektur-Regeln (unbedingt einhalten):
- Schichten: `domain` (rein, ohne Framework) ← `adapters` ← `services` ← `ui`. Nur nach unten
  importieren. `domain`-Logik ist per Vitest getestet.
- Quelldokumente sind unveränderlich; Nutzerarbeit ist eine Kompositionsschicht (Items → Outputs).
- Jede Nutzeraktion ist ein benannter Command mit abgeleiteter Undo-Inverse (`src/domain/commands.ts`).
- **TDD**: reine Logik zuerst per Test (RED→GREEN). UI/Integration per Playwright gegen den Dev-Server
  verifizieren (Screenshot + Assertions), bevor „fertig" behauptet wird.

---

## 1. Arbeitsweise / Setup (so verifiziert man)

```bash
npm run dev            # Vite-Dev-Server (Port 5173, sonst 5174 – im Log prüfen!)
npm run typecheck      # tsc --noEmit
npm test               # vitest run
npm run lint           # eslint .
```

Test-PDFs erzeugen (pdf-lib ist Dependency; Script MUSS im Projektordner laufen, damit `pdf-lib`
auflöst). Farbige Mehrseiten-PDFs mit echtem Text („Contract Seite 1 / 8") entstehen so – Muster
liegt in der letzten Session unter dem Scratchpad, Kern:
```js
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// addPage, drawText('Contract'), drawText('Seite i / n') …  writeFileSync(out, await doc.save())
```

Playwright (v1.63.0 ist Dev-Dependency; Chromium via `npx playwright install chromium`). Muster für
einen Verifikationslauf:
```js
import { chromium } from 'playwright';
const page = await (await chromium.launch()).newPage({ viewport:{width:1440,height:900}, acceptDownloads:true });
await page.addInitScript(()=>indexedDB.deleteDatabase('pdf-master')); // sauberer Start!
await page.goto('http://localhost:5174/');
await page.locator('input[type=file]').first().setInputFiles([...]); // Header-„Dateien"-Input
```
Nützliche Selektoren: Quellzellen `main section img[alt$="Seite N"]` bzw. `button[data-block-index]`;
Ausgabe `[data-output-id] [data-item-id]`; Baumknoten `[data-node-type=output|folder][data-node-id]`.
Downloads über `page.waitForEvent('download')` abfangen; ZIP mit `fflate.unzipSync` + `pdf-lib` prüfen.

**Hinweis Drag in Playwright**: die sichtbare Zellmitte greifen (nicht die von `boundingBox`
gelieferte geometrische Mitte, die im weggeclippten Bereich liegen kann). In kleinen Schritten mit
`page.mouse.move` ziehen, sonst greift der Threshold nicht.

Immer auf einem Feature-Branch arbeiten (`git checkout -b feat/... main`), pro Punkt ein Commit,
am Ende `--ff-only` nach `main` mergen und pushen. Commit-/Session-Attribution wie in den letzten
Commits beibehalten.

---

## 2. Offene Punkte (priorisiert)

### P1 — Dependabot: 2 High-Vulnerabilities auf `main`  ·  Aufwand: klein
**Ziel:** Die 2 als „high" gemeldeten Schwachstellen beheben, ohne die App zu brechen.
**Schritte:**
1. `npm audit` (und `npm audit --json`) laufen lassen; betroffene Pakete + Pfade notieren.
2. Bevorzugt `npm audit fix`; wenn ein Major-Bump nötig ist, das Paket einzeln prüfen
   (Breaking Changes) und gezielt anheben. Kandidaten sind typischerweise transitive Deps von
   `xlsx`, `pdfjs-dist` oder Build-Tooling.
3. Nach jedem Bump: `npm run typecheck && npm test && npm run lint` und einen kurzen Playwright-
   Smoke-Test (Import → Drag → ZIP-Export), damit nichts regressiert.
**Akzeptanz:** `npm audit` meldet keine High-Findings mehr; alle Checks grün; Smoke-Test ok.

---

### P2 — DOCX-Seitenerkennung an echten Seitenumbrüchen  ·  Aufwand: mittel
**Problem:** DOCX wird über `mammoth.extractRawText` als ein Fließtext gelesen
(`src/adapters/text/extractText.ts` → `extractDocxText`), und `paginateText`
(`src/adapters/text/textLayout.ts`) zerteilt nur nach fester Zeilenzahl. Echte Word-Seitenumbrüche
werden ignoriert. Der Nutzer will „die vereinzelten Seiten eines Word-Dokuments" erkennen.

**Umsetzung (minimal-invasiv, ohne die Text-Pipeline umzubauen):**
1. **Seitenumbruch-Marker einführen:** Form-Feed `\f` (U+000C) als harte Seitengrenze.
2. In `extractText.ts` einen DOCX-Pfad ergänzen, der `word/document.xml` aus dem bereits
   entpackten `entries` liest und den Rohtext an folgenden Stellen mit `\f` trennt:
   - manuelle Umbrüche: `<w:br w:type="page"/>`
   - gerenderte Umbrüche: `<w:lastRenderedPageBreak/>`
   - Abschnittswechsel: `<w:sectPr>` (Ende eines Abschnitts = neue Seite)
   Praktischer Weg: Absatz-für-Absatz über `<w:p>…</w:p>` iterieren, den sichtbaren Text je Absatz
   aus den `<w:t>`-Runs zusammensetzen (wie in `extractPptxText` für `<a:t>`), und beim Auftreten
   eines Umbruch-Tags ein `\f` einfügen. Fällt kein Umbruch an, Verhalten wie bisher (mammoth-Rohtext).
3. In `textLayout.ts` `paginateText` so erweitern, dass `\f` **immer** eine neue Seite beginnt
   (zuerst am `\f` splitten, dann jeden Abschnitt wie bisher nach `LINES_PER_PAGE` umbrechen).
4. **TDD zuerst** in `src/adapters/text/textLayout.test.ts` (neu) und
   `src/adapters/text/extractText.test.ts` (neu): Text mit `\f` ergibt die erwartete Seitenanzahl;
   DOCX-Fixture mit einem manuellen Seitenumbruch ergibt 2 Seiten.
**Akzeptanz:** Ein DOCX mit N manuellen Seitenumbrüchen erscheint als ≥ N+1 Quell-„Seiten" im Raster;
Playwright: DOCX importieren → Seitenzahl im Header entspricht den Umbrüchen.
**Achtung:** `paginateText` wird auch vom PDF-Assembler benutzt – die Seitengrenzen für Text müssen
in Adapter (Thumbnail) und Export identisch bleiben. Beide Nutzer laufen über dieselbe Funktion,
also reicht die eine Änderung; per Test absichern, dass `\f` in beiden Pfaden gleich wirkt.

---

### P3 — Reichere LaTeX-Rekonstruktion aus DOCX  ·  Aufwand: mittel–groß
**Problem:** `src/domain/latex.ts` erzeugt reinen Fließtext (`article`, `\newpage` je Seite). Der
Nutzer möchte ein Dokument „nachbauen" können – also Struktur statt nur Text.

**Umsetzung (für DOCX am realistischsten, weil Struktur vorhanden ist):**
1. Neuen strukturierten Pfad nur für `source.kind === 'text'` **und** DOCX-Herkunft: in einem
   Service/Adapter `mammoth.convertToHtml` nutzen (liefert `<h1..h3>`, `<p>`, `<ul>/<ol><li>`,
   `<strong>/<em>`).
2. Neue reine Funktion `domain/latex.ts` → `htmlToLatex(html): string` (framework-frei, TDD):
   Mapping `h1→\section`, `h2→\subsection`, `h3→\subsubsection`, `ul→itemize`, `ol→enumerate`,
   `li→\item`, `strong→\textbf`, `em→\emph`, `p→Absatz`. Alles Übrige als Text mit `escapeLatex`.
   HTML robust parsen (kein DOMParser im domain-Layer – kleiner Tokenizer oder im UI/Service-Layer
   parsen und dem domain nur ein neutrales AST übergeben).
3. `buildLatexDocument` um einen optionalen strukturierten Body erweitern (Rückwärtskompatibel:
   Fällt keine Struktur an → bisheriger Fließtext).
4. `useLatexExport.tsx`: für DOCX den strukturierten Weg wählen, sonst wie bisher (PDF/Plaintext =
   Fließtext, bereits umgesetzt).
**Akzeptanz:** DOCX mit Überschriften/Listen → `.tex` enthält `\section{…}` und `itemize`; kompiliert
mit Standard-LaTeX. Tests für `htmlToLatex` decken jede Mapping-Regel + Escaping ab.
**YAGNI:** keine Formel-/Layout-Rekonstruktion aus PDF (nicht sinnvoll machbar) – klar dokumentieren.

---

### P4 — Marquee auch bei vollem Raster startbar  ·  Aufwand: klein
**Problem:** Die Marquee-Auswahl (`src/ui/workspace/useMarquee.ts`) startet nur auf leerer Fläche.
Bei einem vollständig gefüllten Raster gibt es kaum leere Fläche, um aufzuziehen.
**Umsetzung (eine der beiden Varianten):**
- (a) Am unteren Ende jedes Rasters eine konstante leere „Griffzone" (z. B. `padding-bottom`/ein
  leeres Element) lassen, in der immer aufgezogen werden kann; **oder**
- (b) In `useMarquee` erlauben, dass ein Aufziehen auch über einer Zelle startet, wenn eine
  Modifier-Taste (z. B. `Alt`) gedrückt ist (dann kein Zell-Drag, sondern Marquee).
Empfehlung: (a) ist am wenigsten überraschend. In `SourceGrid`/`OutputGrid` umsetzen.
**Akzeptanz:** Playwright: bei 8 Seiten (volles Raster) lässt sich unten aufziehen und selektiert.

---

### P5 — Speicherort feiner wählen (optional)  ·  Aufwand: mittel
**Stand:** „In Ordner speichern" schreibt die **gesamte** gewählte Struktur an **einen** Ort;
Teil-Export pro Knoten existiert. Das deckt „nicht immer ZIP in Downloads" und „nicht mehrfach
exportieren" bereits ab.
**Nur falls gewünscht:** pro Ordner/Dokument ein eigenes Ziel wählen. Das würde den Export-Dialog
verkomplizieren – vor der Umsetzung mit dem Nutzer rückversichern, ob der Bedarf real ist.
**Empfehlung:** niedrige Priorität; erst nach P1–P4.

---

### P6 — Bestehende Vision-Bausteine end-to-end verifizieren  ·  Aufwand: klein je Punkt
Diese Features sind im Code vorhanden, aber in dieser Session **nicht** frisch verifiziert. Je einen
Playwright-Smoke-Test schreiben und bei Bedarf reparieren:
- **Ordner-Import per Button/Drag** (webkitRelativePath → `importPath`): erscheint die Ordner-
  struktur? (Playwright kann `webkitRelativePath` nicht setzen – ggf. über echten Directory-Drag
  mit `webkitGetAsEntry`-Mock testen, oder manuell verifizieren.)
- **PWA/Offline** (`src/main.tsx` registriert SW nur in PROD): `npm run build && npm run preview`,
  Installierbarkeit + Offline-Reload prüfen.
- **OCR** (Command Palette „Text erkennen"): gescanntes/text-loses PDF → Suche findet danach Text.
- **Suche** (`Ctrl/Cmd+F`) über Quelle/Output/alle Quellen.
- **Bild-/PPTX-/XLSX-Import** je einmal durchspielen.

---

## 3. Bekannte Einschränkungen (bewusst, nicht „kaputt")

- **LaTeX-aus-PDF** extrahiert den Seitentext im Main-Thread (`services.adapter.extractText` je Seite).
  Bei sehr großen PDFs kann das kurz blockieren. Verbesserung: den bestehenden Worker-Extraktor
  (`src/services/search/workerExtractor.ts`) in `services` verfügbar machen und hier nutzen.
- **Direkter Ordner-Export** nur in Chromium (File System Access); sonst ZIP – ist so vorgesehen.
- **`.superpowers/`** im Repo-Root ist nicht von uns und bleibt untracked/unangetastet.

## 4. Definition of Done (für jeden Punkt)

1. Reine Logik per Vitest getestet (RED→GREEN gesehen).
2. `npm run typecheck && npm test && npm run lint` grün.
3. Für UI/Flows: ein Playwright-Lauf gegen den Dev-Server mit Assertions **und** Screenshot,
   Ergebnis dem Nutzer als Datei schicken.
4. Ein fokussierter Commit mit aussagekräftiger Nachricht; am Ende `--ff-only` nach `main` + push.
5. Diese Datei aktualisieren: erledigten Punkt streichen/abhaken, Erkenntnisse ergänzen.
