import { describe, expect, it } from 'vitest';
import {
  aggiungiGiorni,
  annoDi,
  confrontaDate,
  dataValida,
  entroFinestra,
  siSovrappongono,
  sottraiAnni,
} from './date';

describe('dataValida', () => {
  it('accetta una data ISO esistente', () => {
    expect(dataValida('2026-02-28')).toBe(true);
  });
  it('rifiuta il formato non ISO', () => {
    expect(dataValida('14/09/2026')).toBe(false);
  });
  it('rifiuta una data che non esiste nel calendario', () => {
    expect(dataValida('2026-02-30')).toBe(false);
  });
  it('accetta il 29 febbraio di un anno bisestile', () => {
    expect(dataValida('2028-02-29')).toBe(true);
  });
  it('rifiuta il 29 febbraio di un anno non bisestile', () => {
    expect(dataValida('2027-02-29')).toBe(false);
  });
});

describe('confrontaDate', () => {
  it('ordina per anno, mese e giorno', () => {
    expect(confrontaDate('2026-01-31', '2026-02-01')).toBe(-1);
    expect(confrontaDate('2026-02-01', '2026-01-31')).toBe(1);
    expect(confrontaDate('2026-02-01', '2026-02-01')).toBe(0);
  });
});

describe('annoDi', () => {
  it('estrae l’anno', () => {
    expect(annoDi('2026-09-14')).toBe(2026);
  });
});

describe('aggiungiGiorni', () => {
  it('attraversa la fine del mese', () => {
    expect(aggiungiGiorni('2026-01-30', 3)).toBe('2026-02-02');
  });
  it('attraversa la fine dell’anno', () => {
    expect(aggiungiGiorni('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('accetta giorni negativi', () => {
    expect(aggiungiGiorni('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('sottraiAnni', () => {
  it('mantiene giorno e mese', () => {
    expect(sottraiAnni('2026-09-14', 5)).toBe('2021-09-14');
  });
  it('fa scivolare il 29 febbraio al 28 quando l’anno non è bisestile', () => {
    expect(sottraiAnni('2028-02-29', 1)).toBe('2027-02-28');
  });
});

describe('entroFinestra', () => {
  it('include gli estremi', () => {
    expect(entroFinestra('2026-01-01', '2026-01-01', '2026-12-31')).toBe(true);
    expect(entroFinestra('2026-12-31', '2026-01-01', '2026-12-31')).toBe(true);
  });
  it('esclude oltre la fine', () => {
    expect(entroFinestra('2027-01-01', undefined, '2026-12-31')).toBe(false);
  });
  it('esclude prima dell’inizio', () => {
    expect(entroFinestra('2025-12-31', '2026-01-01')).toBe(false);
  });
  it('senza estremi accetta tutto', () => {
    expect(entroFinestra('1999-01-01')).toBe(true);
  });
});

describe('siSovrappongono', () => {
  it('riconosce la sovrapposizione di un solo giorno', () => {
    expect(siSovrappongono({ da: '2021-01-01', a: '2021-09-14' }, { da: '2021-09-14', a: '2026-09-14' })).toBe(true);
  });
  it('riconosce periodi disgiunti', () => {
    expect(siSovrappongono({ da: '2020-01-01', a: '2021-09-13' }, { da: '2021-09-14', a: '2026-09-14' })).toBe(false);
  });
});
