import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { applyCommand, describeCommand, type Command } from '../../domain/commands';
import { checkWorkspaceInvariants } from '../../domain/invariants';
import type { Workspace } from '../../domain/types';
import type { SelectionSnapshot } from './selection';

// Die Undo-Inverse wird aus Patches abgeleitet; dafuer muss Immer Patches fuehren.
enablePatches();

export const HISTORY_LIMIT = 200;

export interface HistoryEntry {
  label: string;
  patches: Patch[];
  inversePatches: Patch[];
  selectionBefore: SelectionSnapshot;
  selectionAfter: SelectionSnapshot;
}

export interface WorkspaceStoreState {
  workspace: Workspace;
  canUndo: boolean;
  canRedo: boolean;
  dispatch(command: Command, selectionAfter?: SelectionSnapshot): void;
  undo(): void;
  redo(): void;
  replaceWorkspace(workspace: Workspace): void;
}

export interface WorkspaceStoreDeps {
  initial: Workspace;
  now(): number;
  /** Liefert die Selektion, wie sie VOR dem Command aussieht. */
  captureSelection(): SelectionSnapshot;
  /** Stellt eine Selektion aus der History wieder her (Undo/Redo). */
  restoreSelection(snapshot: SelectionSnapshot): void;
  /** In Entwicklungsbuilds: meldet verletzte Invarianten nach einem Command. */
  onInvalid?(errors: string[]): void;
  historyLimit?: number;
}

export type WorkspaceStore = StoreApi<WorkspaceStoreState>;

export function createWorkspaceStore(deps: WorkspaceStoreDeps): WorkspaceStore {
  const limit = deps.historyLimit ?? HISTORY_LIMIT;
  let past: HistoryEntry[] = [];
  let future: HistoryEntry[] = [];

  return createStore<WorkspaceStoreState>((set, get) => {
    function flags() {
      return { canUndo: past.length > 0, canRedo: future.length > 0 };
    }

    return {
      workspace: deps.initial,
      canUndo: false,
      canRedo: false,

      dispatch(command, selectionAfter) {
        const before = get().workspace;
        const selectionBefore = deps.captureSelection();

        const [next, patches, inversePatches] = produceWithPatches(before, (draft) => {
          applyCommand(draft, command, { now: deps.now() });
        });

        // Ein Command ohne Wirkung (leerer Name, unmoeglicher Move) darf keinen
        // Undo-Schritt erzeugen -- sonst muesste der Nutzer ins Leere zurueck.
        if (patches.length === 0) return;

        const entry: HistoryEntry = {
          label: describeCommand(command, before),
          patches,
          inversePatches,
          selectionBefore,
          selectionAfter: selectionAfter ?? selectionBefore,
        };
        past.push(entry);
        if (past.length > limit) past = past.slice(past.length - limit);
        future = [];

        if (import.meta.env.DEV && deps.onInvalid) {
          const errors = checkWorkspaceInvariants(next);
          if (errors.length > 0) deps.onInvalid(errors);
        }

        set({ workspace: next, ...flags() });
      },

      undo() {
        const entry = past.at(-1);
        if (!entry) return;
        past = past.slice(0, -1);
        future = [entry, ...future];
        const next = applyPatches(get().workspace, entry.inversePatches);
        set({ workspace: next, ...flags() });
        deps.restoreSelection(entry.selectionBefore);
      },

      redo() {
        const entry = future[0];
        if (!entry) return;
        future = future.slice(1);
        past = [...past, entry];
        const next = applyPatches(get().workspace, entry.patches);
        set({ workspace: next, ...flags() });
        deps.restoreSelection(entry.selectionAfter);
      },

      replaceWorkspace(workspace) {
        // Die History ist sitzungsgebunden: ein geladener Workspace kann aus
        // einer aelteren Schemaversion stammen, gegen die alte Patches nicht
        // mehr passen. Deshalb Stack leeren.
        past = [];
        future = [];
        set({ workspace, canUndo: false, canRedo: false });
      },
    };
  });
}
