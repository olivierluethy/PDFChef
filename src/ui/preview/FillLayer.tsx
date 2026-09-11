import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  ChevronDown,
  GripVertical,
  Italic,
  Minus,
  PenLine,
  Plus,
  ScanLine,
  Trash2,
  Type,
} from 'lucide-react';
import { newId } from '../../domain/ids';
import {
  DEFAULT_OVERLAY_FONT,
  OVERLAY_FONTS,
  OVERLAY_FONT_CATEGORIES,
  overlayCssFamily,
  overlayFontSpec,
  overlayHasBold,
} from '../../domain/overlayFonts';
import type { Overlay } from '../../domain/types';
import { cx } from '../common/cx';
import { ensureOverlayFontFaces } from '../text/overlayFontFaces';
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

// Die Schriftgroesse wird als Bruchteil der Seitenhoehe gespeichert (zoomunabhaengig).
// Fuers Eingeben rechnen wir in Punkt um -- Bezug ist die A4-Hoehe (842 pt), die
// Grundgroesse dieser App. So kann der Nutzer vertraute Werte wie 14,5 pt tippen.
const PT_BASIS = 842;
const DEFAULT_FONT_SIZE = 0.024;
const MIN_FONT_SIZE = 0.01;
const MAX_FONT_SIZE = 0.08;
const clampFontSize = (n: number) => Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, n));
const fractionToPt = (fraction: number) => Math.round(fraction * PT_BASIS * 10) / 10;
const ptToFraction = (pt: number) => clampFontSize(pt / PT_BASIS);

