// Kopiert die Laufzeit-Assets von tesseract.js nach public/tesseract, damit sie
// mit dem Bundle ausgeliefert werden. Local-first: OCR darf zur Laufzeit kein
// CDN kontaktieren -- Worker, Core-WASM und Sprachdaten muessen lokal liegen.
import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const tesseractRoot = dirname(require.resolve('tesseract.js/package.json'));
const tesseractCoreRoot = dirname(require.resolve('tesseract.js-core/package.json'));
const target = join(process.cwd(), 'public', 'tesseract');

await mkdir(target, { recursive: true });

await cp(join(tesseractRoot, 'dist', 'worker.min.js'), join(target, 'worker.min.js'));
await cp(tesseractCoreRoot, join(target, 'core'), { recursive: true });

const langDir = join(target, 'lang');
await mkdir(langDir, { recursive: true });

// tessdata_fast liefert die Sprachdaten unkomprimiert unter raw.githubusercontent
// aus (kein `.gz` im Repo selbst); tesseract.js erwartet aber standardmaessig
// `gzip: true` und laedt `<lang>.traineddata.gz`. Deshalb wird hier lokal
// nachkomprimiert -- der Download bleibt auf tessdata_fast beschraenkt, es wird
// kein anderes CDN kontaktiert.
const langs = ['eng', 'deu'];
for (const lang of langs) {
  const file = join(langDir, `${lang}.traineddata.gz`);
  if (await exists(file)) continue;
  const url = `https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/${lang}.traineddata`;
  let response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new Error(
      `Sprachdatei ${lang}.traineddata konnte nicht von ${url} geladen werden: ${String(cause)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `Sprachdatei ${lang}.traineddata konnte nicht von ${url} geladen werden: HTTP ${response.status}.`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(file, gzipSync(bytes));
  console.log(`Sprachdatei ${lang}.traineddata.gz heruntergeladen und komprimiert.`);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

console.log(`tesseract.js-Assets nach ${target} kopiert`);
