import { describe, expect, it } from 'vitest';
import type { EsitoRequisito } from '../domain';
import { legendaAssunzioni, siglaAssunzione } from './legenda';

function requisito(id: string, assunzioni: EsitoRequisito['assunzioni']): EsitoRequisito {
  return { requisitoId: id, stato: 'coperto', contributi: [], motivazione: '', assunzioni, indeterminatezze: [], rimedi: [] };
}

describe('legendaAssunzioni', () => {
  it('numera i codici nell’ordine di prima comparsa e raccoglie i testi distinti', () => {
    const legenda = legendaAssunzioni([
      requisito('a', [{ codice: 'classe_cpv', testo: 'uno' }]),
      requisito('b', [{ codice: 'arrotondamento_minimi', testo: 'due' }, { codice: 'classe_cpv', testo: 'uno' }]),
      requisito('c', [{ codice: 'classe_cpv', testo: 'tre' }]),
    ]);
    expect(legenda).toEqual([
      { codice: 'classe_cpv', numero: 1, testi: ['uno', 'tre'] },
      { codice: 'arrotondamento_minimi', numero: 2, testi: ['due'] },
    ]);
  });
  it('è vuota senza assunzioni', () => {
    expect(legendaAssunzioni([requisito('a', [])])).toEqual([]);
  });
  it('la sigla è A più il numero', () => {
    expect(siglaAssunzione(2)).toBe('A2');
  });
});
