import { useEffect, useRef, useState } from 'react';
import { Minus, PenLine, Plus, ScanLine, Trash2, Type } from 'lucide-react';
import { newId } from '../../domain/ids';
import { DEFAULT_OVERLAY_FONT, OVERLAY_FONTS, overlayFontSpec } from '../../domain/overlayFonts';
import type { Overlay } from '../../domain/types';
import { cx } from '../common/cx';
import { SignatureDialog } from './SignatureDialog';

export interface FillLayerProps {
  overlays: Overlay[];
  /** true, wenn der Ausfuell-Modus aktiv ist -- dann ist die Schicht interaktiv. */
  active: boolean;
  onAdd(overlay: Overlay): void;
  onUpdate(overlayId: string, patch: Partial<Overlay>): void;
  onRemove(overlayId: string): void;
  /** Erkennt die AcroForm-Felder dieser Seite und legt sie als Overlays an. */
  onDetect?(): void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DragState {
  overlayId: string;
  box: Box;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Liegt deckungsgleich ueber dem gerenderten Seitenbild und erlaubt im
 * Ausfuell-Modus, Textfelder und eine Unterschrift zu setzen, zu verschieben,
 * zu bearbeiten und zu loeschen. Alle Positionen sind Bruchteile der Seite --
 * unabhaengig vom Zoom.
 */
export function FillLayer({
  overlays,
  active,
  onAdd,
  onUpdate,
  onRemove,
  onDetect,
}: FillLayerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [signing, setSigning] = useState(false);
  const [height, setHeight] = useState(0);
  // Neue Felder uebernehmen die zuletzt gewaehlte Schrift.
  const [lastFont, setLastFont] = useState<string>(DEFAULT_OVERLAY_FONT);

  // Die Schrifthoehe ist ein Bruchteil der Seitenhoehe; die Pixelhoehe folgt dem Zoom.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setHeight(el.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rect = () => rootRef.current?.getBoundingClientRect() ?? null;

  const addTextAt = (clientX: number, clientY: number) => {
    const r = rect();
    if (!r) return;
    onAdd({
      id: newId(),
      kind: 'text',
      x: clamp01((clientX - r.left) / r.width),
      y: clamp01((clientY - r.top) / r.height),
      w: 0.32,
      h: 0,
      text: '',
      fontSize: 0.024,
      font: lastFont,
    });
  };

  const addSignature = (dataUrl: string, aspect: number) => {
    setSigning(false);
    const r = rect();
    const w = 0.3;
    // Seitenverhaeltnis erhalten: h (Bruchteil der Hoehe) aus w (Bruchteil der Breite).
    const h = r ? (w * (r.width / r.height)) / aspect : w / aspect;
    onAdd({ id: newId(), kind: 'image', x: (1 - w) / 2, y: 0.45, w, h, dataUrl });
  };

  const beginDrag = (event: React.PointerEvent, overlay: Overlay, mode: 'move' | 'resize') => {
    event.preventDefault();
    event.stopPropagation();
    const r = rect();
    if (!r) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const orig: Box = { x: overlay.x, y: overlay.y, w: overlay.w, h: overlay.h };
    let latest = orig;
    const onMove = (e: PointerEvent) => {
      const dx = (e.clientX - startX) / r.width;
      const dy = (e.clientY - startY) / r.height;
      if (mode === 'move') {
        latest = { ...orig, x: clamp01(orig.x + dx), y: clamp01(orig.y + dy) };
      } else {
        const nextW = Math.max(0.05, orig.w + dx);
        const ratio = orig.w > 0 ? orig.h / orig.w : 1;
        latest = { ...orig, w: nextW, h: nextW * ratio };
      }
      setDrag({ overlayId: overlay.id, box: latest });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDrag(null);
      onUpdate(overlay.id, latest);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const boxOf = (overlay: Overlay): Box =>
    drag && drag.overlayId === overlay.id
      ? drag.box
      : { x: overlay.x, y: overlay.y, w: overlay.w, h: overlay.h };

  return (
    <div
      ref={rootRef}
      className={cx(
        'absolute inset-0 z-10',
        active ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      onPointerDown={(event) => {
        if (!active) return;
        // Im Ausfuell-Modus nie das Seiten-Ziehen darunter ausloesen.
        event.stopPropagation();
        // Nur ein Klick auf die freie Flaeche legt ein neues Textfeld an.
        if (event.target === event.currentTarget) addTextAt(event.clientX, event.clientY);
      }}
    >
      {active && (
        <div className="pointer-events-auto absolute left-2 top-2 flex items-center gap-1 rounded-md bg-surface-raised px-1.5 py-1 text-[11.5px] text-text-secondary shadow-[var(--float-shadow)] ring-1 ring-line-structural">
          <Type className="size-3.5" aria-hidden />
          <span className="mr-1">Klicken für Textfeld</span>
          {onDetect && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onDetect}
              className="inline-flex items-center gap-1 rounded bg-surface-panel px-1.5 py-0.5 text-text-primary ring-1 ring-line-structural hover:bg-surface-hover"
            >
              <ScanLine className="size-3.5" aria-hidden /> Felder erkennen
            </button>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setSigning(true)}
            className="inline-flex items-center gap-1 rounded bg-surface-panel px-1.5 py-0.5 text-text-primary ring-1 ring-line-structural hover:bg-surface-hover"
          >
            <PenLine className="size-3.5" aria-hidden /> Unterschrift
          </button>
        </div>
      )}

      {overlays.map((overlay) => {
        const box = boxOf(overlay);
        const common = {
          left: `${box.x * 100}%`,
          top: `${box.y * 100}%`,
        };

        if (overlay.kind === 'image') {
          return (
            <div
              key={overlay.id}
              className={cx('absolute', active && 'ring-1 ring-accent/60')}
              style={{ ...common, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
              onPointerDown={(e) => active && beginDrag(e, overlay, 'move')}
            >
              <img
                src={overlay.dataUrl}
                alt="Unterschrift"
                className="h-full w-full object-contain"
                draggable={false}
              />
              {active && (
                <>
                  <button
                    type="button"
                    aria-label="Unterschrift entfernen"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onRemove(overlay.id)}
                    className="absolute -right-2 -top-2 grid size-5 place-items-center rounded-full bg-surface-raised text-text-secondary shadow-[var(--float-shadow)] ring-1 ring-line-structural hover:text-danger"
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </button>
                  <span
                    onPointerDown={(e) => beginDrag(e, overlay, 'resize')}
                    className="absolute -bottom-1.5 -right-1.5 size-3 cursor-nwse-resize rounded-sm bg-accent"
                    aria-hidden
                  />
                </>
              )}
            </div>
          );
        }

        const fontPx = (overlay.fontSize ?? 0.024) * height;
        const font = overlayFontSpec(overlay.font);
        const fontStyle = { fontFamily: font.cssFamily, fontWeight: font.cssWeight };
        return (
          <div
            key={overlay.id}
            className="absolute"
            style={{ ...common, width: `${box.w * 100}%` }}
          >
            {active ? (
              <>
                <div
                  className="flex -translate-y-full items-center gap-0.5 rounded-t bg-accent px-1 py-0.5 text-on-accent"
                  onPointerDown={(e) => beginDrag(e, overlay, 'move')}
                  style={{ cursor: 'grab' }}
                >
                  <PenLine className="size-3" aria-hidden />
                  <select
                    value={overlay.font ?? DEFAULT_OVERLAY_FONT}
                    aria-label="Schriftart"
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      onUpdate(overlay.id, { font: e.currentTarget.value });
                      setLastFont(e.currentTarget.value);
                    }}
                    className="mr-auto max-w-[96px] rounded bg-black/15 px-0.5 text-[10px] text-on-accent outline-none"
                  >
                    {OVERLAY_FONTS.map((option) => (
                      <option key={option.key} value={option.key} className="text-text-primary">
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label="Schrift kleiner"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() =>
                      onUpdate(overlay.id, {
                        fontSize: Math.max(0.01, (overlay.fontSize ?? 0.024) - 0.004),
                      })
                    }
                    className="grid size-4 place-items-center rounded hover:bg-black/10"
                  >
                    <Minus className="size-3" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Schrift grösser"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() =>
                      onUpdate(overlay.id, {
                        fontSize: Math.min(0.08, (overlay.fontSize ?? 0.024) + 0.004),
                      })
                    }
                    className="grid size-4 place-items-center rounded hover:bg-black/10"
                  >
                    <Plus className="size-3" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="Feld entfernen"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => onRemove(overlay.id)}
                    className="grid size-4 place-items-center rounded hover:bg-black/10"
                  >
                    <Trash2 className="size-3" aria-hidden />
                  </button>
                </div>
                {overlay.options ? (
                  <select
                    value={overlay.text ?? ''}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) => onUpdate(overlay.id, { text: e.currentTarget.value })}
                    className="block w-full rounded-b bg-white/80 px-1 leading-tight text-[#15181c] outline-none ring-1 ring-accent/60 focus:bg-white focus:ring-accent"
                    style={{ fontSize: `${fontPx}px`, ...fontStyle }}
                  >
                    {overlay.options.map((option, i) => (
                      <option key={i} value={option}>
                        {option === '' ? '—' : option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    defaultValue={overlay.text}
                    autoFocus={(overlay.text ?? '') === ''}
                    onPointerDown={(e) => e.stopPropagation()}
                    onInput={(e) => {
                      const ta = e.currentTarget;
                      ta.style.height = 'auto';
                      ta.style.height = `${ta.scrollHeight}px`;
                    }}
                    onBlur={(e) => onUpdate(overlay.id, { text: e.currentTarget.value })}
                    className="block w-full resize-none rounded-b bg-white/70 px-1 leading-tight text-[#15181c] outline-none ring-1 ring-accent/60 focus:bg-white focus:ring-accent"
                    style={{
                      fontSize: `${fontPx}px`,
                      minHeight: `${fontPx * 1.4}px`,
                      ...fontStyle,
                    }}
                    rows={1}
                  />
                )}
              </>
            ) : (
              overlay.text?.trim() && (
                <div
                  className="whitespace-pre-wrap px-1 leading-tight text-[#15181c]"
                  style={{ fontSize: `${fontPx}px`, ...fontStyle }}
                >
                  {overlay.text}
                </div>
              )
            )}
          </div>
        );
      })}

      {signing && <SignatureDialog onCancel={() => setSigning(false)} onConfirm={addSignature} />}
    </div>
  );
}
