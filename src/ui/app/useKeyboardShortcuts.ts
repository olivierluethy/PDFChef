import { useEffect } from 'react';
import { isOutput, type Workspace } from '../../domain/types';
import type { SelectionScope } from '../../services/store/selection';
import { useSelectionStore, useWorkspaceStore } from './StoreProvider';

/** Die Ordnung des fokussierten Rasters, damit Ctrl/Cmd+A "alles hier" waehlt. */
export function orderOfScope(ws: Workspace, scope: SelectionScope | null): string[] {
  if (scope?.kind === 'source') {
    const source = ws.sources[scope.sourceId];
    return source ? Array.from({ length: source.blockCount }, (_, i) => String(i)) : [];
  }
  if (scope?.kind === 'output') {
    const node = ws.nodes[scope.outputId];
    return node && isOutput(node) ? [...node.items] : [];
  }
  return [];
}

export interface ShortcutHandlers {
  onSearch?(): void;
  onPreview?(): void;
  onRename?(): void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}): void {
  const workspaceStore = useWorkspaceStore();
  const selectionStore = useSelectionStore();

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      const element = target as HTMLElement | null;
      return !!element && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable);
    }

    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      // In Eingabefeldern gelten die Kuerzel nicht -- dort tippt der Nutzer.
      if (isTypingTarget(event.target) && event.key !== 'Escape') return;

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) workspaceStore.getState().redo();
        else workspaceStore.getState().undo();
        return;
      }
      if (meta && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        const scope = selectionStore.getState().scope;
        if (scope) selectionStore.getState().selectAll(scope, orderOfScope(workspaceStore.getState().workspace, scope));
        return;
      }
      if (meta && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        handlers.onSearch?.();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selection = selectionStore.getState();
        if (selection.scope?.kind === 'output' && selection.ids.length > 0) {
          event.preventDefault();
          workspaceStore.getState().dispatch({ type: 'removeItems', itemIds: selection.ids });
        }
        return;
      }
      if (event.key === 'Escape') {
        selectionStore.getState().clear();
        return;
      }
      if (event.key === 'F2') {
        handlers.onRename?.();
        return;
      }
      if (event.key === ' ') {
        handlers.onPreview?.();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [workspaceStore, selectionStore, handlers]);
}
