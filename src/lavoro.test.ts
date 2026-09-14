import { describe, expect, it } from 'vitest';
import { bando, DATA_RIFERIMENTO, raggruppamento, soggetti } from './documenti/documentiDiProva';
import { formattaPercentuale } from './formato';
import { composizionePrimaDellUltimaProva, interpretaQuotaPercento, quotaValida, riduci, type Lavoro } from './lavoro';

const contesto = { bando, soggetti };
const FORNITURA = 'Fornitura di farmaci, parafarmaci, dispositivi medici e altro, da grossista con consegna veloce';

function iniziale(): Lavoro {
  return { lottoId: 'lotto-unico', dataRiferimento: DATA_RIFERIMENTO, raggruppamento, storia: [] };
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
    const dopo = riduci(iniziale(), { tipo: 'imposta_quota', soggettoId: 's-ospedalia', prestazioneId: 'fornitura', quota: 0.4 }, contesto);
    expect(dopo.raggruppamento.membri[1]).toMatchObject({ soggettoId: 's-ospedalia', quote: expect.objectContaining({ fornitura: 0.4 }) });
    expect(dopo.storia).toHaveLength(1);
    expect(dopo.storia[0]).toMatchObject({ genere: 'modifica', etichetta: `Quota di Ospedalia Forniture S.r.l. su «${FORNITURA}»: ${formattaPercentuale(0.33)} → ${formattaPercentuale(0.4)}` });
    expect(dopo.storia[0]?.raggruppamento).toBe(raggruppamento);
  });
  it('non muta il raggruppamento di partenza', () => {
    const prima = JSON.stringify(raggruppamento);
    riduci(iniziale(), { tipo: 'imposta_quota', soggettoId: 's-ospedalia', prestazioneId: 'fornitura', quota: 0.4 }, contesto);
    expect(JSON.stringify(raggruppamento)).toBe(prima);
  });
  it('ignora quote fuori intervallo, membri inesistenti, ausiliarie e valori invariati', () => {
    const l = iniziale();
    expect(riduci(l, { tipo: 'imposta_quota', soggettoId: 's-ospedalia', prestazioneId: 'fornitura', quota: 1.5 }, contesto)).toBe(l);
    expect(riduci(l, { tipo: 'imposta_quota', soggettoId: 's-ignoto', prestazioneId: 'fornitura', quota: 0.5 }, contesto)).toBe(l);
    expect(riduci(l, { tipo: 'imposta_quota', soggettoId: 's-ospedalia', prestazioneId: 'fornitura', quota: 0.33 }, contesto)).toBe(l);
  });
});

describe('riduci — membri', () => {
  it('cambia il ruolo di un esecutore', () => {
    const dopo = riduci(iniziale(), { tipo: 'imposta_ruolo', soggettoId: 's-ospedalia', ruolo: 'consorziata_esecutrice' }, contesto);
    expect(dopo.raggruppamento.membri[1]?.ruolo).toBe('consorziata_esecutrice');
    expect(dopo.storia[0]?.etichetta).toContain('Ruolo di Ospedalia Forniture S.r.l.');
  });
  it('aggiunge un membro a quote zero e rifiuta un doppione', () => {
    const dopo = riduci(iniziale(), { tipo: 'aggiungi_membro', soggettoId: 's-grossfarma', ruolo: 'mandante' }, contesto);
    expect(dopo.raggruppamento.membri[3]).toEqual({ ruolo: 'mandante', soggettoId: 's-grossfarma', quote: {} });
    expect(riduci(dopo, { tipo: 'aggiungi_membro', soggettoId: 's-grossfarma', ruolo: 'mandante' }, contesto)).toBe(dopo);
  });
  it('aggiunge un’ausiliaria solo a favore di un esecutore presente', () => {
    const l = iniziale();
    const dopo = riduci(l, { tipo: 'aggiungi_ausiliaria', soggettoId: 's-grossfarma', ausiliataId: 's-farmalazio', requisitiIds: ['fatturato-globale'] }, contesto);
    expect(dopo.raggruppamento.membri[3]).toEqual({ ruolo: 'ausiliaria', soggettoId: 's-grossfarma', ausiliataId: 's-farmalazio', requisitiIds: ['fatturato-globale'] });
    expect(dopo.storia[0]?.etichetta).toBe('Avvalimento di Grossfarma Centro-Sud S.p.A. a favore di Farmadistribuzione Laziale S.p.A.');
    expect(riduci(l, { tipo: 'aggiungi_ausiliaria', soggettoId: 's-grossfarma', ausiliataId: 's-ignoto', requisitiIds: [] }, contesto)).toBe(l);
  });
  it('rimuove un membro e le sue ausiliarie', () => {
    const conAusiliaria = riduci(iniziale(), { tipo: 'aggiungi_ausiliaria', soggettoId: 's-grossfarma', ausiliataId: 's-ospedalia', requisitiIds: ['fatturato-globale'] }, contesto);
    const dopo = riduci(conAusiliaria, { tipo: 'rimuovi_membro', soggettoId: 's-ospedalia' }, contesto);
    expect(dopo.raggruppamento.membri.map((m) => m.soggettoId)).toEqual(['s-farmalazio', 's-medifarm']);
  });
});

