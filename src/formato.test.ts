import { describe, expect, it } from 'vitest';
import { formattaConUnita, formattaData, formattaEuro, formattaNumero, formattaPercentuale } from './formato';

describe('formattaNumero', () => {
  it('separa le migliaia con il punto', () => {
    expect(formattaNumero(2_900_000)).toBe('2.900.000');
  });
  it('usa la virgola per i decimali, solo se servono', () => {
    expect(formattaNumero(99_999.99)).toBe('99.999,99');
    expect(formattaNumero(100)).toBe('100');
  });
  it('rispetta i decimali richiesti', () => {
    expect(formattaNumero(1234.5, 2)).toBe('1.234,50');
  });
  it('gestisce i negativi', () => {
    expect(formattaNumero(-1500)).toBe('-1.500');
  });
});

describe('formattaEuro', () => {
  it('aggiunge il simbolo dopo la cifra', () => {
    expect(formattaEuro(100_000)).toBe('100.000 €');
  });
  it('mostra i centesimi quando non sono zero', () => {
    expect(formattaEuro(0.5)).toBe('0,50 €');
  });
});

describe('formattaPercentuale', () => {
  it('converte la frazione', () => {
    expect(formattaPercentuale(0.6)).toBe('60 %');
  });
  it('mostra i decimali solo se servono', () => {
    expect(formattaPercentuale(0.125)).toBe('12,5 %');
  });
  it('non produce residui binari', () => {
    expect(formattaPercentuale(0.1 + 0.2)).toBe('30 %');
  });
});

describe('formattaData', () => {
  it('converte in gg/mm/aaaa', () => {
    expect(formattaData('2026-09-14')).toBe('14/09/2026');
  });
  it('lascia com’è una data malformata invece di nasconderla', () => {
    expect(formattaData('domani')).toBe('domani');
  });
});

describe('formattaConUnita', () => {
  it('formatta euro e conteggi', () => {
    expect(formattaConUnita(3_000_000, 'euro')).toBe('3.000.000 €');
    expect(formattaConUnita(3, 'conteggio')).toBe('3');
  });
});
