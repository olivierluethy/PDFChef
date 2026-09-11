import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Overlay } from '../../domain/types';
import { newId } from '../../domain/ids';
import { normalizeOverlays } from '../../domain/overlayLibrary';
import type { Database, LibraryItemKind, LibraryItemRecord } from './db';

export interface LibraryStoreState {
  items: LibraryItemRecord[];
  ready: boolean;
  /** Overlays als benannten Baustein ablegen (auf eine eigene Box normalisiert). */
  add(kind: LibraryItemKind, name: string, overlays: Overlay[]): Promise<LibraryItemRecord>;
  remove(id: string): Promise<void>;
  rename(id: string, name: string): Promise<void>;
}

export type LibraryStore = StoreApi<LibraryStoreState>;

/** Neueste zuerst -- so steht das gerade Gespeicherte oben in der Liste. */
function byNewest(a: LibraryItemRecord, b: LibraryItemRecord): number {
  return b.createdAt - a.createdAt;
}

/**
 * Zustand-Store fuer die dauerhafte Bausteinbibliothek. Laedt beim Erzeugen aus
 * IndexedDB und haelt danach `items` synchron zu jeder Schreiboperation. Fehler
 * beim Speichern gehen in die Konsole, nicht in die Oberflaeche.
 */
export function createLibraryStore(db: Database): LibraryStore {
  const store = createStore<LibraryStoreState>((set, get) => ({
    items: [],
    ready: false,
    async add(kind, name, overlays) {
      const { overlays: normalized, aspect } = normalizeOverlays(overlays);
      const record: LibraryItemRecord = {
        id: newId(),
        kind,
        name: name.trim() || defaultName(kind),
        createdAt: Date.now(),
        aspect,
        overlays: normalized,
      };
      await db.put('library', record);
      set({ items: [record, ...get().items].sort(byNewest) });
      return record;
    },
    async remove(id) {
      await db.delete('library', id);
      set({ items: get().items.filter((item) => item.id !== id) });
    },
    async rename(id, name) {
      const existing = await db.get('library', id);
      if (!existing) return;
      const updated = { ...existing, name: name.trim() || existing.name };
      await db.put('library', updated);
      set({ items: get().items.map((item) => (item.id === id ? updated : item)).sort(byNewest) });
    },
  }));

  // Einmalig aus der DB laden.
  void db
    .getAll('library')
    .then((items) => store.setState({ items: items.sort(byNewest), ready: true }))
    .catch((error) => {
      console.warn('Bibliothek konnte nicht geladen werden', error);
      store.setState({ ready: true });
    });

  return store;
}

function defaultName(kind: LibraryItemKind): string {
  switch (kind) {
    case 'signature':
      return 'Unterschrift';
    case 'text':
      return 'Textbaustein';
    case 'shape':
      return 'Form';
    case 'group':
      return 'Gruppe';
  }
}
