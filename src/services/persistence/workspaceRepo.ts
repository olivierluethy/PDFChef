import type { Workspace } from '../../domain/types';
import type { Database } from './db';

export const CURRENT_SCHEMA_VERSION = 1;

export interface WorkspaceSummary {
  id: string;
  name: string;
  updatedAt: number;
}

export interface WorkspaceRepo {
  save(ws: Workspace): Promise<void>;
  load(id: string): Promise<Workspace | undefined>;
  loadMostRecent(): Promise<Workspace | undefined>;
  list(): Promise<WorkspaceSummary[]>;
  remove(id: string): Promise<void>;
  /** Alle contentHash-Werte, die noch von irgendeinem Workspace gebraucht werden. */
  usedContentHashes(): Promise<string[]>;
}

/**
 * Die Migrationsnaht. In Phase 1 gibt es nur Version 1, aber der Weg von einem
 * gespeicherten Record zum Modell fuehrt ab jetzt immer hier durch -- sonst
 * gibt es diese Stelle beim ersten Modellwechsel nicht.
 */
export function migrateWorkspaceRecord(raw: unknown): Workspace {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('This entry is not a workspace.');
  }
  const record = raw as Partial<Workspace>;
  if (
    typeof record.id !== 'string' ||
    typeof record.schemaVersion !== 'number' ||
    typeof record.sources !== 'object' ||
    typeof record.nodes !== 'object'
  ) {
    throw new Error('This entry is not a workspace.');
  }
  if (record.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      'This workspace was created with a newer version of PDFChef and cannot be opened here.',
    );
  }
  return {
    ...(record as Workspace),
    childOrder: { root: [], ...record.childOrder },
  };
}

export function createWorkspaceRepo(db: Database): WorkspaceRepo {
  async function all(): Promise<Workspace[]> {
    return db.getAll('workspaces');
  }

  return {
    async save(ws) {
      await db.put('workspaces', ws);
    },

    async load(id) {
      const raw = await db.get('workspaces', id);
      return raw === undefined ? undefined : migrateWorkspaceRecord(raw);
    },

    async loadMostRecent() {
      const records = await all();
      if (records.length === 0) return undefined;
      const newest = records.reduce((best, current) =>
        current.updatedAt > best.updatedAt ? current : best,
      );
      return migrateWorkspaceRecord(newest);
    },

    async list() {
      const records = await all();
      return records
        .map((ws) => ({ id: ws.id, name: ws.name, updatedAt: ws.updatedAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async remove(id) {
      await db.delete('workspaces', id);
    },

    async usedContentHashes() {
      const hashes = new Set<string>();
      for (const ws of await all()) {
        for (const source of Object.values(ws.sources)) hashes.add(source.contentHash);
      }
      return [...hashes];
    },
  };
}
