import { useReducedMotion } from 'motion/react';
import type { Transition } from 'motion/react';

/**
 * Zentrale Motion-Presets. Die Werte stammen 1:1 aus der Designvorgabe, damit
 * alle Bewegungen dieselbe Sprache sprechen. `prefers-reduced-motion` wird an
 * genau einer Stelle behandelt: die globale CSS-Regel killt CSS-Transitions,
 * `useMotionPrefs()` liefert JS-Komponenten ihre reduzierte Variante.
 */
export const spring = {
  /** Drag-Vorschau folgt dem Zeiger. */
  dragPreview: { type: 'spring', stiffness: 700, damping: 45, mass: 0.6 },
  /** Karten wandern an ihre neue Rasterposition. */
  layout: { type: 'spring', stiffness: 500, damping: 40 },
} as const satisfies Record<string, Transition>;

export const tween = {
  /** Panel-Kollaps und Splitter. */
  panel: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
  /** Menues, Dialoge, Kontextleiste -- rein. */
  overlayIn: { duration: 0.14, ease: [0.32, 0.72, 0, 1] },
  /** Menues, Dialoge, Kontextleiste -- raus. */
  overlayOut: { duration: 0.1, ease: [0.32, 0.72, 0, 1] },
} as const satisfies Record<string, Transition>;

export interface MotionPrefs {
  reduced: boolean;
  /** Gibt die passende Transition zurueck; bei reduzierter Bewegung: sofort. */
  t(transition: Transition): Transition;
}

export function useMotionPrefs(): MotionPrefs {
  const reduced = useReducedMotion() ?? false;
  return {
    reduced,
    t: (transition) => (reduced ? { duration: 0 } : transition),
  };
}

/** Skalier-und-Fade fuer Overlays (Menue, Dialog, Kontextleiste). */
export const overlayVariants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1 },
};
