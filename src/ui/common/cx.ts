/** Winziger Klassennamen-Helfer: filtert falsy-Werte, verbindet mit Leerzeichen. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
