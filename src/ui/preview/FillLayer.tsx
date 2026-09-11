import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { newId } from '../../domain/ids';
import {
  DEFAULT_OVERLAY_FONT,
  overlayCssFamily,
  overlayFontSpec,
} from '../../domain/overlayFonts';
import { makeShapeOverlay, overlayShapeSupportsText } from '../../domain/overlayShapes';
import { instantiateOverlays } from '../../domain/overlayLibrary';
import type { Overlay, ShapeKind } from '../../domain/types';
import type { LibraryItemKind, LibraryItemRecord } from '../../services/persistence/db';
import { useLibraryStore } from '../app/StoreProvider';
import { cx } from '../common/cx';
import { ensureOverlayFontFaces } from '../text/overlayFontFaces';
import { OverlayShape } from './OverlayShape';
import { SignatureDialog } from './SignatureDialog';
import { LibraryPopover } from './fill/LibraryPopover';
import { NameDialog } from './fill/NameDialog';
import { StyleBar } from './fill/StyleBar';
import { ToolPalette, shapeDrawMode, type Tool } from './fill/tools';
import { DEFAULT_FONT_SIZE } from './fill/units';

export interface FillLayerProps {
  overlays: Overlay[];
  /** true, wenn der Ausfuell-Modus aktiv ist -- dann ist die Schicht interaktiv. */
  active: boolean;
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
    color: overlay.color ?? '#15181c',
  };
}

