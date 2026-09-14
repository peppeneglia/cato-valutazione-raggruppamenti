import { describe, expect, it } from 'vitest';
import type { Requisito, Soggetto } from '../domain';
import { indicizza } from './indici';
import { ausiliaria, certificazione, esecutore, fatturato, prestazione, raggruppamento, REFERENZE, requisito, servizio, soggetto } from './prova';
import { valutaRequisito, type ContestoValutazione } from './requisito';

const CRITERIO_ISO = { tipo: 'certificazione', norma: 'ISO 9001' } as const;
const CRITERIO_FATTURATO = { tipo: 'fatturato', ambito: { tipo: 'specifico', settore: 'dispositivi' }, esercizi: 3, ancoraggio: 'riferimento', soglia: 1_000_000 } as const;
const CRITERIO_SERVIZI = { tipo: 'servizi', cpv: '33100000', anni: 5, ancoraggio: 'riferimento', numeroMinimo: 2, sostantivo: REFERENZE } as const;

function contesto(soggetti: Soggetto[], membri: ReturnType<typeof esecutore>[]): ContestoValutazione {
  return {
    prestazioni: indicizza([prestazione('p-1', { descrizione: 'Manutenzione' }), prestazione('p-2', { descrizione: 'Fornitura' })]),
    soggetti: indicizza(soggetti),
    raggruppamento: raggruppamento(membri),
    criterio: { dataRiferimento: '2026-09-14', dataPubblicazione: '2026-09-01' },
  };
}

