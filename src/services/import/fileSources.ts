import { unzipSync } from 'fflate';

/** Eine importierbare Datei samt ihres relativen Pfads im gezogenen Ordner. */
export interface ImportCandidate {
  file: File;
  importPath?: string;
}

export interface FileEntryLike {
  readonly isFile: true;
  readonly isDirectory: false;
  readonly name: string;
  file(resolve: (file: File) => void, reject?: (error: unknown) => void): void;
}

export interface DirectoryEntryLike {
  readonly isFile: false;
  readonly isDirectory: true;
  readonly name: string;
  createReader(): {
    readEntries(resolve: (entries: EntryLike[]) => void, reject?: (error: unknown) => void): void;
  };
}

export type EntryLike = FileEntryLike | DirectoryEntryLike;

export interface DataTransferItemLike {
  readonly kind: string;
  webkitGetAsEntry(): EntryLike | null;
}

export interface FileHandleLike {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
}

export interface DirectoryHandleLike {
  readonly kind: 'directory';
  readonly name: string;
  values(): AsyncIterable<FileHandleLike | DirectoryHandleLike>;
}

const MAX_DEPTH = 8;

function joinPath(prefix: string[], name: string): string {
  return [...prefix, name].join('/');
}

function readFile(entry: FileEntryLike): Promise<File | undefined> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      (error) => {
        // Eine einzelne unlesbare Datei darf den ganzen Import nicht kippen.
        console.warn(`Datei ${entry.name} konnte nicht gelesen werden`, error);
        resolve(undefined);
      },
    );
  });
}

/** readEntries liefert nur einen Schwung pro Aufruf und muss bis zur Leere wiederholt werden. */
function readBatch(reader: ReturnType<DirectoryEntryLike['createReader']>): Promise<EntryLike[]> {
  return new Promise((resolve) => {
    reader.readEntries(
      (entries) => resolve(entries),
      (error) => {
        console.warn('Verzeichnis konnte nicht gelesen werden', error);
        resolve([]);
      },
    );
  });
}

export async function collectFromEntries(
  entries: EntryLike[],
  maxDepth: number = MAX_DEPTH,
): Promise<ImportCandidate[]> {
  const candidates: ImportCandidate[] = [];

  async function walk(entry: EntryLike, prefix: string[], depth: number): Promise<void> {
    if (depth > maxDepth) {
      console.warn(`Verzeichnis ${entry.name} ist tiefer als ${maxDepth} Ebenen und wird uebersprungen.`);
      return;
    }

    if (entry.isFile) {
      const file = await readFile(entry);
      if (!file) return;
      candidates.push({
        file,
        importPath: prefix.length > 0 ? joinPath(prefix, entry.name) : undefined,
      });
      return;
    }

    const reader = entry.createReader();
    for (;;) {
      const batch = await readBatch(reader);
      if (batch.length === 0) break;
      for (const child of batch) await walk(child, [...prefix, entry.name], depth + 1);
    }
  }

  for (const entry of entries) await walk(entry, [], 0);
  return candidates;
}

export async function collectFromDataTransfer(
  items: DataTransferItemLike[],
): Promise<ImportCandidate[]> {
  const entries: EntryLike[] = [];
  for (const item of items) {
    const entry = item.webkitGetAsEntry();
    if (entry) entries.push(entry);
  }
  return collectFromEntries(entries);
}

export function collectFromFileList(files: Iterable<File>): ImportCandidate[] {
  return [...files].map((file) => {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    return { file, importPath: relative ? relative : undefined };
  });
}

export async function collectFromDirectoryHandle(
  handle: DirectoryHandleLike,
  maxDepth: number = MAX_DEPTH,
): Promise<ImportCandidate[]> {
  const candidates: ImportCandidate[] = [];

  async function walk(directory: DirectoryHandleLike, prefix: string[], depth: number): Promise<void> {
    if (depth > maxDepth) return;
    for await (const child of directory.values()) {
      if (child.kind === 'file') {
        candidates.push({ file: await child.getFile(), importPath: joinPath(prefix, child.name) });
      } else {
        await walk(child, [...prefix, child.name], depth + 1);
      }
    }
  }

  await walk(handle, [handle.name], 0);
  return candidates;
}

export function isZip(file: { name: string; type: string }): boolean {
  return (
    file.name.toLowerCase().endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  );
}

function mimeFromExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return '';
  }
}

function isIgnoredZipEntry(entryName: string): boolean {
  const segments = entryName.split('/');
  const basename = segments[segments.length - 1];
  return segments.includes('__MACOSX') || basename === '.DS_Store';
}

export async function collectFromZip(file: File): Promise<ImportCandidate[]> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = unzipSync(bytes);
    const candidates: ImportCandidate[] = [];

    for (const [entryName, entryBytes] of Object.entries(entries)) {
      if (entryName.endsWith('/')) continue;
      if (isIgnoredZipEntry(entryName)) continue;

      const segments = entryName.split('/');
      const basename = segments[segments.length - 1];
      const entryFile = new File([entryBytes], basename, { type: mimeFromExtension(basename) });
      candidates.push({ file: entryFile, importPath: entryName });
    }

    return candidates;
  } catch (error) {
    console.warn(`Archiv ${file.name} konnte nicht entpackt werden`, error);
    return [];
  }
}

/**
 * Ersetzt ZIP-Kandidaten durch ihre entpackten inneren Kandidaten (eine
 * Ebene; verschachtelte ZIPs bleiben als unbekanntes Format bestehen und
 * werden spaeter abgelehnt).
 */
export async function expandZipCandidates(candidates: ImportCandidate[]): Promise<ImportCandidate[]> {
  const expanded: ImportCandidate[] = [];
  for (const candidate of candidates) {
    if (isZip(candidate.file)) {
      expanded.push(...(await collectFromZip(candidate.file)));
    } else {
      expanded.push(candidate);
    }
  }
  return expanded;
}
