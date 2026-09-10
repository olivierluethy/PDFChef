// Kopiert die Laufzeit-Assets von pdf.js nach public/pdfjs, damit sie mit dem
// Bundle ausgeliefert werden. Ohne cMaps und Standardschriften zeigen manche
// PDFs falsche oder keine Glyphen -- und ein CDN-Fallback ist ausgeschlossen.
import { cp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'));
const target = join(process.cwd(), 'public', 'pdfjs');

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

for (const entry of ['cmaps', 'standard_fonts']) {
  await cp(join(pdfjsRoot, entry), join(target, entry), { recursive: true });
}
await cp(
  join(pdfjsRoot, 'build', 'pdf.worker.min.mjs'),
  join(target, 'pdf.worker.min.mjs'),
);

console.log(`pdf.js-Assets nach ${target} kopiert`);
