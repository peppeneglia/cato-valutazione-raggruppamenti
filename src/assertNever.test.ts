import { describe, expect, it } from 'vitest';
import { assertNever } from './assertNever';

describe('assertNever', () => {
  it('lancia con il valore non gestito nel messaggio', () => {
    const valore = { tipo: 'sconosciuto' } as never;
    expect(() => assertNever(valore)).toThrow('"tipo":"sconosciuto"');
  });
});
