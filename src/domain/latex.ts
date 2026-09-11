// LaTeX-Textexport. Zwei Wege: reiner Fliesstext (aus paginierten Seiten, z. B.
// fuer PDF/Plaintext) und -- fuer DOCX -- eine strukturierte Rekonstruktion aus
// HTML (Ueberschriften, Listen, Fett/Kursiv). Bewusst ohne Formel- oder
// Layout-Rekonstruktion, damit das Ergebnis mit jeder Standard-LaTeX-
// Installation kompiliert. Rein und framework-frei (kein DOMParser) -- der
// HTML-Tokenizer laeuft im domain-Layer und ist per Vitest getestet.

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

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp);/g, (entity) => HTML_ENTITIES[entity] ?? entity);
}

/** Fasst Whitespace (inkl. Zeilenumbrueche aus dem HTML) zu einem Leerzeichen zusammen. */
function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ');
}

type HtmlToken =
  | { kind: 'text'; value: string }
  | { kind: 'open'; tag: string }
  | { kind: 'close'; tag: string }
  | { kind: 'void'; tag: string };

const VOID_TAGS = new Set(['br', 'img', 'hr']);

/** Zerlegt HTML grob in Text- und Tag-Token. Bewusst tolerant und ohne DOM. */
function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  const pattern = /<([^>]+)>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: 'text', value: html.slice(lastIndex, match.index) });
    }
    const raw = match[1].trim();
    const nameMatch = /^\/?\s*([a-zA-Z0-9]+)/.exec(raw);
    if (nameMatch) {
      const tag = nameMatch[1].toLowerCase();
      if (raw.startsWith('/')) {
        tokens.push({ kind: 'close', tag });
      } else if (raw.endsWith('/') || VOID_TAGS.has(tag)) {
        tokens.push({ kind: 'void', tag });
      } else {
        tokens.push({ kind: 'open', tag });
      }
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < html.length) {
    tokens.push({ kind: 'text', value: html.slice(lastIndex) });
  }
  return tokens;
}

const HEADING_COMMANDS: Record<string, string> = {
  h1: 'section',
  h2: 'subsection',
  h3: 'subsubsection',
  h4: 'paragraph',
  h5: 'paragraph',
  h6: 'paragraph',
};

/**
 * Uebersetzt (mammoth-)HTML in strukturiertes LaTeX. Unterstuetzt Ueberschriften
 * (`h1..h3` -> `section`/`subsection`/`subsubsection`), Absaetze, geordnete und
 * ungeordnete Listen (`itemize`/`enumerate`) sowie `strong`/`em`
 * (-> `\textbf`/`\emph`). Unbekannte Tags werden transparent durchgereicht,
 * ihr Textinhalt bleibt erhalten. Textinhalte werden entity-dekodiert und danach
 * fuer LaTeX escaped. Liefert einen Body-String (ohne Praeambel).
 */
export function htmlToLatex(html: string): string {
  const tokens = tokenizeHtml(html);
  let pos = 0;

  function consumeClose(): void {
    if (pos < tokens.length && tokens[pos].kind === 'close') pos++;
  }

  // Rendert Inline-Inhalt bis zum naechsten schliessenden Tag (dieser wird
  // NICHT konsumiert -- der Aufrufer entscheidet). Verschachtelte Inline-Tags
  // (strong/em/...) werden rekursiv aufgeloest.
  function renderInline(): string {
    let out = '';
    while (pos < tokens.length) {
      const token = tokens[pos];
      if (token.kind === 'close') break;
      pos++;
      if (token.kind === 'text') {
        out += escapeLatex(collapseWhitespace(decodeHtmlEntities(token.value)));
      } else if (token.kind === 'void') {
        if (token.tag === 'br') out += ' \\\\ ';
      } else {
        const inner = renderInline();
        consumeClose();
        if (token.tag === 'strong' || token.tag === 'b') out += `\\textbf{${inner}}`;
        else if (token.tag === 'em' || token.tag === 'i') out += `\\emph{${inner}}`;
        else out += inner;
      }
    }
    return out;
  }

  function renderList(env: 'itemize' | 'enumerate'): string {
    const items: string[] = [];
    while (pos < tokens.length) {
      const token = tokens[pos];
      if (token.kind === 'close') break;
      pos++;
      if (token.kind === 'open' && token.tag === 'li') {
        items.push(`  \\item ${renderItem()}`);
      }
      // Whitespace-Text und unerwartete Tags zwischen den Eintraegen ignorieren.
    }
    return `\\begin{${env}}\n${items.join('\n')}\n\\end{${env}}`;
  }

  function renderItem(): string {
    let out = '';
    while (pos < tokens.length) {
      const token = tokens[pos];
      if (token.kind === 'close') {
        pos++;
        if (token.tag === 'li') break;
        continue;
      }
      pos++;
      if (token.kind === 'text') {
        out += escapeLatex(collapseWhitespace(decodeHtmlEntities(token.value)));
      } else if (token.kind === 'void') {
        if (token.tag === 'br') out += ' \\\\ ';
      } else if (token.tag === 'ul') {
        out += `\n${renderList('itemize')}`;
        consumeClose();
      } else if (token.tag === 'ol') {
        out += `\n${renderList('enumerate')}`;
        consumeClose();
      } else if (token.tag === 'strong' || token.tag === 'b') {
        const inner = renderInline();
        consumeClose();
        out += `\\textbf{${inner}}`;
      } else if (token.tag === 'em' || token.tag === 'i') {
        const inner = renderInline();
        consumeClose();
        out += `\\emph{${inner}}`;
      } else {
        const inner = renderInline();
        consumeClose();
        out += inner;
      }
    }
    return out.trim();
  }

  const blocks: string[] = [];
  while (pos < tokens.length) {
    const token = tokens[pos];
    if (token.kind === 'text') {
      pos++;
      const text = escapeLatex(collapseWhitespace(decodeHtmlEntities(token.value))).trim();
      if (text) blocks.push(text);
      continue;
    }
    if (token.kind === 'void' || token.kind === 'close') {
      pos++;
      continue;
    }
    pos++;
    const heading = HEADING_COMMANDS[token.tag];
    if (heading) {
      blocks.push(`\\${heading}{${renderInline()}}`);
      consumeClose();
    } else if (token.tag === 'p') {
      const text = renderInline().trim();
      consumeClose();
      if (text) blocks.push(text);
    } else if (token.tag === 'ul') {
      blocks.push(renderList('itemize'));
      consumeClose();
    } else if (token.tag === 'ol') {
      blocks.push(renderList('enumerate'));
      consumeClose();
    } else {
      // Unbekannter Block (div, table, ...): Inhalt als Text uebernehmen.
      const text = renderInline().trim();
      consumeClose();
      if (text) blocks.push(text);
    }
  }

  return blocks.join('\n\n');
}

/**
 * Baut ein minimales LaTeX-Artikel-Dokument. Ohne `structuredBody` entsteht der
 * Body aus dem Text je Seite (Leerzeilen bleiben als Absatztrenner erhalten,
 * Seiten werden per `\newpage` getrennt). Mit `structuredBody` (bereits fertiges
 * LaTeX, z. B. aus `htmlToLatex`) wird dieser unveraendert als Body verwendet --
 * so bleibt der Seiten-Weg rueckwaertskompatibel.
 */
export function buildLatexDocument(title: string, pages: string[], structuredBody?: string): string {
  const body = structuredBody ?? pages.map((page) => escapeLatex(page).trim()).join('\n\n\\newpage\n\n');

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
