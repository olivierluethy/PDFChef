import type { ExportArtifact, ExportWriter } from './writer';

export interface WritableLike {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

export interface FileHandleLike {
  createWritable(): Promise<WritableLike>;
}

export interface DirectoryHandleLike {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>;
}

export function createFsAccessWriter(root: DirectoryHandleLike): ExportWriter {
  return {
    async writeFile(path, fileName, bytes) {
      let directory = root;
      for (const segment of path) {
        directory = await directory.getDirectoryHandle(segment, { create: true });
      }
      const file = await directory.getFileHandle(fileName, { create: true });
      const writable = await file.createWritable();
      await writable.write(bytes);
      await writable.close();
    },
    async finalize(): Promise<ExportArtifact> {
      return { kind: 'directory' };
    },
  };
}
