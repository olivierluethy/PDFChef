import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Maximize,
  MoreVertical,
  PenLine,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { BlockRef, ItemId, Overlay, Rotation } from '../../domain/types';
import type { DragOrigin } from '../workspace/dragLogic';
import { IconButton } from '../common/IconButton';
import { Menu } from '../common/Menu';
import { cx } from '../common/cx';
import { FillLayer } from './FillLayer';
import { usePageImage } from './usePageImage';
import { clampPageIndex, nextZoom } from './viewerModel';

export interface ViewerPage {
  ref: BlockRef;
  rotation: Rotation;
  sourceName: string;
  pageNumber: number;
  /** Wenn gesetzt, laesst sich diese Seite direkt aus dem Betrachter herausziehen. */
  dragOrigin?: DragOrigin;
  /** Die Seiteninstanz, falls diese Seite ausgefuellt werden kann (Ausgabe). */
  itemId?: ItemId;
  /** Vorhandene Felder/Unterschriften dieser Seite. */
  overlays?: Overlay[];
  /** true, wenn diese Seite ausgefuellt werden darf (Ausgabe, ungedreht). */
  fillable?: boolean;
}

export interface ViewerProps {
  pages: ViewerPage[];
  onJumpToSource?(ref: BlockRef): void;
  /** Startet einen Seiten-Drag aus dem Betrachter an das gewuenschte Ziel. */
  onPagePointerDown?(event: React.PointerEvent, origin: DragOrigin): void;
  onAddOverlay?(itemId: ItemId, overlay: Overlay): void;
  onUpdateOverlay?(itemId: ItemId, overlayId: string, patch: Partial<Overlay>): void;
  onRemoveOverlay?(itemId: ItemId, overlayId: string): void;
  emptyLabel?: string;
}

const VIEW_WIDTH = 800;
const COMPACT_WIDTH = 440;
const clampZoom = (z: number) => Math.min(4, Math.max(0.25, z));

