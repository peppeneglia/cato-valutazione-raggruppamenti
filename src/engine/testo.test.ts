import { describe, expect, it } from 'vitest';
import { coincidono, normalizza } from './testo';

describe('confronto tra stringhe', () => {
  it('ignora spazi ai bordi, spazi interni multipli e maiuscole', () => {
    expect(coincidono('  ISO  9001 ', 'iso 9001')).toBe(true);
  });
  it('non va oltre: parole diverse restano diverse', () => {
    expect(coincidono('assistenza tecnica', 'assistenza tecnica elettromedicale')).toBe(false);
  });
  it('normalizza in modo idempotente', () => {
    expect(normalizza(normalizza('  A   b '))).toBe('a b');
  });
});
