import { useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartHorizontal,
  Bold,
  Copy,
  FlipHorizontal,
  FlipVertical,
  Group,
  Highlighter,
  Italic,
  Keyboard,
  Minus,
  PanelRightClose,
  Plus,
  RotateCw,
  Save,
  Trash2,
  Ungroup,
} from 'lucide-react';
import type { Overlay } from '../../../domain/types';
import type { LibraryItemKind } from '../../../services/persistence/db';
import { overlayFontSpec, overlayHasBold } from '../../../domain/overlayFonts';
import {
  HIGHLIGHT_COLORS,
  OVERLAY_COLORS,
  overlayShapeSupportsText,
} from '../../../domain/overlayShapes';
import { useLibraryStore } from '../../app/StoreProvider';
import { cx } from '../../common/cx';
import { useT } from '../../i18n';
import { ColorPicker } from './ColorPicker';
import { FontPicker } from './FontPicker';
import { NameDialog } from './NameDialog';
import {
  DEFAULT_FONT_SIZE,
  fractionToPt,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  normalizeAngle,
  ptToFraction,
  ptToStroke,
  strokeToPt,
} from './units';

export interface FillPropertiesPanelProps {
  /** Die aktuell ausgewaehlten Overlays (leer = nichts gewaehlt). */
  overlays: Overlay[];
  /** Live-Drehwinkel waehrend des Ziehens am Griff, sonst null. */
  spinDeg: number | null;
  onPatch(patch: Partial<Overlay>): void;
  onDuplicate(): void;
  onDelete(): void;
  onGroup(): void;
  onUngroup(): void;
  canGroup: boolean;
  canUngroup: boolean;
  onCollapse(): void;
}

/** Bestimmt die Bibliotheks-Kategorie einer Auswahl. */
function libraryKindOf(overlays: Overlay[]): LibraryItemKind {
  if (overlays.length > 1) return 'group';
  const first = overlays[0];
  if (first?.kind === 'image') return 'signature';
  if (first?.kind === 'shape') return 'shape';
  return 'text';
}

/**
 * Persistentes, kontextsensitives Eigenschaften-Panel fuer die aktuelle Auswahl
 * (ein oder mehrere Overlays). Ersetzt die frueher ueber dem Blatt schwebende
 * Bearbeitungsleiste: die Regler stehen fest in einer eigenen Spalte, verdecken
 * so nie den Dreh-Griff und zeigen den Drehwinkel live waehrend des Drehens.
 */
