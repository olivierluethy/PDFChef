export interface BlobUrlCacheDeps {
  /** Rund 300 Eintraege: genug fuer mehrere Bildschirmhoehen Raster. */
  maxEntries?: number;
  createUrl(blob: Blob): string;
  revokeUrl(url: string): void;
}

export interface BlobUrlCache {
  get(key: string): string | undefined;
  set(key: string, blob: Blob): string;
  delete(key: string): void;
  keepOnly(keys: Iterable<string>): void;
  clear(): void;
  readonly size: number;
}

export function createBlobUrlCache({
  maxEntries = 300,
  createUrl,
  revokeUrl,
}: BlobUrlCacheDeps): BlobUrlCache {
  // Map haelt die Einfuegereihenfolge: der erste Eintrag ist der aelteste.
  const urls = new Map<string, string>();

  function drop(key: string): void {
    const url = urls.get(key);
    if (url === undefined) return;
    urls.delete(key);
    // Ohne revoke waechst der Speicherverbrauch mit jedem gescrollten Raster.
    revokeUrl(url);
  }

  return {
    get(key) {
      const url = urls.get(key);
      if (url === undefined) return undefined;
      // Erneut einfuegen heisst: als zuletzt benutzt markieren.
      urls.delete(key);
      urls.set(key, url);
      return url;
    },

    set(key, blob) {
      drop(key);
      const url = createUrl(blob);
      urls.set(key, url);
      while (urls.size > maxEntries) {
        const oldest = urls.keys().next();
        if (oldest.done) break;
        drop(oldest.value);
      }
      return url;
    },

    delete: drop,

    keepOnly(keys) {
      const keep = new Set(keys);
      for (const key of [...urls.keys()]) if (!keep.has(key)) drop(key);
    },

    clear() {
      for (const key of [...urls.keys()]) drop(key);
    },

    get size() {
      return urls.size;
    },
  };
}
