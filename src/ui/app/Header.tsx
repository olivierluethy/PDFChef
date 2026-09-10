import { useRef } from 'react';
import { FolderUp, Download } from 'lucide-react';
import { describeSaveStatus, type SaveStatus } from '../../services/persistence/autosave';
import { useDispatch, useServices, useWorkspace } from './StoreProvider';

export interface HeaderProps {
  onImportFiles(files: FileList | File[]): void;
  onExport(): void;
  saveStatus: SaveStatus;
}

export function Header({ onImportFiles, onExport, saveStatus }: HeaderProps) {
  const workspace = useWorkspace();
  const dispatch = useDispatch();
  const services = useServices();
  const fileInput = useRef<HTMLInputElement | null>(null);

  return (
    <header role="banner" className="flex items-center gap-4 border-b border-line px-4 py-2">
      <span className="font-semibold">PDF-Master</span>
      <input
        value={workspace.name}
        onChange={(e) => dispatch({ type: 'renameWorkspace', name: e.target.value })}
        aria-label="Name des Arbeitsbereichs"
        className="w-56 rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-line focus:border-line"
      />
      <span className="text-xs text-neutral-500" role="status">
        {describeSaveStatus(saveStatus)}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={services.registry.acceptAttribute()}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) onImportFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex items-center gap-1 rounded bg-panel px-3 py-1 text-sm hover:bg-panel/80"
        >
          <FolderUp className="size-4" aria-hidden /> Importieren
        </button>
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-1 rounded bg-panel px-3 py-1 text-sm hover:bg-panel/80"
        >
          <Download className="size-4" aria-hidden /> Exportieren
        </button>
      </div>
    </header>
  );
}
