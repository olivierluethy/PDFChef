import { useEffect, useRef, useState } from 'react';
import { cx } from '../../common/cx';
import { useT } from '../../i18n';
import { hasFill } from '../../../domain/overlayShapes';
import { addRecentColor, normalizeHex, useRecentColors } from './recentColors';

export interface ColorPickerProps {
  /** Aktueller Wert (#RRGGBB) oder undefined/'none' fuer keine Farbe. */
  value: string | undefined;
  onChange(value: string | undefined): void;
  swatches: string[];
  title: string;
  /** Erlaubt die Option "keine Farbe" (fuer Fuellungen/Raender). */
  allowNone?: boolean;
  /** Kleines Icon links im Button (z.B. ein Buchstabe oder Symbol). */
  glyph: React.ReactNode;
}

const CHECKERBOARD = 'repeating-conic-gradient(#0000 0 25%, #9994 0 50%) 50%/8px 8px';

/**
 * Kompakter Farbwaehler: ein Button zeigt die aktuelle Farbe, das Popover eine
 * Palette, zuletzt verwendete Farben, freie Wahl per nativem Farbfeld sowie ein
 * Hex-Eingabefeld (mit oder ohne `#`). "Transparent/keine Farbe" ist optional.
 * Schliesst bei Aussenklick/Escape (Capture-Phase, weil die Leiste pointerdown stoppt).
 */
export function ColorPicker({
  value,
  onChange,
  swatches,
  title,
  allowNone,
  glyph,
}: ColorPickerProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const recent = useRecentColors();
  const active = hasFill(value) ? value! : undefined;
  const [hexDraft, setHexDraft] = useState('');

  // Beim Oeffnen das Hex-Feld mit dem aktuellen Wert vorbelegen.
  useEffect(() => {
    if (open) setHexDraft(active ?? '');
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /** Uebernimmt eine echte Farbe und merkt sie als zuletzt verwendet. */
  const commit = (hex: string, close = true) => {
    onChange(hex);
    addRecentColor(hex);
    if (close) setOpen(false);
  };

  const applyHex = () => {
    const norm = normalizeHex(hexDraft);
    if (norm) commit(norm);
  };

  const hexValid = normalizeHex(hexDraft) !== null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={title}
        aria-label={title}
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 items-center gap-1 rounded-md px-1 text-text-secondary hover:bg-surface-hover"
      >
        <span className="grid size-4 place-items-center text-[11px] font-semibold leading-none">
          {glyph}
        </span>
        <span
          className="size-3.5 rounded-[3px] ring-1 ring-line-structural"
          style={active ? { background: active } : { background: CHECKERBOARD }}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-48 rounded-lg bg-surface-panel p-2 shadow-[var(--float-shadow)] ring-1 ring-line-structural">
          <div className="grid grid-cols-6 gap-1">
            {swatches.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                onClick={() => commit(hex)}
                className={cx(
                  'size-5 rounded-[4px] ring-1 ring-line-structural transition-transform hover:scale-110',
                  active?.toLowerCase() === hex.toLowerCase() && 'ring-2 ring-accent',
                )}
                style={{ background: hex }}
              />
            ))}
          </div>

          {recent.length > 0 && (
            <>
              <div className="mt-2 text-[10px] font-medium uppercase tracking-wide text-text-tertiary">
                {t('preview.fill.colorRecent')}
              </div>
              <div className="mt-1 grid grid-cols-8 gap-1">
                {recent.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    title={hex}
                    onClick={() => commit(hex)}
                    className={cx(
                      'size-4 rounded-[3px] ring-1 ring-line-structural transition-transform hover:scale-110',
                      active?.toLowerCase() === hex.toLowerCase() && 'ring-2 ring-accent',
                    )}
                    style={{ background: hex }}
                  />
                ))}
              </div>
            </>
          )}

          <div className="mt-2 flex items-center gap-1.5">
            <label className="flex items-center" title={t('preview.fill.colorFree')}>
              <input
                type="color"
                value={active ?? '#000000'}
                onChange={(e) => onChange(e.currentTarget.value)}
                onBlur={(e) => addRecentColor(e.currentTarget.value)}
                aria-label={t('preview.fill.colorFree')}
                className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </label>
            <div className="flex flex-1 items-center rounded-md ring-1 ring-line-structural focus-within:ring-accent">
              <span className="pl-1.5 text-[11px] text-text-tertiary" aria-hidden>
                #
              </span>
              <input
                type="text"
                inputMode="text"
                spellCheck={false}
                value={hexDraft.replace(/^#/, '')}
                placeholder="rrggbb"
                aria-label={t('preview.fill.colorHex')}
                title={t('preview.fill.colorHex')}
                onChange={(e) => setHexDraft(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyHex();
                  }
                }}
                onBlur={applyHex}
                className="w-full min-w-0 rounded-r-md bg-transparent px-1 py-0.5 text-[11.5px] tabular-nums text-text-primary outline-none [appearance:textfield]"
              />
            </div>
            <button
              type="button"
              disabled={!hexValid}
              onClick={applyHex}
              className={cx(
                'rounded px-1.5 py-0.5 text-[11px]',
                hexValid
                  ? 'text-accent hover:bg-surface-hover'
                  : 'cursor-not-allowed text-text-tertiary opacity-50',
              )}
            >
              {t('preview.fill.colorApply')}
            </button>
          </div>

          {allowNone && (
            <button
              type="button"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className={cx(
                'mt-2 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-text-secondary ring-1 ring-line-structural hover:bg-surface-hover hover:text-text-primary',
                !active && 'ring-accent text-text-primary',
              )}
            >
              <span
                className="size-3.5 rounded-[3px] ring-1 ring-line-structural"
                style={{ background: CHECKERBOARD }}
                aria-hidden
              />
              {t('preview.fill.colorTransparent')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
