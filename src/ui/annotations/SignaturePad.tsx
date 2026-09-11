import { useEffect, useRef, useState } from 'react';
import { cssFamilyFor, type FontManifestEntry } from '../text/fontCatalog';

export interface SignatureResult {
  blob: Blob;
  /** Breite/Hoehe des zugeschnittenen Bildes. */
  aspect: number;
}

export interface SignaturePadProps {
  fontEntries: FontManifestEntry[];
  onConfirm(result: SignatureResult): void;
  onCancel(): void;
}

type Tab = 'draw' | 'upload' | 'type';

const PAD_W = 520;
const PAD_H = 200;

/**
 * Erstellt eine Unterschrift auf drei Wegen -- zeichnen, Bild hochladen oder
 * tippen -- und liefert sie als PNG mit Transparenz. Beim Zeichnen ist die
 * Linienfarbe sichtbar und frei waehlbar (loest das Schwarz-auf-Schwarz-Problem);
 * "Zuruecksetzen" leert die Flaeche fuer einen neuen Versuch.
 */
export function SignaturePad({ fontEntries, onConfirm, onCancel }: SignaturePadProps) {
  const [tab, setTab] = useState<Tab>('draw');
  const [color, setColor] = useState('#1b3a8a');

  return (
    <div
      role="dialog"
      aria-label="Unterschrift erstellen"
      onPointerDown={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 50 }}
    >
      <div
        onPointerDown={(event) => event.stopPropagation()}
        className="rounded-lg border border-line bg-panel p-4 text-sm"
        style={{ width: PAD_W + 32 }}
      >
        <div className="mb-3 flex items-center gap-2">
          <TabButton active={tab === 'draw'} onClick={() => setTab('draw')}>Zeichnen</TabButton>
          <TabButton active={tab === 'upload'} onClick={() => setTab('upload')}>Bild</TabButton>
          <TabButton active={tab === 'type'} onClick={() => setTab('type')}>Tippen</TabButton>
          <span className="ml-auto flex items-center gap-1">
            Farbe
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Farbe" />
          </span>
        </div>

        {tab === 'draw' && <DrawTab color={color} onConfirm={onConfirm} onCancel={onCancel} />}
        {tab === 'upload' && <UploadTab onConfirm={onConfirm} onCancel={onCancel} />}
        {tab === 'type' && <TypeTab color={color} fontEntries={fontEntries} onConfirm={onConfirm} onCancel={onCancel} />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-1 ${active ? 'bg-accent text-black' : 'hover:bg-black/20'}`}
    >
      {children}
    </button>
  );
}

function Actions({ onConfirm, onCancel, disabled }: { onConfirm(): void; onCancel(): void; disabled?: boolean }) {
  return (
    <div className="mt-3 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded px-3 py-1 hover:bg-black/20">Abbrechen</button>
      <button type="button" onClick={onConfirm} disabled={disabled} className="rounded bg-accent px-3 py-1 text-black disabled:opacity-40">Uebernehmen</button>
    </div>
  );
}

/** Schneidet das Canvas auf den sichtbaren Inhalt zu; liefert null, wenn leer. */
async function trimToBlob(canvas: HTMLCanvasElement): Promise<SignatureResult | null> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return null;
  const pad = 6;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')?.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  return blob ? { blob, aspect: w / h } : null;
}

function DrawTab({ color, onConfirm, onCancel }: { color: string; onConfirm(result: SignatureResult): void; onCancel(): void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = PAD_W * dpr;
    canvas.height = PAD_H * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, []);

  const point = (event: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent) => {
    drawing.current = true;
    last.current = point(event);
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };
  const move = (event: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    const p = point(event);
    if (ctx && last.current) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      setDirty(true);
    }
    last.current = p;
  };
  const end = () => {
    drawing.current = false;
    last.current = null;
  };
  const reset = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDirty(false);
  };

  const confirm = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const result = await trimToBlob(canvas);
    if (result) onConfirm(result);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        style={{ width: PAD_W, height: PAD_H, background: '#ffffff', borderRadius: 6, touchAction: 'none', cursor: 'crosshair' }}
      />
      <div className="mt-2 flex items-center">
        <button type="button" onClick={reset} className="rounded px-3 py-1 hover:bg-black/20">Zuruecksetzen</button>
        <div className="ml-auto">
          <Actions onConfirm={() => void confirm()} onCancel={onCancel} disabled={!dirty} />
        </div>
      </div>
    </div>
  );
}

function UploadTab({ onConfirm, onCancel }: { onConfirm(result: SignatureResult): void; onCancel(): void }) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [removeWhite, setRemoveWhite] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    if (removeWhite) {
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = image;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235) data[i + 3] = 0;
      }
      ctx.putImageData(image, 0, 0);
    }
  }, [bitmap, removeWhite]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setBitmap(await createImageBitmap(file));
    } catch (error) {
      console.warn('Bild konnte nicht geladen werden', error);
    }
  };

  const confirm = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmap) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) onConfirm({ blob, aspect: canvas.width / canvas.height });
  };

  return (
    <div>
      <input type="file" accept="image/*" onChange={(event) => void onFile(event.target.files?.[0])} />
      <label className="mt-2 flex items-center gap-2">
        <input type="checkbox" checked={removeWhite} onChange={(event) => setRemoveWhite(event.target.checked)} />
        Weissen Hintergrund transparent machen
      </label>
      <div className="mt-2 grid place-items-center rounded" style={{ height: PAD_H, background: '#ffffff' }}>
        {bitmap ? (
          <canvas ref={canvasRef} style={{ maxWidth: PAD_W, maxHeight: PAD_H }} />
        ) : (
          <span className="text-neutral-500">Ein Bild waehlen</span>
        )}
      </div>
      <Actions onConfirm={() => void confirm()} onCancel={onCancel} disabled={!bitmap} />
    </div>
  );
}

function TypeTab({ color, fontEntries, onConfirm, onCancel }: { color: string; fontEntries: FontManifestEntry[]; onConfirm(result: SignatureResult): void; onCancel(): void }) {
  const handwriting = fontEntries.filter((entry) => entry.category === 'handwriting');
  const choices = handwriting.length > 0 ? handwriting : fontEntries;
  const [text, setText] = useState('');
  const [fontId, setFontId] = useState(choices[0]?.id ?? '');
  const entry = fontEntries.find((candidate) => candidate.id === fontId);

  const confirm = async () => {
    const value = text.trim();
    if (value === '') return;
    const size = 96;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const family = cssFamilyFor(entry, false);
    ctx.font = `${size}px ${family}`;
    const metrics = ctx.measureText(value);
    const w = Math.ceil(metrics.width) + 24;
    const h = Math.ceil(size * 1.6);
    canvas.width = w;
    canvas.height = h;
    ctx.font = `${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(value, 12, h / 2);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) onConfirm({ blob, aspect: w / h });
  };

  return (
    <div>
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Name eingeben"
        className="w-full rounded border border-line bg-black/20 px-2 py-1"
      />
      <select value={fontId} onChange={(event) => setFontId(event.target.value)} className="mt-2 rounded border border-line bg-black/20 px-2 py-1">
        {choices.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
        ))}
      </select>
      <div className="mt-2 grid place-items-center rounded" style={{ height: PAD_H, background: '#ffffff' }}>
        <span style={{ fontFamily: cssFamilyFor(entry, false), fontSize: 64, color }}>{text || 'Vorschau'}</span>
      </div>
      <Actions onConfirm={() => void confirm()} onCancel={onCancel} disabled={text.trim() === ''} />
    </div>
  );
}
