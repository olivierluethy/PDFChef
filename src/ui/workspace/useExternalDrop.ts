import { useCallback, useState, type DragEvent } from 'react';
import { useDispatch, useServices } from '../app/StoreProvider';

export interface ExternalDropResult {
  dropHandlers: {
    onDragOver(event: DragEvent): void;
    onDragLeave(): void;
    onDrop(event: DragEvent): void;
  };
  isOver: boolean;
  rejected: string[];
}

/**
 * Native Datei-/Ordner-Drops -- strikt getrennt vom internen Pointer-Drag.
 * Der Hook uebersetzt nur; das Einsammeln und Einlesen erledigen die
 * getesteten Importdienste ueber services.importForDrop.
 */
export function useExternalDrop(onImported?: () => void): ExternalDropResult {
  const services = useServices();
  const dispatch = useDispatch();
  const [isOver, setIsOver] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setIsOver(false);
      const items = Array.from(event.dataTransfer.items);
      void services.importForDrop(items).then((report) => {
        if (report.sources.length > 0) {
          dispatch({ type: 'importSources', sources: report.sources });
          onImported?.();
        }
        setRejected(report.rejected.map((entry) => `${entry.name}: ${entry.message}`));
      });
    },
    [services, dispatch, onImported],
  );

  return {
    dropHandlers: {
      onDragOver: (event) => {
        event.preventDefault();
        setIsOver(true);
      },
      onDragLeave: () => setIsOver(false),
      onDrop,
    },
    isOver,
    rejected,
  };
}