describe('valutaRequisito — contributi', () => {
  it('elenca tutti gli esecutori nell’ordine del raggruppamento, con il valore reale del fascicolo', () => {
    const r = requisito('r', CRITERIO_ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-1' });
    const c = contesto(
      [soggetto('s-a', [certificazione('ISO 9001', 'x')]), soggetto('s-b', [])],
      [esecutore('s-b', 'mandante', { 'p-1': 1 }), esecutore('s-a', 'mandataria', { 'p-2': 1 })],
    );
    const { esito } = valutaRequisito(r, c);
    expect(esito.stato).toBe('scoperto');
    expect(esito.contributi).toEqual([
      { soggettoId: 's-b', valore: { tipo: 'possesso', esito: 'assente' }, conteggiato: true, fonti: [], nota: 'nessuna certificazione ISO 9001 nel fascicolo' },
      { soggettoId: 's-a', valore: { tipo: 'possesso', esito: 'posseduto' }, conteggiato: false, fonti: [expect.anything()], nota: 'non esegue la prestazione «Manutenzione»' },
    ]);
  });
  it('converte le misure in euro e produce la misurazione', () => {
    const r = requisito('r', CRITERIO_FATTURATO, { tipo: 'somma_membri', minimoMandataria: 0.5 });
    const c = contesto(
      [soggetto('s-a', [fatturato(2025, 'dispositivi', 400_000.5)]), soggetto('s-b', [fatturato(2025, 'dispositivi', 300_000)])],
      [esecutore('s-a', 'mandataria', { 'p-1': 1 }), esecutore('s-b', 'mandante', { 'p-1': 0 })],
    );
    const { esito } = valutaRequisito(r, c);
    expect(esito.contributi[0]?.valore).toEqual({ tipo: 'misura', certo: 400_000.5, incerto: 0 });
    expect(esito.misurazione).toEqual({
      unita: { tipo: 'euro' }, soglia: 1_000_000, raggiunto: 700_000.5, massimo: 700_000.5, delta: 299_999.5,
      minimiRuolo: [{ soggettoId: 's-a', ruolo: 'mandataria', richiesto: 500_000, raggiunto: 400_000.5, delta: 99_999.5 }],
    });
  });
  it('un criterio di possesso non ha misurazione', () => {
    const r = requisito('r', CRITERIO_ISO, { tipo: 'ciascun_membro' });
    const { esito } = valutaRequisito(r, contesto([soggetto('s-a', [certificazione('ISO 9001', 'x')])], [esecutore('s-a', 'mandataria', { 'p-1': 1 })]));
    expect(esito.misurazione).toBeUndefined();
    expect(esito.stato).toBe('coperto');
  });
  it('raccoglie i fatti usati per soggetto e requisito, con la scadenza', () => {
    const r = requisito('r', CRITERIO_ISO, { tipo: 'ciascun_membro' });
    const { usati } = valutaRequisito(r, contesto([soggetto('s-a', [certificazione('ISO 9001', 'x', '2027-01-01')])], [esecutore('s-a', 'mandataria', { 'p-1': 1 })]));
    expect(usati).toEqual([{ soggettoId: 's-a', requisitoId: 'r', fatto: { descrizione: 'certificazione ISO 9001 — x', fonte: expect.anything(), scadeIl: '2027-01-01' } }]);
  });
  it('raccoglie i fatti usati solo dei membri conteggiati', () => {
    const r = requisito('r', CRITERIO_ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-1' });
    const c = contesto(
      [soggetto('s-a', [certificazione('ISO 9001', 'x', '2026-10-01')]), soggetto('s-b', [certificazione('ISO 9001', 'x', '2026-10-02')])],
      [esecutore('s-a', 'mandataria', { 'p-2': 1 }), esecutore('s-b', 'mandante', { 'p-1': 1 })],
    );
    const { usati } = valutaRequisito(r, c);
    expect(usati.map((u) => u.soggettoId)).toEqual(['s-b']);
  });
  it('salta un membro il cui soggetto non esiste', () => {
    const r = requisito('r', CRITERIO_ISO, { tipo: 'ciascun_membro' });
    const { esito } = valutaRequisito(r, contesto([soggetto('s-a', [certificazione('ISO 9001', 'x')])], [esecutore('s-a', 'mandataria', { 'p-1': 1 }), esecutore('s-x', 'mandante', { 'p-1': 0 })]));
    expect(esito.contributi.map((c) => c.soggettoId)).toEqual(['s-a']);
  });
  it('i rimedi sono vuoti: si calcolano dopo', () => {
    const r = requisito('r', CRITERIO_ISO, { tipo: 'ciascun_membro' });
    expect(valutaRequisito(r, contesto([soggetto('s-a')], [esecutore('s-a', 'mandataria', { 'p-1': 1 })])).esito.rimedi).toEqual([]);
  });
});

describe('valutaRequisito — ausiliarie', () => {
  const avvalibile: Partial<Requisito> = { avvalibile: true };

  it('il possesso dell’ausiliaria copre l’ausiliata senza alterarne il valore reale', () => {
    const r = requisito('r', CRITERIO_ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-1' }, avvalibile);
    const c = contesto(
      [soggetto('s-a', []), soggetto('s-x', [certificazione('ISO 9001', 'x')])],
      [esecutore('s-a', 'mandataria', { 'p-1': 1 }), ausiliaria('s-x', 's-a', ['r'])],
    );
    const { esito } = valutaRequisito(r, c);
    expect(esito.stato).toBe('coperto');
    expect(esito.contributi).toEqual([
      { soggettoId: 's-a', valore: { tipo: 'possesso', esito: 'assente' }, conteggiato: true, fonti: [], nota: 'nessuna certificazione ISO 9001 nel fascicolo; integrato dall\'ausiliaria Soggetto s-x' },
      { soggettoId: 's-x', valore: { tipo: 'possesso', esito: 'posseduto' }, conteggiato: true, fonti: [expect.anything()], nota: 'in avvalimento a favore di Soggetto s-a' },
    ]);
  });
  it('la misura dell’ausiliaria si somma a quella dell’ausiliata, minimi per ruolo compresi', () => {
    const r = requisito('r', CRITERIO_FATTURATO, { tipo: 'somma_membri', minimoMandataria: 0.5 }, avvalibile);
    const c = contesto(
      [soggetto('s-a', [fatturato(2025, 'dispositivi', 300_000)]), soggetto('s-b', [fatturato(2025, 'dispositivi', 500_000)]), soggetto('s-x', [fatturato(2025, 'dispositivi', 200_000)])],
      [esecutore('s-a', 'mandataria', { 'p-1': 1 }), esecutore('s-b', 'mandante', { 'p-1': 0 }), ausiliaria('s-x', 's-a', ['r'])],
    );
    const { esito } = valutaRequisito(r, c);
    expect(esito.stato).toBe('coperto');
    expect(esito.misurazione?.minimiRuolo).toEqual([{ soggettoId: 's-a', ruolo: 'mandataria', richiesto: 500_000, raggiunto: 500_000, delta: 0 }]);
  });
  it('un’ausiliaria non indicata per il requisito non compare e non conta', () => {
    const r = requisito('r', CRITERIO_ISO, { tipo: 'ciascun_membro' }, avvalibile);
    const c = contesto(
      [soggetto('s-a', []), soggetto('s-x', [certificazione('ISO 9001', 'x')])],
      [esecutore('s-a', 'mandataria', { 'p-1': 1 }), ausiliaria('s-x', 's-a', ['altro'])],
    );
    const { esito } = valutaRequisito(r, c);
    expect(esito.stato).toBe('scoperto');
    expect(esito.contributi.map((c) => c.soggettoId)).toEqual(['s-a']);
  });
  it('su un requisito non avvalibile l’ausiliaria non conta (l’anomalia è altrove)', () => {
    const r = requisito('r', CRITERIO_ISO, { tipo: 'ciascun_membro' }, { avvalibile: false });
    const c = contesto(
      [soggetto('s-a', []), soggetto('s-x', [certificazione('ISO 9001', 'x')])],
      [esecutore('s-a', 'mandataria', { 'p-1': 1 }), ausiliaria('s-x', 's-a', ['r'])],
    );
    expect(valutaRequisito(r, c).esito.stato).toBe('scoperto');
  });
  it('l’ausiliaria non è conteggiata se la sua ausiliata non esegue la prestazione', () => {
    const r = requisito('r', CRITERIO_ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-1' }, avvalibile);
    const c = contesto(
      [soggetto('s-a', []), soggetto('s-b', [certificazione('ISO 9001', 'x')]), soggetto('s-x', [certificazione('ISO 9001', 'x')])],
      [esecutore('s-a', 'mandataria', { 'p-2': 1 }), esecutore('s-b', 'mandante', { 'p-1': 1 }), ausiliaria('s-x', 's-a', ['r'])],
    );
    const { esito } = valutaRequisito(r, c);
    expect(esito.stato).toBe('coperto');
    expect(esito.contributi.find((x) => x.soggettoId === 's-x')?.conteggiato).toBe(false);
  });
  it('un servizio certo più uno incerto restano distinti nel contributo', () => {
    const r = requisito('r', CRITERIO_SERVIZI, { tipo: 'somma_membri' });
    const c = contesto(
      [soggetto('s-a', [servizio('33100000', '2024-01-01', '2024-12-31'), servizio('50421000', '2024-01-01', '2024-12-31')])],
      [esecutore('s-a', 'mandataria', { 'p-1': 1 })],
    );
    const { esito } = valutaRequisito(r, c);
    expect(esito.stato).toBe('da_verificare');
    expect(esito.contributi[0]?.valore).toEqual({ tipo: 'misura', certo: 1, incerto: 1 });
    expect(esito.misurazione).toMatchObject({ unita: { tipo: 'conteggio', sostantivo: REFERENZE }, raggiunto: 1, massimo: 2, delta: 1 });
  });
});
