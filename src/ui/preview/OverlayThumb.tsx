import { useEffect } from 'react';
import type { Overlay } from '../../domain/types';
import { overlayCssFamily, overlayFontSpec } from '../../domain/overlayFonts';
import { overlayTextColorCss } from '../../domain/overlayShapes';
import { ensureOverlayFontFaces } from '../text/overlayFontFaces';
import { OverlayShape } from './OverlayShape';
import { overlayTextBgStyle } from './FillLayer';

/**
 * Nur-Anzeige-Overlay ueber einer Kachel: zeigt live, welche Felder/Unterschriften
 * eine Ausgabe-Seite traegt. Positionen sind Bruchteile der Seite (wie im Editor);
 * die Schriftgroesse skaliert per Container-Einheit `cqh` mit der Kachel -- ohne
 * Pixelmessung. Liegt im gedrehten Blatt-Span, dreht also mit der Seite mit.
 */
export function OverlayThumb({ overlays }: { overlays: Overlay[] }) {
  useEffect(() => {
    ensureOverlayFontFaces();
  }, []);

  if (overlays.length === 0) return null;

  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, containerType: 'size', overflow: 'hidden', pointerEvents: 'none' }}
    >
      {overlays.map((overlay) => {
        const rot = overlay.rotation ?? 0;
        const common: React.CSSProperties = {
          position: 'absolute',
          left: `${overlay.x * 100}%`,
          top: `${overlay.y * 100}%`,
          width: `${overlay.w * 100}%`,
          ...(rot ? { transform: `rotate(${rot}deg)`, transformOrigin: 'center' } : {}),
        };
        if (overlay.kind === 'image') {
          if (!overlay.dataUrl) return null;
          return (
            <img
              key={overlay.id}
              src={overlay.dataUrl}
              alt=""
              draggable={false}
              style={{ ...common, height: `${overlay.h * 100}%`, objectFit: 'contain' }}
            />
          );
        }
        if (overlay.kind === 'shape') {
          return (
            <div key={overlay.id} style={{ ...common, height: `${overlay.h * 100}%` }}>
              <OverlayShape overlay={overlay} />
            </div>
          );
        }
        const text = overlay.text ?? '';
        if (text.trim() === '') return null;
        const spec = overlayFontSpec(overlay.font);
        const bold = overlay.bold ?? false;
        const bgStyle = overlayTextBgStyle(overlay.textBg);
        const hasBox = overlay.h > 0;
        const flip =
          overlay.flipX || overlay.flipY
            ? `scale(${overlay.flipX ? -1 : 1}, ${overlay.flipY ? -1 : 1})`
            : undefined;
        return (
          <div
            key={overlay.id}
            style={{
              ...common,
              ...(hasBox
                ? {
                    minHeight: `${overlay.h * 100}%`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent:
                      overlay.valign === 'middle'
                        ? 'center'
                        : overlay.valign === 'bottom'
                          ? 'flex-end'
                          : 'flex-start',
                  }
                : {}),
            }}
          >
            <div
              style={{
                width: '100%',
                fontFamily: overlayCssFamily(spec, bold),
                fontWeight: bold ? 700 : spec.cssWeight,
                fontStyle: overlay.italic ? 'italic' : 'normal',
                fontSize: `${(overlay.fontSize ?? 0.024) * 100}cqh`,
                lineHeight: 1.25,
                color: overlayTextColorCss(overlay.color, '#171c21'),
                whiteSpace: 'pre-wrap',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                ...(flip ? { transform: flip, transformOrigin: 'center' } : {}),
              }}
            >
              {bgStyle ? <span style={bgStyle}>{text}</span> : text}
            </div>
          </div>
        );
      })}
    </div>
  );
}
