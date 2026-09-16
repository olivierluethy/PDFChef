import { useEffect, useRef, useState } from 'react';
import { GripVertical, RotateCw } from 'lucide-react';
import { newId } from '../../domain/ids';
import { overlayCssFamily, overlayFontSpec } from '../../domain/overlayFonts';
import {
  hasFill,
  isTransparentColor,
  makeShapeOverlay,
  overlayShapeSupportsText,
  overlayTextColorCss,
} from '../../domain/overlayShapes';
import { instantiateOverlays } from '../../domain/overlayLibrary';
import type { Overlay, ShapeKind } from '../../domain/types';
import type { LibraryItemRecord } from '../../services/persistence/db';
import { cx } from '../common/cx';
import { useI18n, useT } from '../i18n';
import type { Locale } from '../i18n';
import { ensureOverlayFontFaces } from '../text/overlayFontFaces';
import { OverlayShape } from './OverlayShape';
import { SignatureDialog } from './SignatureDialog';
import { LibraryPopover } from './fill/LibraryPopover';
import { ToolPalette, shapeDrawMode, type Tool } from './fill/tools';
import { DEFAULT_FONT_SIZE, normalizeAngle } from './fill/units';

/** Ecke eines Auswahlrahmens fuer die Groessenaenderung. */
type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** BCP-47-Tag je App-Sprache -- Deutsch als Schweizer Variante. */
const DATE_LOCALE: Record<Locale, string> = { de: 'de-CH', en: 'en-US' };

/** Heutiges Datum lang und lesbar in der aktiven Sprache (z.B. "16. September 2026"). */
function formatToday(locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], { dateStyle: 'long' }).format(new Date());
}

