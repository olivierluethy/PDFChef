import {
  Bold,
  Copy,
  Group,
  Italic,
  Minus,
  Plus,
  Save,
  Trash2,
  Ungroup,
  Waypoints,
} from 'lucide-react';
import type { Overlay } from '../../../domain/types';
import { overlayFontSpec, overlayHasBold } from '../../../domain/overlayFonts';
import {
  HIGHLIGHT_COLORS,
  OVERLAY_COLORS,
  overlayShapeSupportsText,
} from '../../../domain/overlayShapes';
import { cx } from '../../common/cx';
import { useT } from '../../i18n';
import { ColorPicker } from './ColorPicker';
import { FontPicker } from './FontPicker';
import {
  DEFAULT_FONT_SIZE,
  fractionToPt,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  ptToFraction,
  ptToStroke,
  strokeToPt,
} from './units';

export interface StyleBarProps {
  overlays: Overlay[];
  onPatch(patch: Partial<Overlay>): void;
  onDuplicate(): void;
  onDelete(): void;
  onGroup(): void;
  onUngroup(): void;
  onSaveToLibrary(): void;
  canGroup: boolean;
  canUngroup: boolean;
}

/**
 * Schwebende Bearbeitungsleiste fuer die aktuelle Auswahl (ein oder mehrere
 * Overlays). Zeigt nur die zur Auswahl passenden Regler: Schrift/Groesse/Farbe
 * fuer Text (und Text-in-Form), Rand/Fuellung/Deckkraft fuer Formen, dazu
 * Duplizieren, Gruppieren, In Bibliothek speichern und Loeschen.
 */
