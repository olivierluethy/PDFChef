import { useEffect, useState } from 'react';
import { ensureFontFaces, loadFontCatalog, type FontManifestEntry } from './fontCatalog';

/** Liefert den (gecachten) Font-Katalog und stellt sicher, dass die @font-face-Regeln injiziert sind. */
export function useFontEntries(): FontManifestEntry[] {
  const [entries, setEntries] = useState<FontManifestEntry[]>([]);
  useEffect(() => {
    let active = true;
    loadFontCatalog().then((next) => {
      if (active) setEntries(next);
    });
    void ensureFontFaces();
    return () => {
      active = false;
    };
  }, []);
  return entries;
}