export function FillPropertiesPanel({
  overlays,
  spinDeg,
  onPatch,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  canGroup,
  canUngroup,
  onCollapse,
}: FillPropertiesPanelProps) {
  const t = useT();
  const library = useLibraryStore();
  const [saveOpen, setSaveOpen] = useState(false);

  const textBearing = overlays.filter((o) => o.kind === 'text' || overlayShapeSupportsText(o));
  const shapes = overlays.filter((o) => o.kind === 'shape');
  const formable = overlays.filter((o) => o.kind === 'text');
  const hasHighlight = shapes.some((o) => o.shape === 'highlight');
  const hasSelection = overlays.length > 0;

  const firstText = textBearing[0];
  const firstShape = shapes[0];
  const fontSize = firstText?.fontSize ?? DEFAULT_FONT_SIZE;
  const canBold = textBearing.some((o) => overlayHasBold(overlayFontSpec(o.font)));
  const boldActive = firstText?.bold ?? false;
  const italicActive = firstText?.italic ?? false;
  const interactiveActive = formable.length > 0 && formable.every((o) => o.interactive);
  const valign = firstText?.valign ?? 'top';
  const flipXActive = firstText?.flipX ?? false;
  const flipYActive = firstText?.flipY ?? false;
  // Live-Wert waehrend des Drehens hat Vorrang vor dem gespeicherten Winkel.
  const rotationDeg = spinDeg ?? normalizeAngle(overlays[0]?.rotation ?? 0);
  const fontPt = fractionToPt(fontSize);

  return (
    <div className="flex h-full w-full flex-col bg-surface-panel">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-line-structural px-3">
        <span className="t-panel-title text-text-primary">{t('preview.fill.panelTitle')}</span>
        <button
          type="button"
          onClick={onCollapse}
          title={t('preview.fill.collapsePanel')}
          aria-label={t('preview.fill.collapsePanel')}
          className="ml-auto grid size-6 place-items-center rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <PanelRightClose className="size-4" aria-hidden />
        </button>
      </header>

      {!hasSelection ? (
        <p className="px-4 py-6 text-[12.5px] leading-relaxed text-text-tertiary">
          {t('preview.fill.panelEmpty')}
        </p>
      ) : (
        <div className="scroll-fade-y min-h-0 flex-1 space-y-4 overflow-auto px-3 py-3">
          {textBearing.length > 0 && (
            <Section title={t('preview.fill.sectionText')}>
              <FontPicker
                value={firstText?.font ?? 'helvetica'}
                onChange={(key) => onPatch({ font: key })}
              />
              <div className="flex items-center gap-1">
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
                  className="h-7 w-14 rounded-md bg-surface-panel px-1 text-center text-[12px] tabular-nums text-text-primary outline-none ring-1 ring-line-structural focus:ring-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <IconBtn
                  label={t('preview.fill.fontLarger')}
                  onClick={() => onPatch({ fontSize: ptToFraction(fractionToPt(fontSize) + 0.5) })}
                >
                  <Plus className="size-3.5" aria-hidden />
                </IconBtn>
                <input
                  type="range"
                  min={fractionToPt(MIN_FONT_SIZE)}
                  max={fractionToPt(MAX_FONT_SIZE)}
                  step={0.5}
                  value={fontPt}
                  aria-label={t('preview.fill.fontSize')}
                  title={t('preview.fill.fontSize')}
                  onChange={(e) => onPatch({ fontSize: ptToFraction(Number(e.currentTarget.value)) })}
                  className="ml-1 h-1 flex-1 cursor-pointer accent-accent"
                />
              </div>
              <div className="flex items-center gap-1">
                <IconBtn
                  label={canBold ? t('preview.fill.bold') : t('preview.fill.boldUnavailable')}
                  pressed={boldActive}
                  disabled={!canBold}
                  onClick={() => onPatch({ bold: !boldActive })}
                >
                  <Bold className="size-3.5" aria-hidden />
                </IconBtn>
                <IconBtn
                  label={t('preview.fill.italic')}
                  pressed={italicActive}
                  onClick={() => onPatch({ italic: !italicActive })}
                >
                  <Italic className="size-3.5" aria-hidden />
                </IconBtn>
              </div>
            </Section>
          )}

          {textBearing.length > 0 && (
            <Section title={t('preview.fill.sectionColor')}>
              <div className="flex flex-wrap items-center gap-1">
                <ColorPicker
                  title={t('preview.fill.textColor')}
                  glyph="A"
                  allowNone
                  value={firstText?.color ?? '#15181c'}
                  swatches={OVERLAY_COLORS}
                  onChange={(v) => onPatch({ color: v ?? 'none' })}
                />
                {formable.length > 0 && (
                  <ColorPicker
                    title={t('preview.fill.textBg')}
                    glyph={<Highlighter className="size-3.5" aria-hidden />}
                    allowNone
                    value={firstText?.textBg}
                    swatches={HIGHLIGHT_COLORS}
                    onChange={(v) => onPatch({ textBg: v ?? 'none' })}
                  />
                )}
              </div>
            </Section>
          )}

          {formable.length > 0 && (
            <Section title={t('preview.fill.sectionAlign')}>
              <div className="flex items-center gap-1">
                <IconBtn
                  label={t('preview.fill.valignTop')}
                  pressed={valign === 'top'}
                  onClick={() => onPatch({ valign: 'top' })}
                >
                  <AlignStartHorizontal className="size-3.5" aria-hidden />
                </IconBtn>
                <IconBtn
                  label={t('preview.fill.valignMiddle')}
                  pressed={valign === 'middle'}
                  onClick={() => onPatch({ valign: 'middle' })}
                >
                  <AlignCenterHorizontal className="size-3.5" aria-hidden />
                </IconBtn>
                <IconBtn
                  label={t('preview.fill.valignBottom')}
                  pressed={valign === 'bottom'}
                  onClick={() => onPatch({ valign: 'bottom' })}
                >
                  <AlignEndHorizontal className="size-3.5" aria-hidden />
                </IconBtn>
              </div>
            </Section>
          )}

          {shapes.length > 0 && (
            <Section title={t('preview.fill.sectionShape')}>
              <div className="flex flex-wrap items-center gap-1">
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
              </div>
              {!hasHighlight && (
                <div className="flex items-center gap-1" title={t('preview.fill.strokeWidth')}>
                  <span className="w-16 text-[11.5px] text-text-secondary">
                    {t('preview.fill.strokeWidth')}
                  </span>
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
                  <span className="w-8 text-center text-[11.5px] tabular-nums text-text-secondary">
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
              <label
                className="flex items-center gap-2 text-[11.5px] text-text-secondary"
                title={t('preview.fill.opacity')}
              >
                <span className="w-16">{t('preview.fill.opacity')}</span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={firstShape?.opacity ?? 1}
                  onChange={(e) => onPatch({ opacity: Number(e.currentTarget.value) })}
                  className="h-1 flex-1 cursor-pointer accent-accent"
                />
              </label>
            </Section>
          )}

          <Section title={t('preview.fill.sectionRotate')}>
            <div className="flex items-center gap-2">
              <RotateCw className="size-3.5 text-text-tertiary" aria-hidden />
              <input
                key={rotationDeg}
                type="number"
                step={1}
                defaultValue={rotationDeg}
                aria-label={t('preview.fill.angle')}
                title={t('preview.fill.angle')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                onBlur={(e) => {
                  const deg = Number(e.currentTarget.value);
                  if (Number.isFinite(deg)) onPatch({ rotation: normalizeAngle(deg) });
                }}
                className="h-7 w-14 rounded-md bg-surface-panel px-1 text-center text-[12px] tabular-nums text-text-primary outline-none ring-1 ring-line-structural focus:ring-accent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[12px] text-text-tertiary" aria-hidden>
                °
              </span>
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={rotationDeg}
                aria-label={t('preview.fill.angle')}
                onChange={(e) => onPatch({ rotation: normalizeAngle(Number(e.currentTarget.value)) })}
                className="ml-1 h-1 flex-1 cursor-pointer accent-accent"
              />
            </div>
            {formable.length > 0 && (
              <div className="flex items-center gap-1">
                <IconBtn
                  label={t('preview.fill.flipH')}
                  pressed={flipXActive}
                  onClick={() => onPatch({ flipX: !flipXActive })}
                >
                  <FlipHorizontal className="size-3.5" aria-hidden />
                </IconBtn>
                <IconBtn
                  label={t('preview.fill.flipV')}
                  pressed={flipYActive}
                  onClick={() => onPatch({ flipY: !flipYActive })}
                >
                  <FlipVertical className="size-3.5" aria-hidden />
                </IconBtn>
              </div>
            )}
          </Section>

          <Section title={t('preview.fill.sectionActions')}>
            {formable.length > 0 && (
              <ActionBtn
                label={
                  interactiveActive
                    ? t('preview.fill.interactiveOn')
                    : t('preview.fill.interactiveOff')
                }
                pressed={interactiveActive}
                onClick={() => onPatch({ interactive: !interactiveActive })}
                icon={<Keyboard className="size-3.5" aria-hidden />}
              />
            )}
            <ActionBtn
              label={t('preview.fill.duplicate')}
              onClick={onDuplicate}
              icon={<Copy className="size-3.5" aria-hidden />}
            />
            {canGroup && (
              <ActionBtn
                label={t('preview.fill.group')}
                onClick={onGroup}
                icon={<Group className="size-3.5" aria-hidden />}
              />
            )}
            {canUngroup && (
              <ActionBtn
                label={t('preview.fill.ungroup')}
                onClick={onUngroup}
                icon={<Ungroup className="size-3.5" aria-hidden />}
              />
            )}
            <ActionBtn
              label={t('preview.fill.saveToLibrary')}
              onClick={() => setSaveOpen(true)}
              icon={<Save className="size-3.5" aria-hidden />}
            />
            <ActionBtn
              label={t('preview.fill.delete')}
              onClick={onDelete}
              danger
              icon={<Trash2 className="size-3.5" aria-hidden />}
            />
          </Section>
        </div>
      )}

      {saveOpen && (
        <NameDialog
          title={t('preview.fill.saveToLibrary')}
          label={t('preview.fill.blockNameLabel')}
          defaultValue=""
          onCancel={() => setSaveOpen(false)}
          onConfirm={(name) => {
            void library.getState().add(libraryKindOf(overlays), name, overlays);
            setSaveOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">{title}</h3>
      {children}
    </section>
  );
}

function IconBtn({
  label,
  onClick,
  children,
  pressed,
  disabled,
}: {
  label: string;
  onClick(): void;
  children: React.ReactNode;
  pressed?: boolean;
  disabled?: boolean;
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
        'grid size-7 shrink-0 place-items-center rounded-md',
        disabled
          ? 'cursor-not-allowed text-text-tertiary opacity-40'
          : pressed
            ? 'bg-accent text-on-accent'
            : 'text-text-secondary ring-1 ring-line-structural hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      {children}
    </button>
  );
}

function ActionBtn({
  label,
  onClick,
  icon,
  pressed,
  danger,
}: {
  label: string;
  onClick(): void;
  icon: React.ReactNode;
  pressed?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px]',
        pressed
          ? 'bg-accent text-on-accent'
          : danger
            ? 'text-text-secondary hover:bg-danger/15 hover:text-danger'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
