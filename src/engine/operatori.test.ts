import { describe, expect, it } from 'vitest';
import type { RuoloEsecutore, ValoreContributo } from '../domain';
import { indicizza } from './indici';
import { componi, frazioneMinima, type Partecipante } from './operatori';
import { prestazione } from './prova';

const PRESTAZIONI = indicizza([prestazione('p-1', { descrizione: 'Manutenzione' }), prestazione('p-2', { descrizione: 'Fornitura' })]);

const POSSEDUTO: ValoreContributo = { tipo: 'possesso', esito: 'posseduto' };
const DA_VERIFICARE: ValoreContributo = { tipo: 'possesso', esito: 'da_verificare' };
const ASSENTE: ValoreContributo = { tipo: 'possesso', esito: 'assente' };

function misura(certo: number, incerto = 0): ValoreContributo {
  return { tipo: 'misura', certo, incerto };
}

function partecipante(soggettoId: string, ruolo: RuoloEsecutore, valore: ValoreContributo, quote: Record<string, number> = { 'p-1': 1 }): Partecipante {
  return { soggettoId, ruolo, quote, valore };
}

describe('frazioneMinima', () => {
  it('arrotonda per eccesso: "almeno il 40 % di 3" sono 2', () => {
    expect(frazioneMinima(3, 0.4)).toBe(2);
  });
  it('non arrotonda per eccesso un prodotto esatto', () => {
    expect(frazioneMinima(300_000_000, 0.4)).toBe(120_000_000);
    expect(frazioneMinima(10, 0.3)).toBe(3);
  });
});

describe('ciascun_membro', () => {
  const regola = { tipo: 'ciascun_membro' } as const;

  it('è coperto quando tutti possiedono', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', POSSEDUTO), partecipante('b', 'mandante', POSSEDUTO)], 1, PRESTAZIONI);
    expect(e.stato).toBe('coperto');
    expect(e.conteggi.every((c) => c.conteggiato)).toBe(true);
  });
  it('è scoperto se manca a uno solo', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', POSSEDUTO), partecipante('b', 'mandante', ASSENTE)], 1, PRESTAZIONI);
    expect(e.stato).toBe('scoperto');
  });
  it('è da verificare se uno è da verificare e nessuno manca', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', POSSEDUTO), partecipante('b', 'mandante', DA_VERIFICARE)], 1, PRESTAZIONI);
    expect(e.stato).toBe('da_verificare');
  });
  it('lo scoperto prevale sul da verificare', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', DA_VERIFICARE), partecipante('b', 'mandante', ASSENTE)], 1, PRESTAZIONI);
    expect(e.stato).toBe('scoperto');
  });
  it('con misura, ogni membro deve raggiungere la soglia da solo e il minimo fa la misurazione', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', misura(500)), partecipante('b', 'mandante', misura(200, 100))], 300, PRESTAZIONI);
    expect(e.stato).toBe('da_verificare');
    expect(e.misurazione).toEqual({ soglia: 300, raggiunto: 200, massimo: 300, delta: 100, minimiRuolo: [] });
  });
  it('senza membri è scoperto', () => {
    expect(componi(regola, [], 1, PRESTAZIONI).stato).toBe('scoperto');
  });
});

describe('somma_membri', () => {
  it('è coperto quando la somma dei certi raggiunge la soglia', () => {
    const e = componi({ tipo: 'somma_membri' }, [partecipante('a', 'mandataria', misura(200)), partecipante('b', 'mandante', misura(100))], 300, PRESTAZIONI);
    expect(e.stato).toBe('coperto');
    expect(e.misurazione).toEqual({ soglia: 300, raggiunto: 300, massimo: 300, delta: 0, minimiRuolo: [] });
  });
  it('è scoperto con il delta esatto quando nemmeno il massimo basta', () => {
    const e = componi({ tipo: 'somma_membri' }, [partecipante('a', 'mandataria', misura(200)), partecipante('b', 'mandante', misura(50, 10))], 300, PRESTAZIONI);
    expect(e.stato).toBe('scoperto');
    expect(e.misurazione.delta).toBe(50);
    expect(e.misurazione.massimo).toBe(260);
  });
  it('è da verificare quando servono gli incerti per arrivare alla soglia', () => {
    const e = componi({ tipo: 'somma_membri' }, [partecipante('a', 'mandataria', misura(2)), partecipante('b', 'mandante', misura(0, 1))], 3, PRESTAZIONI);
    expect(e.stato).toBe('da_verificare');
    expect(e.misurazione).toEqual({ soglia: 3, raggiunto: 2, massimo: 3, delta: 1, minimiRuolo: [] });
  });
  it('minimo della mandataria sopra soglia: coperto, con il minimo registrato', () => {
    const e = componi({ tipo: 'somma_membri', minimoMandataria: 0.4 }, [partecipante('a', 'mandataria', misura(120)), partecipante('b', 'mandante', misura(180))], 300, PRESTAZIONI);
    expect(e.stato).toBe('coperto');
    expect(e.misurazione.minimiRuolo).toEqual([{ soggettoId: 'a', ruolo: 'mandataria', richiesto: 120, raggiunto: 120, delta: 0 }]);
  });
  it('minimo della mandataria sotto soglia: scoperto anche se il totale basta, con il delta del ruolo', () => {
    const e = componi({ tipo: 'somma_membri', minimoMandataria: 0.4 }, [partecipante('a', 'mandataria', misura(100)), partecipante('b', 'mandante', misura(300))], 300, PRESTAZIONI);
    expect(e.stato).toBe('scoperto');
    expect(e.misurazione.delta).toBe(0);
    expect(e.misurazione.minimiRuolo).toEqual([{ soggettoId: 'a', ruolo: 'mandataria', richiesto: 120, raggiunto: 100, delta: 20 }]);
  });
  it('minimo assente: nessun controllo sul ruolo', () => {
    const e = componi({ tipo: 'somma_membri' }, [partecipante('a', 'mandataria', misura(0)), partecipante('b', 'mandante', misura(300))], 300, PRESTAZIONI);
    expect(e.stato).toBe('coperto');
    expect(e.misurazione.minimiRuolo).toEqual([]);
  });
  it('il minimo della mandante si applica a ciascuna mandante, consorziate comprese', () => {
    const e = componi(
      { tipo: 'somma_membri', minimoMandante: 0.1 },
      [partecipante('a', 'mandataria', misura(280)), partecipante('b', 'mandante', misura(30)), partecipante('c', 'consorziata_esecutrice', misura(10))],
      300,
      PRESTAZIONI,
    );
    expect(e.stato).toBe('scoperto');
    expect(e.misurazione.minimiRuolo).toEqual([
      { soggettoId: 'b', ruolo: 'mandante', richiesto: 30, raggiunto: 30, delta: 0 },
      { soggettoId: 'c', ruolo: 'consorziata_esecutrice', richiesto: 30, raggiunto: 10, delta: 20 },
    ]);
  });
  it('un minimo raggiunto solo con gli incerti rende il requisito da verificare', () => {
    const e = componi({ tipo: 'somma_membri', minimoMandataria: 0.4 }, [partecipante('a', 'mandataria', misura(100, 20)), partecipante('b', 'mandante', misura(300))], 300, PRESTAZIONI);
    expect(e.stato).toBe('da_verificare');
  });
});