describe('riduci — prove e annullamento', () => {
  const mossa = { tipo: 'ingresso_soggetto', soggettoId: 's-grossfarma', ruolo: 'mandante', quote: { fornitura: 0.33 }, rilevateDa: 's-ospedalia' } as const;

  it('una prova applica la mossa del motore e registra un passo di genere prova con l’etichetta onesta', () => {
    const dopo = riduci(iniziale(), { tipo: 'prova_rimedio', mossa }, contesto);
    expect(dopo.raggruppamento.membri.map((m) => m.soggettoId)).toEqual(['s-farmalazio', 's-ospedalia', 's-medifarm', 's-grossfarma']);
    expect(dopo.raggruppamento.membri[1]).toMatchObject({ quote: expect.objectContaining({ fornitura: 0 }) });
    expect(dopo.storia[0]).toMatchObject({ genere: 'prova', etichetta: `Prova: Ingresso di Grossfarma Centro-Sud S.p.A. come mandante, rilevando ${formattaPercentuale(0.33)} di «${FORNITURA}» da Ospedalia Forniture S.r.l.` });
  });
  it('annulla ripristina lo stato precedente nell’ordine vero, prove e modifiche insieme', () => {
    const l0 = iniziale();
    const l1 = riduci(l0, { tipo: 'prova_rimedio', mossa }, contesto);
    const l2 = riduci(l1, { tipo: 'imposta_quota', soggettoId: 's-medifarm', prestazioneId: 'fornitura', quota: 0.5 }, contesto);
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
    const l1 = riduci(l0, { tipo: 'imposta_quota', soggettoId: 's-medifarm', prestazioneId: 'fornitura', quota: 0.5 }, contesto);
    const l2 = riduci(l1, { tipo: 'prova_rimedio', mossa }, contesto);
    const l3 = riduci(l2, { tipo: 'imposta_quota', soggettoId: 's-medifarm', prestazioneId: 'fornitura', quota: 0.7 }, contesto);
    expect(composizionePrimaDellUltimaProva(l3)?.raggruppamento).toBe(l1.raggruppamento);
    expect(composizionePrimaDellUltimaProva(l1)).toBeUndefined();
  });
});

describe('riduci — lotto e data', () => {
  it('selezionare un lotto o cambiare la data non tocca la storia', () => {
    const l = iniziale();
    const dopo = riduci(riduci(l, { tipo: 'seleziona_lotto', lottoId: 'altro-lotto' }, contesto), { tipo: 'imposta_data', valore: '2023-12-20' }, contesto);
    expect(dopo).toMatchObject({ lottoId: 'altro-lotto', dataRiferimento: '2023-12-20', storia: [] });
    expect(riduci(l, { tipo: 'seleziona_lotto', lottoId: 'lotto-unico' }, contesto)).toBe(l);
  });
});
