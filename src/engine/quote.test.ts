import { describe, expect, it } from 'vitest';
import { quotaAlmeno, quotaCanonica, quotaPositiva, quotaSu, quotaValida, quoteAzzerate, quoteTotalizzano, sommaQuote } from './quote';

describe('quote', () => {
  it('accetta solo frazioni tra 0 e 1', () => {
    expect(quotaValida(0)).toBe(true);
    expect(quotaValida(1)).toBe(true);
    expect(quotaValida(1.5)).toBe(false);
    expect(quotaValida(-0.1)).toBe(false);
    expect(quotaValida(Number.NaN)).toBe(false);
  });
  it('riconosce il totale 100 % nonostante gli errori binari', () => {
    expect(quoteTotalizzano(sommaQuote([0.1, 0.2, 0.7]))).toBe(true);
  });
  it('rifiuta un totale diverso da 100 %', () => {
    expect(quoteTotalizzano(0.9)).toBe(false);
  });
  it('riconosce il totale zero', () => {
    expect(quoteAzzerate(0)).toBe(true);
    expect(quoteAzzerate(0.01)).toBe(false);
  });
  it('confronta con tolleranza', () => {
    expect(quotaAlmeno(0.1 + 0.2, 0.3)).toBe(true);
    expect(quotaAlmeno(0.29, 0.3)).toBe(false);
  });
  it('considera positiva solo una quota oltre la tolleranza', () => {
    expect(quotaPositiva(0.01)).toBe(true);
    expect(quotaPositiva(0)).toBe(false);
  });
  it('produce una chiave canonica stabile', () => {
    expect(quotaCanonica(0.1 + 0.2)).toBe(0.3);
  });
  it('legge zero per una prestazione assente dalle quote', () => {
    expect(quotaSu({ 'p-1': 0.5 }, 'p-2')).toBe(0);
  });
});
