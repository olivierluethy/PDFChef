// ULID: 48 Bit Zeit (10 Zeichen) + 80 Bit Zufall (16 Zeichen) in Crockford-Base32.
// Lexikografische Sortierung entspricht der Entstehungsreihenfolge, was Debugging und
// stabile Reihenfolgen in Tests erleichtert.
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

function encodeTime(time: number): string {
  let rest = Math.floor(time);
  let out = '';
  for (let i = 0; i < TIME_LENGTH; i++) {
    const digit = rest % 32;
    out = ENCODING.charAt(digit) + out;
    rest = (rest - digit) / 32;
  }
  return out;
}

function encodeRandom(): string {
  const bytes = new Uint8Array(RANDOM_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  // 256 ist ohne Rest durch 32 teilbar, der Modulo bleibt gleichverteilt.
  for (let i = 0; i < RANDOM_LENGTH; i++) out += ENCODING.charAt(bytes[i] % 32);
  return out;
}

export function newId(time: number = Date.now()): string {
  return encodeTime(time) + encodeRandom();
}
