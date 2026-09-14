import { describe, expect, it } from 'vitest';
import { bando, DATA_RIFERIMENTO, raggruppamento, soggetti } from './fixture';
import { composizionePrimaDellUltimaProva, interpretaQuotaPercento, quotaValida, riduci, type Lavoro } from './lavoro';

const contesto = { bando, soggetti };

function iniziale(): Lavoro {
  return { lottoId: 'lotto-1', dataRiferimento: DATA_RIFERIMENTO, raggruppamento, storia: [] };
}

describe('interpretaQuotaPercento', () => {
  it('accetta interi e decimali con virgola o punto', () => {
    expect(interpretaQuotaPercento('60')).toBe(0.6);
    expect(interpretaQuotaPercento('12,5')).toBe(0.125);
    expect(interpretaQuotaPercento('12.5')).toBe(0.125);
    expect(interpretaQuotaPercento(' 0 ')).toBe(0);
    expect(interpretaQuotaPercento('100')).toBe(1);
  });
  it('rifiuta vuoto, testo, negativi e oltre 100', () => {
    expect(interpretaQuotaPercento('')).toBeUndefined();
    expect(interpretaQuotaPercento('abc')).toBeUndefined();
    expect(interpretaQuotaPercento('-5')).toBeUndefined();
    expect(interpretaQuotaPercento('101')).toBeUndefined();
  });
  it('quotaValida accetta solo frazioni tra 0 e 1', () => {
    expect(quotaValida(0.5)).toBe(true);
    expect(quotaValida(1.5)).toBe(false);
    expect(quotaValida(Number.NaN)).toBe(false);
  });
});

describe('riduci — quote', () => {
  it('imposta la quota e registra il passo con i nomi reali e i valori prima e dopo', () => {
    const dopo = riduci(iniziale(), { tipo: 'imposta_quota', soggettoId: 's-beta', prestazioneId: 'l1-manutenzione', quota: 0.4 }, contesto);
    expect(dopo.raggruppamento.membri[1]).toMatchObject({ soggettoId: 's-beta', quote: expect.objectContaining({ 'l1-manutenzione': 0.4 }) });
    expect(dopo.storia).toHaveLength(1);
    expect(dopo.storia[0]).toMatchObject({ genere: 'modifica', etichetta: 'Quota di Beta Service S.r.l. su «Manutenzione e assistenza tecnica»: 100 % → 40 %' });
    expect(dopo.storia[0]?.raggruppamento).toBe(raggruppamento);
  });
  it('non muta il raggruppamento di partenza', () => {
    const prima = JSON.stringify(raggruppamento);
    riduci(iniziale(), { tipo: 'imposta_quota', soggettoId: 's-beta', prestazioneId: 'l1-manutenzione', quota: 0.4 }, contesto);
    expect(JSON.stringify(raggruppamento)).toBe(prima);
  });
  it('ignora quote fuori intervallo, membri inesistenti, ausiliarie e valori invariati', () => {
    const l = iniziale();
    expect(riduci(l, { tipo: 'imposta_quota', soggettoId: 's-beta', prestazioneId: 'l1-manutenzione', quota: 1.5 }, contesto)).toBe(l);
    expect(riduci(l, { tipo: 'imposta_quota', soggettoId: 's-ignoto', prestazioneId: 'l1-manutenzione', quota: 0.5 }, contesto)).toBe(l);
    expect(riduci(l, { tipo: 'imposta_quota', soggettoId: 's-beta', prestazioneId: 'l1-manutenzione', quota: 1 }, contesto)).toBe(l);
  });
});

