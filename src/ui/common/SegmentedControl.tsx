import { cx } from './cx';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  /** Optionaler Zaehler, z. B. Anzahl ausgeblendeter Seiten in der inaktiven Option. */
  count?: number;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange(value: T): void;
  ariaLabel: string;
  className?: string;
}

/**
 * Physischer Zweifach-Umschalter. Bewusst ohne Akzentfarbe -- ein Ansichtsfilter
 * ist keine der reservierten Nutzerentscheidungen. Der aktive Abschnitt hebt sich
 * durch eine erhoehte Flaeche ab, nicht durch Farbe.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx(
        'inline-flex items-center gap-0.5 rounded-md bg-surface-canvas p-0.5 ring-1 ring-line-hairline',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[12.5px] font-medium transition-colors',
              active
                ? 'bg-surface-raised text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={cx('font-mono text-[11px] tabular-nums', active ? 'text-text-secondary' : 'text-text-tertiary')}>
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
