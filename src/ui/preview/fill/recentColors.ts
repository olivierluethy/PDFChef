import { useSyncExternalStore } from 'react';

/**
 * Kleiner, geteilter Speicher fuer "zuletzt verwendete Farben". Alle
 * ColorPicker-Instanzen teilen sich dieselbe Liste (MRU: zuletzt gewaehlte
 * zuerst, ohne Duplikate) und werden bei Aenderungen neu gerendert. Persistiert
 * ueber localStorage, damit die Auswahl auch nach einem Reload erhalten bleibt.
 */
const KEY = 'pdfmaster.recentColors';
const MAX = 8;

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function load(): string[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cache = Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function getRecentColors(): string[] {
  return load();
}

/** Legt eine gewaehlte Farbe vorne an (dedupliziert, auf MAX begrenzt). */
export function addRecentColor(hex: string): void {
  const norm = normalizeHex(hex);
  if (!norm) return;
  const next = [norm, ...load().filter((c) => c.toLowerCase() !== norm.toLowerCase())].slice(0, MAX);
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage nicht verfuegbar (privater Modus o. ae.) -- rein im Speicher weiterfuehren.
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** React-Hook: liefert die aktuelle MRU-Liste und rendert bei Aenderungen neu. */
export function useRecentColors(): string[] {
  return useSyncExternalStore(subscribe, getRecentColors, getRecentColors);
}

/**
 * Normalisiert eine Nutzereingabe (`#abc`, `abc`, `#aabbcc`, `AABBCC`, ...) auf
 * `#rrggbb` in Kleinschreibung. Gibt `null` bei ungueltiger Eingabe zurueck.
 */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const [r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw}`.toLowerCase();
  }
  return null;
}
