import { describe, expect, it } from 'vitest';
import { newId } from './ids';

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe('newId', () => {
  it('erzeugt 26 Zeichen aus dem Crockford-Base32-Alphabet', () => {
    expect(newId()).toMatch(ULID_PATTERN);
  });

  it('ist bei 10000 Aufrufen kollisionsfrei', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i++) ids.add(newId());
    expect(ids.size).toBe(10_000);
  });

  it('sortiert lexikografisch nach Entstehungszeit', () => {
    const earlier = newId(1_700_000_000_000);
    const later = newId(1_700_000_000_001);
    expect(earlier < later).toBe(true);
  });

  it('kodiert dieselbe Zeit in denselben ersten zehn Zeichen', () => {
    const a = newId(1_700_000_000_000);
    const b = newId(1_700_000_000_000);
    expect(a.slice(0, 10)).toBe(b.slice(0, 10));
    expect(a).not.toBe(b);
  });
});
