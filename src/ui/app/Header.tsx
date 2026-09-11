import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileText, FolderUp, Pencil, Printer, Share2 } from 'lucide-react';
import type { SaveStatus } from '../../services/persistence/autosave';
import { isOutput } from '../../domain/types';
import { Button } from '../common/Button';
import { Menu } from '../common/Menu';
import { SaveStatus as SaveStatusView } from '../common/SaveStatus';
import { Tooltip } from '../common/Tooltip';
import { cx } from '../common/cx';
import { useDispatch, useServices, useWorkspace } from './StoreProvider';

export interface HeaderProps {
  onImportFiles(files: FileList | File[]): void;
  onExport(): void;
  onPrint(): void;
  onShare(): void;
  saveStatus: SaveStatus;
}

// webkitdirectory ist kein Standard-Attribut in den React-Typen.
const folderAttrs = { webkitdirectory: '', directory: '' } as Record<string, string>;

export function Header({ onImportFiles, onExport, onPrint, onShare, saveStatus }: HeaderProps) {
  const workspace = useWorkspace();
  const services = useServices();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const folderInput = useRef<HTMLInputElement | null>(null);
  const zipInput = useRef<HTMLInputElement | null>(null);
  const docAccept = services.registry.acceptAttribute();
  const hasOutputs = Object.values(workspace.nodes).some(isOutput);

  const pick = (input: HTMLInputElement | null) => input?.click();

  return (
    <header
      role="banner"
      className="flex h-14 items-center gap-3 border-b border-line-structural bg-surface-panel px-4"
    >
      <span className="t-panel-title select-none text-text-primary">PDF-Master</span>
      <span aria-hidden className="h-5 w-px bg-line-structural" />

      <WorkspaceName />

      <div className="ml-3">
        <SaveStatusView status={saveStatus} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Versteckte Eingaben fuer die drei Importwege. */}
        <input
          ref={fileInput}
          type="file"
          accept={docAccept}
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
        <input
          ref={zipInput}
          type="file"
          accept="application/zip,.zip"
          hidden
          onChange={(e) => {
            if (e.target.files) onImportFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {/* Split-Button: Hauptteil oeffnet den Dateidialog, der Pfeil das Menue. */}
        <div className="flex items-stretch overflow-hidden rounded-md border border-line-structural bg-surface-raised">
          <button
            type="button"
            onClick={() => pick(fileInput.current)}
            className="inline-flex h-8 items-center gap-1.5 px-3 text-[12.5px] font-medium text-text-primary hover:bg-surface-hover"
          >
            <FolderUp className="size-4" aria-hidden /> Importieren
          </button>
          <span aria-hidden className="my-1 w-px bg-line-structural" />
          <Menu
            align="end"
            minWidth={196}
            items={[
              {
                id: 'files',
                label: 'Dateien wählen …',
                icon: FileText,
                onSelect: () => pick(fileInput.current),
              },
              {
                id: 'folder',
                label: 'Ordner wählen …',
                icon: FolderUp,
                onSelect: () => pick(folderInput.current),
              },
              {
                id: 'zip',
                label: 'ZIP-Archiv wählen …',
                icon: FileText,
                onSelect: () => pick(zipInput.current),
              },
            ]}
            renderTrigger={({ ref, toggle, ariaProps }) => (
              <button
                ref={ref}
                type="button"
                onClick={toggle}
                aria-label="Weitere Importoptionen"
                className="inline-grid h-8 w-8 place-items-center text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                {...ariaProps}
              >
                <ChevronDown className="size-4" aria-hidden />
              </button>
            )}
          />
        </div>

        <Button variant="secondary" icon={Share2} onClick={onShare} disabled={!hasOutputs}>
          Teilen
        </Button>

        <Button variant="secondary" icon={Printer} onClick={onPrint}>
          Drucken
        </Button>

        <Tooltip label={hasOutputs ? '' : 'Lege zuerst ein Ausgabedokument mit Seiten an.'}>
          <Button
            variant="primary"
            size="lg"
            icon={Download}
            onClick={onExport}
            disabled={!hasOutputs}
          >
            Exportieren
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}

/**
 * Der Arbeitsbereichsname als Inline-Bearbeitung: sichtbar als Text mit einer
 * Stift-Andeutung, per Klick oder F2 in ein Eingabefeld verwandelt.
 */
function WorkspaceName() {
  const workspace = useWorkspace();
  const dispatch = useDispatch();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(workspace.name);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => setDraft(workspace.name), [workspace.name]);

  const commit = () => {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== workspace.name) dispatch({ type: 'renameWorkspace', name });
    else setDraft(workspace.name);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(workspace.name);
            setEditing(false);
          }
        }}
        aria-label="Name des Arbeitsbereichs"
        className="h-8 w-56 rounded-md bg-surface-raised px-2 text-[13.5px] text-text-primary ring-1 ring-line-structural"
      />
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'F2') {
          e.preventDefault();
          setEditing(true);
        }
      }}
      title="Umbenennen (F2)"
      className={cx(
        'group inline-flex h-8 max-w-[16rem] items-center gap-1.5 rounded-md px-2 text-[13.5px] text-text-primary hover:bg-surface-hover',
      )}
    >
      <span className="truncate">{workspace.name}</span>
      <Pencil
        className="size-3.5 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
    </button>
  );
}
