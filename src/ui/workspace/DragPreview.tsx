import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { spring, useMotionPrefs } from '../common/motion';

export interface DragState {
  count: number;
  action: 'move' | 'copy' | 'add' | 'new';
  x: number;
  y: number;
}

const LABEL: Record<DragState['action'], string> = {
  move: 'Verschieben',
  copy: 'Kopieren',
  add: 'Hinzufügen',
  new: 'Neues Dokument',
};

const OFFSETS = [0, -2, 3]; // Rotationsversatz der bis zu drei Blaetter im Stapel.

/**
 * Gestapelte Kartenvorschau mit Zaehler, dem Zeiger per Feder folgend. 46 Seiten
 * zeigen einen Stapel mit der Zahl, nicht 46 Bilder. Der Modus (Verschieben /
 * Kopieren) steht sichtbar dabei und aktualisiert live beim Halten von Ctrl/Cmd.
 */
export function DragPreview({ state }: { state: DragState }) {
  const prefs = useMotionPrefs();
  const layers = Math.min(state.count, 3);

  return createPortal(
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-50 select-none"
      animate={{ x: state.x + 14, y: state.y + 14 }}
      transition={prefs.t(spring.dragPreview)}
    >
      <div className="relative h-16 w-12">
        {Array.from({ length: layers }).map((_, i) => (
          <span
            key={i}
            className="paper-sheet absolute inset-0"
            style={{ transform: `rotate(${OFFSETS[i] ?? 0}deg)`, zIndex: i }}
          />
        ))}
        <span className="absolute -right-2 -top-2 z-10 rounded-full bg-info px-1.5 py-px font-mono text-[11px] font-medium tabular-nums text-surface-canvas">
          {state.count}
        </span>
      </div>
      <span className="mt-1.5 block w-max rounded bg-surface-raised px-1.5 py-0.5 text-[11px] font-medium text-text-primary shadow-[var(--float-shadow)]">
        {LABEL[state.action]}
      </span>
    </motion.div>,
    document.body,
  );
}
