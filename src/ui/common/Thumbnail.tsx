import { useEffect, useState } from 'react';
import type { BlockRef } from '../../domain/types';
import { THUMBNAIL_WIDTH } from '../../services/thumbnails/thumbnailService';
import { useServices } from '../app/StoreProvider';

export interface ThumbnailProps {
  blockRef: BlockRef;
  width?: number;
  priority?: number;
  alt: string;
}

export function Thumbnail({ blockRef, width = THUMBNAIL_WIDTH, priority = 0, alt }: ThumbnailProps) {
  const { thumbnails } = useServices();
  // Synchroner Blick in den Speicher-Cache: ein bereits gerendertes Thumbnail
  // erscheint ohne Flackern und ohne einen zweiten Renderauftrag.
  const [url, setUrl] = useState<string | undefined>(() => thumbnails.peek(blockRef, width));

  useEffect(() => {
    let active = true;
    const cached = thumbnails.peek(blockRef, width);
    if (cached) {
      setUrl(cached);
      return;
    }
    thumbnails
      .request({ ref: blockRef, width, priority })
      .then((fresh) => {
        if (active) setUrl(fresh);
      })
      .catch((error) => {
        // Ein abgebrochener Auftrag (Wegscrollen) ist kein Fehler fuer den Nutzer.
        console.debug('Thumbnail nicht gerendert', error);
      });
    return () => {
      active = false;
      thumbnails.cancel(blockRef, width);
    };
  }, [thumbnails, blockRef.sourceId, blockRef.blockIndex, width, priority]);

  if (!url) {
    // Der Platzhalter liegt auf weissem Papier: ein heller Schimmer statt dunkler Flaeche.
    return <div className="h-full w-full animate-pulse rounded-[2px] bg-black/[0.06]" aria-label={`${alt} wird geladen`} />;
  }
  return <img src={url} alt={alt} className="h-full w-full rounded-[2px] object-contain" draggable={false} />;
}
