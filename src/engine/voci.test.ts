import { describe, expect, it } from 'vitest';
import { certificazione, dichiarazione, fatturato, servizio } from './prova';
import { datoDiVoce, descriviVoce, fattoDiVoce } from './voci';

describe('voci di fascicolo', () => {
  it('ogni voce espone il dato con la sua fonte', () => {
    expect(datoDiVoce(servizio('33100000', '2024-01-01', '2024-12-31')).valore).toEqual({ da: '2024-01-01', a: '2024-12-31' });
    expect(datoDiVoce(dichiarazione('x')).valore).toBe(true);
  });
  it('solo certificazioni e iscrizioni hanno un fatto con validità', () => {
    expect(fattoDiVoce(certificazione('ISO 9001', 'assistenza', '2027-01-01'))?.validoA).toBe('2027-01-01');
    expect(fattoDiVoce(fatturato(2025, 'dispositivi', 1))).toBeUndefined();
    expect(fattoDiVoce(dichiarazione('x'))).toBeUndefined();
  });
  it('descrive la voce con i dati che la identificano', () => {
    expect(descriviVoce(fatturato(2025, 'dispositivi', 2_100_000))).toBe('fatturato 2025 (2.100.000 €)');
    expect(descriviVoce(certificazione('ISO 9001', 'assistenza tecnica'))).toBe('certificazione ISO 9001 — assistenza tecnica');
  });
});