export function StyleBar({
  overlays,
  onPatch,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onSaveToLibrary,
  canGroup,
  canUngroup,
}: StyleBarProps) {
  const t = useT();
  const textBearing = overlays.filter((o) => o.kind === 'text' || overlayShapeSupportsText(o));
  const shapes = overlays.filter((o) => o.kind === 'shape');
  const formable = overlays.filter((o) => o.kind === 'text');
  const hasHighlight = shapes.some((o) => o.shape === 'highlight');

  const firstText = textBearing[0];
  const firstShape = shapes[0];
  const fontSize = firstText?.fontSize ?? DEFAULT_FONT_SIZE;
  const canBold = textBearing.some((o) => overlayHasBold(overlayFontSpec(o.font)));
  const boldActive = firstText?.bold ?? false;
  const italicActive = firstText?.italic ?? false;
  const interactiveActive = formable.length > 0 && formable.every((o) => o.interactive);

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="flex max-w-[min(460px,88vw)] flex-wrap items-center gap-1 rounded-lg bg-surface-raised p-1 shadow-[var(--float-shadow)] ring-1 ring-line-structural"
    >
      {textBearing.length > 0 && (
        <>
          <FontPicker
            value={firstText?.font ?? 'helvetica'}
            onChange={(key) => onPatch({ font: key })}
          />
          <div className="flex items-center">
            <IconBtn
              label={t('preview.fill.fontSmaller')}
              onClick={() => onPatch({ fontSize: ptToFraction(fractionToPt(fontSize) - 0.5) })}
            >
              <Minus className="size-3.5" aria-hidden />
            </IconBtn>
            <input
              key={fontSize}
              type="number"
              step={0.5}
              min={fractionToPt(MIN_FONT_SIZE)}
              max={fractionToPt(MAX_FONT_SIZE)}
              defaultValue={fractionToPt(fontSize)}
              aria-label={t('preview.fill.fontSizePt')}
              title={t('preview.fill.fontSizePt')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              onBlur={(e) => {
                const pt = Number(e.currentTarget.value);
                if (Number.isFinite(pt)) onPatch({ fontSize: ptToFraction(pt) });
              }}
              className="h-6 w-11 rounded-md bg-surface-panel px-1 text-center text-[11.5px] tabular-nums text-text-primary outline-none ring-1 ring-line-structural focus:ring-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <IconBtn
              label={t('preview.fill.fontLarger')}
              onClick={() => onPatch({ fontSize: ptToFraction(fractionToPt(fontSize) + 0.5) })}
            >
              <Plus className="size-3.5" aria-hidden />
            </IconBtn>
          </div>
          <IconBtn
            label={canBold ? t('preview.fill.bold') : t('preview.fill.boldUnavailable')}
            pressed={boldActive}
            disabled={!canBold}
            onClick={() => onPatch({ bold: !boldActive })}
          >
            <Bold className="size-3.5" aria-hidden />
          </IconBtn>
          <IconBtn label={t('preview.fill.italic')} pressed={italicActive} onClick={() => onPatch({ italic: !italicActive })}>
            <Italic className="size-3.5" aria-hidden />
          </IconBtn>
          <ColorPicker
            title={t('preview.fill.textColor')}
            glyph="A"
            value={firstText?.color ?? '#15181c'}
            swatches={OVERLAY_COLORS}
            onChange={(v) => onPatch({ color: v ?? '#15181c' })}
          />
        </>
      )}

      {shapes.length > 0 && (
        <>
          {textBearing.length > 0 && <Divider />}
          {!hasHighlight && (
            <ColorPicker
              title={t('preview.fill.borderColor')}
              glyph="▢"
              allowNone
              value={firstShape?.stroke}
              swatches={OVERLAY_COLORS}
              onChange={(v) => onPatch({ stroke: v })}
            />
          )}
          <ColorPicker
            title={t('preview.fill.fillColor')}
            glyph="■"
            allowNone
            value={firstShape?.fill}
            swatches={hasHighlight ? HIGHLIGHT_COLORS : OVERLAY_COLORS}
            onChange={(v) => onPatch({ fill: v ?? 'none' })}
          />
          {!hasHighlight && (
            <div className="flex items-center" title={t('preview.fill.strokeWidth')}>
              <Waypoints className="mr-0.5 size-3.5 text-text-tertiary" aria-hidden />
              <IconBtn
                label={t('preview.fill.borderThinner')}
                onClick={() =>
                  onPatch({
                    strokeWidth: ptToStroke(strokeToPt(firstShape?.strokeWidth ?? 0.004) - 0.5),
                  })
                }
              >
                <Minus className="size-3.5" aria-hidden />
              </IconBtn>
              <span className="w-7 text-center text-[11px] tabular-nums text-text-secondary">
                {strokeToPt(firstShape?.strokeWidth ?? 0.004)}
              </span>
              <IconBtn
                label={t('preview.fill.borderThicker')}
                onClick={() =>
                  onPatch({
                    strokeWidth: ptToStroke(strokeToPt(firstShape?.strokeWidth ?? 0.004) + 0.5),
                  })
                }
              >
                <Plus className="size-3.5" aria-hidden />
              </IconBtn>
            </div>
          )}
          <label className="flex items-center gap-1 text-[11px] text-text-secondary" title={t('preview.fill.opacity')}>
            <span aria-hidden>◐</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={firstShape?.opacity ?? 1}
              onChange={(e) => onPatch({ opacity: Number(e.currentTarget.value) })}
              className="h-1 w-14 cursor-pointer accent-accent"
            />
          </label>
        </>
      )}

      <Divider />

      {formable.length > 0 && (
        <IconBtn
          label={interactiveActive ? t('preview.fill.interactiveOn') : t('preview.fill.interactiveOff')}
          pressed={interactiveActive}
          onClick={() => onPatch({ interactive: !interactiveActive })}
        >
          <span className="text-[11px] font-semibold leading-none">⌨</span>
        </IconBtn>
      )}
      <IconBtn label={t('preview.fill.duplicate')} onClick={onDuplicate}>
        <Copy className="size-3.5" aria-hidden />
      </IconBtn>
      {canGroup && (
        <IconBtn label={t('preview.fill.group')} onClick={onGroup}>
          <Group className="size-3.5" aria-hidden />
        </IconBtn>
      )}
      {canUngroup && (
        <IconBtn label={t('preview.fill.ungroup')} onClick={onUngroup}>
          <Ungroup className="size-3.5" aria-hidden />
        </IconBtn>
      )}
      <IconBtn label={t('preview.fill.saveToLibrary')} onClick={onSaveToLibrary}>
        <Save className="size-3.5" aria-hidden />
      </IconBtn>
      <IconBtn label={t('preview.fill.delete')} danger onClick={onDelete}>
        <Trash2 className="size-3.5" aria-hidden />
      </IconBtn>
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-line-structural" aria-hidden />;
}

function IconBtn({
  label,
  onClick,
  children,
  pressed,
  disabled,
  danger,
}: {
  label: string;
  onClick(): void;
  children: React.ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'grid size-6 place-items-center rounded-md',
        disabled
          ? 'cursor-not-allowed text-text-tertiary opacity-40'
          : pressed
            ? 'bg-accent text-on-accent'
            : danger
              ? 'text-text-secondary hover:bg-danger/15 hover:text-danger'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      {children}
    </button>
  );
}
