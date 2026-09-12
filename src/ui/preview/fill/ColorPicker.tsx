import { useEffect, useRef, useState } from 'react';
import { cx } from '../../common/cx';
import { useT } from '../../i18n';
import { hasFill } from '../../../domain/overlayShapes';

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

/**
 * Kompakter Farbwaehler: ein Button zeigt die aktuelle Farbe, das Popover eine
 * Palette + freie Wahl per nativem Farbfeld. "Keine Farbe" ist optional.
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
  const active = hasFill(value) ? value! : undefined;

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
          style={
            active
              ? { background: active }
              : {
                  background:
                    'repeating-conic-gradient(#0000 0 25%, #9994 0 50%) 50%/8px 8px',
                }
          }
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-44 rounded-lg bg-surface-panel p-2 shadow-[var(--float-shadow)] ring-1 ring-line-structural">
          <div className="grid grid-cols-6 gap-1">
            {swatches.map((hex) => (
              <button
                key={hex}
                type="button"
                title={hex}
                onClick={() => {
                  onChange(hex);
                  setOpen(false);
                }}
                className={cx(
                  'size-5 rounded-[4px] ring-1 ring-line-structural transition-transform hover:scale-110',
                  active?.toLowerCase() === hex.toLowerCase() && 'ring-2 ring-accent',
                )}
                style={{ background: hex }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-text-secondary">
              <input
                type="color"
                value={active ?? '#000000'}
                onChange={(e) => onChange(e.currentTarget.value)}
                className="size-6 cursor-pointer rounded border-0 bg-transparent p-0"
              />
              {t('preview.fill.colorFree')}
            </label>
            {allowNone && (
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                className="ml-auto rounded px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              >
                {t('preview.fill.colorNone')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
