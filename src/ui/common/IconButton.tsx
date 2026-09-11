import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from './cx';

type Variant = 'quiet' | 'raised' | 'quietDanger';
type Size = 'sm' | 'md';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Pflicht: die Aktion wird als aria-label und title gesetzt. */
  label: string;
  variant?: Variant;
  size?: Size;
}

const base =
  'inline-grid place-items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40';

const variants: Record<Variant, string> = {
  quiet: 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
  raised:
    'bg-surface-raised text-text-secondary ring-1 ring-line-hairline hover:text-text-primary hover:ring-line-structural',
  quietDanger: 'text-text-secondary hover:bg-danger/15 hover:text-danger',
};

// Mindest-Trefferflaeche 32x32; kompakt 28x28.
const sizes: Record<Size, string> = { sm: 'size-7', md: 'size-8' };
const iconSizes: Record<Size, string> = { sm: 'size-4', md: 'size-4' };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, variant = 'quiet', size = 'md', className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      <Icon className={iconSizes[size]} aria-hidden />
    </button>
  );
});
