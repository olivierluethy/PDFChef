import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Overlay, Workspace } from '../../domain/types';
import type { NodeSnapshot } from '../../domain/trash';

export const DB_NAME = 'pdf-master';
export const DB_VERSION = 4;

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

export type LibraryItemKind = 'signature' | 'text' | 'shape' | 'group';

/**
 * Ein wiederverwendbarer Baustein: eine gespeicherte Unterschrift, ein
 * Textbaustein, eine Form oder eine Gruppe. Die Overlays sind auf eine
 * eigene 0..1-Box normalisiert (Ursprung oben links, `x`/`y` beginnen bei 0),
 * damit sie unabhaengig davon, wo sie gespeichert wurden, wieder eingefuegt
 * werden koennen. `thumbDataUrl` ist eine kleine Vorschau fuer die Liste.
 */
export interface LibraryItemRecord {
  id: string;
  kind: LibraryItemKind;
  name: string;
  createdAt: number;
  /** Seitenverhaeltnis (Breite/Hoehe) der normalisierten Box. */
  aspect: number;
  overlays: Overlay[];
  thumbDataUrl?: string;
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
  /** Permanent: wiederverwendbare Bausteine (Unterschriften, Textbausteine, Formen, Gruppen). */
  library: { key: string; value: LibraryItemRecord };
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
      // v3 fuegt hier keine Stores hinzu. Die Version wird dennoch mitgezaehlt,
      // damit eine bereits auf v3 angehobene DB (z.B. aus einem Feature-Branch)
      // geoeffnet werden kann, statt mit einem VersionError abzustuerzen.
      if (oldVersion < 4) {
        db.createObjectStore('library', { keyPath: 'id' });
      }
    },
    blocked() {
      console.warn('Eine andere Registerkarte blockiert die Aktualisierung der Datenbank.');
    },
    blocking(_currentVersion, _blockedVersion, event) {
      // Eine neuere Version will oeffnen; diese aeltere Verbindung schliessen,
      // sonst haengt das Upgrade, bis der alte Tab manuell geschlossen wird.
      console.warn('Datenbank wird fuer ein Upgrade geschlossen (neuere Version geoeffnet).');
      (event.target as IDBDatabase | null)?.close();
    },
  });
}

export function thumbKey(sourceId: string, blockIndex: number, width: number): string {
  return `${sourceId}:${blockIndex}:${width}`;
}

export function pageTextKey(sourceId: string, blockIndex: number): string {
  return `${sourceId}:${blockIndex}`;
}
