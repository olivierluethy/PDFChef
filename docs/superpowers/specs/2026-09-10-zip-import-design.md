# Design: ZIP-Import (Phase 2, Teilprojekt 6)

Datum: 2026-09-10
Status: zur Umsetzung freigegeben

## Zweck

Eine `.zip`-Datei importieren: ihre Eintraege werden entpackt und jede
unterstuetzte Datei (PDF, Bild) wie ein normaler Import behandelt, mit dem
Pfad im Archiv als `importPath`. Funktioniert fuer Drag-&-Drop und den
Dateidialog.

## Architektur (klein, additiv)

`fflate` ist bereits installiert (`unzipSync`).

1. `src/services/import/fileSources.ts` (erweitern):
   - `isZip(file: { name: string; type: string }): boolean` -- Endung `.zip`
     oder Typ `application/zip`/`application/x-zip-compressed`.
   - `collectFromZip(file: File): Promise<ImportCandidate[]>` -- Bytes lesen,
     `unzipSync`, je Eintrag (Verzeichnisse und `__MACOSX/`/`.DS_Store`
     ueberspringen) ein `File` aus den Bytes bauen (Basename + aus der Endung
     abgeleiteter MIME-Typ), `importPath` = Eintragspfad im Archiv.
   - `expandZipCandidates(candidates: ImportCandidate[]): Promise<ImportCandidate[]>`
     -- ersetzt ZIP-Kandidaten durch ihre entpackten inneren Kandidaten (eine
     Ebene; verschachtelte ZIPs bleiben als unbekanntes Format und werden
     spaeter abgelehnt), nicht-ZIP-Kandidaten unveraendert.
2. `src/services/app/appServices.ts` (erweitern): in `importForDrop` und
   `importForFiles` vor `importCandidates` die Kandidaten durch
   `expandZipCandidates` schleusen.
3. `src/ui/app/Header.tsx`: dem Datei-Dialog `.zip` erlauben --
   `accept={`${services.registry.acceptAttribute()},application/zip,.zip`}`.

Unbekannte Dateitypen im Archiv werden wie bisher sauber abgelehnt
(`importCandidates` meldet sie in `rejected`). Der Blob wird wie immer per
`contentHash` dedupliziert.

## Dateien

| Datei | Aenderung |
| --- | --- |
| `src/services/import/fileSources.ts` | `isZip`, `collectFromZip`, `expandZipCandidates` |
| `src/services/app/appServices.ts` | ZIPs vor dem Import expandieren |
| `src/ui/app/Header.tsx` | `.zip` im Dateidialog erlauben |

## Robustheit / Tests

- `unzipSync` laeuft synchron auf dem Hauptthread; fuer sehr grosse Archive ist
  das v1 eine bewusste Einschraenkung.
- Beschaedigtes Archiv -> `collectFromZip` faengt den Fehler, liefert eine leere
  Liste und laesst den uebrigen Import unberuehrt (Stacktrace in die Konsole).
- Deutsch, nie das scharfe s. Ohne Testlaeufe; Pruefung via
  `tsc`/`eslint`/`vite build`. `isZip`/`collectFromZip`/`expandZipCandidates`
  sind rein bzw. duenn und spaeter unit-testbar.

## Bewusst nicht in v1

Verschachtelte ZIPs; ZIP-**Export** (existiert bereits separat); Fortschritts-
anzeige beim Entpacken.
