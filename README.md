# PDF-Master

**Seiten wie Bausteine ordnen.** PDF-Master ist ein lokal laufender Dokument-Arbeitsplatz im
Browser: mehrere Dokumente importieren, einzelne Seiten per Maus in völlig neue Dokumente und
Ordnerstrukturen umsortieren und das Ergebnis exportieren – **ohne Zwischenexporte**.

Es ist bewusst kein reiner PDF-Merger/-Splitter, sondern ein **Dateimanager für Dokumentseiten**.

---

## Idee

- **Quellen sind unveränderlich.** Deine Arbeit ist eine Kompositionsschicht aus Referenzen auf
  Quellseiten – das Original wird nie verändert.
- **Direkte Manipulation:** Auswählen → Ziehen → Ablegen → Vorschau → Exportieren.
- **Local-first & privat:** Kein Konto, kein Server, keine Datenbank in der Cloud. Alle Dokumente
  bleiben im Browser (IndexedDB) und verlassen das Gerät nicht.

## Kernfunktionen

- **Import** von einer oder mehreren Dateien, von ganzen **Ordnern** und per **Drag-and-Drop**;
  **ZIP-Archive** werden automatisch entpackt. Formate: PDF, Bilder (PNG/JPG/WebP/GIF), TXT, Markdown,
  DOCX, PPTX, XLSX.
- **Seiten umsortieren** per Maus – innerhalb eines Dokuments und **quellenübergreifend**
  (z. B. eine Seite aus PDF A in ein Dokument mit Seiten aus PDF B).
- **Auswahl** über ein Bereichsfeld (`4-49`, `1-3,50-100`), Klick/Shift/Strg und **Marquee**
  (mit der Maus ein Rechteck aufziehen).
- **Ordner & Ausgabedokumente** frei anlegen und verschachteln; so entsteht die eigene Exportstruktur.
- **Aufteilen (Split)** eines Dokuments in mehrere Teile – gleiche Hälften/Drittel, alle N Seiten,
  eigene Bereiche, aktuelle Auswahl oder an leeren Trennseiten. **Jeder Teil bekommt einen eigenen
  Namen.**
- **Vorschau** der Quell- und Ergebnisseiten mit Zoom, Seitennavigation und **Suche** (inkl. OCR für
  gescannte PDFs).
- **Export** als **ZIP** oder – wo unterstützt – direkt **in einen frei gewählten Ordner** (die ganze
  Struktur in einem Schritt). Namen sind vor dem Export bearbeitbar; einzelne Ordner/Dokumente lassen
  sich separat exportieren.
- **LaTeX** aus einem Dokument erzeugen (Textextraktion → `.tex`).
- **PWA:** installierbar und offline nutzbar.
- **Undo/Redo** über die gesamte Bearbeitung; **Papierkorb** für gelöschte Elemente; **Autosave**.

## Schnellstart

Voraussetzungen: **Node ≥ 20** und **npm**.

```bash
npm install
npm run dev        # Entwicklungsserver (http://localhost:5173, sonst nächster freier Port)
```

Weitere Skripte:

```bash
npm run build      # Typecheck + Produktions-Build (dist/)
npm run preview    # den Produktions-Build lokal ausliefern
npm test           # Unit-Tests (Vitest)
npm run typecheck  # TypeScript ohne Emit
npm run lint       # ESLint
npm run format     # Prettier
```

> Vor `dev`/`build`/`test` werden pdf.js- und tesseract.js-Assets automatisch nach `public/`
> synchronisiert (`predev`/`prebuild`/`pretest`), damit die App vollständig offline läuft.

## Browser-Unterstützung

- Läuft in aktuellen Chromium-, Firefox- und Safari-Browsern.
- **Direkter Ordner-Export** (File System Access API) ist Chromium-Browsern vorbehalten; überall
  sonst steht der **ZIP-Export** als vollwertige Alternative bereit – kein Feature verschwindet
  stillschweigend.

## Architektur

Strikte Schichtung, per ESLint erzwungen – Abhängigkeiten zeigen nur nach unten:

```
domain    reine, framework-freie Logik (Ranges, Split, Komposition, Commands/Undo, Export-Plan) – unit-getestet
adapters  Formate: PDF (pdf.js/pdf-lib), Bilder, Text/OOXML; Rendern & Textextraktion
services  Store (Zustand), Persistenz (IndexedDB), Thumbnails, Import/Export, Suche/OCR
ui        React-Oberfläche (Shell, Quellen, Arbeitsbereich, Vorschau, Export)
workers   Textextraktion abseits des Haupt-Threads
```

Leitplanken: Quelldokumente sind unveränderlich; jede Nutzeraktion ist ein **benannter Command** mit
abgeleiteter Undo-Inverse; reine Logik wird per **TDD** entwickelt, UI/Flows per Playwright verifiziert.

## Tech-Stack

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · Zustand + Immer ·
pdf.js (`pdfjs-dist`) & pdf-lib · tesseract.js (OCR) · mammoth/xlsx (OOXML) · fflate (ZIP) ·
idb (IndexedDB) · Vitest & Playwright.

## Status & Roadmap

Die App ist funktionsfähig; Kernmechanik (Drag/Drop, Thumbnails), Oberfläche und die wichtigsten
Workflows sind umgesetzt und getestet. Offene Punkte und die genauen nächsten Schritte stehen in
[`docs/superpowers/plans/2026-09-11-handoff-offene-punkte.md`](docs/superpowers/plans/2026-09-11-handoff-offene-punkte.md).
Design-Dokumente liegen unter [`docs/superpowers/specs/`](docs/superpowers/specs/).

## Datenschutz

Es findet **kein** Netzwerkverkehr mit Dokumentinhalten statt, kein Tracking und keine externen
Laufzeit-Requests. pdf.js-Worker, Schriften und OCR-Daten werden mit der App ausgeliefert.
