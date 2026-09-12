export type Locale = 'en' | 'de';

/**
 * A per-area slice of the message catalog. `en` is authored as the source of
 * truth; `de` mirrors the same keys. Keys are dot-namespaced (e.g. `header.import`).
 */
export interface MessageFragment {
  en: Record<string, string>;
  de: Record<string, string>;
}
