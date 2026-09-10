import { createPortal } from 'react-dom';

export interface DragState {
  count: number;
  action: 'move' | 'copy' | 'add' | 'new';
  x: number;
  y: number;
}

const LABEL: Record<DragState['action'], string> = {
  move: 'verschieben',
  copy: 'kopieren',
  add: 'hinzufuegen',
  new: 'neues Dokument',
};

/**
 * Gestapelte Kartenvorschau mit Zaehler, dem Zeiger folgend. 46 gezogene
 * Seiten zeigen einen Stapel mit der Zahl, nicht 46 einzelne Bilder.
 */
export function DragPreview({ state }: { state: DragState }) {
  return createPortal(
    <div
      className="pointer-events-none fixed z-50 select-none"
      style={{ left: state.x + 12, top: state.y + 12 }}
    >
      <div className="relative">
        <span className="absolute left-1 top-1 block h-16 w-12 rounded bg-panel ring-1 ring-line" />
        <span className="absolute left-0.5 top-0.5 block h-16 w-12 rounded bg-panel ring-1 ring-line" />
        <span className="relative block h-16 w-12 rounded bg-panel ring-1 ring-sky-400" />
        <span className="absolute -right-2 -top-2 rounded-full bg-sky-500 px-1.5 text-xs font-medium">
          {state.count}
        </span>
      </div>
      <span className="mt-1 block rounded bg-black/70 px-1 text-center text-[11px]">{LABEL[state.action]}</span>
    </div>,
    document.body,
  );
}
