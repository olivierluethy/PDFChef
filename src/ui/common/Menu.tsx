import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cx } from './cx';
import { overlayVariants, tween, useMotionPrefs } from './motion';

export interface MenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect(): void;
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuTriggerArgs {
  ref: (el: HTMLButtonElement | null) => void;
  open: boolean;
  toggle(): void;
  ariaProps: { 'aria-haspopup': 'menu'; 'aria-expanded': boolean };
}

export interface MenuProps {
  items: MenuItem[];
  renderTrigger(args: MenuTriggerArgs): ReactNode;
  align?: 'start' | 'end';
  /** Minimalbreite des Menues in px. */
  minWidth?: number;
}

/**
 * Zugaengliches Popover-Menue: Roving-Focus per Pfeiltasten, Escape schliesst und
 * gibt den Fokus an den Ausloeser zurueck, Klick nach aussen schliesst. Skaliert
 * beim Oeffnen aus dem Ausloeser heraus.
 */
export function Menu({ items, renderTrigger, align = 'end', minWidth = 200 }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const prefs = useMotionPrefs();

  const enabledIndexes = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const first = enabledIndexes[0] ?? 0;
    setActiveIndex(first);
    // Fokus in die Liste, nachdem sie gerendert wurde.
    const id = requestAnimationFrame(() => itemRefs.current[first]?.focus());
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open]);

  const move = (dir: 1 | -1) => {
    const pos = enabledIndexes.indexOf(activeIndex);
    const nextPos = (pos + dir + enabledIndexes.length) % enabledIndexes.length;
    const next = enabledIndexes[nextPos];
    setActiveIndex(next);
    itemRefs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(enabledIndexes[0]);
        itemRefs.current[enabledIndexes[0]]?.focus();
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(enabledIndexes.at(-1)!);
        itemRefs.current[enabledIndexes.at(-1)!]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <span className="relative inline-flex">
      {renderTrigger({
        ref: (el) => (triggerRef.current = el),
        open,
        toggle: () => setOpen((v) => !v),
        ariaProps: { 'aria-haspopup': 'menu', 'aria-expanded': open },
      })}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            id={menuId}
            role="menu"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={overlayVariants}
            transition={prefs.t(tween.overlayIn)}
            onKeyDown={onKeyDown}
            style={{ minWidth, transformOrigin: align === 'end' ? 'top right' : 'top left' }}
            className={cx(
              'absolute top-[calc(100%+6px)] z-50 flex flex-col gap-0.5 rounded-[10px] bg-surface-raised p-1 shadow-[var(--float-shadow)] ring-1 ring-line-structural',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  tabIndex={-1}
                  onClick={() => {
                    close(false);
                    item.onSelect();
                  }}
                  className={cx(
                    'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors disabled:opacity-40',
                    item.danger
                      ? 'text-text-secondary hover:bg-danger/15 hover:text-danger focus-visible:bg-danger/15 focus-visible:text-danger'
                      : 'text-text-primary hover:bg-surface-hover focus-visible:bg-surface-hover',
                  )}
                >
                  {Icon && <Icon className="size-4 shrink-0 text-text-secondary" aria-hidden />}
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
