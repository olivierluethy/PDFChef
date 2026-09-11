import type { ReactNode } from 'react';
import { cx } from './cx';

type Tone = 'neutral' | 'info';

export interface PillProps {
  children: ReactNode;
  tone?: Tone;
  /** Zahlen laufen mono/tabular; Text-Pills bleiben in der UI-Schrift. */
  mono?: boolean;
  className?: string;
  title?: string;
  'aria-label'?: string;
}

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-raised text-text-secondary',
  info: 'bg-info-soft text-info',
};

/** Zaehler-Pille: 999px Radius ist ausschliesslich hier erlaubt. */
export function Pill({ children, tone = 'neutral', mono = true, className, title, ...aria }: PillProps) {
  return (
    <span
      title={title}
      {...aria}
      className={cx(
        'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-px text-[11px] font-medium leading-none',
        mono && 'font-mono tabular-nums',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
