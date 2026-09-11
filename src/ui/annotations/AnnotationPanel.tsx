import { Trash2 } from 'lucide-react';
import type { Annotation, TextAnnotation } from '../../domain/types';
import type { FontManifestEntry } from '../text/fontCatalog';
import { hexToRgb, rgbToHex } from './annotationModel';

export interface AnnotationPanelProps {
  annotation: Annotation;
  fontEntries: FontManifestEntry[];
  /** Seitenhoehe in Punkten -- fuer die Anzeige/Bearbeitung der Groesse in pt. */
  pageHeightPts: number;
  onChange(patch: Partial<Annotation>): void;
  onRemove(): void;
}

/** Kompakte Eigenschaftenleiste fuer das aktuell ausgewaehlte Feld. */
export function AnnotationPanel({ annotation, fontEntries, pageHeightPts, onChange, onRemove }: AnnotationPanelProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-3 py-1.5 text-sm">
      {annotation.kind === 'text' ? (
        <TextControls annotation={annotation} fontEntries={fontEntries} pageHeightPts={pageHeightPts} onChange={onChange} />
      ) : (
        <label className="flex items-center gap-1">
          Breite
          <input
            type="range"
            min={5}
            max={100}
            value={Math.round(annotation.width * 100)}
            onChange={(event) => onChange({ width: Number(event.target.value) / 100 })}
          />
          {Math.round(annotation.width * 100)}%
        </label>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Feld loeschen"
        className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-red-300 hover:bg-red-500/15"
      >
        <Trash2 className="size-4" /> Loeschen
      </button>
    </div>
  );
}

function TextControls({
  annotation,
  fontEntries,
  pageHeightPts,
  onChange,
}: {
  annotation: TextAnnotation;
  fontEntries: FontManifestEntry[];
  pageHeightPts: number;
  onChange(patch: Partial<Annotation>): void;
}) {
  const pt = Math.round(annotation.sizeFrac * pageHeightPts);
  const setPt = (value: number) => onChange({ sizeFrac: Math.max(1, value) / pageHeightPts });

  return (
    <>
      <select
        aria-label="Schriftart"
        value={annotation.fontId}
        onChange={(event) => onChange({ fontId: event.target.value })}
        className="rounded border border-line bg-black/20 px-2 py-1"
      >
        {fontEntries.map((entry) => (
          <option key={entry.id} value={entry.id}>{entry.label}</option>
        ))}
      </select>

      <label className="flex items-center gap-1">
        Groesse
        <input
          type="number"
          min={4}
          max={400}
          value={pt}
          onChange={(event) => setPt(Number(event.target.value))}
          className="w-16 rounded border border-line bg-black/20 px-1 py-0.5"
        />
        pt
      </label>

      <button
        type="button"
        aria-pressed={annotation.bold}
        onClick={() => onChange({ bold: !annotation.bold })}
        className={`rounded px-2 py-1 font-bold ${annotation.bold ? 'bg-accent text-black' : 'hover:bg-black/20'}`}
      >
        B
      </button>

      <div className="flex items-center gap-0.5" role="group" aria-label="Ausrichtung">
        {(['left', 'center', 'right'] as const).map((align) => (
          <button
            key={align}
            type="button"
            aria-pressed={annotation.align === align}
            onClick={() => onChange({ align })}
            className={`rounded px-2 py-1 ${annotation.align === align ? 'bg-accent text-black' : 'hover:bg-black/20'}`}
          >
            {align === 'left' ? 'L' : align === 'center' ? 'M' : 'R'}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-1">
        Farbe
        <input
          type="color"
          value={rgbToHex(annotation.color)}
          onChange={(event) => onChange({ color: hexToRgb(event.target.value) })}
          aria-label="Textfarbe"
        />
      </label>
    </>
  );
}
