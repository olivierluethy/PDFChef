import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'quiet' | 'quietDanger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Fuehrendes Icon; benennt die Aktion mit, ersetzt sie nicht. */
  icon?: LucideIcon;
  children?: ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  // Die einzige gefuellte Aktion: der Akzent markiert das Ende des Flusses.
  primary:
    'bg-accent text-on-accent hover:bg-accent-strong disabled:bg-surface-raised disabled:text-text-tertiary',
  // Umriss: gleichwertige, aber nicht abschliessende Aktionen.
  secondary:
    'border border-line-structural bg-surface-raised text-text-primary hover:bg-surface-hover disabled:opacity-40',
  // Leise: Text-Buttons ohne Flaeche.
  quiet:
    'text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:opacity-40',
  quietDanger: 'text-text-secondary hover:bg-danger/15 hover:text-danger disabled:opacity-40',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[12.5px]',
  md: 'h-8 px-3 text-[12.5px]',
  lg: 'h-10 px-4 text-[13.5px]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon: Icon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cx(base, variants[variant], sizes[size], className)} {...rest}>
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      {children}
    </button>
  );
});
