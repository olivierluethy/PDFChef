import { useEffect, useState } from 'react';

/**
 * Haelt genau eine Blob-URL am Leben und gibt sie frei, sobald der Blob
 * wechselt oder die Komponente verschwindet. Ohne die Freigabe waechst der
 * Speicher bei jedem Seitenwechsel im Viewer.
 */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => {
      URL.revokeObjectURL(next);
    };
  }, [blob]);

  return url;
}
