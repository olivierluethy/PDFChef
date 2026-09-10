# Design: PWA-Installierbarkeit und Offline-Betrieb (Phase 2, Teilprojekt 7)

Datum: 2026-09-10
Status: zur Umsetzung freigegeben

## Zweck

Die App wird installierbar und laeuft offline: ein Web-App-Manifest plus ein
handgeschriebener Service Worker cachen die App-Schale und die pdf.js-Assets.
Local-first passt genau dazu -- es gibt ohnehin keine Server-Requests mit
Dokumentinhalten.

Bewusst handgeschrieben (kein Build-Plugin), um unabhaengig von der
Vite-8/rolldown-Toolchain und ohne neue Build-Abhaengigkeit zu bleiben.

## Architektur

1. `public/manifest.webmanifest` (neu): `name: "PDF-Master"`, `short_name`,
   `description`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`,
   `background_color`/`theme_color: "#0f1115"`, ein Icon `/icon.svg`
   (`sizes:"any"`, `type:"image/svg+xml"`, `purpose:"any maskable"`).
2. `public/icon.svg` (neu): schlichtes dunkles App-Icon (Dokument-Glyphe).
3. `public/sw.js` (neu): versionierter Cache (`CACHE = 'pdf-master-v1'`).
   - `install`: Kern vorab cachen (`/`, `/index.html`, `/icon.svg`,
     `/manifest.webmanifest`), `skipWaiting()`.
   - `activate`: alte Caches loeschen, `clients.claim()`.
   - `fetch` (nur same-origin GET): Navigationen -> network-first, offline
     Fallback auf gecachtes `/index.html` (SPA). Uebrige Assets (inkl.
     `/assets/*`, `/pdfjs/*`) -> stale-while-revalidate (aus Cache liefern,
     im Hintergrund aktualisieren). Nicht-GET/cross-origin: unveraendert
     durchreichen.
4. `index.html`: `<link rel="manifest" href="/manifest.webmanifest">`,
   `<meta name="theme-color" content="#0f1115">`, `<link rel="icon"
   href="/icon.svg">`.
5. `src/main.tsx`: nur in Produktion registrieren --
   `if (import.meta.env.PROD && 'serviceWorker' in navigator)
   window.addEventListener('load', () => navigator.serviceWorker
   .register('/sw.js').catch((e) => console.warn('SW-Registrierung
   fehlgeschlagen', e)));`. In der Entwicklung kein SW (kein Caching-Aerger).

## Dateien

| Datei | Aenderung |
| --- | --- |
| `public/manifest.webmanifest` | neu |
| `public/icon.svg` | neu |
| `public/sw.js` | neu |
| `index.html` | Manifest/Theme/Icon verlinken |
| `src/main.tsx` | SW in Produktion registrieren |

## Robustheit / Tests

- Vite kopiert `public/` unveraendert nach `dist/`; `sw.js` liegt unter `/sw.js`
  (Scope `/`).
- Bei einem neuen Deploy aktualisiert der Browser den SW ueber den Byte-Diff
  von `sw.js`; Assets werden per stale-while-revalidate frisch. Fuer harte
  Invalidierung wird `CACHE` hochgezaehlt.
- Deutsch, nie das scharfe s. Ohne Testlaeufe; Pruefung via
  `tsc`/`eslint`/`vite build`. `sw.js`/`manifest`/`icon.svg` liegen in `public/`
  und sind nicht Teil des TypeScript-/Lint-Laufs; nur die `main.tsx`-Aenderung
  wird typgeprueft.

## Bewusst nicht in v1

Vorab-Cachen der grossen pdf.js-cMaps/Schriften (werden bei Bedarf zur Laufzeit
gecacht); Update-Hinweis-UI ("neue Version verfuegbar"); Push/Background-Sync.
