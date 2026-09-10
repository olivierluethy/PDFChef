import { createContext, useContext, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { Command } from '../../domain/commands';
import { createEmptyWorkspace, type Workspace } from '../../domain/types';
import type { AppServices } from '../../services/app/appServices';
import type { SelectionSnapshot, SelectionState } from '../../services/store/selection';
import { createSelectionStore, type SelectionStore } from '../../services/store/selectionStore';
import { createWorkspaceStore, type WorkspaceStore } from '../../services/store/workspaceStore';

export interface StoreContextValue {
  workspaceStore: WorkspaceStore;
  selectionStore: SelectionStore;
  services: AppServices;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ value, children }: { value: StoreContextValue; children: ReactNode }) {
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function useContextValue(): StoreContextValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore-Hooks brauchen einen StoreProvider im Baum.');
  return value;
}

export function useWorkspaceStore(): WorkspaceStore {
  return useContextValue().workspaceStore;
}
export function useSelectionStore(): SelectionStore {
  return useContextValue().selectionStore;
}
export function useServices(): AppServices {
  return useContextValue().services;
}

export function useWorkspace(): Workspace {
  return useStore(useWorkspaceStore(), (state) => state.workspace);
}

export function useSelection(): SelectionState {
  // useShallow memoisiert das Ergebnis: ohne shallow-Vergleich liefert der
  // Selektor bei jedem Render ein neues Objekt, useSyncExternalStore sieht
  // einen "neuen" Snapshot und rendert endlos ("Maximum update depth exceeded").
  return useStore(
    useSelectionStore(),
    useShallow((state) => ({ scope: state.scope, anchor: state.anchor, ids: state.ids })),
  );
}

export function useDispatch(): (command: Command, selectionAfter?: SelectionSnapshot) => void {
  return useWorkspaceStore().getState().dispatch;
}

export interface WireStoresDeps {
  services: AppServices;
  initialWorkspace?: Workspace;
  now?(): number;
}

/**
 * Verbindet die zwei entkoppelten Stores: die History bekommt Snapshot und
 * Wiederherstellung der Selektion als Callbacks, damit weder Store den anderen
 * importieren muss. Verletzte Invarianten sind ein Programmierfehler und gehen
 * in die Konsole, nicht in die Oberflaeche.
 */
export function wireStores({
  services,
  initialWorkspace,
  now = () => Date.now(),
}: WireStoresDeps): StoreContextValue {
  const selectionStore = createSelectionStore();
  const workspaceStore = createWorkspaceStore({
    initial: initialWorkspace ?? createEmptyWorkspace({ id: 'ws-1', name: 'Neuer Arbeitsbereich' }),
    now,
    captureSelection: () => selectionStore.getState().snapshot(),
    restoreSelection: (snapshot) => selectionStore.getState().restore(snapshot),
    onInvalid: (errors) => console.warn('Workspace-Invarianten verletzt', errors),
  });
  return { workspaceStore, selectionStore, services };
}
