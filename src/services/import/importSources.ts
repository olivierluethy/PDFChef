import type { AdapterRegistry } from '../../adapters/types';
import type { SourceDocument, SourceId } from '../../domain/types';
import type { SourceBlobStore } from '../persistence/sourceBlobStore';
import type { StorageGuard } from '../persistence/storage';
import type { ImportCandidate } from './fileSources';

export interface ImportDeps {
  registry: AdapterRegistry;
  blobStore: SourceBlobStore;
  storage: StorageGuard;
  hash(bytes: Uint8Array): Promise<string>;
  newId(): SourceId;
}

export interface ImportRejection {
  name: string;
  message: string;
}

export interface ImportReport {
  sources: SourceDocument[];
  rejected: ImportRejection[];
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Liest die Kandidaten ein und liefert fertige SourceDocuments. Der Workspace
 * wird hier nicht angefasst -- das erledigt der Command `importSources`.
 */
export async function importCandidates(
  candidates: ImportCandidate[],
  deps: ImportDeps,
): Promise<ImportReport> {
  const report: ImportReport = { sources: [], rejected: [] };
  if (candidates.length === 0) return report;

  const totalBytes = candidates.reduce((sum, candidate) => sum + candidate.file.size, 0);
  const room = await deps.storage.ensureRoom(totalBytes);
  if (!room.ok) {
    // Lieber vorher klar ablehnen als spaeter in einen QuotaExceededError laufen.
    return {
      sources: [],
      rejected: candidates.map((candidate) => ({ name: candidate.file.name, message: room.message })),
    };
  }

  // Schuetzt den Workspace vor Verdraengung unter Speicherdruck; einmal pro Import genuegt.
  await deps.storage.requestPersistence();

  for (const candidate of candidates) {
    const { file } = candidate;
    const adapter = deps.registry.adapterFor({ name: file.name, type: file.type, size: file.size });
    if (!adapter) {
      report.rejected.push({
        name: file.name,
        message: 'This file format is not supported yet.',
      });
      continue;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const contentHash = await deps.hash(bytes);
      const probe = await adapter.probe(file);

      // Gleicher Inhalt, ein Blob: der Doppelimport derselben Datei kostet
      // keinen zweiten Speicherplatz. Eine zweite Quelle entsteht trotzdem --
      // Duplikaterkennung ist ausdruecklich Phase 2.
      if (probe.status === 'ready') {
        await deps.blobStore.put(contentHash, file);
      }

      report.sources.push({
        id: deps.newId(),
        kind: adapter.kind,
        name: file.name,
        ...(candidate.importPath ? { importPath: candidate.importPath } : {}),
        blobKey: contentHash,
        byteSize: file.size,
        contentHash,
        blockKind: probe.blockKind,
        blockCount: probe.blockCount,
        blockRotations: probe.blockRotations,
        ...(probe.outline ? { outline: probe.outline } : {}),
        status: probe.status,
        ...(probe.statusDetail ? { statusDetail: probe.statusDetail } : {}),
      });
    } catch (error) {
      console.error(`Import of ${file.name} failed`, error);
      report.rejected.push({ name: file.name, message: 'This file could not be read.' });
    }
  }

  return report;
}
