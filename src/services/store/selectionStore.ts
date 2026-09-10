import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  EMPTY_SELECTION,
  applyExtend,
  applyReplace,
  applySelect,
  applySelectAll,
  applyToggle,
  isSelected,
  type SelectionScope,
  type SelectionSnapshot,
  type SelectionState,
} from './selection';

export interface SelectionStoreState extends SelectionState {
  select(scope: SelectionScope, id: string, order: string[]): void;
  extend(scope: SelectionScope, id: string, order: string[]): void;
  toggle(scope: SelectionScope, id: string): void;
  replace(scope: SelectionScope, ids: string[], anchor: string | null, additive: boolean): void;
  selectAll(scope: SelectionScope, order: string[]): void;
  clear(): void;
  restore(snapshot: SelectionSnapshot): void;
  snapshot(): SelectionSnapshot;
  has(scope: SelectionScope, id: string): boolean;
}

export type SelectionStore = StoreApi<SelectionStoreState>;

export function createSelectionStore(): SelectionStore {
  return createStore<SelectionStoreState>((set, get) => {
    // Nur die Datenfelder aus dem State an die reinen Operationen geben,
    // damit die Aktionen nicht versehentlich in den Snapshot geraten.
    const state = (): SelectionState => {
      const { scope, anchor, ids } = get();
      return { scope, anchor, ids };
    };
    return {
      ...EMPTY_SELECTION,
      select(scope, id, order) {
        set(applySelect(state(), scope, id, order));
      },
      extend(scope, id, order) {
        set(applyExtend(state(), scope, id, order));
      },
      toggle(scope, id) {
        set(applyToggle(state(), scope, id));
      },
      replace(scope, ids, anchor, additive) {
        set(applyReplace(state(), scope, ids, anchor, additive));
      },
      selectAll(scope, order) {
        set(applySelectAll(scope, order));
      },
      clear() {
        set(EMPTY_SELECTION);
      },
      restore(snapshot) {
        set({ scope: snapshot.scope, anchor: snapshot.anchor, ids: snapshot.ids });
      },
      snapshot() {
        return state();
      },
      has(scope, id) {
        return isSelected(state(), scope, id);
      },
    };
  });
}
