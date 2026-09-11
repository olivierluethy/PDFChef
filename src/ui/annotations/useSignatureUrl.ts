import { useEffect, useState } from 'react';
import { useServices } from '../app/StoreProvider';

/**
 * Object-URLs gezeichneter Unterschriften, geteilt zwischen grosser Vorschau und
 * Kacheln. Der Cache ist modulweit und sitzungsgebunden: dieselbe Unterschrift
 * wird nur einmal aus IndexedDB gelesen und nie doppelt als URL gehalten.
 */
const cache = new Map<string, Promise<string>>();

export function getSignatureUrl(blobKey: string, read: (key: string) => Promise<Blob>): Promise<string> {
  const existing = cache.get(blobKey);
  if (existing) return existing;
  const promise = read(blobKey)
    .then((blob) => URL.createObjectURL(blob))
    .catch((error) => {
      cache.delete(blobKey); // Fehlschlag nicht dauerhaft merken.
      throw error;
    });
  cache.set(blobKey, promise);
  return promise;
}

export function useSignatureUrl(blobKey: string): string | undefined {
  const { annotationBlobStore } = useServices();
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    getSignatureUrl(blobKey, (key) => annotationBlobStore.read(key))
      .then((next) => {
        if (active) setUrl(next);
      })
      .catch((error) => console.warn('Unterschrift-Bild nicht ladbar', error));
    return () => {
      active = false;
    };
  }, [annotationBlobStore, blobKey]);
  return url;
}
