import { useEffect, useState } from 'react';
import type { BlockRef } from '../../domain/types';
import { useObjectUrl } from '../common/useObjectUrl';
import { useServices } from '../app/StoreProvider';

export type PageImageStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PageImageResult {
  url: string | undefined;
  status: PageImageStatus;
  /** Punktmasse der Seite (Anzeigeorientierung) -- fuer die Annotationsebene. */
  pageWidth: number | undefined;
  pageHeight: number | undefined;
}

/** Rendert eine Seite in voller Ansichtsgroesse; das Thumbnail-Raster deckelt bei 180 px, der Viewer nicht. */
export function usePageImage(ref: BlockRef, targetWidth: number): PageImageResult {
  const { adapter } = useServices();
  const [blob, setBlob] = useState<Blob | undefined>(undefined);
  const [status, setStatus] = useState<PageImageStatus>('idle');
  const [size, setSize] = useState<{ width: number; height: number } | undefined>(undefined);
  const url = useObjectUrl(blob);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setStatus('loading');
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    adapter
      .renderBlock(ref, { targetWidth, dpr, signal: controller.signal })
      .then((bitmap) => {
        if (!active) return;
        setBlob(bitmap.blob);
        setSize({ width: bitmap.pageWidth, height: bitmap.pageHeight });
        setStatus('ready');
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        console.warn('Seite konnte nicht gerendert werden', error);
        setStatus('error');
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [adapter, ref.sourceId, ref.blockIndex, targetWidth]);

  return { url, status, pageWidth: size?.width, pageHeight: size?.height };
}
