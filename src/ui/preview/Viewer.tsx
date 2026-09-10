import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import type { BlockRef, Rotation } from '../../domain/types';
import { usePageImage } from './usePageImage';
import { clampPageIndex, nextZoom } from './viewerModel';

export interface ViewerPage {
  ref: BlockRef;
  rotation: Rotation;
  provenance: string;
}

export interface ViewerProps {
  pages: ViewerPage[];
  onJumpToSource?(ref: BlockRef): void;
  emptyLabel?: string;
}

const VIEW_WIDTH = 800;

export function Viewer({ pages, onJumpToSource, emptyLabel }: ViewerProps) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [extraRotation, setExtraRotation] = useState<Rotation>(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Beim Wechsel von Quelle/Dokument oben beginnen.
  useLayoutEffect(() => {
    setIndex(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pages]);

  // Die angezeigte Seitenzahl folgt dem Scrollen: sichtbar ist die Seite, deren
  // Bereich die vertikale Mitte des Scrollfensters enthaelt.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const midpoint = container.scrollTop + container.clientHeight / 2;
        let best = 0;
        for (let i = 0; i < pageRefs.current.length; i++) {
          const el = pageRefs.current[i];
          if (el && el.offsetTop <= midpoint) best = i;
          else break;
        }
        setIndex(best);
      });
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pages]);

  if (pages.length === 0) {
    return <p className="grid h-full place-items-center text-sm text-neutral-500">{emptyLabel ?? 'Nichts zum Anzeigen.'}</p>;
  }

  const scrollToPage = (target: number) => {
    const i = clampPageIndex(target, pages.length);
    const el = pageRefs.current[i];
    if (el && scrollRef.current) scrollRef.current.scrollTo({ top: el.offsetTop, behavior: 'smooth' });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-1 text-sm">
        <button type="button" aria-label="Vorige Seite" disabled={index === 0} onClick={() => scrollToPage(index - 1)} className="rounded p-1 hover:bg-panel disabled:opacity-40">
          <ChevronLeft className="size-4" />
        </button>
        <label className="flex items-center gap-1">
          Seite
          <input
            type="number"
            min={1}
            max={pages.length}
            value={index + 1}
            onChange={(e) => scrollToPage(Number(e.target.value) - 1)}
            className="w-14 rounded border border-line bg-panel px-1 py-0.5"
          />
          von {pages.length}
        </label>
        <button type="button" aria-label="Naechste Seite" disabled={index >= pages.length - 1} onClick={() => scrollToPage(index + 1)} className="rounded p-1 hover:bg-panel disabled:opacity-40">
          <ChevronRight className="size-4" />
        </button>
        <span className="mx-2 h-4 w-px bg-line" />
        <button type="button" aria-label="Verkleinern" onClick={() => setZoom((z) => nextZoom(z, -1))} className="rounded p-1 hover:bg-panel">
          <ZoomOut className="size-4" />
        </button>
        <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="Vergroessern" onClick={() => setZoom((z) => nextZoom(z, 1))} className="rounded p-1 hover:bg-panel">
          <ZoomIn className="size-4" />
        </button>
        <button type="button" aria-label="Drehen" onClick={() => setExtraRotation((r) => ((r + 90) % 360) as Rotation)} className="rounded p-1 hover:bg-panel">
          <RotateCw className="size-4" />
        </button>
      </div>

      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto bg-black/30 p-4">
        <div className="flex flex-col items-center gap-6">
          {pages.map((page, i) => (
            <PageBlock
              key={`${page.ref.sourceId}:${page.ref.blockIndex}:${i}`}
              page={page}
              zoom={zoom}
              extraRotation={extraRotation}
              scrollRef={scrollRef}
              onJumpToSource={onJumpToSource}
              blockRef={(el) => (pageRefs.current[i] = el)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PageBlockProps {
  page: ViewerPage;
  zoom: number;
  extraRotation: Rotation;
  scrollRef: RefObject<HTMLDivElement | null>;
  onJumpToSource?(ref: BlockRef): void;
  blockRef(el: HTMLDivElement | null): void;
}

/**
 * Eine Seite im vertikalen Fluss. Ihr Bild wird erst gerendert, wenn sie in die
 * Naehe des Sichtfensters scrollt -- sonst wuerden hunderte Seiten auf einmal
 * rendern. Der Platzhalter haelt vorab die richtige Hoehe, damit die Scrollleiste
 * stimmt.
 */
function PageBlock({ page, zoom, extraRotation, scrollRef, onJumpToSource, blockRef }: PageBlockProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (visible) return; // einmal sichtbar, geladen bleiben.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { root: scrollRef.current, rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRef, visible]);

  const rotation = ((page.rotation + extraRotation) % 360) as Rotation;

  return (
    <div
      ref={(el) => {
        wrapRef.current = el;
        blockRef(el);
      }}
      className="w-full"
    >
      {visible ? (
        <PageImage ref={page.ref} zoom={zoom} rotation={rotation} provenance={page.provenance} />
      ) : (
        <div className="mx-auto h-[60vh] w-2/3 animate-pulse rounded bg-panel" aria-label={`${page.provenance} wird geladen`} />
      )}
      <div className="mt-1 flex items-center justify-between px-1 text-xs text-neutral-400">
        <span className="truncate">{page.provenance}</span>
        {onJumpToSource && (
          <button type="button" onClick={() => onJumpToSource(page.ref)} className="flex shrink-0 items-center gap-1 rounded px-2 py-0.5 hover:bg-panel" aria-label={`Zur Quelle: ${page.provenance}`}>
            <ExternalLink className="size-3" /> Zur Quelle
          </button>
        )}
      </div>
    </div>
  );
}

function PageImage({ ref, zoom, rotation, provenance }: { ref: BlockRef; zoom: number; rotation: Rotation; provenance: string }) {
  const { url, status } = usePageImage(ref, VIEW_WIDTH);
  if (status === 'error') {
    return <p className="grid h-40 place-items-center text-sm text-amber-400">Diese Seite konnte nicht gerendert werden.</p>;
  }
  if (!url) {
    return <div className="mx-auto h-[60vh] w-2/3 animate-pulse rounded bg-panel" aria-label={`${provenance} wird geladen`} />;
  }
  return (
    <img
      src={url}
      alt={provenance}
      className="mx-auto rounded shadow-lg"
      style={{ width: `${zoom * 100}%`, transform: `rotate(${rotation}deg)` }}
    />
  );
}