export function Viewer({
  pages,
  onJumpToSource,
  onPagePointerDown,
  onAddOverlay,
  onUpdateOverlay,
  onRemoveOverlay,
  emptyLabel,
}: ViewerProps) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [extraRotation, setExtraRotation] = useState<Rotation>(0);
  const [scrolling, setScrolling] = useState(false);
  const [compact, setCompact] = useState(false);
  const [fillMode, setFillMode] = useState(false);

  const anyFillable = pages.some((page) => page.fillable);
  const filling = fillMode && anyFillable;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollStop = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useLayoutEffect(() => {
    setIndex(0);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pages]);

  // Panelbreite bestimmt, ob Drehen/Vollbild ins Ueberlaufmenue wandern.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setCompact(el.clientWidth < COMPACT_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Sichtbare Seitenzahl folgt dem Scrollen; die Sticky-Pille blendet 1s nach Stopp aus.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let frame = 0;
    const onScroll = () => {
      setScrolling(true);
      clearTimeout(scrollStop.current);
      scrollStop.current = setTimeout(() => setScrolling(false), 1000);
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
    return (
      <p className="grid h-full place-items-center px-8 text-center text-[13px] text-text-tertiary">
        {emptyLabel ?? 'Nichts zum Anzeigen.'}
      </p>
    );
  }

  const scrollToPage = (target: number) => {
    const i = clampPageIndex(target, pages.length);
    const el = pageRefs.current[i];
    if (el && scrollRef.current)
      scrollRef.current.scrollTo({ top: el.offsetTop - 24, behavior: 'smooth' });
  };

  const fitWidth = () => setZoom(1);
  const fitPage = () => {
    const area = scrollRef.current;
    const pageEl = pageRefs.current[index]?.querySelector('img');
    if (area && pageEl)
      setZoom((z) => clampZoom((z * (area.clientHeight - 64)) / pageEl.clientHeight));
  };
  const actualSize = () => {
    const area = scrollRef.current;
    if (area) setZoom(clampZoom(VIEW_WIDTH / (area.clientWidth - 48)));
  };
  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };
  const rotate = () => setExtraRotation((r) => ((r + 90) % 360) as Rotation);

  return (
    <div ref={rootRef} className="flex h-full flex-col bg-surface-panel">
      <div className="flex h-10 shrink-0 items-center gap-1 overflow-hidden whitespace-nowrap border-b border-line-structural px-2">
        <IconButton
          size="sm"
          icon={ChevronLeft}
          label="Vorige Seite"
          disabled={index === 0}
          onClick={() => scrollToPage(index - 1)}
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={pages.length}
            value={index + 1}
            onChange={(e) => scrollToPage(Number(e.target.value) - 1)}
            aria-label="Seite"
            className="h-7 w-12 rounded-md bg-surface-raised px-1.5 text-center font-mono text-[12.5px] tabular-nums text-text-primary ring-1 ring-line-structural [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="font-mono text-[12.5px] tabular-nums text-text-secondary">
            /{pages.length}
          </span>
        </div>
        <IconButton
          size="sm"
          icon={ChevronRight}
          label="Nächste Seite"
          disabled={index >= pages.length - 1}
          onClick={() => scrollToPage(index + 1)}
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line-structural" />

        <div className="flex items-center rounded-md bg-surface-canvas ring-1 ring-line-hairline">
          <IconButton
            size="sm"
            icon={ZoomOut}
            label="Verkleinern"
            onClick={() => setZoom((z) => clampZoom(nextZoom(z, -1)))}
          />
          <span className="w-14 text-center font-mono text-[12px] tabular-nums text-text-secondary">
            {Math.round(zoom * 100)} %
          </span>
          <IconButton
            size="sm"
            icon={ZoomIn}
            label="Vergrössern"
            onClick={() => setZoom((z) => clampZoom(nextZoom(z, 1)))}
          />
        </div>

        <Menu
          align="start"
          minWidth={180}
          items={[
            { id: 'page', label: 'Seite einpassen', onSelect: fitPage },
            { id: 'width', label: 'Breite einpassen', onSelect: fitWidth },
            { id: 'actual', label: 'Originalgrösse', onSelect: actualSize },
          ]}
          renderTrigger={({ ref, toggle, ariaProps }) => (
            <button
              ref={ref}
              type="button"
              onClick={toggle}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              {...ariaProps}
            >
              Einpassen <ChevronDown className="size-3.5" aria-hidden />
            </button>
          )}
        />

        <span aria-hidden className="mx-1 h-5 w-px bg-line-structural" />

        {anyFillable && (
          <button
            type="button"
            onClick={() => setFillMode((value) => !value)}
            className={cx(
              'mr-1 inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium',
              filling
                ? 'bg-accent text-on-accent'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
            )}
          >
            <PenLine className="size-3.5" aria-hidden /> Ausfüllen
          </button>
        )}

        {compact ? (
          <Menu
            align="end"
            minWidth={160}
            items={[
              { id: 'rotate', label: 'Drehen', icon: RotateCw, onSelect: rotate },
              { id: 'fullscreen', label: 'Vollbild', icon: Maximize, onSelect: toggleFullscreen },
            ]}
            renderTrigger={({ ref, toggle, ariaProps }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                aria-label="Weitere Ansichtsoptionen"
                className="inline-grid size-7 place-items-center rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                {...ariaProps}
              >
                <MoreVertical className="size-4" aria-hidden />
              </button>
            )}
          />
        ) : (
          <>
            <IconButton size="sm" icon={RotateCw} label="Drehen" onClick={rotate} />
            <IconButton size="sm" icon={Maximize} label="Vollbild" onClick={toggleFullscreen} />
          </>
        )}
      </div>

      <div
        ref={scrollRef}
        className="scroll-fade-y relative min-h-0 flex-1 overflow-auto bg-surface-canvas px-6 pb-10 pt-6"
      >
        <div className="mx-auto flex max-w-full flex-col gap-5">
          {pages.map((page, i) => (
            <PageBlock
              key={`${page.ref.sourceId}:${page.ref.blockIndex}:${i}`}
              page={page}
              zoom={zoom}
              extraRotation={extraRotation}
              scrollRef={scrollRef}
              filling={filling}
              onJumpToSource={onJumpToSource}
              onPagePointerDown={onPagePointerDown}
              onAddOverlay={onAddOverlay}
              onUpdateOverlay={onUpdateOverlay}
              onRemoveOverlay={onRemoveOverlay}
              blockRef={(el) => (pageRefs.current[i] = el)}
            />
          ))}
        </div>

        {/* Sticky-Seitenanzeige, mittig unten, verschwindet nach dem Scrollen. */}
        <div
          aria-hidden
          className={cx(
            'pointer-events-none sticky bottom-3 left-1/2 z-10 mx-auto w-max -translate-x-0 rounded-full bg-surface-raised px-2.5 py-1 font-mono text-[11.5px] tabular-nums text-text-secondary shadow-[var(--float-shadow)] ring-1 ring-line-structural transition-opacity duration-300',
            scrolling ? 'opacity-100' : 'opacity-0',
          )}
        >
          {index + 1} / {pages.length}
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
  filling: boolean;
  onJumpToSource?(ref: BlockRef): void;
  onPagePointerDown?(event: React.PointerEvent, origin: DragOrigin): void;
  onAddOverlay?(itemId: ItemId, overlay: Overlay): void;
  onUpdateOverlay?(itemId: ItemId, overlayId: string, patch: Partial<Overlay>): void;
  onRemoveOverlay?(itemId: ItemId, overlayId: string): void;
  blockRef(el: HTMLDivElement | null): void;
}

