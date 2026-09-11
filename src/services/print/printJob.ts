/**
 * Druckt PDF-Bytes ueber den nativen Druckdialog des Browsers -- ohne Umweg ueber
 * einen Download. Wie das geht, haengt vom Browser ab:
 *
 * - Chromium/Edge koennen aus einem versteckten <iframe> heraus zuverlaessig den
 *   Druckdialog oeffnen (`contentWindow.print()`). Der Dialog springt sofort auf,
 *   nichts landet auf der Platte.
 * - In Firefox/Safari ist genau dieser Auto-Druck aus dem iframe unzuverlaessig.
 *   Dort oeffnen wir das PDF stattdessen in einem neuen Tab; der eingebaute
 *   PDF-Viewer uebernimmt das Drucken (Cmd/Ctrl+P).
 *
 * Das spiegelt die Linie des Ordner-Exports: Chromium zuerst, ueberall sonst ein
 * sauberer Fallback -- kein Feature verschwindet stillschweigend.
 */

export type PrintOutcome = 'dialog' | 'tab';

/** Wie lange das versteckte iframe im DOM bleibt, bevor es aufgeraeumt wird. */
const CLEANUP_DELAY_MS = 60_000;

interface Navigatorish {
  userAgentData?: { brands?: Array<{ brand: string }> };
  userAgent?: string;
}

/**
 * Kann dieser Browser den Druckdialog direkt aus einem iframe oeffnen? True fuer
 * Chromium-basierte Browser (Chrome, Edge, Opera, Brave ...).
 */
export function canAutoPrint(nav: Navigatorish = navigator): boolean {
  const brands = nav.userAgentData?.brands;
  if (brands && brands.length > 0) {
    return brands.some((b) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand));
  }
  const ua = nav.userAgent ?? '';
  // Kein UA-Client-Hints: grob ueber den User-Agent. "Chrome/" deckt Chromium
  // ab; Firefox und reines Safari fallen bewusst auf den Tab-Weg zurueck.
  return /Chrome\//.test(ua) && !/Firefox\//.test(ua);
}

function printViaIframe(url: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.src = url;

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    URL.revokeObjectURL(url);
    iframe.remove();
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }
    // Kleiner Aufschub: manche Chromium-Versionen brauchen einen Tick, bis der
    // PDF-Viewer im iframe bereit ist.
    window.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        // Wenn der Auto-Druck doch scheitert, bleibt der Nutzer nicht ohne PDF:
        // in einem neuen Tab oeffnen.
        window.open(url, '_blank', 'noopener');
      }
    }, 250);
  };

  document.body.append(iframe);
  // Aufraeumen nach grosszuegiger Frist -- wir koennen den Dialog-Abschluss nicht
  // browseruebergreifend zuverlaessig abwarten.
  window.setTimeout(cleanup, CLEANUP_DELAY_MS);
}

/**
 * Baut aus den PDF-Bytes ein druckbares Dokument und loest den Druck aus.
 * Gibt zurueck, ob der Druckdialog direkt geoeffnet wurde (`dialog`) oder das PDF
 * in einem neuen Tab landet (`tab`).
 */
export function printPdf(bytes: Uint8Array, fileName: string): PrintOutcome {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  if (canAutoPrint()) {
    printViaIframe(url);
    return 'dialog';
  }

  // Fallback: neuer Tab mit dem eingebauten PDF-Viewer. Der Dateiname hilft dem
  // Nutzer beim Wiedererkennen im Tab-Titel (soweit der Browser ihn zeigt).
  const win = window.open(url, '_blank', 'noopener');
  if (win) win.name = fileName;
  // Der Tab besitzt das Blob jetzt; erst spaeter freigeben.
  window.setTimeout(() => URL.revokeObjectURL(url), CLEANUP_DELAY_MS);
  return 'tab';
}
