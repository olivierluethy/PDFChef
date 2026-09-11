import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { Annotation, SignatureAnnotation, TextAnnotation } from '../../domain/types';
import { cssFamilyFor, type FontManifestEntry } from '../text/fontCatalog';
import { clamp01, cycleSelection, hitTest, rgbToHex, type LayerBox } from './annotationModel';
import { useSignatureUrl } from './useSignatureUrl';

export interface AnnotationLayerProps {
  annotations: Annotation[];
  /** Pixelmasse der Bildflaeche, ueber der die Ebene liegt. */
  box: LayerBox;
  fontEntries: FontManifestEntry[];
  editable: boolean;
  selectedId?: string | null;
  /** Wird dieses Feld gesetzt, startet sofort die Inline-Bearbeitung (frisch erstellter Text). */
  autoEditId?: string | null;
  /** Sichtbare Drehung der Ebene in Grad -- damit Ziehen auch gedreht stimmt. */
  rotationDeg?: number;
  onSelect?(id: string | null): void;
  onChange?(id: string, patch: Partial<Annotation>): void;
  onRemove?(id: string): void;
}

interface Offset {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}
const NO_OFFSET: Offset = { dx: 0, dy: 0, dw: 0, dh: 0 };

interface DragState {
  pointerId: number;
  targetId: string;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
}

/** Rechnet eine Bildschirm-Verschiebung in die (moeglicherweise gedrehte) lokale Ebene um. */
function toLocalDelta(dx: number, dy: number, rotationDeg: number): { dx: number; dy: number } {
  const theta = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return { dx: dx * cos + dy * sin, dy: -dx * sin + dy * cos };
}

/**
 * Transparente Ebene ueber dem Seitenbild. Editierbar (grosse Vorschau): Felder
 * anklicken (auch verdeckte -- Alt+Klick geht die Ueberlappung nach unten
 * durch), ziehen, in der Groesse aendern, Text per Doppelklick inline
 * bearbeiten. Nur-Anzeige (Kacheln): dasselbe Bild ohne Interaktion. Die ganze
 * Zeiger-Logik sitzt hier zentral -- so kann keine Zelle Klicks "verschlucken".
 */
export function AnnotationLayer({
  annotations,
  box,
  fontEntries,
  editable,
  selectedId = null,
  autoEditId = null,
  rotationDeg = 0,
  onSelect,
  onChange,
  onRemove,
}: AnnotationLayerProps) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [offset, setOffset] = useState<Offset>(NO_OFFSET);
  const drag = useRef<DragState | null>(null);

  useEffect(() => {
    if (selectedId === null) setEditingId(null);
  }, [selectedId]);
  useEffect(() => {
    if (autoEditId) setEditingId(autoEditId);
  }, [autoEditId]);

  if (annotations.length === 0 && !editable) return null;

  const byId = (id: string) => annotations.find((annotation) => annotation.id === id);

  const fractionAt = (event: { clientX: number; clientY: number }) => {
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect) return { fx: 0, fy: 0 };
    return { fx: (event.clientX - rect.left) / rect.width, fy: (event.clientY - rect.top) / rect.height };
  };

  const beginResize = (event: ReactPointerEvent, id: string) => {
    event.stopPropagation();
    event.preventDefault();
    layerRef.current?.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, targetId: id, mode: 'resize', startX: event.clientX, startY: event.clientY };
    setOffset(NO_OFFSET);
  };

  const onPointerDown = (event: ReactPointerEvent) => {
    if (!editable) return;
    const { fx, fy } = fractionAt(event);
    const hits = hitTest(annotations, fx, fy);
    if (hits.length === 0) {
      onSelect?.(null);
      setEditingId(null);
      return;
    }
    // Normal: das oberste Feld. Alt+Klick: durch die Ueberlappung nach unten.
    const top = hits[hits.length - 1].id;
    const nextId = event.altKey ? (cycleSelection(hits, selectedId) ?? top) : hits.some((h) => h.id === selectedId) ? selectedId! : top;
    onSelect?.(nextId);
    if (editingId && editingId !== nextId) setEditingId(null);
    layerRef.current?.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, targetId: nextId, mode: 'move', startX: event.clientX, startY: event.clientY };
    setOffset(NO_OFFSET);
  };

  const onPointerMove = (event: ReactPointerEvent) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const target = byId(state.targetId);
    if (!target) return;
    const { dx, dy } = toLocalDelta(event.clientX - state.startX, event.clientY - state.startY, rotationDeg);
    if (state.mode === 'move') {
      setOffset({ dx, dy, dw: 0, dh: 0 });
    } else if (target.kind === 'signature') {
      // Proportional skalieren: Breite fuehrt, Hoehe folgt dem Bildverhaeltnis.
      setOffset({ dx: 0, dy: 0, dw: dx, dh: (dx / target.aspect) * (box.width / box.height) });
    } else {
      setOffset({ dx: 0, dy: 0, dw: dx, dh: 0 });
    }
  };

  const endDrag = (event: ReactPointerEvent) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const target = byId(state.targetId);
    drag.current = null;
    if (!target) {
      setOffset(NO_OFFSET);
      return;
    }
    if (state.mode === 'move') {
      onChange?.(target.id, {
        x: clamp01(target.x + offset.dx / box.width),
        y: clamp01(target.y + offset.dy / box.height),
      });
    } else if (target.kind === 'signature') {
      const width = clamp01(target.width + offset.dw / box.width);
      onChange?.(target.id, { width, height: (width * box.width) / target.aspect / box.height });
    } else {
      onChange?.(target.id, { width: clamp01(target.width + offset.dw / box.width) });
    }
    setOffset(NO_OFFSET);
  };

  const onDoubleClick = (event: React.MouseEvent) => {
    if (!editable) return;
    const { fx, fy } = fractionAt(event);
    const hits = hitTest(annotations, fx, fy);
    const text = [...hits].reverse().find((annotation) => annotation.kind === 'text');
    if (text) {
      onSelect?.(text.id);
      setEditingId(text.id);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!editable || editingId || !selectedId) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onRemove?.(selectedId);
      setEditingId(null);
    }
  };

  return (
    <div
      ref={layerRef}
      tabIndex={editable ? 0 : -1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: editable ? 'auto' : 'none',
        overflow: 'hidden',
        touchAction: editable ? 'none' : 'auto',
        outline: 'none',
      }}
    >
      {annotations.map((annotation) => (
        <AnnotationView
          key={annotation.id}
          annotation={annotation}
          box={box}
          fontEntries={fontEntries}
          editable={editable}
          selected={editable && annotation.id === selectedId}
          editing={editable && annotation.id === editingId}
          offset={annotation.id === drag.current?.targetId ? offset : NO_OFFSET}
          onCommitText={(text) => onChange?.(annotation.id, { text })}
          onStopEditing={() => setEditingId(null)}
          onResizeStart={(event) => beginResize(event, annotation.id)}
        />
      ))}
    </div>
  );
}