export interface FillLayerProps {
  overlays: Overlay[];
  /** true, wenn der Ausfuell-Modus aktiv ist -- dann ist die Schicht interaktiv. */
  active: boolean;
  /**
   * Die auf DIESER Seite ausgewaehlten Overlay-Ids. Die Auswahl liegt zentral im
   * Viewer, damit ein einziges Eigenschaften-Panel sie seitenuebergreifend kennt.
   */
  selectedIds: string[];
  /** Setzt die Auswahl dieser Seite (leer = nichts gewaehlt). */
  onSelect(ids: string[]): void;
  /**
   * Alle Ebenen-Nummern einblenden. Sonst zeigt die Schicht nur die Nummer des
   * gewaehlten Elements -- die vollstaendigen Nummern erscheinen erst, wenn der
   * Nutzer sie fixiert oder gerade im Ebene-Bereich des Panels arbeitet.
   */
  showAllBadges: boolean;
  /** Meldet den Live-Drehwinkel waehrend des Ziehens am Griff (null nach dem Loslassen). */
  onSpin?(deg: number | null): void;
  /** Zuletzt gewaehlte Schrift -- neue Textfelder uebernehmen sie. */
  lastFont: string;
  onAdd(overlay: Overlay): void;
  /** Mehrere Overlays in einem Schritt anfuegen (Einfuegen/Duplizieren/Bibliothek). */
  onAddMany(overlays: Overlay[]): void;
  onUpdate(overlayId: string, patch: Partial<Overlay>): void;
  /** Mehrere Overlays in einem Schritt aendern (Gruppe verschieben/formatieren). */
  onUpdateMany(updates: { id: string; patch: Partial<Overlay> }[]): void;
  onRemove(overlayId: string): void;
  /** Mehrere Overlays in einem Schritt entfernen. */
  onRemoveMany(overlayIds: string[]): void;
  /** Erkennt die AcroForm-Felder dieser Seite und legt sie als Overlays an. */
  onDetect?(): void;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Sitzungsweite Zwischenablage fuer kopierte Overlays (fuer Einfuegen). */
let overlayClipboard: Overlay[] = [];

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Flache [x0,y0,x1,y1,...]-Punkte in eine SVG-`points`-Zeichenkette. */
function polygonPoints(flat: number[]): string {
  const pairs: string[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pairs.push(`${flat[i]},${flat[i + 1]}`);
  return pairs.join(' ');
}

/** CSS-Textstil eines Text-Overlays -- identisch fuer Editor und Vorschau. */
function overlayTextStyle(overlay: Overlay): React.CSSProperties {
  const spec = overlayFontSpec(overlay.font);
  const bold = overlay.bold ?? false;
  return {
    fontFamily: overlayCssFamily(spec, bold),
    fontWeight: bold ? 700 : spec.cssWeight,
    fontStyle: overlay.italic ? 'italic' : 'normal',
    color: overlayTextColorCss(overlay.color, '#15181c'),
  };
}

/**
 * Style fuer die zeilenweise Hintergrund-/Hervorhebungsfarbe eines Textfelds
 * (wie Words Texthervorhebung). Als Inline-Span mit `box-decoration-break: clone`
 * umschliesst die Farbe jede Zeile eng statt den ganzen Kasten zu fuellen.
 */
export function overlayTextBgStyle(textBg: string | undefined): React.CSSProperties | undefined {
  if (!hasFill(textBg)) return undefined;
  return {
    background: textBg,
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
    padding: '0.02em 0.15em',
    borderRadius: '0.1em',
  };
}

/** CSS-`justify-content` fuer die vertikale Ausrichtung des Texts im Feld. */
function valignJustify(v: Overlay['valign']): 'flex-start' | 'center' | 'flex-end' {
  return v === 'middle' ? 'center' : v === 'bottom' ? 'flex-end' : 'flex-start';
}

/** CSS-`transform` fuer das Spiegeln eines Textinhalts (undefined, wenn ungespiegelt). */
function flipTransform(o: Overlay): string | undefined {
  if (!o.flipX && !o.flipY) return undefined;
  return `scale(${o.flipX ? -1 : 1}, ${o.flipY ? -1 : 1})`;
}

/**
 * true, wenn der Winkel (nahezu) auf einer Ausrichtung liegt -- Vielfaches von
 * 45 Grad (0/45/90/135/180 ...). Dann werden die Hilfslinien kraeftig statt dezent.
 */
const CARDINAL_TOL = 1.5;
function nearCardinal(deg: number): boolean {
  const m = ((deg % 45) + 45) % 45;
  return m <= CARDINAL_TOL || m >= 45 - CARDINAL_TOL;
}

/** Erzeugt Klone einer Auswahl: frische Ids, versetzt, mit erhaltener (neu vergebener) Gruppierung. */
export function cloneOverlays(source: Overlay[], dx: number, dy: number): Overlay[] {
  const groupRemap = new Map<string, string>();
  return source.map((o) => {
    let groupId = o.groupId;
    if (groupId) {
      if (!groupRemap.has(groupId)) groupRemap.set(groupId, newId());
      groupId = groupRemap.get(groupId);
    }
    return {
      ...o,
      id: newId(),
      x: clamp01(o.x + dx),
      y: clamp01(o.y + dy),
      ...(groupId ? { groupId } : {}),
    };
  });
}

/**
 * Liegt deckungsgleich ueber dem gerenderten Seitenbild und erlaubt im
 * Ausfuell-Modus, Textfelder, Formen und Unterschriften zu setzen, zu
 * verschieben, zu formatieren, zu gruppieren, zu duplizieren und in der
 * Bibliothek abzulegen. Alle Positionen sind Bruchteile der Seite.
 */
export function FillLayer({
  overlays,
  active,
  selectedIds,
  onSelect,
  showAllBadges,
  onSpin,
  lastFont,
  onAdd,
  onAddMany,
  onUpdate,
  onUpdateMany,
  onRemove,
  onRemoveMany,
  onDetect,
}: FillLayerProps) {
  const t = useT();
  const { locale } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<Tool>('text');
  // Adapter auf die zentral (im Viewer) gehaltene Auswahl: erlaubt sowohl das
  // direkte Setzen einer Id-Liste als auch die vertrauten funktionalen Updates.
  const setSelectedIds = (next: string[] | ((prev: string[]) => string[])) =>
    onSelect(typeof next === 'function' ? next(selectedIds) : next);
  const [dragMap, setDragMap] = useState<Map<string, Box> | null>(null);
  // Live-Drehung waehrend des Ziehens am Dreh-Griff: Grad plus Mittelpunkt der
  // Auswahl (Bruchteile der Seite) fuer die eingeblendeten Ausrichtungslinien.
  const [spin, setSpin] = useState<{ id: string; deg: number; cx: number; cy: number } | null>(null);
  const [signing, setSigning] = useState(false);
  const [height, setHeight] = useState(0);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  // Welches Textfeld gerade den Fokus hat. Nur DAS wird beim Tippen nach oben
  // geholt (z 40); eine reine Auswahl hebt NICHT an, damit das Umsortieren auch
  // bei Text live sichtbar bleibt.
  const [focusedTextId, setFocusedTextId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  // `lastFont` (zuletzt gewaehlte Schrift fuer neue Felder) liegt zentral im Viewer.
  // Zeichnen einer Form (Box/Linie/Freihand) bzw. Polygon per Klick.
  const [draw, setDraw] = useState<
    | { mode: 'box' | 'line'; kind: ShapeKind; sx: number; sy: number; cx: number; cy: number }
    | { mode: 'freehand'; kind: ShapeKind; pts: number[] }
    | null
  >(null);
  const [polygon, setPolygon] = useState<number[] | null>(null);
  const draftIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    ensureOverlayFontFaces();
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setHeight(el.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const byId = new Map(overlays.map((o) => [o.id, o]));
  const groupmates = (id: string): string[] => {
    const o = byId.get(id);
    if (!o?.groupId) return [id];
    return overlays.filter((x) => x.groupId === o.groupId).map((x) => x.id);
  };
  const expand = (ids: string[]): string[] => Array.from(new Set(ids.flatMap(groupmates)));
  const selectedOverlays = selectedIds.map((id) => byId.get(id)).filter((o): o is Overlay => !!o);

  const rect = () => rootRef.current?.getBoundingClientRect() ?? null;
  const fracAt = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const r = rect();
    if (!r) return null;
    return { x: clamp01((clientX - r.left) / r.width), y: clamp01((clientY - r.top) / r.height) };
  };

  const selectOverlay = (id: string, additive: boolean) => {
    const mates = groupmates(id);
    setLibraryOpen(false);
    setSelectedIds((prev) => {
      if (additive) {
        return prev.includes(id)
          ? prev.filter((x) => !mates.includes(x))
          : Array.from(new Set([...prev, ...mates]));
      }
      return mates;
    });
  };

  // Leere Entwurfsfelder verwerfen (ausser `exceptId`). Liest LIVE aus dem DOM,
  // damit gerade getippter, noch nicht uebernommener Text nie verloren geht.
  const pruneEmptyDrafts = (exceptId?: string) => {
    const root = rootRef.current;
    if (!root) return;
    for (const id of Array.from(draftIds.current)) {
      if (id === exceptId) continue;
      const ta = root.querySelector<HTMLTextAreaElement>(`textarea[data-overlay-id="${id}"]`);
      if (!ta) continue;
      draftIds.current.delete(id);
      if (ta.value.trim() === '') {
        onRemove(id);
        setSelectedIds((s) => s.filter((x) => x !== id));
      }
    }
  };

  useEffect(() => {
    if (!active) return;
    const onDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && !root.contains(event.target as Node)) pruneEmptyDrafts();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [active]);

  // --- Aktionen auf der Auswahl ----------------------------------------------
  // Formatieren, Gruppieren und In-Bibliothek-Speichern laufen jetzt ueber das
  // Eigenschaften-Panel (Viewer-Ebene). Hier bleiben nur die Aktionen, die auch
  // per Tastenkuerzel ausgeloest werden.

  const duplicateSelection = () => {
    if (selectedOverlays.length === 0) return;
    const clones = cloneOverlays(selectedOverlays, 0.02, 0.02);
    onAddMany(clones);
    setSelectedIds(clones.map((c) => c.id));
  };
  const deleteSelection = () => {
    if (selectedIds.length === 0) return;
    onRemoveMany(selectedIds);
    setSelectedIds([]);
  };
  const insertLibraryItem = (item: LibraryItemRecord) => {
    const created = instantiateOverlays(item.overlays, { x: 0.28, y: 0.3 });
    if (created.length === 0) return;
    onAddMany(created);
    setSelectedIds(created.map((o) => o.id));
    setLibraryOpen(false);
    setTool('select');
  };

  // --- Tastenkuerzel ----------------------------------------------------------

  useEffect(() => {
    if (!active) return;
    const isEditable = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setLibraryOpen(false);
        setPolygon(null);
        return;
      }
      const editable = isEditable(e.target);
      const mod = e.metaKey || e.ctrlKey;
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editable && selectedIds.length > 0) {
        e.preventDefault();
        deleteSelection();
      } else if (mod && e.key.toLowerCase() === 'd' && selectedIds.length > 0) {
        e.preventDefault();
        duplicateSelection();
      } else if (mod && e.key.toLowerCase() === 'c' && !editable && selectedIds.length > 0) {
        overlayClipboard = selectedOverlays;
      } else if (mod && e.key.toLowerCase() === 'v' && !editable && overlayClipboard.length > 0) {
        e.preventDefault();
        const clones = cloneOverlays(overlayClipboard, 0.03, 0.03);
        onAddMany(clones);
        setSelectedIds(clones.map((c) => c.id));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, selectedIds, overlays]);

  // --- Elemente erzeugen ------------------------------------------------------

  const addTextAt = (clientX: number, clientY: number) => {
    const p = fracAt(clientX, clientY);
    if (!p) return;
    pruneEmptyDrafts();
    const overlay: Overlay = {
      id: newId(),
      kind: 'text',
      x: p.x,
      y: p.y,
      w: 0.32,
      h: 0,
      text: '',
      fontSize: DEFAULT_FONT_SIZE,
      font: lastFont,
    };
    draftIds.current.add(overlay.id);
    onAdd(overlay);
    setSelectedIds([overlay.id]);
  };

  const addSignature = (dataUrl: string, aspect: number) => {
    setSigning(false);
    const r = rect();
    const w = 0.3;
    const h = r ? (w * (r.width / r.height)) / aspect : w / aspect;
    const overlay: Overlay = { id: newId(), kind: 'image', x: (1 - w) / 2, y: 0.45, w, h, dataUrl };
    onAdd(overlay);
    setSelectedIds([overlay.id]);
  };

  // Fuegt das heutige Datum als fertiges Text-Overlay ein -- ein Klick statt
  // manuellem Tippen/Formatieren. Landet oben links, ausgewaehlt zum Verschieben.
  const addDate = () => {
    pruneEmptyDrafts();
    const overlay: Overlay = {
      id: newId(),
      kind: 'text',
      x: 0.08,
      y: 0.08,
      w: 0.32,
      h: 0,
      text: formatToday(locale),
      fontSize: DEFAULT_FONT_SIZE,
      font: lastFont,
    };
    onAdd(overlay);
    setSelectedIds([overlay.id]);
    setTool('select');
  };

  const stampMark = (kind: ShapeKind, p: { x: number; y: number }) => {
    const r = rect();
    const w = 0.05;
    const h = r ? w * (r.width / r.height) : w; // in Pixeln quadratisch
    const overlay = makeShapeOverlay(newId(), kind, {
      x: clamp01(p.x - w / 2),
      y: clamp01(p.y - h / 2),
      w,
      h,
    });
    onAdd(overlay);
    setSelectedIds([overlay.id]);
  };

  /** Baut aus einer aufgezogenen Box/Linie ein Form-Overlay (mit Mindestgroesse). */
  const buildDragShape = (
    kind: ShapeKind,
    mode: 'box' | 'line',
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    id: string,
  ): Overlay => {
    let minX = Math.min(sx, ex);
    let minY = Math.min(sy, ey);
    let w = Math.abs(ex - sx);
    let h = Math.abs(ey - sy);
    if (mode === 'box') {
      if (w < 0.02 && h < 0.02) {
        w = 0.14;
        h = 0.1;
        minX = clamp01(sx - w / 2);
        minY = clamp01(sy - h / 2);
      } else {
        w = Math.max(w, 0.03);
        h = Math.max(h, 0.03);
      }
      return makeShapeOverlay(id, kind, { x: minX, y: minY, w, h });
    }
    // Linie/Pfeil: Box ist die Bounding-Box, mit Mindestmass in der duennen Achse.
    const MIN = 0.014;
    let bx = minX;
    let by = minY;
    if (w < MIN) {
      bx = minX - (MIN - w) / 2;
      w = MIN;
    }
    if (h < MIN) {
      by = minY - (MIN - h) / 2;
      h = MIN;
    }
    const pts = [(sx - bx) / w, (sy - by) / h, (ex - bx) / w, (ey - by) / h];
    return makeShapeOverlay(id, kind, { x: clamp01(bx), y: clamp01(by), w, h }, pts);
  };

  /** Baut aus freien Punkten (Freihand/Polygon) ein Form-Overlay. */
  const buildPointsShape = (kind: ShapeKind, absPts: number[], id: string): Overlay | null => {
    if (absPts.length < 4) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i + 1 < absPts.length; i += 2) {
      minX = Math.min(minX, absPts[i]);
      maxX = Math.max(maxX, absPts[i]);
      minY = Math.min(minY, absPts[i + 1]);
      maxY = Math.max(maxY, absPts[i + 1]);
    }
    const MIN = 0.014;
    const w = Math.max(maxX - minX, MIN);
    const h = Math.max(maxY - minY, MIN);
    const rel: number[] = [];
    for (let i = 0; i + 1 < absPts.length; i += 2) {
      rel.push((absPts[i] - minX) / w, (absPts[i + 1] - minY) / h);
    }
    return makeShapeOverlay(id, kind, { x: clamp01(minX), y: clamp01(minY), w, h }, rel);
  };

  // --- Zeigerinteraktion ------------------------------------------------------

  const onRootPointerDown = (event: React.PointerEvent) => {
    if (!active) return;
    event.stopPropagation();
    if (event.target !== event.currentTarget) return; // ein Overlay wurde getroffen
    const p = fracAt(event.clientX, event.clientY);
    if (!p) return;
    if (tool === 'select') {
      setSelectedIds([]);
      setLibraryOpen(false);
      return;
    }
    if (tool === 'text') {
      addTextAt(event.clientX, event.clientY);
      return;
    }
    const kind = tool;
    const mode = shapeDrawMode(kind);
    setLibraryOpen(false);
    setSelectedIds([]);
    if (mode === 'mark') {
      stampMark(kind, p);
      return;
    }
    if (mode === 'polygon') {
      setPolygon((prev) => [...(prev ?? []), p.x, p.y]);
      return;
    }
    if (mode === 'freehand') {
      beginFreehand(kind, p);
      return;
    }
    beginDrawBox(kind, mode, p);
  };

  const beginDrawBox = (kind: ShapeKind, mode: 'box' | 'line', p: { x: number; y: number }) => {
    setDraw({ mode, kind, sx: p.x, sy: p.y, cx: p.x, cy: p.y });
    const onMove = (e: PointerEvent) => {
      const f = fracAt(e.clientX, e.clientY);
      if (f) setDraw((d) => (d && d.mode !== 'freehand' ? { ...d, cx: f.x, cy: f.y } : d));
    };
    const onUp = (e: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const f = fracAt(e.clientX, e.clientY) ?? p;
      const overlay = buildDragShape(kind, mode, p.x, p.y, f.x, f.y, newId());
      setDraw(null);
      onAdd(overlay);
      setSelectedIds([overlay.id]);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const beginFreehand = (kind: ShapeKind, p: { x: number; y: number }) => {
    setDraw({ mode: 'freehand', kind, pts: [p.x, p.y] });
    const onMove = (e: PointerEvent) => {
      const f = fracAt(e.clientX, e.clientY);
      if (f) setDraw((d) => (d && d.mode === 'freehand' ? { ...d, pts: [...d.pts, f.x, f.y] } : d));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDraw((d) => {
        if (d && d.mode === 'freehand') {
          const overlay = buildPointsShape(kind, d.pts, newId());
          if (overlay) {
            onAdd(overlay);
            setSelectedIds([overlay.id]);
          }
        }
        return null;
      });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const finishPolygon = () => {
    setPolygon((pts) => {
      if (pts && pts.length >= 6) {
        const overlay = buildPointsShape('polygon', pts, newId());
        if (overlay) {
          onAdd(overlay);
          setSelectedIds([overlay.id]);
        }
      }
      return null;
    });
  };

  const beginMove = (event: React.PointerEvent, overlay: Overlay) => {
    event.preventDefault();
    event.stopPropagation();
    const movingIds = expand(selectedIds.includes(overlay.id) ? selectedIds : [overlay.id]);
    if (!selectedIds.includes(overlay.id)) setSelectedIds(movingIds);
    const r = rect();
    if (!r) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const orig = new Map<string, Box>();
    for (const id of movingIds) {
      const o = byId.get(id);
      if (o) orig.set(id, { x: o.x, y: o.y, w: o.w, h: o.h });
    }
    let latest = new Map(orig);
    const onMove = (e: PointerEvent) => {
      const dx = (e.clientX - startX) / r.width;
      const dy = (e.clientY - startY) / r.height;
      latest = new Map();
      for (const [id, box] of orig) {
        latest.set(id, { ...box, x: clamp01(box.x + dx), y: clamp01(box.y + dy) });
      }
      setDragMap(new Map(latest));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDragMap(null);
      onUpdateMany(
        Array.from(latest.entries()).map(([id, box]) => ({ id, patch: { x: box.x, y: box.y } })),
      );
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Groessenaenderung ueber eine Ecke: die gegenueberliegende Ecke bleibt im
  // Bildschirm fix, w/h (und dadurch x/y) folgen dem Zeiger. Bei gedrehten
  // Overlays wird der Zeigervektor in die lokale Box-Achse zurueckgedreht, damit
  // die Ecke gerade zieht. `aspect` erhaelt das Seitenverhaeltnis (Bilder).
  const beginResize = (
    event: React.PointerEvent,
    overlay: Overlay,
    corner: Corner,
    aspect: boolean,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedIds([overlay.id]);
    const r = rect();
    if (!r) return;
    const W = r.width;
    const H = r.height;
    const wrapEl = (event.currentTarget as HTMLElement).closest(
      '[data-overlay-wrap]',
    ) as HTMLElement | null;
    // Startmasse in Pixeln. Textfelder ohne feste Hoehe (h === 0) nehmen die
    // gemessene Layout-Hoehe als Ausgangswert -- ab jetzt haben sie eine Hoehe.
    const pw0 = overlay.w * W;
    const ph0 = overlay.h > 0 ? overlay.h * H : (wrapEl?.offsetHeight ?? overlay.w * W);
    const cx0 = overlay.x * W + pw0 / 2;
    const cy0 = overlay.y * H + ph0 / 2;
    const theta = ((overlay.rotation ?? 0) * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const ratio = pw0 > 0 ? ph0 / pw0 : 1;
    // Vorzeichen der gezogenen Ecke relativ zur Mitte.
    const sx = corner === 'ne' || corner === 'se' ? 1 : -1;
    const sy = corner === 'sw' || corner === 'se' ? 1 : -1;
    // Bildschirmposition der fixen Ankerecke (gegenueberliegend, im Ausgangszustand).
    const ax = (-sx * pw0) / 2;
    const ay = (-sy * ph0) / 2;
    const anchorX = cx0 + (cos * ax - sin * ay);
    const anchorY = cy0 + (sin * ax + cos * ay);
    const minWFrac = overlay.kind === 'text' ? 0.06 : 0.02;
    const minHFrac = 0.02;
    let latest: Box = { x: overlay.x, y: overlay.y, w: overlay.w, h: ph0 / H };
    const onMove = (e: PointerEvent) => {
      const vx = e.clientX - r.left - anchorX;
      const vy = e.clientY - r.top - anchorY;
      // R(-theta) * v, danach Vorzeichen der Ecke -> lokale Breite/Hoehe.
      let localW = (cos * vx + sin * vy) * sx;
      let localH = (-sin * vx + cos * vy) * sy;
      localW = Math.max(minWFrac * W, localW);
      localH = Math.max(minHFrac * H, localH);
      if (aspect && ratio > 0) {
        localW = Math.max(localW, localH / ratio);
        localH = localW * ratio;
      }
      // neue Mitte aus fixem Anker plus halber lokaler Diagonale (mitgedreht).
      const halfX = (sx * localW) / 2;
      const halfY = (sy * localH) / 2;
      const ncx = anchorX + (cos * halfX - sin * halfY);
      const ncy = anchorY + (sin * halfX + cos * halfY);
      latest = {
        x: (ncx - localW / 2) / W,
        y: (ncy - localH / 2) / H,
        w: localW / W,
        h: localH / H,
      };
      setDragMap(new Map([[overlay.id, latest]]));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDragMap(null);
      onUpdate(overlay.id, latest);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Freies Drehen ueber den Griff: Winkel = Startwinkel + Zeigerwinkel-Differenz
  // um den Box-Mittelpunkt. Shift rastet in 15-Grad-Schritten.
  const beginRotate = (event: React.PointerEvent, overlay: Overlay) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedIds([overlay.id]);
    const wrapEl = (event.currentTarget as HTMLElement).closest(
      '[data-overlay-wrap]',
    ) as HTMLElement | null;
    if (!wrapEl) return;
    // Drehung erfolgt um die Mitte -- die bleibt bei getBoundingClientRect erhalten.
    const b = wrapEl.getBoundingClientRect();
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    // Mittelpunkt in Seiten-Bruchteilen -- fixer Bezug fuer die Ausrichtungslinien.
    const r0 = rect();
    const centerX = r0 ? (cx - r0.left) / r0.width : 0.5;
    const centerY = r0 ? (cy - r0.top) / r0.height : 0.5;
    const startAngle = (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI;
    const startRotation = overlay.rotation ?? 0;
    let latest = normalizeAngle(startRotation);
    const onMove = (e: PointerEvent) => {
      const a = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
      let next = startRotation + (a - startAngle);
      if (e.shiftKey) next = Math.round(next / 15) * 15;
      latest = normalizeAngle(next);
      setSpin({ id: overlay.id, deg: latest, cx: centerX, cy: centerY });
      // Live-Winkel ans Eigenschaften-Panel melden, damit er waehrend des
      // Drehens sichtbar ist -- nicht erst nach dem Loslassen.
      onSpin?.(latest);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setSpin(null);
      onSpin?.(null);
      onUpdate(overlay.id, { rotation: latest });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /** Aktueller Drehwinkel eines Overlays -- live waehrend des Drehens, sonst gespeichert. */
  const rotationOf = (overlay: Overlay): number =>
    spin?.id === overlay.id ? spin.deg : (overlay.rotation ?? 0);

  /** Vier Eck-Griffe fuer die Groessenaenderung eines einzeln gewaehlten Overlays. */
  const cornerHandles = (overlay: Overlay, aspect: boolean) =>
    (['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
      <span
        key={corner}
        onPointerDown={(e) => beginResize(e, overlay, corner, aspect)}
        title={t('preview.fill.resizeBox')}
        aria-label={t('preview.fill.resizeBox')}
        className={cx(
          'absolute z-20 size-3 touch-none rounded-sm bg-accent ring-2 ring-surface-canvas',
          corner === 'nw' && '-left-1.5 -top-1.5 cursor-nwse-resize',
          corner === 'ne' && '-right-1.5 -top-1.5 cursor-nesw-resize',
          corner === 'sw' && '-bottom-1.5 -left-1.5 cursor-nesw-resize',
          corner === 'se' && '-bottom-1.5 -right-1.5 cursor-nwse-resize',
        )}
      />
    ));

  /** Dreh-Griff oberhalb der Oberkante eines einzeln gewaehlten Overlays. */
  const rotateHandle = (overlay: Overlay) => (
    <span
      onPointerDown={(e) => beginRotate(e, overlay)}
      title={t('preview.fill.rotate')}
      aria-label={t('preview.fill.rotate')}
      className="absolute -top-6 left-1/2 z-20 grid size-4 -translate-x-1/2 cursor-grab touch-none place-items-center rounded-full bg-accent text-on-accent ring-2 ring-surface-canvas active:cursor-grabbing"
    >
      <RotateCw className="size-2.5" aria-hidden />
    </span>
  );

  const boxOf = (overlay: Overlay): Box =>
    dragMap?.get(overlay.id) ?? { x: overlay.x, y: overlay.y, w: overlay.w, h: overlay.h };


  const previewShape = (() => {
    if (!draw) return null;
    if (draw.mode === 'freehand') return buildPointsShape(draw.kind, draw.pts, '__preview');
    return buildDragShape(draw.kind, draw.mode, draw.sx, draw.sy, draw.cx, draw.cy, '__preview');
  })();

  return (
    <div
      ref={rootRef}
      // `container-type: size` macht diese seitengrosse Schicht zum Bezug fuer
      // die Container-Einheit `cqh` -- so skaliert der Text in Formen relativ
      // zur Seite (wie beim Editieren), nicht zur kleinen Form-Box.
      style={{ containerType: 'size' }}
      className={cx(
        'absolute inset-0 z-10',
        active ? 'pointer-events-auto' : 'pointer-events-none',
        active && tool !== 'select' && 'cursor-crosshair',
      )}
      onPointerDown={onRootPointerDown}
      onDoubleClick={() => {
        if (tool === 'polygon') finishPolygon();
      }}
    >
      {active && (
        <ToolPalette
          tool={tool}
          onTool={(t) => {
            setTool(t);
            if (t !== 'polygon') setPolygon(null);
          }}
          onSignature={() => setSigning(true)}
          onDate={addDate}
          onLibrary={() => setLibraryOpen((o) => !o)}
          onDetect={onDetect}
          libraryOpen={libraryOpen}
        />
      )}

      {overlays.map((overlay, index) => {
        const box = boxOf(overlay);
        const selected = active && selectedIds.includes(overlay.id);
        const singleSelected = selected && selectedIds.length === 1;
        // Die Stapelreihenfolge folgt dem Array-Index (= Ebene), damit das
        // Umsortieren sichtbar wird. Nur das gerade per Textarea editierte Element
        // wird nach oben geholt, damit man hineintippen kann -- eine reine Auswahl
        // hebt NICHT an, sonst liesse sich ein Element nie sichtbar nach hinten legen.
        const baseZ = 10 + index;
        const rot = rotationOf(overlay);
        const rotateStyle: React.CSSProperties = rot
          ? { transform: `rotate(${rot}deg)`, transformOrigin: 'center' }
          : {};
        const common: React.CSSProperties = { left: `${box.x * 100}%`, top: `${box.y * 100}%` };

        // --- Formen ---
        if (overlay.kind === 'shape') {
          if (!active) {
            return (
              <div
                key={overlay.id}
                className="absolute"
                style={{ ...common, width: `${box.w * 100}%`, height: `${box.h * 100}%`, ...rotateStyle }}
              >
                <OverlayShape overlay={overlay} />
              </div>
            );
          }
          const editingText = editingTextId === overlay.id && overlayShapeSupportsText(overlay);
          return (
            <div
              key={overlay.id}
              data-overlay-wrap
              className={cx('absolute', selected && 'outline outline-1 outline-accent/70')}
              style={{ ...common, width: `${box.w * 100}%`, height: `${box.h * 100}%`, ...rotateStyle, zIndex: editingText ? 40 : baseZ }}
              onPointerDown={(e) => {
                if (e.shiftKey || e.metaKey || e.ctrlKey) {
                  e.stopPropagation();
                  selectOverlay(overlay.id, true);
                } else {
                  beginMove(e, overlay);
                }
              }}
              onDoubleClick={(e) => {
                if (overlayShapeSupportsText(overlay)) {
                  e.stopPropagation();
                  setSelectedIds([overlay.id]);
                  setEditingTextId(overlay.id);
                }
              }}
            >
              <OverlayShape overlay={overlay} hideText={editingText} />
              {editingText && (
                // Deckungsgleich zur Anzeige in OverlayShape: gleiche vertikale
                // Ausrichtung und gleiches Innenmass, damit der Text beim Wechsel
                // in den Editiermodus nicht springt.
                <div
                  className="absolute inset-0 flex flex-col"
                  style={{ justifyContent: valignJustify(overlay.valign ?? 'middle'), padding: '4%' }}
                >
                  <textarea
                    autoFocus
                    defaultValue={overlay.text}
                    rows={1}
                    onPointerDown={(e) => e.stopPropagation()}
                    onInput={(e) => {
                      const ta = e.currentTarget;
                      ta.style.height = 'auto';
                      ta.style.height = `${ta.scrollHeight}px`;
                    }}
                    onBlur={(e) => {
                      onUpdate(overlay.id, { text: e.currentTarget.value });
                      setEditingTextId(null);
                    }}
                    className="w-full resize-none overflow-hidden bg-transparent text-center outline-none"
                    style={{
                      fontSize: `${(overlay.fontSize ?? DEFAULT_FONT_SIZE) * height}px`,
                      lineHeight: 1.25,
                      ...overlayTextStyle(overlay),
                    }}
                  />
                </div>
              )}
              {singleSelected && cornerHandles(overlay, false)}
              {singleSelected && rotateHandle(overlay)}
            </div>
          );
        }

        // --- Unterschrift/Bild ---
        if (overlay.kind === 'image') {
          if (!active) {
            return (
              overlay.dataUrl && (
                <img
                  key={overlay.id}
                  src={overlay.dataUrl}
                  alt={t('preview.fill.signatureAlt')}
                  draggable={false}
                  className="absolute object-contain"
                  style={{ ...common, width: `${box.w * 100}%`, height: `${box.h * 100}%`, ...rotateStyle }}
                />
              )
            );
          }
          return (
            <div
              key={overlay.id}
              data-overlay-wrap
              className={cx('absolute', selected && 'ring-1 ring-accent/70')}
              style={{ ...common, width: `${box.w * 100}%`, height: `${box.h * 100}%`, ...rotateStyle, zIndex: baseZ }}
              onPointerDown={(e) => {
                if (e.shiftKey || e.metaKey || e.ctrlKey) {
                  e.stopPropagation();
                  selectOverlay(overlay.id, true);
                } else {
                  beginMove(e, overlay);
                }
              }}
            >
              <img
                src={overlay.dataUrl}
                alt={t('preview.fill.signatureAlt')}
                className="h-full w-full object-contain"
                draggable={false}
              />
              {singleSelected && cornerHandles(overlay, true)}
              {singleSelected && rotateHandle(overlay)}
            </div>
          );
        }

        // --- Textfeld ---
        const fontPx = (overlay.fontSize ?? DEFAULT_FONT_SIZE) * height;
        const textStyle = overlayTextStyle(overlay);

        const hasBox = box.h > 0;
        const boxStyle: React.CSSProperties = hasBox
          ? {
              minHeight: `${box.h * 100}%`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: valignJustify(overlay.valign),
            }
          : {};
        const flip = flipTransform(overlay);

        if (!active) {
          const bgStyle = overlayTextBgStyle(overlay.textBg);
          return (
            overlay.text?.trim() && (
              <div
                key={overlay.id}
                className="absolute"
                style={{ ...common, width: `${box.w * 100}%`, ...boxStyle, ...rotateStyle }}
              >
                <div
                  className="w-full whitespace-pre-wrap px-1 leading-tight"
                  style={{
                    fontSize: `${fontPx}px`,
                    ...textStyle,
                    ...(flip ? { transform: flip, transformOrigin: 'center' } : {}),
                  }}
                >
                  {bgStyle ? <span style={bgStyle}>{overlay.text}</span> : overlay.text}
                </div>
              </div>
            )
          );
        }

        return (
          <div
            key={overlay.id}
            data-overlay-wrap
            className="absolute"
            style={{ ...common, width: `${box.w * 100}%`, ...boxStyle, ...rotateStyle, zIndex: focusedTextId === overlay.id ? 40 : baseZ }}
          >
            {selected && (
              <span
                onPointerDown={(e) => beginMove(e, overlay)}
                title={t('preview.fill.moveDrag')}
                aria-label={t('preview.fill.moveField')}
                className="absolute left-0 top-0 z-20 flex h-full w-5 -translate-x-full cursor-grab touch-none items-center justify-center rounded-l-md bg-accent text-on-accent active:cursor-grabbing"
              >
                <GripVertical className="size-3.5" aria-hidden />
              </span>
            )}

            <div
              className="w-full"
              style={flip ? { transform: flip, transformOrigin: 'center' } : undefined}
            >
            {overlay.options ? (
              <select
                value={overlay.text ?? ''}
                onFocus={() => {
                  setSelectedIds([overlay.id]);
                  setFocusedTextId(overlay.id);
                }}
                onBlur={() => setFocusedTextId(null)}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => onUpdate(overlay.id, { text: e.currentTarget.value })}
                className={cx(
                  'block w-full rounded-md bg-transparent px-1.5 py-0.5 leading-tight outline-none',
                  selected ? 'ring-2 ring-accent' : 'ring-1 ring-accent/40',
                )}
                style={{
                  fontSize: `${fontPx}px`,
                  ...textStyle,
                  // Beim Editieren transparenten Text gedaempft zeigen, damit man tippen kann.
                  ...(isTransparentColor(overlay.color) ? { color: 'rgba(120,130,140,0.75)' } : {}),
                  ...(hasFill(overlay.textBg) ? { background: overlay.textBg } : {}),
                }}
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
                  setSelectedIds([overlay.id]);
                  setFocusedTextId(overlay.id);
                  pruneEmptyDrafts(overlay.id);
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (e.shiftKey || e.metaKey || e.ctrlKey) selectOverlay(overlay.id, true);
                }}
                onInput={(e) => {
                  const ta = e.currentTarget;
                  ta.style.height = 'auto';
                  ta.style.height = `${ta.scrollHeight}px`;
                }}
                onBlur={(e) => {
                  setFocusedTextId(null);
                  const val = e.currentTarget.value;
                  if (val.trim() !== '') onUpdate(overlay.id, { text: val });
                  else if ((overlay.text ?? '') !== '') onUpdate(overlay.id, { text: '' });
                }}
                className={cx(
                  'block w-full resize-none rounded-md bg-transparent px-1.5 py-0.5 leading-tight outline-none transition-colors',
                  selected
                    ? 'ring-2 ring-accent'
                    : 'ring-1 ring-accent/30 hover:ring-accent/50',
                )}
                style={{
                  fontSize: `${fontPx}px`,
                  minHeight: `${fontPx * 1.4}px`,
                  ...textStyle,
                  // Beim Editieren transparenten Text gedaempft zeigen, damit man tippen kann.
                  ...(isTransparentColor(overlay.color) ? { color: 'rgba(120,130,140,0.75)' } : {}),
                  ...(hasFill(overlay.textBg) ? { background: overlay.textBg } : {}),
                }}
                rows={1}
              />
            )}
            </div>

            {singleSelected && cornerHandles(overlay, false)}
            {singleSelected && rotateHandle(overlay)}
          </div>
        );
      })}

      {/* Ebenen-Nummern (1 = hinten). Als eigene, immer oben liegende Schicht --
          so bleiben sie sichtbar, egal welches Element vorne ist. Standardmaessig
          erscheint nur die Nummer des gewaehlten Elements; alle Nummern werden
          erst gezeigt, wenn der Nutzer sie fixiert oder gerade im Ebene-Bereich
          arbeitet. Die Zahl aktualisiert sich beim Umsortieren live. */}
      {active && overlays.length > 1 && (
        <div className="pointer-events-none absolute inset-0 z-40" aria-hidden>
          {overlays.map((overlay, index) => {
            const b = boxOf(overlay);
            const isSel = selectedIds.includes(overlay.id);
            if (!showAllBadges && !isSel) return null;
            return (
              <span
                key={overlay.id}
                className={cx(
                  'absolute grid h-4 min-w-[16px] -translate-y-full place-items-center rounded px-1 text-[10px] font-semibold tabular-nums shadow-sm ring-1 ring-surface-canvas',
                  isSel ? 'bg-accent text-on-accent' : 'bg-surface-raised text-text-secondary',
                )}
                style={{ left: `${b.x * 100}%`, top: `${b.y * 100}%` }}
                title={t('preview.fill.layerBadge', { n: index + 1 })}
              >
                {index + 1}
              </span>
            );
          })}
        </div>
      )}

      {/* Ausrichtungslinien waehrend des Drehens: gestricheltes, seitenparalleles
          Fadenkreuz durch den Objektmittelpunkt. Kraeftig, sobald der Winkel auf
          einer Ausrichtung (Vielfaches von 45 Grad) liegt. */}
      {spin && (
        <div className="pointer-events-none absolute inset-0 z-30" aria-hidden>
          {(() => {
            const aligned = nearCardinal(spin.deg);
            const line = cx('border-dashed', aligned ? 'border-accent' : 'border-accent/45');
            return (
              <>
                <div
                  className={cx('absolute bottom-0 top-0 border-l', line)}
                  style={{ left: `${spin.cx * 100}%` }}
                />
                <div
                  className={cx('absolute left-0 right-0 border-t', line)}
                  style={{ top: `${spin.cy * 100}%` }}
                />
                <div
                  className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface-canvas"
                  style={{ left: `${spin.cx * 100}%`, top: `${spin.cy * 100}%` }}
                />
              </>
            );
          })()}
        </div>
      )}

      {/* Vorschau der gerade gezeichneten Form. */}
      {previewShape && (
        <div
          className="pointer-events-none absolute opacity-80"
          style={{
            left: `${previewShape.x * 100}%`,
            top: `${previewShape.y * 100}%`,
            width: `${previewShape.w * 100}%`,
            height: `${previewShape.h * 100}%`,
          }}
        >
          <OverlayShape overlay={previewShape} />
        </div>
      )}

      {/* Vorschau des in Arbeit befindlichen Polygons. */}
      {polygon && polygon.length >= 2 && (
        <svg
          className="pointer-events-none absolute inset-0"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
        >
          <polyline
            points={polygonPoints(polygon)}
            fill="none"
            stroke="#1f6feb"
            strokeWidth={0.004}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      {/* Die Formatierregler leben jetzt im Eigenschaften-Panel (Viewer-Ebene). */}

      {/* Bibliotheks-Panel. */}
      {active && libraryOpen && (
        <div className="absolute left-2 top-12 z-40">
          <LibraryPopover onInsert={insertLibraryItem} onClose={() => setLibraryOpen(false)} />
        </div>
      )}

      {signing && <SignatureDialog onCancel={() => setSigning(false)} onConfirm={addSignature} />}
    </div>
  );
}
