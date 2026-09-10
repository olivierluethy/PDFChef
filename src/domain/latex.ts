// Minimaler LaTeX-Textexport: reiner Fliesstext, keine Layout- oder
// Formelrekonstruktion. Bewusst einfach gehalten, damit das erzeugte
// Dokument mit jeder Standard-LaTeX-Installation kompiliert.

const SPECIAL_CHARS = /[\\{}$&#_%~^]/g;

/**
 * Ersetzt LaTeX-Sonderzeichen durch ihre escapte Form. Arbeitet in einem
 * einzigen Durchlauf ueber den Originaltext, damit von der Ersetzung selbst
 * eingefuegte Backslashes nicht erneut escaped werden.
 */
export function escapeLatex(text: string): string {
  return text.replace(SPECIAL_CHARS, (char) => {
    switch (char) {
      case '\\':
        return '\\textbackslash{}';
      case '{':
        return '\\{';
      case '}':
        return '\\}';
      case '$':
        return '\\$';
      case '&':
        return '\\&';
      case '#':
        return '\\#';
      case '_':
        return '\\_';
      case '%':
        return '\\%';
      case '~':
        return '\\textasciitilde{}';
      case '^':
        return '\\textasciicircum{}';
      default:
        return char;
    }
  });
}

/**
 * Baut ein minimales LaTeX-Artikel-Dokument aus dem Titel und dem Text je
 * Seite. Leerzeilen innerhalb einer Seite bleiben erhalten und wirken in
 * LaTeX als Absatztrenner. Seiten werden per `\newpage` getrennt.
 */
export function buildLatexDocument(title: string, pages: string[]): string {
  const body = pages.map((page) => escapeLatex(page).trim()).join('\n\n\\newpage\n\n');

  return [
    '\\documentclass{article}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage[T1]{fontenc}',
    `\\title{${escapeLatex(title)}}`,
    '\\begin{document}',
    '\\maketitle',
    '',
    body,
    '',
    '\\end{document}',
    '',
  ].join('\n');
}
