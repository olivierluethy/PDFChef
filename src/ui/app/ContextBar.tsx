import { AnimatePresence, motion } from 'motion/react';
import { FilePlus2, RotateCw, Scissors, Trash2, X } from 'lucide-react';
import { newId } from '../../domain/ids';
import type { CompositionItem } from '../../domain/types';
import { Button } from '../common/Button';
import { IconButton } from '../common/IconButton';
import { overlayVariants, tween, useMotionPrefs } from '../common/motion';
import { useDispatch, useSelection, useSelectionStore } from './StoreProvider';

export interface ContextBarProps {
  onRequestSplit(): void;
}

/**
 * Schwebende Kontextleiste. Sie erscheint nur, wenn etwas ausgewaehlt ist -- ohne
 * Auswahl ist sie schlicht abwesend, kein grauer Platzhalter. Ein Live-Bereich
 * meldet die Auswahlgroesse an Screenreader.
 */
export function ContextBar({ onRequestSplit }: ContextBarProps) {
  const selection = useSelection();
  const selectionStore = useSelectionStore();
  const dispatch = useDispatch();
  const prefs = useMotionPrefs();
  const count = selection.ids.length;
  const scope = selection.scope;
  const inOutput = scope?.kind === 'output';
  const inSource = scope?.kind === 'source';

  function newDocumentFromSelection() {
    if (scope?.kind !== 'source') return;
    const outputId = newId();
    const items: CompositionItem[] = selection.ids.map((id) => ({
      id: newId(),
      sourceId: scope.sourceId,
      blockIndex: Number(id),
      rotation: 0,
    }));
    dispatch({
      type: 'batch',
      label: `${count} Seiten in ein neues Dokument`,
      commands: [
        { type: 'createOutput', node: { id: outputId, name: 'Neues Dokument', parentId: null } },
        { type: 'addItems', outputId, index: 0, items },
      ],
    });
  }

  return (
    <>
      <span className="sr-only" role="status" aria-live="polite">
        {count > 0 ? `${count} ${count === 1 ? 'Seite' : 'Seiten'} ausgewählt` : ''}
      </span>
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={overlayVariants}
            transition={prefs.t(tween.overlayIn)}
            style={{ transformOrigin: 'bottom center' }}
            className="fixed bottom-4 left-1/2 z-40 flex h-12 -translate-x-1/2 items-center gap-1 rounded-[10px] bg-surface-raised px-2 shadow-[var(--float-shadow)] ring-1 ring-line-structural"
          >
            <span className="px-2 font-mono text-[12.5px] tabular-nums text-text-primary">
              {count} <span className="font-sans text-text-secondary">{count === 1 ? 'Seite' : 'Seiten'} ausgewählt</span>
            </span>
            <span aria-hidden className="mx-1 h-5 w-px bg-line-structural" />

            {inSource && (
              <Button variant="quiet" size="sm" icon={FilePlus2} onClick={newDocumentFromSelection}>
                Neues Dokument aus Auswahl
              </Button>
            )}
            {inOutput && (
              <Button
                variant="quiet"
                size="sm"
                icon={RotateCw}
                onClick={() => dispatch({ type: 'rotateItems', itemIds: selection.ids, delta: 90 })}
              >
                Drehen
              </Button>
            )}
            <Button variant="quiet" size="sm" icon={Scissors} onClick={onRequestSplit}>
              Aufteilen
            </Button>
            {inOutput && (
              <Button
                variant="quietDanger"
                size="sm"
                icon={Trash2}
                onClick={() => dispatch({ type: 'removeItems', itemIds: selection.ids })}
              >
                Entfernen
              </Button>
            )}

            <span aria-hidden className="mx-1 h-5 w-px bg-line-structural" />
            <IconButton icon={X} label="Auswahl aufheben" onClick={() => selectionStore.getState().clear()} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