/** CSS-Textstil eines Overlays -- identisch fuer Editor, Vorschau und (analog) Export. */
function overlayTextStyle(overlay: Overlay): React.CSSProperties {
  const spec = overlayFontSpec(overlay.font);
  const bold = overlay.bold ?? false;
  return {
    fontFamily: overlayCssFamily(spec, bold),
    fontWeight: bold ? 700 : spec.cssWeight,
    fontStyle: overlay.italic ? 'italic' : 'normal',
  };
}

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
  // Welches Feld gerade die Bearbeitungsleiste zeigt.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Nur per Klick neu erzeugte Felder sind "Entwuerfe": bleiben sie leer, werden
  // sie beim Wegklicken verworfen. Erkannte Formularfelder bleiben unberuehrt.
  const draftIds = useRef<Set<string>>(new Set());
  // Neue Felder uebernehmen die zuletzt gewaehlte Schrift.
  const [lastFont, setLastFont] = useState<string>(DEFAULT_OVERLAY_FONT);

  // @font-face der eingebetteten Schriften bereitstellen (einmalig).
  useEffect(() => {
    ensureOverlayFontFaces();
  }, []);

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

  // Leere Entwurfsfelder verwerfen (ausser `exceptId`). Liest die LIVE-Werte der
  // Textfelder aus dem DOM, nicht den evtl. noch nicht gespeicherten Store -- so
  // geht gerade getippter, noch nicht uebernommener Text nie verloren.
  const pruneEmptyDrafts = (exceptId?: string) => {
    const root = rootRef.current;
    if (!root) return;
    for (const id of Array.from(draftIds.current)) {
      if (id === exceptId) continue;
      const ta = root.querySelector<HTMLTextAreaElement>(`textarea[data-overlay-id="${id}"]`);
      if (!ta) continue; // nicht (mehr) gerendert -> nicht anfassen
      draftIds.current.delete(id);
      if (ta.value.trim() === '') {
        onRemove(id);
        setSelectedId((s) => (s === id ? null : s));
      }
    }
  };

  // Klick ausserhalb dieser Ausfuell-Schicht: leere Entwuerfe verwerfen.
  useEffect(() => {
    if (!active) return;
    const onDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) pruneEmptyDrafts();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [active]);

  const addTextAt = (clientX: number, clientY: number) => {
    const r = rect();
    if (!r) return;
    // Zuvor angelegte, leer gebliebene Entwuerfe erst verwerfen.
    pruneEmptyDrafts();
    const overlay: Overlay = {
      id: newId(),
      kind: 'text',
      x: clamp01((clientX - r.left) / r.width),
      y: clamp01((clientY - r.top) / r.height),
      w: 0.32,
      h: 0,
      text: '',
      fontSize: DEFAULT_FONT_SIZE,
      font: lastFont,
    };
    draftIds.current.add(overlay.id);
    onAdd(overlay);
    setSelectedId(overlay.id);
  };

  const addSignature = (dataUrl: string, aspect: number) => {
    setSigning(false);
    const r = rect();
    const w = 0.3;
    // Seitenverhaeltnis erhalten: h (Bruchteil der Hoehe) aus w (Bruchteil der Breite).
    const h = r ? (w * (r.width / r.height)) / aspect : w / aspect;
    const overlay: Overlay = { id: newId(), kind: 'image', x: (1 - w) / 2, y: 0.45, w, h, dataUrl };
    onAdd(overlay);
    setSelectedId(overlay.id);
  };

  const beginDrag = (
    event: React.PointerEvent,
    overlay: Overlay,
    mode: 'move' | 'resize' | 'width',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedId(overlay.id);
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
      } else if (mode === 'width') {
        latest = { ...orig, w: Math.max(0.06, Math.min(1, orig.w + dx)) };
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
        const selected = active && selectedId === overlay.id;
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

        const fontPx = (overlay.fontSize ?? DEFAULT_FONT_SIZE) * height;
        const textStyle = overlayTextStyle(overlay);
        const spec = overlayFontSpec(overlay.font);
        const canBold = overlayHasBold(spec);
        // Leiste nach unten klappen, wenn das Feld ganz oben sitzt (sonst abgeschnitten).
        const toolbarBelow = box.y < 0.14;

        if (!active) {
          return (
            overlay.text?.trim() && (
              <div
                key={overlay.id}
                className="absolute whitespace-pre-wrap px-1 leading-tight text-[#15181c]"
                style={{ ...common, width: `${box.w * 100}%`, fontSize: `${fontPx}px`, ...textStyle }}
              >
                {overlay.text}
              </div>
            )
          );
        }

        return (
          <div
            key={overlay.id}
            className="absolute"
            style={{ ...common, width: `${box.w * 100}%`, zIndex: selected ? 30 : 10 }}
          >
            {/* Ziehgriff: unmissverstaendlich zum Verschieben, getrennt vom Textcursor. */}
            {selected && (
              <span
                onPointerDown={(e) => beginDrag(e, overlay, 'move')}
                title="Zum Verschieben ziehen"
                aria-label="Feld verschieben"
                className="absolute left-0 top-0 z-20 flex h-full w-5 -translate-x-full cursor-grab touch-none items-center justify-center rounded-l-md bg-accent text-on-accent active:cursor-grabbing"
              >
                <GripVertical className="size-3.5" aria-hidden />
              </span>
            )}

            {/* Schwebende Bearbeitungsleiste. */}
            {selected && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className={cx(
                  'absolute left-0 z-30 flex max-w-[min(360px,80vw)] flex-wrap items-center gap-1 rounded-lg bg-surface-raised p-1 shadow-[var(--float-shadow)] ring-1 ring-line-structural',
                  toolbarBelow ? 'top-full mt-2' : 'bottom-full mb-2',
                )}
              >
                <FontPicker
                  value={overlay.font ?? DEFAULT_OVERLAY_FONT}
                  onChange={(key) => {
                    onUpdate(overlay.id, { font: key });
                    setLastFont(key);
                  }}
                />

                <span className="mx-0.5 h-5 w-px bg-line-structural" aria-hidden />

                <button
                  type="button"
                  aria-label="Schrift kleiner"
                  onClick={() =>
                    onUpdate(overlay.id, {
                      fontSize: ptToFraction(fractionToPt(overlay.fontSize ?? DEFAULT_FONT_SIZE) - 0.5),
                    })
                  }
                  className="grid size-6 place-items-center rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                >
                  <Minus className="size-3.5" aria-hidden />
                </button>
                {/* key erzwingt bei jeder Groessenaenderung (auch via +/-) einen Neustart
                    mit aktuellem Wert; getippt wird in Punkt mit Dezimalen. */}
                <input
                  key={overlay.fontSize ?? DEFAULT_FONT_SIZE}
                  type="number"
                  step={0.5}
                  min={fractionToPt(MIN_FONT_SIZE)}
                  max={fractionToPt(MAX_FONT_SIZE)}
                  defaultValue={fractionToPt(overlay.fontSize ?? DEFAULT_FONT_SIZE)}
                  aria-label="Schriftgrösse in Punkt"
                  title="Schriftgrösse in Punkt"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  onBlur={(e) => {
                    const pt = Number(e.currentTarget.value);
                    if (Number.isFinite(pt)) onUpdate(overlay.id, { fontSize: ptToFraction(pt) });
                  }}
                  className="h-6 w-11 rounded-md bg-surface-panel px-1 text-center text-[11.5px] tabular-nums text-text-primary outline-none ring-1 ring-line-structural focus:ring-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  aria-label="Schrift grösser"
                  onClick={() =>
                    onUpdate(overlay.id, {
                      fontSize: ptToFraction(fractionToPt(overlay.fontSize ?? DEFAULT_FONT_SIZE) + 0.5),
                    })
                  }
                  className="grid size-6 place-items-center rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                >
                  <Plus className="size-3.5" aria-hidden />
                </button>

                <span className="mx-0.5 h-5 w-px bg-line-structural" aria-hidden />

                <button
                  type="button"
                  aria-label="Fett"
                  aria-pressed={overlay.bold ?? false}
                  title={canBold ? 'Fett' : 'Für diese Schrift kein Fett verfügbar'}
                  disabled={!canBold}
                  onClick={() => onUpdate(overlay.id, { bold: !(overlay.bold ?? false) })}
                  className={cx(
                    'grid size-6 place-items-center rounded-md',
                    !canBold
                      ? 'cursor-not-allowed text-text-tertiary opacity-40'
                      : overlay.bold
                        ? 'bg-accent text-on-accent'
                        : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                  )}
                >
                  <Bold className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Kursiv"
                  aria-pressed={overlay.italic ?? false}
                  title="Kursiv"
                  onClick={() => onUpdate(overlay.id, { italic: !(overlay.italic ?? false) })}
                  className={cx(
                    'grid size-6 place-items-center rounded-md',
                    overlay.italic
                      ? 'bg-accent text-on-accent'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                  )}
                >
                  <Italic className="size-3.5" aria-hidden />
                </button>

                <span className="mx-0.5 h-5 w-px bg-line-structural" aria-hidden />

                <button
                  type="button"
                  aria-label="Feld entfernen"
                  title="Feld entfernen"
                  onClick={() => onRemove(overlay.id)}
                  className="grid size-6 place-items-center rounded-md text-text-secondary hover:bg-danger/15 hover:text-danger"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            )}

            {/* Das eigentliche Eingabefeld -- immer bearbeitbar, Fokus waehlt es aus. */}
            {overlay.options ? (
              <select
                value={overlay.text ?? ''}
                onFocus={() => setSelectedId(overlay.id)}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => onUpdate(overlay.id, { text: e.currentTarget.value })}
                className={cx(
                  'block w-full rounded-md px-1.5 py-0.5 leading-tight text-[#15181c] outline-none',
                  selected ? 'bg-white ring-2 ring-accent' : 'bg-white/70 ring-1 ring-accent/40',
                )}
                style={{ fontSize: `${fontPx}px`, ...textStyle }}
              >
                {overlay.options.map((option, i) => (
                  <option key={i} value={option}>
                    {option === '' ? '—' : option}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                data-overlay-id={overlay.id}
                defaultValue={overlay.text}
                autoFocus={(overlay.text ?? '') === ''}
                onFocus={() => {
                  setSelectedId(overlay.id);
                  // Beim Wechsel in dieses Feld leere Entwuerfe der anderen verwerfen.
                  pruneEmptyDrafts(overlay.id);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onInput={(e) => {
                  const ta = e.currentTarget;
                  ta.style.height = 'auto';
                  ta.style.height = `${ta.scrollHeight}px`;
                }}
                onBlur={(e) => {
                  const val = e.currentTarget.value;
                  if (val.trim() !== '') onUpdate(overlay.id, { text: val });
                  else if ((overlay.text ?? '') !== '') onUpdate(overlay.id, { text: '' });
                }}
                className={cx(
                  'block w-full resize-none rounded-md px-1.5 py-0.5 leading-tight text-[#15181c] outline-none transition-colors',
                  selected
                    ? 'bg-white ring-2 ring-accent'
                    : 'bg-white/60 ring-1 ring-accent/30 hover:bg-white/80',
                )}
                style={{
                  fontSize: `${fontPx}px`,
                  minHeight: `${fontPx * 1.4}px`,
                  ...textStyle,
                }}
                rows={1}
              />
            )}

            {/* Breiten-Griff rechts. */}
            {selected && (
              <span
                onPointerDown={(e) => beginDrag(e, overlay, 'width')}
                title="Breite ändern"
                aria-label="Breite ändern"
                className="absolute right-0 top-1/2 z-20 size-3 -translate-y-1/2 translate-x-1/2 cursor-ew-resize touch-none rounded-full bg-accent ring-2 ring-surface-canvas"
              />
            )}
          </div>
        );
      })}

      {signing && <SignatureDialog onCancel={() => setSigning(false)} onConfirm={addSignature} />}
    </div>
  );
}

