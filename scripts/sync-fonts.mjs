// Laedt das kuratierte Font-Set als statische TTF-Dateien nach public/fonts.
// Dieselbe Datei dient zweimal: als @font-face fuer die Live-Vorschau UND als
// Einbett-Quelle fuer pdf-lib beim Export -- so sieht der Export exakt aus wie
// die Vorschau. Quelle sind die @expo-google-fonts-Pakete (statische TTFs, OFL/
// Apache), ueber jsDelivr gespiegelt. Ein Font ohne Netz faellt einfach weg;
// der Katalog markiert nur die tatsaechlich vorhandenen Dateien als verfuegbar.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const CDN = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts';

// family: der fontId und CSS-Familienname; pkg: das expo-Paket; styles: die zu
// ladenden Schnitte mit expo-Dateibasis. `regular` ist Pflicht, `bold` optional.
const FONTS = [
  { id: 'roboto', label: 'Roboto', category: 'sans', pkg: 'roboto', regular: 'Roboto_400Regular', bold: 'Roboto_700Bold' },
  { id: 'open-sans', label: 'Open Sans', category: 'sans', pkg: 'open-sans', regular: 'OpenSans_400Regular', bold: 'OpenSans_700Bold' },
  { id: 'lato', label: 'Lato', category: 'sans', pkg: 'lato', regular: 'Lato_400Regular', bold: 'Lato_700Bold' },
  { id: 'montserrat', label: 'Montserrat', category: 'sans', pkg: 'montserrat', regular: 'Montserrat_400Regular', bold: 'Montserrat_700Bold' },
  { id: 'merriweather', label: 'Merriweather', category: 'serif', pkg: 'merriweather', regular: 'Merriweather_400Regular', bold: 'Merriweather_700Bold' },
  { id: 'lora', label: 'Lora', category: 'serif', pkg: 'lora', regular: 'Lora_400Regular', bold: 'Lora_700Bold' },
  { id: 'playfair-display', label: 'Playfair Display', category: 'serif', pkg: 'playfair-display', regular: 'PlayfairDisplay_400Regular', bold: 'PlayfairDisplay_700Bold' },
  { id: 'eb-garamond', label: 'EB Garamond', category: 'serif', pkg: 'eb-garamond', regular: 'EBGaramond_400Regular', bold: 'EBGaramond_700Bold' },
  { id: 'roboto-mono', label: 'Roboto Mono', category: 'mono', pkg: 'roboto-mono', regular: 'RobotoMono_400Regular', bold: 'RobotoMono_700Bold' },
  { id: 'caveat', label: 'Caveat', category: 'handwriting', pkg: 'caveat', regular: 'Caveat_400Regular', bold: 'Caveat_700Bold' },
  { id: 'dancing-script', label: 'Dancing Script', category: 'handwriting', pkg: 'dancing-script', regular: 'DancingScript_400Regular', bold: 'DancingScript_700Bold' },
  { id: 'pacifico', label: 'Pacifico', category: 'handwriting', pkg: 'pacifico', regular: 'Pacifico_400Regular' },
];

const target = join(process.cwd(), 'public', 'fonts');
await mkdir(target, { recursive: true });

async function fetchFont(pkg, base) {
  const fileName = `${base}.ttf`;
  const out = join(target, fileName);
  // Bereits vorhandene Dateien nicht erneut laden -- der Sync ist idempotent.
  if (existsSync(out)) return { fileName, bytes: (await readFile(out)).length };
  const url = `${CDN}/${pkg}/${fileName}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  await writeFile(out, bytes);
  return { fileName, bytes: bytes.length };
}

const manifest = [];
for (const font of FONTS) {
  const regular = await fetchFont(font.pkg, font.regular);
  if (!regular) {
    console.warn(`  uebersprungen (kein Regular): ${font.label}`);
    continue;
  }
  const entry = { id: font.id, label: font.label, category: font.category, regular: regular.fileName };
  if (font.bold) {
    const bold = await fetchFont(font.pkg, font.bold);
    if (bold) entry.bold = bold.fileName;
  }
  manifest.push(entry);
  console.log(`  ${font.label}${entry.bold ? ' (+ Bold)' : ''}`);
}

await writeFile(join(target, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`${manifest.length} Schriften nach ${target} synchronisiert`);
