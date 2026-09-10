import { useState } from 'react';
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

  if (pages.length === 0) {
    return <p className="grid h-full place-items-center text-sm text-neutral-500">{emptyLabel ?? 'Nichts zum Anzeigen.'}</p>;
  }

  const current = pages[clampPageIndex(index, pages.length)];
  const rotation = ((current.rotation + extraRotation) % 360) as Rotation;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-line px-3 py-1 text-sm">
        <button type="button" aria-label="Vorige Seite" disabled={index === 0} onClick={() => setIndex((i) => clampPageIndex(i - 1, pages.length))} className="rounded p-1 hover:bg-panel disabled:opacity-40">
          <ChevronLeft className="size-4" />
        </button>
        <label className="flex items-center gap-1">
          Seite
          <input
            type="number"
            min={1}
            max={pages.length}
            value={index + 1}
            onChange={(e) => setIndex(clampPageIndex(Number(e.target.value) - 1, pages.length))}
            className="w-14 rounded border border-line bg-panel px-1 py-0.5"
          />
          von {pages.length}
        </label>
        <button type="button" aria-label="Naechste Seite" disabled={index >= pages.length - 1} onClick={() => setIndex((i) => clampPageIndex(i + 1, pages.length))} className="rounded p-1 hover:bg-panel disabled:opacity-40">
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

      <div className="min-h-0 flex-1 overflow-auto bg-black/30 p-4">
        <PageImage ref={current.ref} zoom={zoom} rotation={rotation} provenance={current.provenance} />
      </div>

      <div className="flex items-center justify-between border-t border-line px-3 py-1 text-xs text-neutral-400">
        <span>{current.provenance}</span>
        {onJumpToSource && (
          <button type="button" onClick={() => onJumpToSource(current.ref)} className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-panel" aria-label={`Zur Quelle: ${current.provenance}`}>
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
