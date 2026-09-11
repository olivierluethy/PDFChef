import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  PenLine,
  RotateCw,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { Annotation, AnnotationId, BlockRef, ItemId, Rotation } from '../../domain/types';
import { newId } from '../../domain/ids';
import { AnnotationLayer } from '../annotations/AnnotationLayer';
import { AnnotationPanel } from '../annotations/AnnotationPanel';
import { SignaturePad, type SignatureResult } from '../annotations/SignaturePad';
import { newSignatureAnnotation, newTextAnnotation } from '../annotations/annotationModel';
import { defaultFontId, type FontManifestEntry } from '../text/fontCatalog';
import { useElementSize } from '../common/useElementSize';
import { useServices } from '../app/StoreProvider';
import { usePageImage } from './usePageImage';
import { clampPageIndex, nextZoom } from './viewerModel';

export interface ViewerPage {
  ref: BlockRef;
  rotation: Rotation;
  provenance: string;
  /** Vorhanden => diese Seite ist eine Ausgabe-Instanz und annotierbar. */
  itemId?: ItemId;
  annotations?: Annotation[];
}

export interface ViewerProps {
  pages: ViewerPage[];
  onJumpToSource?(ref: BlockRef): void;
  emptyLabel?: string;
  /** Editierbar nur, wenn Fonts geladen sind und Seiten eine itemId tragen. */
  fontEntries?: FontManifestEntry[];
  onAnnotationAdd?(itemId: ItemId, annotation: Annotation): void;
  onAnnotationChange?(itemId: ItemId, annotationId: AnnotationId, patch: Partial<Annotation>): void;
  onAnnotationRemove?(itemId: ItemId, annotationId: AnnotationId): void;
}

const VIEW_WIDTH = 800;
const A4_ASPECT = 595 / 842;

interface Selected {
  itemId: ItemId;
  id: AnnotationId;
}

export function Viewer({
  pages,
  onJumpToSource,
  emptyLabel,
  fontEntries = [],
  onAnnotationAdd,
  onAnnotationChange,
  onAnnotationRemove,
}: ViewerProps) {
  const services = useServices();
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [extraRotation, setExtraRotation] = useState<Rotation>(0);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [autoEditId, setAutoEditId] = useState<AnnotationId | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  // Punktmasse je Seiten-Instanz, sobald ihr Bild geladen ist (fuer pt-Anzeige + Aspekt).
  const [geometry, setGeometry] = useState<Record<ItemId, { pageWidth: number; pageHeight: number }>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const canEdit = fontEntries.length > 0 && Boolean(onAnnotationAdd);

  useLayoutEffect(() => {
    setIndex(0);
    setSelected(null);
    setAutoEditId(null);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [pages]);

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

  const currentPage = pages[clampPageIndex(index, pages.length)];

  const addText = () => {
    if (!currentPage?.itemId) return;
    const id = newId();
    onAnnotationAdd?.(currentPage.itemId, newTextAnnotation(id, defaultFontId(fontEntries)));
    setSelected({ itemId: currentPage.itemId, id });
    setAutoEditId(id);
  };

  const placeSignature = async (result: SignatureResult) => {
    setSignatureOpen(false);
    if (!currentPage?.itemId) return;
    const blobKey = newId();
    try {
      await services.annotationBlobStore.put(blobKey, result.blob);
    } catch (error) {
      console.warn('Unterschrift konnte nicht gespeichert werden', error);
      return;
    }
    const size = geometry[currentPage.itemId];
    const pageAspect = size ? size.pageWidth / size.pageHeight : A4_ASPECT;
    const id = newId();
    onAnnotationAdd?.(currentPage.itemId, newSignatureAnnotation(id, blobKey, result.aspect, pageAspect));
    setSelected({ itemId: currentPage.itemId, id });
    setAutoEditId(null);
  };

  const selectedAnnotation =
    selected &&
    pages
      .find((page) => page.itemId === selected.itemId)
      ?.annotations?.find((annotation) => annotation.id === selected.id);
  const selectedPageHeight = selected ? geometry[selected.itemId]?.pageHeight ?? 842 : 842;

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

        {canEdit && currentPage?.itemId && (
          <>
            <span className="mx-2 h-4 w-px bg-line" />
            <button type="button" onClick={addText} className="flex items-center gap-1 rounded px-2 py-1 hover:bg-panel" aria-label="Text hinzufuegen">
              <Type className="size-4" /> Text
            </button>
            <button type="button" onClick={() => setSignatureOpen(true)} className="flex items-center gap-1 rounded px-2 py-1 hover:bg-panel" aria-label="Unterschrift hinzufuegen">
              <PenLine className="size-4" /> Unterschrift
            </button>
          </>
        )}
      </div>

      {canEdit && selected && selectedAnnotation && (
        <AnnotationPanel
          annotation={selectedAnnotation}
          fontEntries={fontEntries}
          pageHeightPts={selectedPageHeight}
          onChange={(patch) => onAnnotationChange?.(selected.itemId, selected.id, patch)}
          onRemove={() => {
            onAnnotationRemove?.(selected.itemId, selected.id);
            setSelected(null);
          }}
        />
      )}

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
              editable={canEdit}
              fontEntries={fontEntries}
              selectedId={selected && selected.itemId === page.itemId ? selected.id : null}
              autoEditId={selected && selected.itemId === page.itemId ? autoEditId : null}
              onSelect={(id) => setSelected(id && page.itemId ? { itemId: page.itemId, id } : null)}
              onChange={(id, patch) => page.itemId && onAnnotationChange?.(page.itemId, id, patch)}
              onRemove={(id) => {
                if (!page.itemId) return;
                onAnnotationRemove?.(page.itemId, id);
                setSelected(null);
              }}
              onGeometry={(pageWidth, pageHeight) =>
                page.itemId && setGeometry((prev) => ({ ...prev, [page.itemId!]: { pageWidth, pageHeight } }))
              }
            />
          ))}
        </div>
      </div>

      {signatureOpen && (
        <SignaturePad fontEntries={fontEntries} onConfirm={(result) => void placeSignature(result)} onCancel={() => setSignatureOpen(false)} />
      )}
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
  editable: boolean;
  fontEntries: FontManifestEntry[];
  selectedId: AnnotationId | null;
  autoEditId: AnnotationId | null;
  onSelect(id: AnnotationId | null): void;
  onChange(id: AnnotationId, patch: Partial<Annotation>): void;
  onRemove(id: AnnotationId): void;
  onGeometry(pageWidth: number, pageHeight: number): void;
}

