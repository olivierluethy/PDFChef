import { describe, expect, it } from 'vitest';
import { createRenderQueue } from './renderQueue';

/** Ein Task, der erst aufloest, wenn wir es ihm von aussen erlauben. */
function deferredTask<T>(value: T) {
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });
  let started = false;
  const task = async (signal: AbortSignal): Promise<T> => {
    started = true;
    await gate;
    if (signal.aborted) throw new Error('aborted');
    return value;
  };
  return { task, release, get started() { return started; } };
}

describe('createRenderQueue', () => {
  it('rendert eine erneut angeforderte Zelle, deren laufender Auftrag zwischendurch abgebrochen wurde', async () => {
    const queue = createRenderQueue({ concurrency: 1 });

    // Erster Mount: Auftrag laeuft an.
    const first = deferredTask('bild');
    const p1 = queue.run('cell', 0, first.task);
    p1.catch(() => {}); // abgebrochener erster Versuch darf ungehandelt rejecten
    expect(first.started).toBe(true);

    // StrictMode-Unmount: der laufende Auftrag wird abgebrochen.
    queue.cancel('cell');

    // Remount: dieselbe Zelle fordert erneut an. Das darf NICHT den
    // abgebrochenen Auftrag zurueckliefern, sondern muss frisch rendern.
    const second = deferredTask('bild');
    const p2 = queue.run('cell', 0, second.task);

    first.release();
    second.release();

    await expect(p2).resolves.toBe('bild');
  });

  it('behaelt einen laufenden Auftrag fuer eine weiterhin sichtbare Zelle', async () => {
    const queue = createRenderQueue({ concurrency: 2 });
    const only = deferredTask('bild');
    const p = queue.run('a', 0, only.task);
    only.release();
    await expect(p).resolves.toBe('bild');
  });
});
