import { describe, expect, it } from 'vitest';
import { certificazione, fatturato, servizio } from './prova';
import { descriviVoce, fattoDiVoce } from './voci';

describe('voci di fascicolo', () => {
  it('espone il fatto che porta la validità di ogni voce', () => {
    expect(fattoDiVoce(certificazione('ISO 9001', 'assistenza', '2027-01-01')).validoA).toBe('2027-01-01');
    expect(fattoDiVoce(servizio('33100000', '2024-01-01', '2024-12-31')).valore).toEqual({ da: '2024-01-01', a: '2024-12-31' });
  });
  it('descrive la voce con i dati che la identificano', () => {
    expect(descriviVoce(fatturato(2025, 'dispositivi', 2_100_000))).toBe('fatturato 2025 (2.100.000 €)');
    expect(descriviVoce(certificazione('ISO 9001', 'assistenza tecnica'))).toBe('certificazione ISO 9001 — assistenza tecnica');
  });
});