describe('esecutore_prestazione', () => {
  const regola = { tipo: 'esecutore_prestazione', prestazioneId: 'p-1' } as const;

  it('è coperto quando chi esegue possiede', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', ASSENTE, { 'p-1': 0, 'p-2': 1 }), partecipante('b', 'mandante', POSSEDUTO, { 'p-1': 1 })], 1, PRESTAZIONI);
    expect(e.stato).toBe('coperto');
  });
  it('è scoperto quando chi esegue non possiede, anche se un altro membro possiede', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', POSSEDUTO, { 'p-1': 0, 'p-2': 1 }), partecipante('b', 'mandante', ASSENTE, { 'p-1': 1 })], 1, PRESTAZIONI);
    expect(e.stato).toBe('scoperto');
  });
  it('chi non esegue non è conteggiato e la nota nomina la prestazione', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', POSSEDUTO, { 'p-1': 0, 'p-2': 1 }), partecipante('b', 'mandante', POSSEDUTO, { 'p-1': 1 })], 1, PRESTAZIONI);
    expect(e.conteggi).toEqual([
      { soggettoId: 'a', conteggiato: false, nota: 'non esegue la prestazione «Manutenzione»' },
      { soggettoId: 'b', conteggiato: true },
    ]);
  });
  it('con la prestazione divisa tra due esecutori, entrambi devono possedere', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', POSSEDUTO, { 'p-1': 0.6 }), partecipante('b', 'mandante', ASSENTE, { 'p-1': 0.4 })], 1, PRESTAZIONI);
    expect(e.stato).toBe('scoperto');
    expect(e.conteggi.every((c) => c.conteggiato)).toBe(true);
  });
  it('con la prestazione divisa e tutti in possesso è coperto', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', POSSEDUTO, { 'p-1': 0.6 }), partecipante('b', 'mandante', POSSEDUTO, { 'p-1': 0.4 })], 1, PRESTAZIONI);
    expect(e.stato).toBe('coperto');
  });
  it('una quota zero esplicita e una assente sono la stessa cosa', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', ASSENTE, { 'p-2': 1 }), partecipante('b', 'mandante', POSSEDUTO, { 'p-1': 1 })], 1, PRESTAZIONI);
    expect(e.stato).toBe('coperto');
    expect(e.conteggi[0]?.conteggiato).toBe(false);
  });
  it('senza esecutori è scoperto', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', POSSEDUTO, { 'p-2': 1 })], 1, PRESTAZIONI);
    expect(e.stato).toBe('scoperto');
  });
  it('una prestazione ignota vale come senza esecutori e la nota usa l’id', () => {
    const e = componi({ tipo: 'esecutore_prestazione', prestazioneId: 'p-9' }, [partecipante('a', 'mandataria', POSSEDUTO)], 1, PRESTAZIONI);
    expect(e.stato).toBe('scoperto');
    expect(e.conteggi[0]?.nota).toBe('non esegue la prestazione «p-9»');
  });
});

describe('almeno_un_membro', () => {
  const regola = { tipo: 'almeno_un_membro' } as const;

  it('è coperto se uno possiede', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', ASSENTE), partecipante('b', 'mandante', POSSEDUTO)], 1, PRESTAZIONI);
    expect(e.stato).toBe('coperto');
  });
  it('è scoperto se nessuno possiede', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', ASSENTE), partecipante('b', 'mandante', ASSENTE)], 1, PRESTAZIONI);
    expect(e.stato).toBe('scoperto');
  });
  it('è da verificare se il migliore è da verificare', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', ASSENTE), partecipante('b', 'mandante', DA_VERIFICARE)], 1, PRESTAZIONI);
    expect(e.stato).toBe('da_verificare');
  });
  it('con misura conta il migliore, non la somma', () => {
    const e = componi(regola, [partecipante('a', 'mandataria', misura(200)), partecipante('b', 'mandante', misura(200))], 300, PRESTAZIONI);
    expect(e.stato).toBe('scoperto');
    expect(e.misurazione).toEqual({ soglia: 300, raggiunto: 200, massimo: 200, delta: 100, minimiRuolo: [] });
  });
});
