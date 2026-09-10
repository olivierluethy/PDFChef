# Design: Duplikaterkennung (Phase 2, Teilprojekt 4)

Datum: 2026-09-10
Status: zur Umsetzung freigegeben
Baut auf: Phase 1 + Bild-Import + Kapitel-Navigation + Export-Review (`main`)

## 1. Zweck und Abgrenzung

Dieselbe Datei mehrfach importiert (typisch bei Scans) erzeugt heute mehrere
Quellen mit gleichem `contentHash` -- der Blob ist im Store dedupliziert, die
Quelle aber nicht. Neu: Erkennung solcher Doppel und **sichere** Bereinigung.

**Kernentscheidung (Sicherheit vor Aggressivitaet):** v1 entfernt nur
**ungenutzte** Doppel. Die zuerst importierte Quelle bleibt (kanonisch);
weitere Quellen mit gleichem Hash, die in keinem Output verwendet werden
(`itemsOfSource` leer), lassen sich per Klick entfernen. Bereits verwendete
Doppel werden angezeigt, aber nie automatisch geloescht (das wuerde komponierte
Seiten verlieren). Ein "Merge"/Umhaengen der Items auf die kanonische Quelle
braeuchte einen neuen Domain-Command und ist bewusst ein Folge-Teilprojekt.

## 2. Architektur (klein, additiv, kein neuer Command)

### 2.1 Reine Erkennung (`src/domain/duplicates.ts`, neu)

```ts
export interface DuplicateGroup {
  contentHash: string;
  sourceIds: SourceId[];   // in sourceOrder; [0] ist kanonisch (bleibt)
}

/** Gruppen gleicher Inhalte mit mindestens zwei Quellen, in sourceOrder. */
export function findDuplicateSourceGroups(ws: Workspace): DuplicateGroup[];

/** Nicht-kanonische Doppel, die in keinem Output verwendet werden -> sicher entfernbar. */
export function removableDuplicateSourceIds(ws: Workspace): SourceId[];
```

- `findDuplicateSourceGroups`: iteriert `ws.sourceOrder`, gruppiert die
  vorhandenen Quellen nach `contentHash`, behaelt nur Gruppen mit `length >= 2`.
  Nur Quellen mit Status `ready` zaehlen (fehlerhafte/verschluesselte haben
  keinen verwertbaren Inhalt). Reihenfolge stabil zu `sourceOrder`.
- `removableDuplicateSourceIds`: fuer jede Gruppe die `sourceIds.slice(1)`,
  gefiltert auf jene mit `itemsOfSource(ws, id).length === 0`. Nutzt
  `itemsOfSource` aus `./composition`.
- Framework-frei, rein, unabhaengig testbar.

### 2.2 Anzeige und Aktion (`src/ui/sources/DuplicatesNotice.tsx`, neu)

- Liest `useWorkspace()`; berechnet Gruppen und entfernbare Ids.
- Sichtbar nur, wenn Gruppen existieren und die Notiz nicht lokal ausgeblendet
  wurde (`useState`).
- Text: "N doppelt importierte Dateien." Pro Gruppe der Name der kanonischen
  Quelle und die Zahl der Doppel; verwendete Doppel mit Notiz "wird verwendet --
  nicht automatisch entfernbar".
- Knopf "X ungenutzte Doppel entfernen" (nur wenn `X > 0`): dispatcht **einen**
  `batch` aus `removeSource`-Commands fuer `removableDuplicateSourceIds`, Label
  z. B. `X doppelte Quellen entfernt` -> ein Undo-Schritt. Nutzt `useDispatch()`.
- Ausblendknopf (X) setzt den lokalen `dismissed`-Zustand; die Notiz kommt bei
  einem Reload oder neuen Doppeln wieder (kein persistenter Zustand).

### 2.3 Einhaengen (`src/ui/app/App.tsx`)

- `DuplicatesNotice` im linken Bereich direkt ueber `SourceList` rendern
  (innerhalb des Quellen-Abschnitts). Keine Aenderung an `SourceList` noetig.

## 3. Geaenderte und neue Dateien

| Datei | Aenderung |
| --- | --- |
| `src/domain/duplicates.ts` | neu: `findDuplicateSourceGroups`, `removableDuplicateSourceIds`, `DuplicateGroup` |
| `src/ui/sources/DuplicatesNotice.tsx` | neu: Notiz + sichere Entfernen-Aktion |
| `src/ui/app/App.tsx` | `DuplicatesNotice` ueber `SourceList` einhaengen |

## 4. Fehler/Robustheit

- Nur `ready`-Quellen werden gruppiert.
- Entfernen wirkt ausschliesslich auf ungenutzte, nicht-kanonische Doppel --
  komponierte Seiten koennen nie verloren gehen.
- Der `batch` ist ein einziger Undo-Schritt.
- Deutsch, nie das scharfe s (immer `ss`).

## 5. Tests

Umsetzung ohne Testlaeufe (Nutzervorgabe); Kompilierpruefung via
`tsc --noEmit`, `eslint .`, `vite build`. `findDuplicateSourceGroups` und
`removableDuplicateSourceIds` sind reine Funktionen und spaeter ohne Umbau
unit-testbar.

## 6. Bewusst nicht in v1

- "Merge"/Umhaengen von Items einer Doppel-Quelle auf die kanonische Quelle
  (braeuchte einen neuen Domain-Command).
- Warnung bereits beim Import (dieser Entwurf erkennt Doppel im Workspace,
  nicht im Import-Fluss).
- Duplikate auf Seitenebene innerhalb einer Quelle.