function PageBlock({
  page,
  zoom,
  extraRotation,
  scrollRef,
  filling,
  onJumpToSource,
  onPagePointerDown,
  onAddOverlay,
  onUpdateOverlay,
  onRemoveOverlay,
  blockRef,
}: PageBlockProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || visible) return;
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
      className="group w-full"
    >
      {/* Herkunft ueber dem Blatt -- eindeutig zugeordnet, nicht zwischen zweien. */}
      <div className="mb-1.5 flex items-baseline gap-2 px-0.5">
        <span className="min-w-0 truncate text-[12px] text-text-secondary" title={page.sourceName}>
          {page.sourceName}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[11.5px] tabular-nums text-text-secondary">
          Seite {page.pageNumber}
        </span>
        {onJumpToSource && (
          <button
            type="button"
            onClick={() => onJumpToSource(page.ref)}
            className="shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] text-text-secondary opacity-0 transition-opacity hover:bg-surface-hover hover:text-text-primary focus-visible:opacity-100 group-hover:opacity-100 inline-flex"
            aria-label={`Zur Quelle: ${page.sourceName}, Seite ${page.pageNumber}`}
          >
            <ExternalLink className="size-3.5" aria-hidden /> Zur Quelle
          </button>
        )}
      </div>
      {visible ? (
        <div
          className={page.dragOrigin ? 'cursor-grab' : undefined}
          onPointerDown={(event) => {
            // Nur die Bildflaeche startet den Drag -- der Kopf mit "Zur Quelle" bleibt klickbar.
            if (page.dragOrigin) onPagePointerDown?.(event, page.dragOrigin);
          }}
        >
          <PageImage
            ref={page.ref}
            zoom={zoom}
            rotation={rotation}
            alt={`${page.sourceName}, Seite ${page.pageNumber}`}
          >
            {page.fillable && page.itemId && (
              <FillLayer
                overlays={page.overlays ?? []}
                active={filling}
                onAdd={(overlay) => onAddOverlay?.(page.itemId!, overlay)}
                onUpdate={(overlayId, patch) => onUpdateOverlay?.(page.itemId!, overlayId, patch)}
                onRemove={(overlayId) => onRemoveOverlay?.(page.itemId!, overlayId)}
              />
            )}
          </PageImage>
        </div>
      ) : (
        <div
          className="mx-auto h-[60vh] w-2/3 animate-pulse rounded-[2px] bg-surface-raised"
          aria-label={`${page.sourceName} wird geladen`}
        />
      )}
    </div>
  );
}

function PageImage({
  ref,
  zoom,
  rotation,
  alt,
  children,
}: {
  ref: BlockRef;
  zoom: number;
  rotation: Rotation;
  alt: string;
  children?: React.ReactNode;
}) {
  const { url, status } = usePageImage(ref, VIEW_WIDTH);
  if (status === 'error') {
    return (
      <p className="grid h-40 place-items-center text-[13px] text-danger">
        Diese Seite konnte nicht gerendert werden.
      </p>
    );
  }
  if (!url) {
    return (
      <div
        className="mx-auto h-[60vh] w-2/3 animate-pulse rounded-[2px] bg-surface-raised"
        aria-label={`${alt} wird geladen`}
      />
    );
  }
  return (
    <div className="flex justify-center">
      {/* Der Wrapper schrumpft auf die Bildgroesse, damit die Ausfuell-Schicht
          (children) deckungsgleich ueber dem Blatt liegt. */}
      <div className="relative inline-block max-w-full" style={{ width: `${zoom * 100}%` }}>
        <img
          src={url}
          alt={alt}
          draggable={false}
          className="paper-sheet block w-full"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
        {children}
      </div>
    </div>
  );
}