interface ViewProps {
  annotation: Annotation;
  box: LayerBox;
  fontEntries: FontManifestEntry[];
  editable: boolean;
  selected: boolean;
  editing: boolean;
  offset: Offset;
  onCommitText(text: string): void;
  onStopEditing(): void;
  onResizeStart(event: ReactPointerEvent): void;
}

function AnnotationView(props: ViewProps) {
  const { annotation, box, selected, offset } = props;
  const left = annotation.x * box.width + offset.dx;
  const top = annotation.y * box.height + offset.dy;
  const width = Math.max(12, annotation.width * box.width + offset.dw);

  const baseStyle: CSSProperties = {
    position: 'absolute',
    left,
    top,
    width,
    outline: selected ? '1px solid var(--color-accent, #e7a13a)' : 'none',
    outlineOffset: 2,
  };

  return (
    <div style={baseStyle}>
      {annotation.kind === 'text' ? <TextBody {...props} /> : <SignatureBody annotation={annotation} box={box} offsetDh={offset.dh} />}
      {selected && (
        <span
          onPointerDown={props.onResizeStart}
          style={{
            position: 'absolute',
            right: -6,
            bottom: -6,
            width: 12,
            height: 12,
            borderRadius: 2,
            background: 'var(--color-accent, #e7a13a)',
            cursor: 'nwse-resize',
          }}
        />
      )}
    </div>
  );
}

function TextBody({ annotation, box, fontEntries, editable, editing, onCommitText, onStopEditing }: ViewProps) {
  const text = annotation as TextAnnotation;
  const entry = fontEntries.find((candidate) => candidate.id === text.fontId);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  const shared: CSSProperties = {
    fontFamily: cssFamilyFor(entry, text.bold),
    fontSize: text.sizeFrac * box.height,
    lineHeight: text.lineHeight,
    color: rgbToHex(text.color),
    textAlign: text.align,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    width: '100%',
  };

  useEffect(() => {
    if (editing && areaRef.current) {
      const area = areaRef.current;
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
      area.style.height = 'auto';
      area.style.height = `${area.scrollHeight}px`;
    }
  }, [editing]);

  if (editing) {
    return (
      <textarea
        ref={areaRef}
        defaultValue={text.text}
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onInput={(event) => {
          const area = event.currentTarget;
          area.style.height = 'auto';
          area.style.height = `${area.scrollHeight}px`;
        }}
        onBlur={(event) => {
          onCommitText(event.currentTarget.value);
          onStopEditing();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.currentTarget.blur();
        }}
        style={{
          ...shared,
          margin: 0,
          padding: 0,
          border: 'none',
          outline: 'none',
          background: 'rgba(255,255,255,0.55)',
          resize: 'none',
          overflow: 'hidden',
          display: 'block',
        }}
      />
    );
  }

  const empty = text.text.trim() === '';
  return (
    <div style={{ ...shared, minHeight: text.sizeFrac * box.height, opacity: empty ? 0.5 : 1, pointerEvents: 'none' }}>
      {empty && editable ? 'Doppelklick zum Bearbeiten' : text.text}
    </div>
  );
}

function SignatureBody({ annotation, box, offsetDh }: { annotation: SignatureAnnotation; box: LayerBox; offsetDh: number }) {
  const url = useSignatureUrl(annotation.blobKey);
  const height = Math.max(8, annotation.height * box.height + offsetDh);
  if (!url) {
    return <div style={{ width: '100%', height, background: 'rgba(120,120,120,0.15)' }} aria-label="Unterschrift wird geladen" />;
  }
  return <img src={url} alt="Unterschrift" draggable={false} style={{ display: 'block', width: '100%', height, objectFit: 'fill', pointerEvents: 'none' }} />;
}
