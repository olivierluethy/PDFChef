import type { OutlineNode } from '../../domain/types';
import type { DetectedField, TextSpan } from '../types';

/** Zielflaeche eines Renders. In Produktion ein OffscreenCanvas. */
export interface RenderSurface {
  readonly width: number;
  readonly height: number;
  readonly context: OffscreenCanvasRenderingContext2D;
  toBlob(type: string, quality: number): Promise<Blob>;
}

export type CreateSurface = (width: number, height: number) => RenderSurface;

export interface PdfPageHandle {
  /** Rotation der Quellseite laut /Rotate, in Grad. */
  readonly rotation: number;
  size(scale: number): { width: number; height: number };
  render(surface: RenderSurface, scale: number, signal?: AbortSignal): Promise<void>;
  text(): Promise<TextSpan[]>;
  /** Erkannte AcroForm-Felder als Bruchteile der Anzeige-Seite (oben links). */
  fields(): Promise<DetectedField[]>;
  /** Gibt Seiten-interne Caches frei; das Dokument bleibt offen. */
  release(): void;
}

export interface PdfDocumentHandle {
  readonly pageCount: number;
  /** 0-basiert, wie ueberall im Projekt -- pdf.js selbst ist 1-basiert. */
  page(blockIndex: number): Promise<PdfPageHandle>;
  outline(): Promise<OutlineNode[] | undefined>;
  destroy(): Promise<void>;
}

export interface PdfEngine {
  open(bytes: Uint8Array): Promise<PdfDocumentHandle>;
  /** Trennt "passwortgeschuetzt" von "kaputt" -- die Meldungen sind verschieden. */
  isPasswordError(error: unknown): boolean;
}
