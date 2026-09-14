// Test-Harness: rendert die ECHTEN Fill-Editor-Komponenten (FillLayer,
// OverlayShape, FillPropertiesPanel) samt echter reorderOverlays-Logik ueber
// einem Platzhalter-Blatt -- ohne den PDF-Import-/pdfjs-Pfad. Nur fuer die
// Playwright-Verifikation der Overlay-Bugs. Kein Produktionscode.
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createStore } from 'zustand/vanilla';
import { reorderOverlays } from '../src/domain/composition';
import type { ItemId, Overlay, OverlayLayerMode, Workspace } from '../src/domain/types';
import { StoreProvider, type StoreContextValue } from '../src/ui/app/StoreProvider';
import { I18nProvider } from '../src/ui/i18n';
import { FillLayer } from '../src/ui/preview/FillLayer';
import { FillPropertiesPanel } from '../src/ui/preview/fill/FillPropertiesPanel';
import '../src/ui/styles.css';

// Minimaler Library-Store-Stub -- das Panel haelt nur die Referenz und ruft
// getState().add ausschliesslich im Speichern-Dialog (hier nicht getestet).
const libraryStub = createStore(() => ({
  items: [],
  add: async () => ({}) as never,
  rename: async () => {},
  remove: async () => {},
  hydrate: async () => {},
}));
const storeValue = {
  workspaceStore: null,
  selectionStore: null,
  services: { library: libraryStub },
} as unknown as StoreContextValue;

const seed = (): Overlay[] => [
  {
    id: 'A',
    kind: 'shape',
    shape: 'rect',
    x: 0.15,
    y: 0.2,
    w: 0.42,
    h: 0.26,
    fill: '#dbeafe',
    stroke: '#1e3a8a',
    strokeWidth: 0.004,
    text: 'Original',
    fontSize: 0.03,
    color: '#0b1220',
  },
  {
    id: 'B',
    kind: 'shape',
    shape: 'rect',
    x: 0.32,
    y: 0.32,
    w: 0.42,
    h: 0.26,
    fill: '#fde68a',
    stroke: '#92400e',
    strokeWidth: 0.004,
  },
];

function HarnessApp() {
  const [overlays, setOverlays] = useState<Overlay[]>(seed);
  const [selection, setSelection] = useState<string[]>([]);
  const [spinDeg, setSpinDeg] = useState<number | null>(null);
  const [lastFont, setLastFont] = useState('helvetica');

  const selectedOverlays = overlays.filter((o) => selection.includes(o.id));
  const layerCount = overlays.length;
  const layerIndex =
    selection.length === 1 ? overlays.findIndex((o) => o.id === selection[0]) + 1 : null;

  const patchSelection = (patch: Partial<Overlay>) => {
    if (typeof patch.font === 'string') setLastFont(patch.font);
    setOverlays((prev) => prev.map((o) => (selection.includes(o.id) ? { ...o, ...patch } : o)));
  };

  const reorder = (mode: OverlayLayerMode) => {
    setOverlays((prev) => {
      const ws = { items: { it1: { overlays: prev.map((o) => ({ ...o })) } } } as unknown as Workspace;
      reorderOverlays(ws, 'it1' as ItemId, selection, mode);
      return (ws.items as unknown as { it1: { overlays: Overlay[] } }).it1.overlays;
    });
  };

  return (
    <StoreProvider value={storeValue}>
      <div style={{ display: 'flex', height: '100vh', background: '#0d0f11' }}>
        <div
          data-testid="page"
          style={{ position: 'relative', width: 600, height: 800, background: '#ffffff', margin: 20 }}
        >
          <FillLayer
            overlays={overlays}
            active
            selectedIds={selection}
            onSelect={(ids) => {
              setSpinDeg(null);
              setSelection(ids);
            }}
            onSpin={setSpinDeg}
            lastFont={lastFont}
            onAdd={(o) => setOverlays((p) => [...p, o])}
            onAddMany={(list) => setOverlays((p) => [...p, ...list])}
            onUpdate={(id, patch) =>
              setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)))
            }
            onUpdateMany={(ups) =>
              setOverlays((prev) =>
                prev.map((o) => {
                  const u = ups.find((x) => x.id === o.id);
                  return u ? { ...o, ...u.patch } : o;
                }),
              )
            }
            onRemove={(id) => setOverlays((p) => p.filter((o) => o.id !== id))}
            onRemoveMany={(ids) => setOverlays((p) => p.filter((o) => !ids.includes(o.id)))}
            onDetect={() => {}}
          />
        </div>
        <div style={{ width: 224, borderLeft: '1px solid #363d46', height: '100vh' }}>
          <FillPropertiesPanel
            overlays={selectedOverlays}
            spinDeg={spinDeg}
            onPatch={patchSelection}
            onDuplicate={() => {}}
            onDelete={() => {
              setOverlays((p) => p.filter((o) => !selection.includes(o.id)));
              setSelection([]);
            }}
            onGroup={() => {}}
            onUngroup={() => {}}
            onReorder={reorder}
            layerIndex={layerIndex}
            layerCount={layerCount}
            canGroup={selection.length >= 2}
            canUngroup={selectedOverlays.some((o) => !!o.groupId)}
            onCollapse={() => {}}
          />
        </div>
      </div>
    </StoreProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <HarnessApp />
    </I18nProvider>
  </StrictMode>,
);
