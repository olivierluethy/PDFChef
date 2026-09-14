import { useEffect, useRef, useState } from 'react';
import type { Overlay } from '../../domain/types';
import {
  DEFAULT_SHAPE_TEXT_COLOR,
  DEFAULT_STROKE_WIDTH,
  hasFill,
  overlayShapeSupportsText,
  overlayTextColorCss,
  shapeSpec,
} from '../../domain/overlayShapes';
import { overlayCssFamily, overlayFontSpec } from '../../domain/overlayFonts';

/**
 * Zeichnet eine Form (Rechteck/Ellipse/Linie/Pfeil/Polygon/Freihand/Highlight/
 * Haken/Kreuz) samt optionalem, zentriertem Text. Fuellt die Box des Eltern-
 * Elements (`position: absolute; inset: 0`). Misst sich selbst: die Randstaerke
 * ist ein Bruchteil der SEITENhoehe -- dafuer wird die Hoehe des positionierten
 * Vorfahren (Seiten-/Kachelflaeche) gelesen, damit duenne Formen nicht
 * verzerren. Dieselbe Komponente dient Editor, Kacheln und Bibliotheksvorschau.
 */
export function OverlayShape({
  overlay,
  hideText,
}: {
  overlay: Overlay;
  /** Blendet den Formtext aus -- waehrend er gerade in einer Textarea editiert wird. */
  hideText?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ boxW: 0, boxH: 0, pageH: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const parent = el.offsetParent as HTMLElement | null;
      setSize({
        boxW: el.clientWidth,
        boxH: el.clientHeight,
        pageH: parent?.clientHeight ?? el.clientHeight,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (el.offsetParent instanceof HTMLElement) observer.observe(el.offsetParent);
    return () => observer.disconnect();
  }, []);

  const kind = overlay.shape;
  if (!kind) return null;

  const { boxW, boxH, pageH } = size;
  const strokeFrac = overlay.strokeWidth ?? DEFAULT_STROKE_WIDTH;
  const strokePx = Math.max(0.5, strokeFrac * (pageH || boxH));
  const stroke = overlay.stroke;
  const fill = hasFill(overlay.fill) ? overlay.fill : undefined;
  const opacity = overlay.opacity ?? 1;
  const spec = shapeSpec(kind);
  const vbW = Math.max(boxW, 1);
  const vbH = Math.max(boxH, 1);

  let body: React.ReactNode = null;

  if (kind === 'rect' || kind === 'roundRect' || kind === 'ellipse' || kind === 'highlight') {
    const radius =
      kind === 'ellipse' ? '50%' : kind === 'roundRect' ? `${Math.min(boxW, boxH) * 0.12}px` : '0';
    body = (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: radius,
          background: fill ?? (kind === 'highlight' ? '#ffe14d' : 'transparent'),
          border: stroke ? `${strokePx}px solid ${stroke}` : undefined,
          boxSizing: 'border-box',
          mixBlendMode: kind === 'highlight' ? 'multiply' : undefined,
        }}
      />
    );
  } else {
    // Punkt-/Pfad-Formen als SVG in Pixel-Koordinaten (viewBox == Boxgroesse,
    // preserveAspectRatio none) -- so bleibt die Randstaerke unverzerrt.
    body = (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {renderSvgShape(kind, overlay.points, vbW, vbH, stroke ?? '#15181c', strokePx, fill)}
      </svg>
    );
  }

  const text = overlay.text ?? '';
  const showText = !hideText && text.trim() !== '' && overlayShapeSupportsText(overlay);

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0, opacity }}>
      {body}
      {showText && spec.supportsText && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4%',
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
            lineHeight: 1.25,
            fontFamily: overlayCssFamily(overlayFontSpec(overlay.font), overlay.bold ?? false),
            fontWeight: overlay.bold ? 700 : overlayFontSpec(overlay.font).cssWeight,
            fontStyle: overlay.italic ? 'italic' : 'normal',
            // Schriftgroesse ist ein Bruchteil der SEITENhoehe. Ueber die
            // Container-Einheit `cqh` (relativ zum naechsten `container-type`-
            // Vorfahren -- Seite im Editor, Kachel in der Miniatur) trifft die
            // Anzeige exakt die Editiergroesse, statt faelschlich mit der viel
            // kleineren Form-Box zu skalieren.
            fontSize: `${(overlay.fontSize ?? 0.024) * 100}cqh`,
            color: overlayTextColorCss(overlay.color, DEFAULT_SHAPE_TEXT_COLOR),
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

function renderSvgShape(
  kind: string,
  points: number[] | undefined,
  w: number,
  h: number,
  stroke: string,
  strokePx: number,
  fill: string | undefined,
): React.ReactNode {
  const common = {
    stroke,
    strokeWidth: strokePx,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  const px = (p: number[] | undefined, defaults: number[]) => {
    const src = p && p.length >= defaults.length ? p : defaults;
    return src.map((v, i) => v * (i % 2 === 0 ? w : h));
  };

  if (kind === 'line' || kind === 'arrow') {
    const [x0, y0, x1, y1] = px(points, [0, 0, 1, 1]);
    const head: React.ReactNode[] = [];
    if (kind === 'arrow') {
      const angle = Math.atan2(y1 - y0, x1 - x0);
      const len = Math.max(strokePx * 3.2, Math.hypot(x1 - x0, y1 - y0) * 0.22);
      const spread = Math.PI / 7;
      for (const sign of [1, -1]) {
        const a = angle + Math.PI - sign * spread;
        head.push(
          <line
            key={sign}
            x1={x1}
            y1={y1}
            x2={x1 + Math.cos(a) * len}
            y2={y1 + Math.sin(a) * len}
            {...common}
          />,
        );
      }
    }
    return (
      <>
        <line x1={x0} y1={y0} x2={x1} y2={y1} {...common} />
        {head}
      </>
    );
  }

  if (kind === 'polygon' || kind === 'freehand') {
    const flat = points ?? [];
    const pts: string[] = [];
    for (let i = 0; i + 1 < flat.length; i += 2) pts.push(`${flat[i] * w},${flat[i + 1] * h}`);
    if (pts.length < 2) return null;
    if (kind === 'polygon') {
      return <polygon points={pts.join(' ')} {...common} fill={fill ?? 'none'} />;
    }
    return <polyline points={pts.join(' ')} {...common} />;
  }

  if (kind === 'check') {
    const [x0, y0, x1, y1, x2, y2] = px(undefined, [0.18, 0.55, 0.42, 0.8, 0.84, 0.22]);
    return <path d={`M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2}`} {...common} />;
  }
  if (kind === 'cross') {
    return (
      <>
        <line x1={0.22 * w} y1={0.22 * h} x2={0.78 * w} y2={0.78 * h} {...common} />
        <line x1={0.78 * w} y1={0.22 * h} x2={0.22 * w} y2={0.78 * h} {...common} />
      </>
    );
  }
  return null;
}
