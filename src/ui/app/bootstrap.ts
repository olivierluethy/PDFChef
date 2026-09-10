import { createEmptyWorkspace, type SourceId, type Workspace } from '../../domain/types';
import { newId } from '../../domain/ids';
import { createAppServices } from '../../services/app/appServices';
import { wireStores, type StoreContextValue } from './StoreProvider';

/**
 * Baut die Dienste, laedt den zuletzt benutzten Workspace und verdrahtet den
 * Autosave. contentHashOf liest aus einer Referenz, die immer auf den aktuellen
 * Workspace zeigt -- so kennt die Adapterschicht den Store nicht, bekommt aber
 * trotzdem den Inhalt-Hash zu jeder Quelle.
 */
export async function bootstrapWorkspace(): Promise<StoreContextValue> {
  let currentWorkspace: Workspace = createEmptyWorkspace({ id: newId(), name: 'Neuer Arbeitsbereich' });

  const services = await createAppServices({
    contentHashOf: (sourceId: SourceId) => currentWorkspace.sources[sourceId]?.contentHash,
  });

  const loaded = await services.repo.loadMostRecent();
  const initialWorkspace = loaded ?? currentWorkspace;
  currentWorkspace = initialWorkspace;

  const value = wireStores({ services, initialWorkspace });

  // Jede Aenderung am Workspace geht als geplanter Autosave weiter; die
  // Referenz fuer contentHashOf wird gleich mitgezogen.
  value.workspaceStore.subscribe((state) => {
    currentWorkspace = state.workspace;
    services.autosave.schedule(state.workspace);
  });

  // Beim Verlassen des Tabs sofort schreiben, nicht auf die Ruhezeit warten.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void services.autosave.flush();
    });
  }

  return value;
}
