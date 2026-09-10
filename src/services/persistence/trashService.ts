import type { Database, TrashRecord } from './db';

export interface TrashService {
  add(record: TrashRecord): Promise<void>;
  list(): Promise<TrashRecord[]>;
  remove(id: string): Promise<void>;
}

export function createTrashService(db: Database): TrashService {
  return {
    async add(record) {
      await db.put('trash', record);
    },
    async list() {
      const all = await db.getAll('trash');
      return all.sort((a, b) => b.deletedAt - a.deletedAt);
    },
    async remove(id) {
      await db.delete('trash', id);
    },
  };
}
