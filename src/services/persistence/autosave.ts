import type { Workspace } from '../../domain/types';

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: number }
  | { kind: 'error'; reason: 'quota' | 'unknown'; message: string };

export interface AutosaveDeps {
  save(ws: Workspace): Promise<void>;
  /** Ruhezeit nach der letzten Aenderung. */
  delayMs?: number;
  now?(): number;
}

export interface Autosave {
  schedule(ws: Workspace): void;
  /** Schreibt sofort; das UI ruft dies bei visibilitychange. */
  flush(): Promise<void>;
  getStatus(): SaveStatus;
  subscribe(listener: (status: SaveStatus) => void): () => void;
  dispose(): void;
}

export function isQuotaError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: string }).name === 'QuotaExceededError'
  );
}

export function describeSaveStatus(status: SaveStatus): string {
  switch (status.kind) {
    case 'idle':
      return '';
    case 'pending':
    case 'saving':
      return 'Saving...';
    case 'saved':
      return 'Saved locally';
    case 'error':
      return status.message;
  }
}

export function createAutosave({
  save,
  delayMs = 400,
  now = () => Date.now(),
}: AutosaveDeps): Autosave {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Workspace | undefined;
  let draining: Promise<void> | undefined;
  let disposed = false;
  let status: SaveStatus = { kind: 'idle' };
  const listeners = new Set<(status: SaveStatus) => void>();

  function setStatus(next: SaveStatus): void {
    status = next;
    for (const listener of listeners) listener(next);
  }

  async function loop(): Promise<void> {
    // Solange schreiben, bis nichts mehr aufgelaufen ist: waehrend eines
    // Schreibvorgangs kann eine neuere Fassung eingetroffen sein.
    while (pending && !disposed) {
      const ws = pending;
      pending = undefined;
      setStatus({ kind: 'saving' });
      try {
        await save(ws);
        setStatus({ kind: 'saved', at: now() });
      } catch (error) {
        console.error('Autosave failed', error);
        setStatus(
          isQuotaError(error)
            ? { kind: 'error', reason: 'quota', message: 'Not saved -- storage full' }
            : {
                kind: 'error',
                reason: 'unknown',
                message: 'Not saved -- an error occurred',
              },
        );
      }
    }
  }

  function drain(): Promise<void> {
    if (!draining) {
      draining = loop().finally(() => {
        draining = undefined;
      });
    }
    return draining;
  }

  return {
    schedule(ws) {
      if (disposed) return;
      pending = ws;
      setStatus({ kind: 'pending' });
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void drain();
      }, delayMs);
    },

    async flush() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      await drain();
    },

    getStatus() {
      return status;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending = undefined;
      listeners.clear();
    },
  };
}
