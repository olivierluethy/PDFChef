import { useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartHorizontal,
  Bold,
  BringToFront,
  ChevronDown,
  ChevronUp,
  Copy,
  FlipHorizontal,
  FlipVertical,
  Group,
  Highlighter,
  Italic,
  Keyboard,
  Minus,
  MousePointerSquareDashed,
  PanelRightClose,
  Plus,
  RotateCw,
  Save,
  SendToBack,
  Trash2,
  Ungroup,
} from 'lucide-react';
import type { Overlay, OverlayLayerMode } from '../../../domain/types';
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
  onReorder(mode: OverlayLayerMode): void;
  /** 1-basierte Ebene der Auswahl (nur bei genau einem Element), sonst null. */
  layerIndex: number | null;
  /** Gesamtzahl der Overlays auf der Seite. */
  layerCount: number;
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
 * (ein oder mehrere Overlays). Aufgebaut wie ein praezises Instrumentenpult:
 * ruhige Flaechen, ein einziger Akzent fuer aktive Zustaende, segmentierte
 * Regler-Gruppen und tabellarische Zahlen. Ersetzt die frueher schwebende
 * Bearbeitungsleiste -- die Regler stehen fest in einer eigenen Spalte.
 */
export function FillPropertiesPanel({
  overlays,
  spinDeg,
  onPatch,
  onDuplicate,
  onDelete,
  onGroup,
  onUngroup,
  onReorder,
  layerIndex,
  layerCount,
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
  const strokePt = strokeToPt(firstShape?.strokeWidth ?? 0.004);

  return (
    <div className="flex h-full w-full flex-col bg-surface-panel">
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-line-structural pl-3 pr-2">
        <span className="t-label text-text-primary">{t('preview.fill.panelTitle')}</span>
        <button
          type="button"
          onClick={onCollapse}
          title={t('preview.fill.collapsePanel')}
          aria-label={t('preview.fill.collapsePanel')}
          className="ml-auto grid size-7 place-items-center rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <PanelRightClose className="size-4" aria-hidden />
        </button>
      </header>

      {!hasSelection ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <MousePointerSquareDashed className="size-6 text-text-tertiary" aria-hidden />
          <p className="t-meta max-w-[22ch]">{t('preview.fill.panelEmpty')}</p>
        </div>
      ) : (
        <div className="scroll-fade-y min-h-0 flex-1 overflow-auto px-3 pb-4">
          {textBearing.length > 0 && (
            <Section title={t('preview.fill.sectionText')} first>
              <FontPicker
                value={firstText?.font ?? 'helvetica'}
                onChange={(key) => onPatch({ font: key })}
              />
              <Row label={t('preview.fill.fontSize')}>
                <Stepper
                  value={fontPt}
                  decLabel={t('preview.fill.fontSmaller')}
                  incLabel={t('preview.fill.fontLarger')}
                  fieldLabel={t('preview.fill.fontSizePt')}
                  min={fractionToPt(MIN_FONT_SIZE)}
                  max={fractionToPt(MAX_FONT_SIZE)}
                  step={0.5}
                  onStep={(d) => onPatch({ fontSize: ptToFraction(fontPt + d) })}
                  onSet={(v) => onPatch({ fontSize: ptToFraction(v) })}
                />
              </Row>
              <input
                type="range"
                min={fractionToPt(MIN_FONT_SIZE)}
                max={fractionToPt(MAX_FONT_SIZE)}
                step={0.5}
                value={fontPt}
                aria-label={t('preview.fill.fontSize')}
                onChange={(e) => onPatch({ fontSize: ptToFraction(Number(e.currentTarget.value)) })}
                className="h-1 w-full cursor-pointer accent-accent"
              />
              <Row label={t('preview.fill.styleLabel')}>
                <Seg>
                  <SegBtn
                    label={canBold ? t('preview.fill.bold') : t('preview.fill.boldUnavailable')}
                    pressed={boldActive}
                    disabled={!canBold}
                    onClick={() => onPatch({ bold: !boldActive })}
                  >
                    <Bold className="size-3.5" aria-hidden />
                  </SegBtn>
                  <SegBtn
                    label={t('preview.fill.italic')}
                    pressed={italicActive}
                    onClick={() => onPatch({ italic: !italicActive })}
                  >
                    <Italic className="size-3.5" aria-hidden />
                  </SegBtn>
                </Seg>
              </Row>
              <Row label={t('preview.fill.sectionColor')}>
                <div className="flex items-center gap-1">
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
              </Row>
              {formable.length > 0 && (
                <Row label={t('preview.fill.sectionAlign')}>
                  <Seg>
                    <SegBtn
                      label={t('preview.fill.valignTop')}
                      pressed={valign === 'top'}
                      onClick={() => onPatch({ valign: 'top' })}
                    >
                      <AlignStartHorizontal className="size-3.5" aria-hidden />
                    </SegBtn>
                    <SegBtn
                      label={t('preview.fill.valignMiddle')}
                      pressed={valign === 'middle'}
                      onClick={() => onPatch({ valign: 'middle' })}
                    >
                      <AlignCenterHorizontal className="size-3.5" aria-hidden />
                    </SegBtn>
                    <SegBtn
                      label={t('preview.fill.valignBottom')}
                      pressed={valign === 'bottom'}
                      onClick={() => onPatch({ valign: 'bottom' })}
                    >
                      <AlignEndHorizontal className="size-3.5" aria-hidden />
                    </SegBtn>
                  </Seg>
                </Row>
              )}
            </Section>
          )}

          {shapes.length > 0 && (
            <Section title={t('preview.fill.sectionShape')}>
              {!hasHighlight && (
                <Row label={t('preview.fill.borderColor')}>
                  <ColorPicker
                    title={t('preview.fill.borderColor')}
                    glyph="▢"
                    allowNone
                    value={firstShape?.stroke}
                    swatches={OVERLAY_COLORS}
                    onChange={(v) => onPatch({ stroke: v })}
                  />
                </Row>
              )}
              <Row label={t('preview.fill.fillColor')}>
                <ColorPicker
                  title={t('preview.fill.fillColor')}
                  glyph="■"
                  allowNone
                  value={firstShape?.fill}
                  swatches={hasHighlight ? HIGHLIGHT_COLORS : OVERLAY_COLORS}
                  onChange={(v) => onPatch({ fill: v ?? 'none' })}
                />
              </Row>
              {!hasHighlight && (
                <Row label={t('preview.fill.strokeWidth')}>
                  <Stepper
                    value={strokePt}
                    decLabel={t('preview.fill.borderThinner')}
                    incLabel={t('preview.fill.borderThicker')}
                    fieldLabel={t('preview.fill.strokeWidth')}
                    min={0}
                    max={20}
                    step={0.5}
                    onStep={(d) => onPatch({ strokeWidth: ptToStroke(strokePt + d) })}
                    onSet={(v) => onPatch({ strokeWidth: ptToStroke(v) })}
                  />
                </Row>
              )}
              <Row label={t('preview.fill.opacity')}>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={firstShape?.opacity ?? 1}
                    aria-label={t('preview.fill.opacity')}
                    onChange={(e) => onPatch({ opacity: Number(e.currentTarget.value) })}
                    className="h-1 w-20 cursor-pointer accent-accent"
                  />
                  <span className="t-data w-8 text-right text-text-secondary">
                    {Math.round((firstShape?.opacity ?? 1) * 100)}
                  </span>
                </div>
              </Row>
            </Section>
          )}

          <Section title={t('preview.fill.sectionRotate')}>
            <Row label={t('preview.fill.angle')}>
              <div className="flex items-center gap-1.5">
                <RotateCw className="size-3.5 text-text-tertiary" aria-hidden />
                <NumberField
                  key={rotationDeg}
                  value={rotationDeg}
                  label={t('preview.fill.angle')}
                  suffix="°"
                  onSet={(v) => onPatch({ rotation: normalizeAngle(v) })}
                />
              </div>
            </Row>
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={rotationDeg}
              aria-label={t('preview.fill.angle')}
              onChange={(e) => onPatch({ rotation: normalizeAngle(Number(e.currentTarget.value)) })}
              className="h-1 w-full cursor-pointer accent-accent"
            />
            {formable.length > 0 && (
              <Row label={t('preview.fill.flipLabel')}>
                <Seg>
                  <SegBtn
                    label={t('preview.fill.flipH')}
                    pressed={flipXActive}
                    onClick={() => onPatch({ flipX: !flipXActive })}
                  >
                    <FlipHorizontal className="size-3.5" aria-hidden />
                  </SegBtn>
                  <SegBtn
                    label={t('preview.fill.flipV')}
                    pressed={flipYActive}
                    onClick={() => onPatch({ flipY: !flipYActive })}
                  >
                    <FlipVertical className="size-3.5" aria-hidden />
                  </SegBtn>
                </Seg>
              </Row>
            )}
          </Section>

          <Section title={t('preview.fill.sectionLayer')}>
            <div className="flex items-center justify-between gap-2">
              <span className="t-label text-text-secondary">
                {layerIndex != null
                  ? t('preview.fill.layerPosition', { n: layerIndex, total: layerCount })
                  : t('preview.fill.layerMultiple', { n: overlays.length })}
              </span>
              <Seg>
                <SegBtn
                  label={t('preview.fill.layerBack')}
                  disabled={layerIndex === 1}
                  onClick={() => onReorder('back')}
                >
                  <SendToBack className="size-3.5" aria-hidden />
                </SegBtn>
                <SegBtn
                  label={t('preview.fill.layerBackward')}
                  disabled={layerIndex === 1}
                  onClick={() => onReorder('backward')}
                >
                  <ChevronDown className="size-4" aria-hidden />
                </SegBtn>
                <SegBtn
                  label={t('preview.fill.layerForward')}
                  disabled={layerIndex === layerCount}
                  onClick={() => onReorder('forward')}
                >
                  <ChevronUp className="size-4" aria-hidden />
                </SegBtn>
                <SegBtn
                  label={t('preview.fill.layerFront')}
                  disabled={layerIndex === layerCount}
                  onClick={() => onReorder('front')}
                >
                  <BringToFront className="size-3.5" aria-hidden />
                </SegBtn>
              </Seg>
            </div>
          </Section>

          <Section title={t('preview.fill.sectionActions')}>
            {formable.length > 0 && (
              <ActionButton
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
            <ActionButton
              label={t('preview.fill.duplicate')}
              onClick={onDuplicate}
              icon={<Copy className="size-3.5" aria-hidden />}
            />
            {canGroup && (
              <ActionButton
                label={t('preview.fill.group')}
                onClick={onGroup}
                icon={<Group className="size-3.5" aria-hidden />}
              />
            )}
            {canUngroup && (
              <ActionButton
                label={t('preview.fill.ungroup')}
                onClick={onUngroup}
                icon={<Ungroup className="size-3.5" aria-hidden />}
              />
            )}
            <ActionButton
              label={t('preview.fill.saveToLibrary')}
              onClick={() => setSaveOpen(true)}
              icon={<Save className="size-3.5" aria-hidden />}
            />
            <ActionButton
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

/** Ein thematischer Block; ausser dem ersten mit feiner Trennlinie darueber. */
function Section({
  title,
  children,
  first,
}: {
  title: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <section className={cx('space-y-2.5 py-3', !first && 'border-t border-line-hairline')}>
      <h3 className="text-[11.5px] font-medium text-text-tertiary">{title}</h3>
      {children}
    </section>
  );
}

/** Beschriftete Zeile: Label links, Regler rechts. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-2">
      <span className="t-label truncate text-text-secondary">{label}</span>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

/** Segmentierte Regler-Gruppe auf erhabenem Grund. */
function Seg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'inline-flex items-center gap-0.5 rounded-lg bg-surface-raised p-0.5 ring-1 ring-line-structural',
        className,
      )}
    >
      {children}
    </div>
  );
}

function SegBtn({
  label,
  onClick,
  children,
  pressed,
  disabled,
  grow,
}: {
  label: string;
  onClick(): void;
  children: React.ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  grow?: boolean;
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
        'grid h-6 place-items-center rounded-md transition-colors',
        grow ? 'flex-1' : 'w-7',
        disabled
          ? 'cursor-not-allowed text-text-tertiary opacity-40'
          : pressed
            ? 'bg-accent text-on-accent'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      {children}
    </button>
  );
}

/** Zahlenfeld mit −/+-Steppern auf erhabenem Grund. */
function Stepper({
  value,
  onStep,
  onSet,
  decLabel,
  incLabel,
  fieldLabel,
  min,
  max,
  step,
}: {
  value: number;
  onStep(delta: number): void;
  onSet(value: number): void;
  decLabel: string;
  incLabel: string;
  fieldLabel: string;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div className="inline-flex items-center rounded-lg bg-surface-raised ring-1 ring-line-structural">
      <button
        type="button"
        title={decLabel}
        aria-label={decLabel}
        onClick={() => onStep(-step)}
        className="grid size-7 place-items-center rounded-l-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <input
        key={value}
        type="number"
        step={step}
        min={min}
        max={max}
        defaultValue={value}
        aria-label={fieldLabel}
        title={fieldLabel}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={(e) => {
          const n = Number(e.currentTarget.value);
          if (Number.isFinite(n)) onSet(n);
        }}
        className="t-data h-7 w-10 border-x border-line-hairline bg-transparent text-center text-text-primary outline-none focus:bg-surface-hover [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        title={incLabel}
        aria-label={incLabel}
        onClick={() => onStep(step)}
        className="grid size-7 place-items-center rounded-r-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      >
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** Einfaches Zahlenfeld mit optionalem Suffix (z. B. Grad). */
function NumberField({
  value,
  onSet,
  label,
  suffix,
}: {
  value: number;
  onSet(value: number): void;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="inline-flex items-center rounded-lg bg-surface-raised px-1.5 ring-1 ring-line-structural focus-within:ring-accent">
      <input
        type="number"
        step={1}
        defaultValue={value}
        aria-label={label}
        title={label}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onBlur={(e) => {
          const n = Number(e.currentTarget.value);
          if (Number.isFinite(n)) onSet(n);
        }}
        className="t-data h-7 w-9 bg-transparent text-center text-text-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix && (
        <span className="t-data pr-0.5 text-text-tertiary" aria-hidden>
          {suffix}
        </span>
      )}
    </div>
  );
}

function ActionButton({
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
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors',
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
