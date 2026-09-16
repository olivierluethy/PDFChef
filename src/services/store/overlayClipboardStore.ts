import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Overlay } from '../../domain/types';

export interface OverlayClipboardState {
  /** Momentaufnahme der kopierten Overlays (mit Original-Ids; beim Einfuegen geklont). */
  overlays: Overlay[];
  /** Legt eine Kopie der uebergebenen Overlays in die Zwischenablage. */
  copy(overlays: Overlay[]): void;
  clear(): void;
}

export type OverlayClipboardStore = StoreApi<OverlayClipboardState>;

/**
 * Sitzungsweite Zwischenablage fuer kopierte Overlays. Bewusst ein Modul-Singleton
 * (nicht Teil des Workspace-Stores), damit Elemente und Unterschriften
 * dokumentuebergreifend kopiert und in ein anderes PDF eingefuegt werden koennen.
 * Reaktiv, damit die Einfuegen-Aktion ihren leeren/gefuellten Zustand zeigen kann.
 * Es wird eine flache Kopie abgelegt, damit spaetere Aenderungen am Original die
 * Zwischenablage nicht mehr beeinflussen.
 */
export const overlayClipboardStore: OverlayClipboardStore = createStore<OverlayClipboardState>(
  (set) => ({
    overlays: [],
    copy: (overlays) => set({ overlays: overlays.map((o) => ({ ...o })) }),
    clear: () => set({ overlays: [] }),
  }),
);
