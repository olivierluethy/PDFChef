export type QueueTask<T> = (signal: AbortSignal) => Promise<T>;

export interface RenderQueue {
  /**
   * Meldet eine Aufgabe an. Derselbe Schluessel liefert dieselbe Zusage
   * zurueck, statt ein zweites Mal zu rendern. Hoehere `priority` ist
   * dringender; bei Gleichstand gilt die Reihenfolge der Anmeldung.
   */
  run<T>(key: string, priority: number, task: QueueTask<T>): Promise<T>;
  cancel(key: string): void;
  /** Verwirft alles, was nicht mehr sichtbar ist. */
  keepOnly(keys: Iterable<string>): void;
  readonly stats: { running: number; waiting: number };
}

interface Entry {
  key: string;
  priority: number;
  order: number;
  running: boolean;
  controller: AbortController;
  task: QueueTask<unknown>;
  promise: Promise<unknown>;
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

function abortError(): Error {
  return new Error('Der Renderauftrag wurde abgebrochen.');
}

export function createRenderQueue({ concurrency = 3 }: { concurrency?: number } = {}): RenderQueue {
  const entries = new Map<string, Entry>();
  let running = 0;
  let counter = 0;

  function pick(): Entry | undefined {
    let best: Entry | undefined;
    for (const entry of entries.values()) {
      if (entry.running) continue;
      if (!best || entry.priority > best.priority || (entry.priority === best.priority && entry.order < best.order)) {
        best = entry;
      }
    }
    return best;
  }

  function pump(): void {
    while (running < concurrency) {
      const entry = pick();
      if (!entry) return;
      entry.running = true;
      running += 1;
      void entry
        .task(entry.controller.signal)
        .then(entry.resolve, entry.reject)
        .finally(() => {
          running -= 1;
          entries.delete(entry.key);
          pump();
        });
    }
  }

  function discard(key: string): void {
    const entry = entries.get(key);
    if (!entry) return;
    entry.controller.abort();
    if (entry.running) return; // Der Abschluss der laufenden Aufgabe raeumt selbst auf.
    entries.delete(key);
    entry.reject(abortError());
  }

  return {
    run<T>(key: string, priority: number, task: QueueTask<T>): Promise<T> {
      const existing = entries.get(key);
      if (existing) {
        // Eine wieder sichtbar gewordene Zelle darf ihre Aufgabe vordraengen.
        existing.priority = Math.max(existing.priority, priority);
        return existing.promise as Promise<T>;
      }

      let resolve: (value: unknown) => void = () => {};
      let reject: (error: unknown) => void = () => {};
      const promise = new Promise<unknown>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      entries.set(key, {
        key,
        priority,
        order: counter++,
        running: false,
        controller: new AbortController(),
        task: task as QueueTask<unknown>,
        promise,
        resolve,
        reject,
      });

      pump();
      return promise as Promise<T>;
    },

    cancel: discard,

    keepOnly(keys) {
      const keep = new Set(keys);
      for (const key of [...entries.keys()]) {
        if (!keep.has(key)) discard(key);
      }
    },

    get stats() {
      let waiting = 0;
      for (const entry of entries.values()) if (!entry.running) waiting += 1;
      return { running, waiting };
    },
  };
}
