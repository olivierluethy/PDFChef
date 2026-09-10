export type ExportArtifact = { kind: 'directory' } | { kind: 'zip'; blob: Blob; fileName: string };

export interface ExportWriter {
  /** `path` ist relativ und enthaelt bereits sanitisierte, kollisionsfreie Namen. */
  writeFile(path: string[], fileName: string, bytes: Uint8Array): Promise<void>;
  finalize(): Promise<ExportArtifact>;
}
