import { useEffect } from 'react';
import type { Overlay } from '../../domain/types';
import { overlayCssFamily, overlayFontSpec } from '../../domain/overlayFonts';
import { ensureOverlayFontFaces } from '../text/overlayFontFaces';

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
        const common: React.CSSProperties = {
          position: 'absolute',
          left: `${overlay.x * 100}%`,
          top: `${overlay.y * 100}%`,
          width: `${overlay.w * 100}%`,
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
        const text = overlay.text ?? '';
        if (text.trim() === '') return null;
        const spec = overlayFontSpec(overlay.font);
        const bold = overlay.bold ?? false;
        return (
          <div
            key={overlay.id}
            style={{
              ...common,
              fontFamily: overlayCssFamily(spec, bold),
              fontWeight: bold ? 700 : spec.cssWeight,
              fontStyle: overlay.italic ? 'italic' : 'normal',
              fontSize: `${(overlay.fontSize ?? 0.024) * 100}cqh`,
              lineHeight: 1.25,
              color: '#171c21',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
              wordBreak: 'break-word',
            }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}
