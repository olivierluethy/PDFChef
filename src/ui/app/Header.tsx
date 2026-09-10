import { useRef } from 'react';
import { Download, FolderUp, Upload } from 'lucide-react';
import { describeSaveStatus, type SaveStatus } from '../../services/persistence/autosave';
import { useDispatch, useServices, useWorkspace } from './StoreProvider';

export interface HeaderProps {
  onImportFiles(files: FileList | File[]): void;
  onExport(): void;
  saveStatus: SaveStatus;
}

// webkitdirectory ist kein Standard-Attribut in den React-Typen.
const folderAttrs = { webkitdirectory: '', directory: '' } as Record<string, string>;

export function Header({ onImportFiles, onExport, saveStatus }: HeaderProps) {
  const workspace = useWorkspace();
  const dispatch = useDispatch();
  const services = useServices();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const folderInput = useRef<HTMLInputElement | null>(null);
  const accept = `${services.registry.acceptAttribute()},application/zip,.zip`;

  const button = 'flex items-center gap-1.5 rounded border border-line bg-raised px-3 py-1.5 text-sm hover:border-accent/60';

  return (
    <header role="banner" className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2">
      <span className="font-semibold text-ink">PDF-Master</span>
      <input
        value={workspace.name}
        onChange={(e) => dispatch({ type: 'renameWorkspace', name: e.target.value })}
        aria-label="Name des Arbeitsbereichs"
        className="w-56 rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-line focus:border-line"
      />
      <span className="text-xs text-muted" role="status">
        {describeSaveStatus(saveStatus)}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={accept}
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) onImportFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          {...folderAttrs}
          onChange={(e) => {
            if (e.target.files) onImportFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button type="button" onClick={() => fileInput.current?.click()} className={button}>
          <Upload className="size-4" aria-hidden /> Dateien
        </button>
        <button type="button" onClick={() => folderInput.current?.click()} className={button}>
          <FolderUp className="size-4" aria-hidden /> Ordner
        </button>
        <button type="button" onClick={onExport} className={button}>
          <Download className="size-4" aria-hidden /> Exportieren
        </button>
      </div>
    </header>
  );
}
