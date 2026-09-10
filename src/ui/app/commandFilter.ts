export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  run(): void;
}

/** Prueft, ob `query` als Teilfolge (in Reihenfolge, nicht zwingend zusammenhaengend) in `label` vorkommt. */
function isSubsequence(query: string, label: string): boolean {
  let queryIndex = 0;
  for (let labelIndex = 0; labelIndex < label.length && queryIndex < query.length; labelIndex++) {
    if (label[labelIndex] === query[queryIndex]) queryIndex++;
  }
  return queryIndex === query.length;
}

/** Filtert Aktionen per case-insensitiver Teilfolgen-Suche auf `label`; leere Anfrage liefert alle. */
export function filterActions(actions: PaletteAction[], query: string): PaletteAction[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '') return actions;
  return actions.filter((action) => isSubsequence(trimmed, action.label.toLowerCase()));
}
