import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Workspace } from '../../domain/types';
import type { NodeSnapshot } from '../../domain/trash';

export const DB_NAME = 'pdf-master';
export const DB_VERSION = 2;

export interface SourceBlobRecord {
  contentHash: string;
  blob: Blob;
  byteSize: number;
  importedAt: number;
}

export interface ThumbRecord {
  key: string;
  blob: Blob;
  width: number;
  createdAt: number;
}

export interface PageTextRecord {
  key: string;
  sourceId: string;
  blockIndex: number;
  text: string;
  createdAt: number;
}

/** Ein geloeschter Ordner/Output samt Teilbaum, wiederherstellbar aus `snapshot`. */
export interface TrashRecord {
  id: string;
  kind: 'node';
  name: string;
  deletedAt: number;
  snapshot: NodeSnapshot;
}

export interface PdfMasterDb extends DBSchema {
  /** Permanent: der komplette Workspace-Record. */
  workspaces: { key: string; value: Workspace };
  /** Referenziert ueber contentHash, geloescht wenn keine Quelle mehr darauf zeigt. */
  sourceBlobs: { key: string; value: SourceBlobRecord };
  /** Verwerfbarer Cache. */
  thumbs: { key: string; value: ThumbRecord };
  /** Verwerfbarer Cache. */
  pageText: { key: string; value: PageTextRecord };
  /** Geloeschte Ordner/Output-Dokumente, bis sie wiederhergestellt oder endgueltig geloescht werden. */
  trash: { key: string; value: TrashRecord };
}

export type Database = IDBPDatabase<PdfMasterDb>;

/** `name` ist parametrisiert, damit Tests sich nicht gegenseitig sehen. */
export function openWorkspaceDb(name: string = DB_NAME): Promise<Database> {
  return openDB<PdfMasterDb>(name, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('workspaces', { keyPath: 'id' });
        db.createObjectStore('sourceBlobs', { keyPath: 'contentHash' });
        db.createObjectStore('thumbs', { keyPath: 'key' });
        db.createObjectStore('pageText', { keyPath: 'key' });
      }
      if (oldVersion < 2) {
        db.createObjectStore('trash', { keyPath: 'id' });
      }
    },
    blocked() {
      console.warn('Eine andere Registerkarte blockiert die Aktualisierung der Datenbank.');
    },
  });
}

export function thumbKey(sourceId: string, blockIndex: number, width: number): string {
  return `${sourceId}:${blockIndex}:${width}`;
}

export function pageTextKey(sourceId: string, blockIndex: number): string {
  return `${sourceId}:${blockIndex}`;
}
