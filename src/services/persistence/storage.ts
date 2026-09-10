/** Der Teil von navigator.storage, den dieser Dienst braucht. */
export interface StorageManagerLike {
  persist?(): Promise<boolean>;
  persisted?(): Promise<boolean>;
  estimate?(): Promise<{ usage?: number; quota?: number }>;
}

export type RoomCheck = { ok: true } | { ok: false; message: string };

export interface StorageGuard {
  /** Schuetzt den Workspace vor Verdraengung unter Speicherdruck. */
  requestPersistence(): Promise<boolean>;
  estimate(): Promise<{ usage: number; quota: number } | undefined>;
  ensureRoom(bytes: number): Promise<RoomCheck>;
}

const DEFAULT_MARGIN = 50 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = unit === 0 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${String(rounded).replace('.', ',')} ${units[unit]}`;
}

export function createStorageGuard(
  storage: StorageManagerLike | undefined,
  safetyMarginBytes: number = DEFAULT_MARGIN,
): StorageGuard {
  async function estimate(): Promise<{ usage: number; quota: number } | undefined> {
    if (!storage?.estimate) return undefined;
    try {
      const { usage, quota } = await storage.estimate();
      if (typeof usage !== 'number' || typeof quota !== 'number') return undefined;
      return { usage, quota };
    } catch (error) {
      console.warn('Speicherschaetzung nicht verfuegbar', error);
      return undefined;
    }
  }

  return {
    async requestPersistence() {
      if (!storage?.persist) return false;
      try {
        if (storage.persisted && (await storage.persisted())) return true;
        return await storage.persist();
      } catch (error) {
        console.warn('Dauerhafte Ablage konnte nicht angefragt werden', error);
        return false;
      }
    },

    estimate,

    async ensureRoom(bytes) {
      const current = await estimate();
      // Ohne Schaetzung wird nicht geraten: lieber importieren und im
      // Fehlerfall den Autosave-Status sprechen lassen.
      if (!current) return { ok: true };

      const free = current.quota - current.usage - safetyMarginBytes;
      if (bytes <= free) return { ok: true };

      return {
        ok: false,
        message:
          `Fuer diesen Import fehlen rund ${formatBytes(bytes - free)} Speicher im Browser. ` +
          'Loeschen Sie nicht mehr benoetigte Workspaces oder leeren Sie die Vorschau-Caches.',
      };
    },
  };
}