describe('riduci — membri', () => {
  it('cambia il ruolo di un esecutore', () => {
    const dopo = riduci(iniziale(), { tipo: 'imposta_ruolo', soggettoId: 's-beta', ruolo: 'consorziata_esecutrice' }, contesto);
    expect(dopo.raggruppamento.membri[1]?.ruolo).toBe('consorziata_esecutrice');
    expect(dopo.storia[0]?.etichetta).toContain('Ruolo di Beta Service S.r.l.');
  });
  it('aggiunge un membro a quote zero e rifiuta un doppione', () => {
    const dopo = riduci(iniziale(), { tipo: 'aggiungi_membro', soggettoId: 's-delta', ruolo: 'mandante' }, contesto);
    expect(dopo.raggruppamento.membri[3]).toEqual({ ruolo: 'mandante', soggettoId: 's-delta', quote: {} });
    expect(riduci(dopo, { tipo: 'aggiungi_membro', soggettoId: 's-delta', ruolo: 'mandante' }, contesto)).toBe(dopo);
  });
  it('aggiunge un’ausiliaria solo a favore di un esecutore presente', () => {
    const l = iniziale();
    const dopo = riduci(l, { tipo: 'aggiungi_ausiliaria', soggettoId: 's-epsilon', ausiliataId: 's-alfa', requisitiIds: ['l1-referenze'] }, contesto);
    expect(dopo.raggruppamento.membri[3]).toEqual({ ruolo: 'ausiliaria', soggettoId: 's-epsilon', ausiliataId: 's-alfa', requisitiIds: ['l1-referenze'] });
    expect(dopo.storia[0]?.etichetta).toBe('Avvalimento di Epsilon Hospital Supply S.r.l. a favore di Alfa Medical S.p.A.');
    expect(riduci(l, { tipo: 'aggiungi_ausiliaria', soggettoId: 's-epsilon', ausiliataId: 's-ignoto', requisitiIds: [] }, contesto)).toBe(l);
  });
  it('rimuove un membro e le sue ausiliarie', () => {
    const conAusiliaria = riduci(iniziale(), { tipo: 'aggiungi_ausiliaria', soggettoId: 's-epsilon', ausiliataId: 's-beta', requisitiIds: ['l1-referenze'] }, contesto);
    const dopo = riduci(conAusiliaria, { tipo: 'rimuovi_membro', soggettoId: 's-beta' }, contesto);
    expect(dopo.raggruppamento.membri.map((m) => m.soggettoId)).toEqual(['s-alfa', 's-gamma']);
  });
});

describe('riduci — prove e annullamento', () => {
  const mossa = { tipo: 'ingresso_soggetto', soggettoId: 's-delta', ruolo: 'mandante', quote: { 'l1-manutenzione': 1 }, rilevateDa: 's-beta' } as const;

  it('una prova applica la mossa del motore e registra un passo di genere prova con l’etichetta onesta', () => {
    const dopo = riduci(iniziale(), { tipo: 'prova_rimedio', mossa }, contesto);
    expect(dopo.raggruppamento.membri.map((m) => m.soggettoId)).toEqual(['s-alfa', 's-beta', 's-gamma', 's-delta']);
    expect(dopo.raggruppamento.membri[1]).toMatchObject({ quote: expect.objectContaining({ 'l1-manutenzione': 0 }) });
    expect(dopo.storia[0]).toMatchObject({ genere: 'prova', etichetta: 'Prova: Ingresso di Delta Tecnica S.r.l. come mandante, rilevando 100 % di «Manutenzione e assistenza tecnica» da Beta Service S.r.l.' });
  });
  it('annulla ripristina lo stato precedente nell’ordine vero, prove e modifiche insieme', () => {
    const l0 = iniziale();
    const l1 = riduci(l0, { tipo: 'prova_rimedio', mossa }, contesto);
    const l2 = riduci(l1, { tipo: 'imposta_quota', soggettoId: 's-gamma', prestazioneId: 'l1-formazione', quota: 0.5 }, contesto);
    const l3 = riduci(l2, { tipo: 'annulla' }, contesto);
    expect(l3.raggruppamento).toBe(l1.raggruppamento);
    expect(l3.storia).toHaveLength(1);
    const l4 = riduci(l3, { tipo: 'annulla' }, contesto);
    expect(l4.raggruppamento).toBe(l0.raggruppamento);
    expect(l4.storia).toEqual([]);
  });
  it('annulla con storia vuota non fa nulla', () => {
    const l = iniziale();
    expect(riduci(l, { tipo: 'annulla' }, contesto)).toBe(l);
  });
  it('trova la composizione prima dell’ultima prova, ignorando le modifiche successive', () => {
    const l0 = iniziale();
    const l1 = riduci(l0, { tipo: 'imposta_quota', soggettoId: 's-gamma', prestazioneId: 'l1-formazione', quota: 0.5 }, contesto);
    const l2 = riduci(l1, { tipo: 'prova_rimedio', mossa }, contesto);
    const l3 = riduci(l2, { tipo: 'imposta_quota', soggettoId: 's-gamma', prestazioneId: 'l1-formazione', quota: 0.7 }, contesto);
    expect(composizionePrimaDellUltimaProva(l3)?.raggruppamento).toBe(l1.raggruppamento);
    expect(composizionePrimaDellUltimaProva(l1)).toBeUndefined();
  });
});

describe('riduci — lotto e data', () => {
  it('selezionare un lotto o cambiare la data non tocca la storia', () => {
    const l = iniziale();
    const dopo = riduci(riduci(l, { tipo: 'seleziona_lotto', lottoId: 'lotto-2' }, contesto), { tipo: 'imposta_data', valore: '2026-05-01' }, contesto);
    expect(dopo).toMatchObject({ lottoId: 'lotto-2', dataRiferimento: '2026-05-01', storia: [] });
    expect(riduci(l, { tipo: 'seleziona_lotto', lottoId: 'lotto-1' }, contesto)).toBe(l);
  });
});
