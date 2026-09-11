import { useEffect, useRef, useState } from 'react';
import type { Annotation, BlockRef } from '../../domain/types';
import { THUMBNAIL_WIDTH } from '../../services/thumbnails/thumbnailService';
import { useServices } from '../app/StoreProvider';
import { AnnotationLayer } from '../annotations/AnnotationLayer';
import { useFontEntries } from '../text/useFontEntries';
import { useElementSize } from './useElementSize';

export interface ThumbnailProps {
  blockRef: BlockRef;
  width?: number;
  priority?: number;
  alt: string;
  /** Annotationen dieser Seiten-Instanz -- live (nur Anzeige) ueber das Thumbnail gelegt. */
  annotations?: Annotation[];
}

/** Bildflaeche innerhalb eines object-contain-Bildes (Letterbox beruecksichtigt). */
function containRect(containerW: number, containerH: number, natW: number, natH: number) {
  const scale = Math.min(containerW / natW, containerH / natH);
  const width = natW * scale;
  const height = natH * scale;
  return { left: (containerW - width) / 2, top: (containerH - height) / 2, width, height };
}

export function Thumbnail({ blockRef, width = THUMBNAIL_WIDTH, priority = 0, alt, annotations }: ThumbnailProps) {
  const { thumbnails } = useServices();
  const [url, setUrl] = useState<string | undefined>(() => thumbnails.peek(blockRef, width));
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const box = useElementSize(containerRef);
  const hasAnnotations = Boolean(annotations && annotations.length > 0);
  const fontEntries = useFontEntries();

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
        console.debug('Thumbnail nicht gerendert', error);
      });
    return () => {
      active = false;
      thumbnails.cancel(blockRef, width);
    };
  }, [thumbnails, blockRef.sourceId, blockRef.blockIndex, width, priority]);

  if (!url) {
    return <div className="h-full w-full animate-pulse rounded bg-panel" aria-label={`${alt} wird geladen`} />;
  }

  const content = natural ? containRect(box.width, box.height, natural.w, natural.h) : null;

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <img
        src={url}
        alt={alt}
        className="h-full w-full rounded object-contain"
        draggable={false}
        onLoad={(event) => setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
      />
      {hasAnnotations && content && box.width > 0 && (
        <div style={{ position: 'absolute', left: content.left, top: content.top, width: content.width, height: content.height }}>
          <AnnotationLayer
            annotations={annotations ?? []}
            box={{ width: content.width, height: content.height }}
            fontEntries={fontEntries}
            editable={false}
          />
        </div>
      )}
    </div>
  );
}
