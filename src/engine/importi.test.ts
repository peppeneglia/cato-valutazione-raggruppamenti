import { describe, expect, it } from 'vitest';
import { inCentesimi, inEuro } from './importi';

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
});
