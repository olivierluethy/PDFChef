export interface PoolOptions<T> {
  load(key: string): Promise<T>;
  destroy(doc: T): Promise<void> | void;
  /** Mehr offene Dokumente bringen keinen Nutzen, kosten aber Speicher. */
  maxOpen?: number;
  now?(): number;
}

export interface DocumentPool<T> {
  /**
   * Fuehrt `fn` mit dem Dokument aus und haelt es solange gegen Verdraengung.
   * Bewusst kein `acquire`: eine vergessene Rueckgabe wuerde den Pool
   * dauerhaft blockieren.
   */
  use<R>(key: string, fn: (doc: T) => Promise<R>): Promise<R>;
  drop(key: string): Promise<void>;
  clear(): Promise<void>;
  readonly openKeys: string[];
}

interface PoolEntry<T> {
  value: Promise<T>;
  leases: number;
  usedAt: number;
}

export function createDocumentPool<T>({
  load,
  destroy,
  maxOpen = 4,
  now = () => Date.now(),
}: PoolOptions<T>): DocumentPool<T> {
  const entries = new Map<string, PoolEntry<T>>();

  async function close(key: string): Promise<void> {
    const entry = entries.get(key);
    if (!entry) return;
    entries.delete(key);
    try {
      await destroy(await entry.value);
    } catch (error) {
      // Ein bereits kaputtes Dokument muss sich nicht sauber schliessen lassen.
      console.warn('Dokument konnte nicht geschlossen werden', error);
    }
  }

  async function evict(): Promise<void> {
    while (entries.size > maxOpen) {
      let victim: string | undefined;
      let oldest = Number.POSITIVE_INFINITY;
      for (const [key, entry] of entries) {
        if (entry.leases > 0) continue;
        if (entry.usedAt < oldest) {
          oldest = entry.usedAt;
          victim = key;
        }
      }
      // Sind alle Dokumente in Benutzung, bleibt der Pool vorlaeufig zu gross.
      if (victim === undefined) return;
      await close(victim);
    }
  }

  return {
    async use<R>(key: string, fn: (doc: T) => Promise<R>): Promise<R> {
      let entry = entries.get(key);
      if (!entry) {
        // Das Promise selbst wird gespeichert, damit gleichzeitige Zugriffe
        // dasselbe Dokument bekommen statt zwei zu laden.
        entry = { value: load(key), leases: 0, usedAt: now() };
        entries.set(key, entry);
      }
      entry.leases += 1;
      entry.usedAt = now();

      let doc: T;
      try {
        doc = await entry.value;
      } catch (error) {
        entry.leases -= 1;
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      }

      try {
        return await fn(doc);
      } finally {
        entry.leases -= 1;
        entry.usedAt = now();
        await evict();
      }
    },
    drop: close,
    async clear() {
      for (const key of [...entries.keys()]) await close(key);
    },
    get openKeys() {
      return [...entries.keys()];
    },
  };
}
