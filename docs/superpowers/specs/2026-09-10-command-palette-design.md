# Design: Command Palette (Phase 2, Teilprojekt 5)

Datum: 2026-09-10
Status: zur Umsetzung freigegeben

## Zweck

Schnelle Aktionssuche per `Ctrl/Cmd+K`: ein Overlay mit Suchfeld und
gefilterter Aktionsliste, Pfeiltasten zur Auswahl, Enter fuehrt aus, Escape
schliesst. Nutzt die bereits vorhandenen App-Aktionen -- keine neuen Commands.

## Architektur (klein, additiv)

1. Reine Filterung `src/ui/app/commandFilter.ts`: `interface PaletteAction {
   id: string; label: string; hint?: string; run(): void }` und
   `filterActions(actions: PaletteAction[], query: string): PaletteAction[]`
   (case-insensitive Teilfolgen-Match; leere Anfrage -> alle).
2. `src/ui/app/CommandPalette.tsx`: Overlay-Komponente
   `CommandPalette({ actions, onClose })` -- Suchfeld (autofocus), Liste der
   gefilterten Aktionen, Tastatur: Auf/Ab bewegt die Hervorhebung, Enter ruft
   `run()` und `onClose()`, Escape schliesst. Rein darstellend.
3. `src/ui/app/useKeyboardShortcuts.ts`: `ShortcutHandlers` um
   `onCommandPalette?()` erweitern; `Ctrl/Cmd+K` ruft es (nicht in
   Eingabefeldern).
4. `src/ui/app/App.tsx`: `const [paletteOpen, setPaletteOpen] = useState(false)`;
   `useKeyboardShortcuts({ onSearch: search.open, onCommandPalette: () =>
   setPaletteOpen(true) })`; Aktionsliste bauen und `<CommandPalette>` rendern
   wenn offen.

Aktionen v1 (aus vorhandenen Handlern): Rueckgaengig (`workspaceStore.getState()
.undo()`), Wiederherstellen (`.redo()`), Ordner anlegen / Dokument anlegen
(`dispatch({type:'createFolder'|'createOutput', node:{ id:newId(), name:'Neuer
Ordner'|'Neues Dokument', parentId:null }})`), Exportieren (`exportUi.open()`),
Suchen (`search.open()`).

## Dateien

| Datei | Aenderung |
| --- | --- |
| `src/ui/app/commandFilter.ts` | neu: `PaletteAction`, `filterActions` |
| `src/ui/app/CommandPalette.tsx` | neu: Overlay mit Tastaturnavigation |
| `src/ui/app/useKeyboardShortcuts.ts` | `onCommandPalette` + `Ctrl/Cmd+K` |
| `src/ui/app/App.tsx` | Palette-Zustand, Aktionsliste, Rendern |

## Robustheit / Tests

Deutsch, nie das scharfe s. Ohne Testlaeufe (Nutzervorgabe); Pruefung via
`tsc`/`eslint`/`vite build`. `filterActions` ist rein und spaeter unit-testbar.

## Bewusst nicht in v1

Sprung zu einer konkreten Quelle/Output als Aktion; Import ueber die Palette
(braucht den versteckten Datei-Dialog aus dem Header); Aktions-Verlauf.
