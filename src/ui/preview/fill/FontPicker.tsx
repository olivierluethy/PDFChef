import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  OVERLAY_FONTS,
  OVERLAY_FONT_CATEGORIES,
  overlayCssFamily,
  overlayFontSpec,
} from '../../../domain/overlayFonts';
import { cx } from '../../common/cx';
import { useT } from '../../i18n';

/**
 * Eigenes Schriftart-Dropdown statt eines nativen <select>: In einem Overlay
 * wird das native Popup durch Blur/Re-Render zuverlaessig unterbrochen (das
 * "Menue geht nicht auf"-Problem). Dieses Menue rendert selbst -- jede Schrift
 * in ihrer eigenen Familie -- und schliesst bei Aussenklick oder Escape.
 */
export function FontPicker({ value, onChange }: { value: string; onChange(key: string): void }) {
  const t = useT();
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
        title={t('preview.fill.fontFamily')}
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 items-center gap-1 rounded-md bg-surface-panel px-1.5 text-[11.5px] text-text-primary outline-none ring-1 ring-line-structural hover:bg-surface-hover focus:ring-accent"
      >
        <span
          className="max-w-[104px] truncate"
          style={{ fontFamily: overlayCssFamily(current, false) }}
        >
          {current.label}
        </span>
        <ChevronDown
          className={cx('size-3 shrink-0 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
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
                <div className="px-2 pb-0.5 pt-1.5 text-[10.5px] text-text-tertiary">
                  {group.label}
                </div>
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
