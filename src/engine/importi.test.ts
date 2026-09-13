import { describe, expect, it } from 'vitest';
import { frazioneDi, inCentesimi, inEuro } from './importi';

describe('importi in centesimi', () => {
  it('converte gli euro in centesimi interi', () => {
    expect(inCentesimi(1234.56)).toBe(123456);
  });
  it('arrotonda al centesimo gli importi con più decimali', () => {
    expect(inCentesimi(0.1 + 0.2)).toBe(30);
  });
  it('torna in euro senza residui binari sulle somme', () => {
    expect(inEuro(inCentesimi(0.1) + inCentesimi(0.2))).toBe(0.3);
  });
  it('calcola la frazione di un importo arrotondando al centesimo', () => {
    expect(frazioneDi(300_000_000, 0.4)).toBe(120_000_000);
    expect(frazioneDi(1001, 0.5)).toBe(501);
  });
});
