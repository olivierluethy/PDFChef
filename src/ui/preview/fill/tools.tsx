import {
  ArrowUpRight,
  BookMarked,
  CalendarDays,
  Check,
  ChevronDown,
  Circle,
  Highlighter,
  Minus,
  MousePointer2,
  PenLine,
  PenTool,
  Pentagon,
  ScanLine,
  Shapes,
  Square,
  SquareDashed,
  Type,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ShapeKind } from '../../../domain/types';
import { SHAPE_SPECS } from '../../../domain/overlayShapes';
import { cx } from '../../common/cx';
import { useT } from '../../i18n';

/** Das aktive Werkzeug: Auswahl, Text oder eine der Formen. */
export type Tool = 'select' | 'text' | ShapeKind;

/** Wie eine Form gezeichnet wird -- bestimmt die Zeigerinteraktion im Editor. */
export type DrawMode = 'box' | 'line' | 'freehand' | 'polygon' | 'mark';

export function shapeDrawMode(kind: ShapeKind): DrawMode {
  switch (kind) {
    case 'line':
    case 'arrow':
      return 'line';
    case 'freehand':
      return 'freehand';
    case 'polygon':
      return 'polygon';
    case 'check':
    case 'cross':
      return 'mark';
    default:
      return 'box';
  }
}

const SHAPE_ICONS: Record<ShapeKind, LucideIcon> = {
  rect: Square,
  roundRect: SquareDashed,
  ellipse: Circle,
  line: Minus,
  arrow: ArrowUpRight,
  polygon: Pentagon,
  freehand: PenTool,
  highlight: Highlighter,
  check: Check,
  cross: X,
};

export interface ToolPaletteProps {
  tool: Tool;
  onTool(tool: Tool): void;
  onSignature(): void;
  onDate(): void;
  onLibrary(): void;
  onDetect?(): void;
  libraryOpen: boolean;
}

/** Die obere Werkzeugleiste im Ausfuell-Modus. */
export function ToolPalette({
  tool,
  onTool,
  onSignature,
  onDate,
  onLibrary,
  onDetect,
  libraryOpen,
}: ToolPaletteProps) {
  const t = useT();
  const shapeActive = tool !== 'select' && tool !== 'text';
  return (
    <div className="pointer-events-auto absolute left-2 top-2 flex flex-wrap items-center gap-1 rounded-lg bg-surface-raised px-1.5 py-1 text-[11.5px] text-text-secondary shadow-[var(--float-shadow)] ring-1 ring-line-structural">
      <PaletteButton
        icon={MousePointer2}
        label={t('preview.fill.toolSelect')}
        active={tool === 'select'}
        onClick={() => onTool('select')}
      />
      <PaletteButton
        icon={Type}
        label={t('preview.fill.toolText')}
        active={tool === 'text'}
        onClick={() => onTool('text')}
      />
      <ShapeMenu current={shapeActive ? (tool as ShapeKind) : null} onPick={(k) => onTool(k)} />

      <span className="mx-0.5 h-5 w-px bg-line-structural" aria-hidden />

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onSignature}
        className="inline-flex items-center gap-1 rounded bg-surface-panel px-1.5 py-0.5 text-text-primary ring-1 ring-line-structural hover:bg-surface-hover"
      >
        <PenLine className="size-3.5" aria-hidden /> {t('preview.fill.signature')}
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onDate}
        className="inline-flex items-center gap-1 rounded bg-surface-panel px-1.5 py-0.5 text-text-primary ring-1 ring-line-structural hover:bg-surface-hover"
      >
        <CalendarDays className="size-3.5" aria-hidden /> {t('preview.fill.date')}
      </button>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onLibrary}
        aria-pressed={libraryOpen}
        className={cx(
          'inline-flex items-center gap-1 rounded px-1.5 py-0.5 ring-1 ring-line-structural',
          libraryOpen
            ? 'bg-accent text-on-accent'
            : 'bg-surface-panel text-text-primary hover:bg-surface-hover',
        )}
      >
        <BookMarked className="size-3.5" aria-hidden /> {t('preview.fill.library')}
      </button>
      {onDetect && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDetect}
          className="inline-flex items-center gap-1 rounded bg-surface-panel px-1.5 py-0.5 text-text-primary ring-1 ring-line-structural hover:bg-surface-hover"
        >
          <ScanLine className="size-3.5" aria-hidden /> {t('preview.fill.detectFields')}
        </button>
      )}
    </div>
  );
}

function PaletteButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className={cx(
        'grid size-7 place-items-center rounded-md',
        active ? 'bg-accent text-on-accent' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}

function ShapeMenu({
  current,
  onPick,
}: {
  current: ShapeKind | null;
  onPick(kind: ShapeKind): void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const CurrentIcon = current ? SHAPE_ICONS[current] : Shapes;

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
        title={t('preview.fill.shapes')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-pressed={current !== null}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'inline-flex h-7 items-center gap-0.5 rounded-md px-1.5',
          current !== null
            ? 'bg-accent text-on-accent'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
        )}
      >
        <CurrentIcon className="size-4" aria-hidden />
        <ChevronDown className={cx('size-3 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-40 mt-1 grid w-40 grid-cols-1 gap-0.5 rounded-lg bg-surface-panel p-1 shadow-[var(--float-shadow)] ring-1 ring-line-structural"
        >
          {SHAPE_SPECS.map((spec) => {
            const Icon = SHAPE_ICONS[spec.kind];
            return (
              <button
                key={spec.kind}
                type="button"
                role="menuitem"
                onClick={() => {
                  onPick(spec.kind);
                  setOpen(false);
                }}
                className={cx(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px]',
                  spec.kind === current
                    ? 'bg-accent text-on-accent'
                    : 'text-text-primary hover:bg-surface-hover',
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden /> {t('preview.shape.' + spec.kind)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