/** Erzeugt Klone einer Auswahl: frische Ids, versetzt, mit erhaltener (neu vergebener) Gruppierung. */
function cloneOverlays(source: Overlay[], dx: number, dy: number): Overlay[] {
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
  onAdd,
  onAddMany,
  onUpdate,
  onUpdateMany,
  onRemove,
  onRemoveMany,
  onDetect,
}: FillLayerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const library = useLibraryStore();
  const [tool, setTool] = useState<Tool>('text');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dragMap, setDragMap] = useState<Map<string, Box> | null>(null);
  const [signing, setSigning] = useState(false);
  const [height, setHeight] = useState(0);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveDialog, setSaveDialog] = useState<{ kind: LibraryItemKind; overlays: Overlay[] } | null>(
    null,
  );
  // Zeichnen einer Form (Box/Linie/Freihand) bzw. Polygon per Klick.
  const [draw, setDraw] = useState<
    | { mode: 'box' | 'line'; kind: ShapeKind; sx: number; sy: number; cx: number; cy: number }
    | { mode: 'freehand'; kind: ShapeKind; pts: number[] }
    | null
  >(null);
  const [polygon, setPolygon] = useState<number[] | null>(null);
  const draftIds = useRef<Set<string>>(new Set());
  const [lastFont, setLastFont] = useState<string>(DEFAULT_OVERLAY_FONT);

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

  const patchSelection = (patch: Partial<Overlay>) => {
    if (selectedIds.length === 0) return;
    // Neue Felder uebernehmen die zuletzt gewaehlte Schrift.
    if (typeof patch.font === 'string') setLastFont(patch.font);
    onUpdateMany(selectedIds.map((id) => ({ id, patch })));
  };
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
  const groupSelection = () => {
    if (selectedIds.length < 2) return;
    const gid = newId();
    onUpdateMany(selectedIds.map((id) => ({ id, patch: { groupId: gid } })));
  };
  const ungroupSelection = () => {
    if (selectedIds.length === 0) return;
    onUpdateMany(selectedIds.map((id) => ({ id, patch: { groupId: undefined } })));
  };
  const saveSelectionToLibrary = () => {
    if (selectedOverlays.length === 0) return;
    const kind: LibraryItemKind =
      selectedOverlays.length > 1
        ? 'group'
        : selectedOverlays[0].kind === 'image'
          ? 'signature'
          : selectedOverlays[0].kind === 'shape'
            ? 'shape'
            : 'text';
    setSaveDialog({ kind, overlays: selectedOverlays });
    setLibraryOpen(false);
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

  const beginResize = (
    event: React.PointerEvent,
    overlay: Overlay,
    mode: 'aspect' | 'free' | 'width',
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedIds([overlay.id]);
    const r = rect();
    if (!r) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const o0: Box = { x: overlay.x, y: overlay.y, w: overlay.w, h: overlay.h };
    let latest = o0;
    const onMove = (e: PointerEvent) => {
      const dx = (e.clientX - startX) / r.width;
      const dy = (e.clientY - startY) / r.height;
      if (mode === 'width') {
        latest = { ...o0, w: Math.max(0.06, Math.min(1, o0.w + dx)) };
      } else if (mode === 'free') {
        latest = { ...o0, w: Math.max(0.02, o0.w + dx), h: Math.max(0.02, o0.h + dy) };
      } else {
        const nextW = Math.max(0.05, o0.w + dx);
        const ratio = o0.w > 0 ? o0.h / o0.w : 1;
        latest = { ...o0, w: nextW, h: nextW * ratio };
      }
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

  const boxOf = (overlay: Overlay): Box =>
    dragMap?.get(overlay.id) ?? { x: overlay.x, y: overlay.y, w: overlay.w, h: overlay.h };

  // --- Anker fuer die Stilleiste (Bounding-Box der Auswahl) -------------------
  const selectionAnchor = (): { left: number; top: number; below: boolean } | null => {
    if (selectedOverlays.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    for (const o of selectedOverlays) {
      const b = boxOf(o);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
    }
    return { left: minX, top: minY, below: minY < 0.16 };
  };
  const anchor = selectionAnchor();

  const previewShape = (() => {
    if (!draw) return null;
    if (draw.mode === 'freehand') return buildPointsShape(draw.kind, draw.pts, '__preview');
    return buildDragShape(draw.kind, draw.mode, draw.sx, draw.sy, draw.cx, draw.cy, '__preview');
  })();

  return (
    <div
      ref={rootRef}
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
          onLibrary={() => setLibraryOpen((o) => !o)}
          onDetect={onDetect}
          libraryOpen={libraryOpen}
        />
      )}

      {overlays.map((overlay) => {
        const box = boxOf(overlay);
        const selected = active && selectedIds.includes(overlay.id);
        const singleSelected = selected && selectedIds.length === 1;
        const common: React.CSSProperties = { left: `${box.x * 100}%`, top: `${box.y * 100}%` };

        // --- Formen ---
        if (overlay.kind === 'shape') {
          if (!active) {
            return (
              <div
                key={overlay.id}
                className="absolute"
                style={{ ...common, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
              >
                <OverlayShape overlay={overlay} />
              </div>
            );
          }
          const editingText = editingTextId === overlay.id && overlayShapeSupportsText(overlay);
          return (
            <div
              key={overlay.id}
              className={cx('absolute', selected && 'outline outline-1 outline-accent/70')}
              style={{ ...common, width: `${box.w * 100}%`, height: `${box.h * 100}%`, zIndex: selected ? 30 : 10 }}
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
              <OverlayShape overlay={overlay} />
              {editingText && (
                <textarea
                  autoFocus
                  defaultValue={overlay.text}
                  onPointerDown={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    onUpdate(overlay.id, { text: e.currentTarget.value });
                    setEditingTextId(null);
                  }}
                  className="absolute inset-0 resize-none bg-transparent text-center outline-none"
                  style={{
                    fontSize: `${(overlay.fontSize ?? DEFAULT_FONT_SIZE) * height}px`,
                    ...overlayTextStyle(overlay),
                  }}
                />
              )}
              {singleSelected && (
                <span
                  onPointerDown={(e) => beginResize(e, overlay, 'free')}
                  title="Größe ändern"
                  aria-label="Größe ändern"
                  className="absolute -bottom-1.5 -right-1.5 z-20 size-3 cursor-nwse-resize touch-none rounded-sm bg-accent ring-2 ring-surface-canvas"
                />
              )}
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
                  alt="Unterschrift"
                  draggable={false}
                  className="absolute object-contain"
                  style={{ ...common, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
                />
              )
            );
          }
          return (
            <div
              key={overlay.id}
              className={cx('absolute', selected && 'ring-1 ring-accent/70')}
              style={{ ...common, width: `${box.w * 100}%`, height: `${box.h * 100}%`, zIndex: selected ? 30 : 10 }}
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
                alt="Unterschrift"
                className="h-full w-full object-contain"
                draggable={false}
              />
              {singleSelected && (
                <span
                  onPointerDown={(e) => beginResize(e, overlay, 'aspect')}
                  className="absolute -bottom-1.5 -right-1.5 z-20 size-3 cursor-nwse-resize rounded-sm bg-accent ring-2 ring-surface-canvas"
                  aria-label="Größe ändern"
                />
              )}
            </div>
          );
        }

        // --- Textfeld ---
        const fontPx = (overlay.fontSize ?? DEFAULT_FONT_SIZE) * height;
        const textStyle = overlayTextStyle(overlay);

        if (!active) {
          return (
            overlay.text?.trim() && (
              <div
                key={overlay.id}
                className="absolute whitespace-pre-wrap px-1 leading-tight"
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
            {selected && (
              <span
                onPointerDown={(e) => beginMove(e, overlay)}
                title="Zum Verschieben ziehen"
                aria-label="Feld verschieben"
                className="absolute left-0 top-0 z-20 flex h-full w-5 -translate-x-full cursor-grab touch-none items-center justify-center rounded-l-md bg-accent text-on-accent active:cursor-grabbing"
              >
                <GripVertical className="size-3.5" aria-hidden />
              </span>
            )}

            {overlay.options ? (
              <select
                value={overlay.text ?? ''}
                onFocus={() => setSelectedIds([overlay.id])}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => onUpdate(overlay.id, { text: e.currentTarget.value })}
                className={cx(
                  'block w-full rounded-md px-1.5 py-0.5 leading-tight outline-none',
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
                  setSelectedIds([overlay.id]);
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
                  const val = e.currentTarget.value;
                  if (val.trim() !== '') onUpdate(overlay.id, { text: val });
                  else if ((overlay.text ?? '') !== '') onUpdate(overlay.id, { text: '' });
                }}
                className={cx(
                  'block w-full resize-none rounded-md px-1.5 py-0.5 leading-tight outline-none transition-colors',
                  selected
                    ? 'bg-white ring-2 ring-accent'
                    : 'bg-white/60 ring-1 ring-accent/30 hover:bg-white/80',
                )}
                style={{ fontSize: `${fontPx}px`, minHeight: `${fontPx * 1.4}px`, ...textStyle }}
                rows={1}
              />
            )}

            {singleSelected && (
              <span
                onPointerDown={(e) => beginResize(e, overlay, 'width')}
                title="Breite ändern"
                aria-label="Breite ändern"
                className="absolute right-0 top-1/2 z-20 size-3 -translate-y-1/2 translate-x-1/2 cursor-ew-resize touch-none rounded-full bg-accent ring-2 ring-surface-canvas"
              />
            )}
          </div>
        );
      })}

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

      {/* Stilleiste fuer die aktuelle Auswahl. */}
      {active && anchor && selectedOverlays.length > 0 && !editingTextId && (
        <div className="absolute z-40" style={{ left: `${anchor.left * 100}%`, top: `${anchor.top * 100}%` }}>
          <div className={cx('absolute left-0', anchor.below ? 'top-6' : 'bottom-2')}>
            <StyleBar
              overlays={selectedOverlays}
              onPatch={patchSelection}
              onDuplicate={duplicateSelection}
              onDelete={deleteSelection}
              onGroup={groupSelection}
              onUngroup={ungroupSelection}
              onSaveToLibrary={saveSelectionToLibrary}
              canGroup={selectedIds.length >= 2}
              canUngroup={selectedOverlays.some((o) => !!o.groupId)}
            />
          </div>
        </div>
      )}

      {/* Bibliotheks-Panel. */}
      {active && libraryOpen && (
        <div className="absolute left-2 top-12 z-40">
          <LibraryPopover onInsert={insertLibraryItem} onClose={() => setLibraryOpen(false)} />
        </div>
      )}

      {signing && <SignatureDialog onCancel={() => setSigning(false)} onConfirm={addSignature} />}

      {saveDialog && (
        <NameDialog
          title="In Bibliothek speichern"
          label="Name des Bausteins"
          defaultValue=""
          onCancel={() => setSaveDialog(null)}
          onConfirm={(name) => {
            void library.getState().add(saveDialog.kind, name, saveDialog.overlays);
            setSaveDialog(null);
          }}
        />
      )}
    </div>
  );
}
