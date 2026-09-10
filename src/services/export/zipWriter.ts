import { zipSync } from 'fflate';
import type { ExportArtifact, ExportWriter } from './writer';

export function createZipWriter(zipName: string): ExportWriter {
  // fflate erwartet ein flaches Objekt mit "/"-getrennten Pfaden als Schluessel.
  const files: Record<string, Uint8Array> = {};

  return {
    async writeFile(path, fileName, bytes) {
      const key = [...path, fileName].join('/');
      files[key] = bytes;
    },
    async finalize(): Promise<ExportArtifact> {
      const zipped = zipSync(files);
      return { kind: 'zip', blob: new Blob([zipped], { type: 'application/zip' }), fileName: zipName };
    },
  };
}
