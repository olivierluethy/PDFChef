import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../common/Button';
import { useT } from '../../i18n';

export interface NameDialogProps {
  title: string;
  label: string;
  defaultValue?: string;
  confirmLabel?: string;
  onCancel(): void;
  onConfirm(name: string): void;
}

/** Kleiner Dialog, um einem Baustein (oder einer Unterschrift) einen Namen zu geben. */
export function NameDialog({
  title,
  label,
  defaultValue = '',
  confirmLabel,
  onCancel,
  onConfirm,
}: NameDialogProps) {
  const t = useT();
  const confirmText = confirmLabel ?? t('preview.fill.save');
  const [value, setValue] = useState(defaultValue);
  return createPortal(
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-xl bg-surface-panel p-5 shadow-[var(--float-shadow)] ring-1 ring-line-structural">
        <h2 className="t-panel-title text-text-primary">{title}</h2>
        <label className="mt-3 block text-[12.5px] text-text-secondary">
          {label}
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim() !== '') onConfirm(value.trim());
            }}
            className="mt-1.5 block w-full rounded-md bg-surface-raised px-2.5 py-1.5 text-[13px] text-text-primary outline-none ring-1 ring-line-structural focus:ring-accent"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {t('preview.fill.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={value.trim() === ''}
            onClick={() => onConfirm(value.trim())}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
