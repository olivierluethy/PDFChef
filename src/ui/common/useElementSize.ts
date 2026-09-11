import { useEffect, useState, type RefObject } from 'react';

/**
 * Misst die aktuelle Pixelgroesse eines Elements und aktualisiert sie bei jeder
 * Groessenaenderung (Zoom, Fensterbreite, Layoutwechsel). Die Annotationsebene
 * braucht die echte Bildgroesse, um Bruchteile in Pixel umzurechnen.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    setSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, [ref]);
  return size;
}