/**
 * Eigenes Schriftart-Dropdown statt eines nativen <select>: In einem Overlay
 * wird das native Popup durch Blur/Re-Render zuverlaessig unterbrochen (das
 * "Menue geht nicht auf"-Problem). Dieses Menue rendert selbst -- jede Schrift
 * in ihrer eigenen Familie -- und schliesst bei Aussenklick oder Escape.
 */
function FontPicker({ value, onChange }: { value: string; onChange(key: string): void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current = overlayFontSpec(value);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // Capture-Phase: greift auch, obwohl die Leiste pointerdown stoppt.
    document.addEventListener('pointerdown', onDocDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Schriftart"
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 items-center gap-1 rounded-md bg-surface-panel px-1.5 text-[11.5px] text-text-primary outline-none ring-1 ring-line-structural hover:bg-surface-hover focus:ring-accent"
      >
        <span className="max-w-[104px] truncate" style={{ fontFamily: overlayCssFamily(current, false) }}>
          {current.label}
        </span>
        <ChevronDown className={cx('size-3 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-40 mt-1 max-h-72 w-52 overflow-auto rounded-lg bg-surface-panel p-1 shadow-[var(--float-shadow)] ring-1 ring-line-structural"
        >
          {OVERLAY_FONT_CATEGORIES.map((group) => {
            const fonts = OVERLAY_FONTS.filter((font) => font.category === group.category);
            if (fonts.length === 0) return null;
            return (
              <div key={group.category} className="mb-0.5">
                <div className="px-2 pb-0.5 pt-1.5 text-[10.5px] text-text-tertiary">{group.label}</div>
                {fonts.map((font) => (
                  <button
                    key={font.key}
                    type="button"
                    role="option"
                    aria-selected={font.key === current.key}
                    onClick={() => {
                      onChange(font.key);
                      setOpen(false);
                    }}
                    className={cx(
                      'flex w-full items-center rounded-md px-2 py-1.5 text-left text-[14px] leading-none',
                      font.key === current.key
                        ? 'bg-accent text-on-accent'
                        : 'text-text-primary hover:bg-surface-hover',
                    )}
                    style={{ fontFamily: overlayCssFamily(font, false) }}
                  >
                    {font.label}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
