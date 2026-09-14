// Playwright-Verifikation der Overlay-Bugfixes gegen die Harness-Seite.
// Startet KEINEN Server -- erwartet Vite unter BASE (Default localhost:5173).
// Nutzt die reine `playwright`-Bibliothek (kein Test-Runner).
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:5173';
const URL = `${BASE}/e2e/harness.html`;

let failures = 0;
function check(name, ok, detail = '') {
  const tag = ok ? 'PASS' : 'FAIL';
  if (!ok) failures++;
  console.log(`  [${tag}] ${name}${detail ? ` -- ${detail}` : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1000, height: 900 } });
// Sprache auf Deutsch fixieren, damit die Label-Assertions stabil sind.
await context.addInitScript(() => {
  try {
    localStorage.setItem('pdfchef.locale', 'de');
  } catch {
    /* ignore */
  }
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });

// Auf das gerenderte Blatt + die Form warten.
await page.waitForSelector('[data-testid="page"]');
await page.waitForSelector('[data-overlay-wrap]');
await page.waitForTimeout(600); // ResizeObserver/Fonts

const box = await page.locator('[data-testid="page"]').boundingBox();
const pt = (fx, fy) => ({ x: Math.round(box.x + fx * 600), y: Math.round(box.y + fy * 800) });
const A_ONLY = pt(0.2, 0.35);
const OVERLAP = pt(0.45, 0.42);

// Zaehlt SICHTBAR gerenderte Textknoten auf dem Blatt (Nicht-Textarea-Blaetter).
// Wichtig: eine <textarea defaultValue="Original"> hat "Original" als DOM-Text-
// inhalt -- den zaehlen wir hier bewusst NICHT, sonst verwechselt man den
// Editier-Wert mit dem (versteckten) OverlayShape-Geisttext.
function leafText(txt) {
  return page.evaluate((t) => {
    return [...document.querySelectorAll('[data-testid="page"] *')].filter(
      (el) => el.tagName !== 'TEXTAREA' && el.children.length === 0 && (el.textContent || '').trim() === t,
    ).length;
  }, txt);
}

// Welche Form liegt am Ueberlappungspunkt oben? (A traegt den Text "Original".)
async function topAtOverlap() {
  return page.evaluate(
    ([x, y]) => {
      const el = document.elementFromPoint(x, y);
      const wrap = el?.closest('[data-overlay-wrap]');
      if (!wrap) return 'none';
      return wrap.textContent?.includes('Original') ? 'A' : 'B';
    },
    [OVERLAP.x, OVERLAP.y],
  );
}

// Text des Ebenen-Badges des Elements, dessen linke Kante bei ~fx (%) liegt.
async function badgeAtLeft(fxPercent) {
  return page.evaluate((target) => {
    const spans = [...document.querySelectorAll('[title^="Ebene "]')];
    let best = null;
    for (const s of spans) {
      const left = parseFloat(s.style.left);
      if (best === null || Math.abs(left - target) < Math.abs(parseFloat(best.style.left) - target))
        best = s;
    }
    return best ? best.textContent.trim() : null;
  }, fxPercent);
}

console.log('\nBug 1+2 — Ebenen-Reihenfolge & Positionsanzeige:');
await page.mouse.click(A_ONLY.x, A_ONLY.y); // A auswaehlen
await page.waitForTimeout(150);
check('Panel zeigt "Ebene 1 von 2"', (await page.getByText('Ebene 1 von 2').count()) === 1);
const topBefore = await topAtOverlap();
check('Vor dem Umsortieren liegt B oben (A dahinter)', topBefore === 'B', `oben=${topBefore}`);
check('Zwei Ebenen-Badges auf den Elementen', (await page.locator('[title^="Ebene "]').count()) === 2);
const aBadgeBefore = await badgeAtLeft(15);
check('Badge von A zeigt "1" (hinten)', aBadgeBefore === '1', `badge=${aBadgeBefore}`);
await page.screenshot({ path: 'e2e/shot-01-selected.png' });

await page.getByRole('button', { name: 'In den Vordergrund' }).click();
await page.waitForTimeout(150);
check('Panel zeigt jetzt "Ebene 2 von 2"', (await page.getByText('Ebene 2 von 2').count()) === 1);
const topAfter = await topAtOverlap();
check('Nach "In den Vordergrund" liegt A oben', topAfter === 'A', `oben=${topAfter}`);
const aBadgeAfter = await badgeAtLeft(15);
check('Badge von A springt live auf "2" (vorne)', aBadgeAfter === '2', `badge=${aBadgeAfter}`);
await page.screenshot({ path: 'e2e/shot-02-front.png' });

console.log('\nBug 3 — Text in Form bearbeiten (kein Geist/Duplikat):');
await page.mouse.dblclick(A_ONLY.x, A_ONLY.y); // Text von A bearbeiten
await page.waitForTimeout(150);
const activeTag = await page.evaluate(() => document.activeElement?.tagName);
check('Textarea ist fokussiert', activeTag === 'TEXTAREA', `active=${activeTag}`);
const val = await page.locator('textarea').inputValue();
check('Textarea enthaelt "Original"', val === 'Original', `value=${val}`);
const ghostDuringEdit = await leafText('Original');
check('Kein sichtbarer Geist-Text hinter der Bearbeitung', ghostDuringEdit === 0, `sichtbar=${ghostDuringEdit}`);
await page.screenshot({ path: 'e2e/shot-03-editing.png' });

await page.locator('textarea').fill('Neu');
await page.waitForTimeout(100);
const ghostAfterType = await leafText('Original');
check('Nach Ueberschreiben kein alter Text sichtbar', ghostAfterType === 0, `sichtbar=${ghostAfterType}`);

// Ausserhalb der Textarea klicken (Panel-Titel), damit sie den Fokus verliert.
await page.getByText('Eigenschaften').click();
await page.waitForTimeout(150);
const shownNew = await leafText('Neu');
check('Nach dem Verlassen wird der neue Text angezeigt', shownNew === 1, `sichtbar=${shownNew}`);
const originalGone = await leafText('Original');
check('Der urspruengliche Text ist verschwunden', originalGone === 0, `sichtbar=${originalGone}`);
await page.screenshot({ path: 'e2e/shot-04-committed.png' });

await browser.close();
console.log(`\n${failures === 0 ? 'ALLE CHECKS BESTANDEN' : `${failures} CHECK(S) FEHLGESCHLAGEN`}`);
process.exit(failures === 0 ? 0 : 1);
