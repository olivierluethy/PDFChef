import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eraser } from 'lucide-react';
import { Button } from '../common/Button';

const CANVAS_W = 600;
const CANVAS_H = 200;

export interface SignatureDialogProps {
  onCancel(): void;
  /** Liefert die gezeichnete Unterschrift als PNG-data-URL samt Seitenverhaeltnis (Breite/Hoehe). */
  onConfirm(dataUrl: string, aspect: number): void;
}

/**
 * Kleiner Zeichenbereich fuer eine Freihand-Unterschrift. Das Ergebnis wird als
 * PNG uebergeben und spaeter als Bild-Overlay auf der Seite platziert.
 */
export function SignatureDialog({ onCancel, onConfirm }: SignatureDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  const context = () => canvasRef.current?.getContext('2d') ?? null;

  const posOf = (event: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  };

  const start = (event: React.PointerEvent) => {
    drawing.current = true;
    last.current = posOf(event);
    canvasRef.current?.setPointerCapture(event.pointerId);
  };

  const move = (event: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = context();
    if (!ctx || !last.current) return;
    const point = posOf(event);
    ctx.strokeStyle = '#15181c';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    last.current = point;
    setHasInk(true);
  };

  const end = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    context()?.clearRect(0, 0, CANVAS_W, CANVAS_H);
    setHasInk(false);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onConfirm(canvas.toDataURL('image/png'), CANVAS_W / CANVAS_H);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-lg rounded-xl bg-surface-panel p-5 shadow-[var(--float-shadow)] ring-1 ring-line-structural">
        <h2 className="t-panel-title text-text-primary">Unterschrift</h2>
        <p className="mt-1 text-[12.5px] text-text-secondary">
          Zeichne deine Unterschrift mit Maus, Trackpad oder Finger.
        </p>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="mt-3 aspect-[3/1] w-full touch-none rounded-lg bg-white ring-1 ring-line-structural"
        />
        <div className="mt-4 flex items-center gap-2">
          <Button variant="quiet" size="sm" icon={Eraser} onClick={clear}>
            Löschen
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" onClick={onCancel}>
              Abbrechen
            </Button>
            <Button variant="primary" size="sm" disabled={!hasInk} onClick={confirm}>
              Übernehmen
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
