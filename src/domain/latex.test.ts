import { describe, expect, it } from 'vitest';

import { buildLatexDocument, escapeLatex, htmlToLatex } from './latex';

describe('escapeLatex', () => {
  it('escaped LaTeX-Sonderzeichen in einem Durchlauf', () => {
    expect(escapeLatex('50% & #1 _x_ {y} $z$')).toBe(
      '50\\% \\& \\#1 \\_x\\_ \\{y\\} \\$z\\$',
    );
  });
});

describe('htmlToLatex', () => {
  it('bildet Ueberschriften auf section/subsection/subsubsection ab', () => {
    const tex = htmlToLatex('<h1>Titel</h1><h2>Kapitel</h2><h3>Unterkapitel</h3>');
    expect(tex).toContain('\\section{Titel}');
    expect(tex).toContain('\\subsection{Kapitel}');
    expect(tex).toContain('\\subsubsection{Unterkapitel}');
  });

  it('gibt Absaetze als eigenstaendige, escapte Bloecke aus', () => {
    const tex = htmlToLatex('<p>Erster Absatz</p><p>50% sicher</p>');
    expect(tex).toBe('Erster Absatz\n\n50\\% sicher');
  });

  it('uebersetzt fett und kursiv', () => {
    expect(htmlToLatex('<p>Ein <strong>fetter</strong> und <em>kursiver</em> Text</p>')).toBe(
      'Ein \\textbf{fetter} und \\emph{kursiver} Text',
    );
  });

  it('erzeugt eine itemize-Umgebung aus einer ungeordneten Liste', () => {
    const tex = htmlToLatex('<ul><li>Alpha</li><li>Beta</li></ul>');
    expect(tex).toBe('\\begin{itemize}\n  \\item Alpha\n  \\item Beta\n\\end{itemize}');
  });

  it('erzeugt eine enumerate-Umgebung aus einer geordneten Liste', () => {
    const tex = htmlToLatex('<ol><li>Eins</li><li>Zwei</li></ol>');
    expect(tex).toContain('\\begin{enumerate}');
    expect(tex).toContain('\\item Eins');
    expect(tex).toContain('\\end{enumerate}');
  });

  it('dekodiert HTML-Entities und escaped danach fuer LaTeX', () => {
    expect(htmlToLatex('<p>A &amp; B &lt; C</p>')).toBe('A \\& B < C');
  });

  it('behandelt Inline-Formatierung innerhalb von Listeneintraegen', () => {
    const tex = htmlToLatex('<ul><li><strong>Wichtig</strong>: dazu mehr</li></ul>');
    expect(tex).toContain('\\item \\textbf{Wichtig}: dazu mehr');
  });

  it('gibt fuer leere oder rein strukturlose Eingabe einen leeren String zurueck', () => {
    expect(htmlToLatex('')).toBe('');
    expect(htmlToLatex('   ')).toBe('');
  });
});

describe('buildLatexDocument', () => {
  it('baut aus Seiten ein Artikel-Dokument mit newpage-Trennung', () => {
    const tex = buildLatexDocument('Bericht', ['Seite eins', 'Seite zwei']);
    expect(tex).toContain('\\documentclass{article}');
    expect(tex).toContain('\\title{Bericht}');
    expect(tex).toContain('Seite eins\n\n\\newpage\n\nSeite zwei');
  });

  it('nutzt einen vorgefertigten strukturierten Body statt der Seiten', () => {
    const body = '\\section{X}\n\nText';
    const tex = buildLatexDocument('Doc', [], body);
    expect(tex).toContain(body);
    expect(tex).not.toContain('\\newpage');
  });
});