function PageBlock({
  page,
  zoom,
  extraRotation,
  scrollRef,
  onJumpToSource,
  blockRef,
  editable,
  fontEntries,
  selectedId,
  autoEditId,
  onSelect,
  onChange,
  onRemove,
  onGeometry,
}: PageBlockProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (visible) return;
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
        <PageImage
          pageRef={page.ref}
          zoom={zoom}
          rotation={rotation}
          provenance={page.provenance}
          annotations={page.annotations ?? []}
          editable={editable && Boolean(page.itemId)}
          fontEntries={fontEntries}
          selectedId={selectedId}
          autoEditId={autoEditId}
          onSelect={onSelect}
          onChange={onChange}
          onRemove={onRemove}
          onGeometry={onGeometry}
        />
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

interface PageImageProps {
  pageRef: BlockRef;
  zoom: number;
  rotation: Rotation;
  provenance: string;
  annotations: Annotation[];
  editable: boolean;
  fontEntries: FontManifestEntry[];
  selectedId: AnnotationId | null;
  autoEditId: AnnotationId | null;
  onSelect(id: AnnotationId | null): void;
  onChange(id: AnnotationId, patch: Partial<Annotation>): void;
  onRemove(id: AnnotationId): void;
  onGeometry(pageWidth: number, pageHeight: number): void;
}

function PageImage({
  pageRef,
  zoom,
  rotation,
  provenance,
  annotations,
  editable,
  fontEntries,
  selectedId,
  autoEditId,
  onSelect,
  onChange,
  onRemove,
  onGeometry,
}: PageImageProps) {
  const { url, status, pageWidth, pageHeight } = usePageImage(pageRef, VIEW_WIDTH);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const box = useElementSize(containerRef);

  useEffect(() => {
    if (pageWidth && pageHeight) onGeometry(pageWidth, pageHeight);
  }, [pageWidth, pageHeight, onGeometry]);

  if (status === 'error') {
    return <p className="grid h-40 place-items-center text-sm text-amber-400">Diese Seite konnte nicht gerendert werden.</p>;
  }
  if (!url) {
    return <div className="mx-auto h-[60vh] w-2/3 animate-pulse rounded bg-panel" aria-label={`${provenance} wird geladen`} />;
  }
  return (
    <div
      ref={containerRef}
      className="relative mx-auto rounded shadow-lg"
      style={{ width: `${zoom * 100}%`, transform: `rotate(${rotation}deg)` }}
    >
      <img src={url} alt={provenance} draggable={false} style={{ display: 'block', width: '100%' }} />
      {(annotations.length > 0 || editable) && box.width > 0 && (
        <AnnotationLayer
          annotations={annotations}
          box={box}
          rotationDeg={rotation}
          fontEntries={fontEntries}
          editable={editable}
          selectedId={selectedId}
          autoEditId={autoEditId}
          onSelect={onSelect}
          onChange={onChange}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}
