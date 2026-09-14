import { describe, expect, it } from 'vitest';
import type { Lotto, ParametriValutazione, Rimedio } from '../domain';
import { ausiliaria, bando, certificazione, esecutore, fatturato, lotto, parametri, prestazione, raggruppamento, requisito, soggetto } from './prova';
import { applicaMossa, mosseCandidate, peggiora, rimediPerRequisito, type Mossa } from './rimedi';
import { valutazione } from './valutazione';

const ISO = { tipo: 'certificazione', norme: ['ISO 9001'] } as const;
const FATTURATO = { tipo: 'fatturato', ambito: { tipo: 'globale' }, periodo: { tipo: 'a_ritroso', esercizi: 3, ancoraggio: 'riferimento' }, soglia: 1_000_000 } as const;

/** Due prestazioni: Alfa esegue p-1, Beta p-2. ISO richiesta a chi esegue p-2. */
function scenario(extra: Partial<ParametriValutazione> = {}, lottoExtra: Partial<Lotto> = {}): { p: ParametriValutazione; l: Lotto } {
  const l = lotto({
    prestazioni: [prestazione('p-1'), prestazione('p-2')],
    requisiti: [requisito('r-iso', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' })],
    ...lottoExtra,
  });
  const p = parametri({
    bando: bando([l]),
    soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'x')]), soggetto('s-beta'), soggetto('s-x', [certificazione('ISO 9001', 'x')])],
    raggruppamento: raggruppamento([esecutore('s-alfa', 'mandataria', { 'p-1': 1 }), esecutore('s-beta', 'mandante', { 'p-2': 1 })]),
    ...extra,
  });
  return { p, l };
}

function tipi(mosse: Mossa[]): string[] {
  return mosse.map((m) => m.tipo);
}

describe('mosseCandidate', () => {
  it('genera le mosse nell’ordine di invasività: riassegnazione, uscita, ingresso, avvalimento', () => {
    const { p, l } = scenario({}, { requisiti: [requisito('r-iso', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' }, { avvalibile: true })] });
    const ordine = [...new Set(tipi(mosseCandidate(p, l, valutazione(p).esito)))];
    expect(ordine).toEqual(['riassegna_quota', 'uscita_soggetto', 'ingresso_soggetto', 'avvalimento']);
  });
  it('riassegna l’intera quota, in entrambe le direzioni, mai a sé stessi', () => {
    const { p, l } = scenario();
    const riassegnazioni = mosseCandidate(p, l, valutazione(p).esito).filter((m) => m.tipo === 'riassegna_quota');
    expect(riassegnazioni).toEqual([
      { tipo: 'riassegna_quota', prestazioneId: 'p-1', daSoggettoId: 's-alfa', aSoggettoId: 's-beta', quota: 1 },
      { tipo: 'riassegna_quota', prestazioneId: 'p-2', daSoggettoId: 's-beta', aSoggettoId: 's-alfa', quota: 1 },
    ]);
  });
  it('propone l’uscita solo dei membri che non sono mandataria', () => {
    const { p, l } = scenario();
    const uscite = mosseCandidate(p, l, valutazione(p).esito).filter((m) => m.tipo === 'uscita_soggetto');
    expect(uscite).toEqual([{ tipo: 'uscita_soggetto', soggettoId: 's-beta' }]);
  });
  it('propone l’ingresso dei soli non membri, a quote zero o rilevando una quota intera', () => {
    const { p, l } = scenario();
    const ingressi = mosseCandidate(p, l, valutazione(p).esito).filter((m) => m.tipo === 'ingresso_soggetto');
    expect(ingressi).toEqual([
      { tipo: 'ingresso_soggetto', soggettoId: 's-x', ruolo: 'mandante', quote: {} },
      { tipo: 'ingresso_soggetto', soggettoId: 's-x', ruolo: 'mandante', quote: { 'p-1': 1 }, rilevateDa: 's-alfa' },
      { tipo: 'ingresso_soggetto', soggettoId: 's-x', ruolo: 'mandante', quote: { 'p-2': 1 }, rilevateDa: 's-beta' },
    ]);
  });
  it('propone l’avvalimento solo su requisiti avvalibili non coperti, da chi copre davvero, a favore di chi manca', () => {
    const { p, l } = scenario(
      { soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'x')]), soggetto('s-beta'), soggetto('s-x', [certificazione('ISO 9001', 'x')]), soggetto('s-y')] },
      { requisiti: [requisito('r-iso', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' }, { avvalibile: true })] },
    );
    const avvalimenti = mosseCandidate(p, l, valutazione(p).esito).filter((m) => m.tipo === 'avvalimento');
    expect(avvalimenti).toEqual([{ tipo: 'avvalimento', requisitoId: 'r-iso', ausiliariaId: 's-x', ausiliataId: 's-beta' }]);
  });
  it('non propone avvalimenti su un requisito non avvalibile', () => {
    const { p, l } = scenario();
    expect(tipi(mosseCandidate(p, l, valutazione(p).esito))).not.toContain('avvalimento');
  });
  it('su una somma sotto soglia l’avvalimento va a favore della mandataria', () => {
    const { p, l } = scenario(
      { soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'x'), fatturato(2025, 'x', 1)]), soggetto('s-beta', [certificazione('ISO 9001', 'x')]), soggetto('s-x', [{ tipo: 'fatturato', esercizio: 2025, ambito: { tipo: 'globale' }, importo: { valore: 2_000_000, fonte: { documento: 'd', riferimento: 'r' } } }])] },
      { requisiti: [requisito('r-fat', FATTURATO, { tipo: 'somma_membri' }, { avvalibile: true })] },
    );
    const avvalimenti = mosseCandidate(p, l, valutazione(p).esito).filter((m) => m.tipo === 'avvalimento');
    expect(avvalimenti).toEqual([{ tipo: 'avvalimento', requisitoId: 'r-fat', ausiliariaId: 's-x', ausiliataId: 's-alfa' }]);
  });
  it('un’ausiliaria già presente può essere indicata per un altro requisito della stessa ausiliata', () => {
    const { p, l } = scenario(
      { raggruppamento: raggruppamento([esecutore('s-alfa', 'mandataria', { 'p-1': 1 }), esecutore('s-beta', 'mandante', { 'p-2': 1 }), ausiliaria('s-x', 's-beta', ['altro'])]) },
      { requisiti: [
        requisito('r-iso', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' }, { avvalibile: true }),
        requisito('altro', { tipo: 'dichiarazione', oggetto: 'x' }, { tipo: 'almeno_un_membro' }, { avvalibile: true }),
      ] },
    );
    const avvalimenti = mosseCandidate(p, l, valutazione(p).esito).filter((m) => m.tipo === 'avvalimento');
    expect(avvalimenti).toContainEqual({ tipo: 'avvalimento', requisitoId: 'r-iso', ausiliariaId: 's-x', ausiliataId: 's-beta' });
  });
});

describe('applicaMossa', () => {
  const base = raggruppamento([esecutore('s-alfa', 'mandataria', { 'p-1': 1, 'p-2': 0 }), esecutore('s-beta', 'mandante', { 'p-2': 1 }), ausiliaria('s-x', 's-beta', ['r-1'])]);

  it('non muta l’input', () => {
    const copia = JSON.stringify(base);
    applicaMossa(base, { tipo: 'riassegna_quota', prestazioneId: 'p-2', daSoggettoId: 's-beta', aSoggettoId: 's-alfa', quota: 1 });
    applicaMossa(base, { tipo: 'avvalimento', requisitoId: 'r-2', ausiliariaId: 's-x', ausiliataId: 's-beta' });
    expect(JSON.stringify(base)).toBe(copia);
  });
  it('riassegna la quota da un membro all’altro', () => {
    const dopo = applicaMossa(base, { tipo: 'riassegna_quota', prestazioneId: 'p-2', daSoggettoId: 's-beta', aSoggettoId: 's-alfa', quota: 1 });
    expect(dopo.membri[0]).toMatchObject({ soggettoId: 's-alfa', quote: { 'p-1': 1, 'p-2': 1 } });
    expect(dopo.membri[1]).toMatchObject({ soggettoId: 's-beta', quote: { 'p-2': 0 } });
  });
  it('l’uscita rimuove il membro e le sue ausiliarie', () => {
    const dopo = applicaMossa(base, { tipo: 'uscita_soggetto', soggettoId: 's-beta' });
    expect(dopo.membri.map((m) => m.soggettoId)).toEqual(['s-alfa']);
  });
  it('l’ingresso aggiunge il membro e sottrae le quote rilevate', () => {
    const dopo = applicaMossa(base, { tipo: 'ingresso_soggetto', soggettoId: 's-y', ruolo: 'mandante', quote: { 'p-2': 1 }, rilevateDa: 's-beta' });
    expect(dopo.membri[1]).toMatchObject({ soggettoId: 's-beta', quote: { 'p-2': 0 } });
    expect(dopo.membri[3]).toEqual({ ruolo: 'mandante', soggettoId: 's-y', quote: { 'p-2': 1 } });
  });
  it('l’avvalimento aggiunge un’ausiliaria nuova o estende quella esistente', () => {
    const estesa = applicaMossa(base, { tipo: 'avvalimento', requisitoId: 'r-2', ausiliariaId: 's-x', ausiliataId: 's-beta' });
    expect(estesa.membri[2]).toEqual({ ruolo: 'ausiliaria', soggettoId: 's-x', ausiliataId: 's-beta', requisitiIds: ['r-1', 'r-2'] });
    const nuova = applicaMossa(base, { tipo: 'avvalimento', requisitoId: 'r-2', ausiliariaId: 's-y', ausiliataId: 's-alfa' });
    expect(nuova.membri[3]).toEqual({ ruolo: 'ausiliaria', soggettoId: 's-y', ausiliataId: 's-alfa', requisitiIds: ['r-2'] });
  });
});

describe('rimediPerRequisito', () => {
  function rimediDi(p: ParametriValutazione, l: Lotto, requisitoId: string): Rimedio[] {
    const { esito, scaduti } = valutazione(p);
    return rimediPerRequisito(p, l, esito, scaduti).get(requisitoId) ?? [];
  }

  it('propone solo le mosse che, rivalutate, rendono coperto il requisito', () => {
    const { p, l } = scenario();
    const rimedi = rimediDi(p, l, 'r-iso');
    expect(rimedi).toEqual([
      { tipo: 'riassegna_quota', prestazioneId: 'p-2', daSoggettoId: 's-beta', aSoggettoId: 's-alfa', quota: 1 },
      { tipo: 'ingresso_soggetto', soggettoId: 's-x', ruolo: 'mandante', quote: { 'p-2': 1 }, rilevateDa: 's-beta' },
    ]);
  });
  it('scarta una mossa che copre il requisito ma ne scopre un altro', () => {
    const { p, l } = scenario(
      { soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'x')]), soggetto('s-beta', [certificazione('ISO 13485', 'x')]), soggetto('s-x', [certificazione('ISO 9001', 'x')])] },
      { requisiti: [
        requisito('r-iso', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' }),
        requisito('r-13485', { tipo: 'certificazione', norme: ['ISO 13485'] }, { tipo: 'almeno_un_membro' }),
      ] },
    );
    const rimedi = rimediDi(p, l, 'r-iso');
    // Riassegnare p-2 ad Alfa copre r-iso senza toccare r-13485; l'uscita di Beta lo scoprirebbe e non compare.
    expect(rimedi.map((r) => r.tipo)).toEqual(['riassegna_quota', 'ingresso_soggetto']);
  });
  it('non calcola rimedi per un requisito coperto', () => {
    const { p, l } = scenario({ soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'x')]), soggetto('s-beta', [certificazione('ISO 9001', 'x')]), soggetto('s-x')] });
    const { esito, scaduti } = valutazione(p);
    expect(rimediPerRequisito(p, l, esito, scaduti).has('r-iso')).toBe(false);
  });
  it('propone il rinnovo di un documento scaduto solo se, rinnovato, coprirebbe', () => {
    const { p, l } = scenario({ soggetti: [soggetto('s-alfa'), soggetto('s-beta', [certificazione('ISO 9001', 'x', '2026-04-30')]), soggetto('s-x')] });
    const rimedi = rimediDi(p, l, 'r-iso');
    expect(rimedi).toContainEqual({ tipo: 'rinnovo_documento', soggettoId: 's-beta', requisitoId: 'r-iso', fonte: expect.anything(), scadutoIl: '2026-04-30' });
  });
  it('non propone il rinnovo di un documento che, rinnovato, non coprirebbe', () => {
    const scoped = { tipo: 'certificazione', norme: ['ISO 9001'], scope: 'giusto' } as const;
    const { p, l } = scenario(
      { soggetti: [soggetto('s-alfa'), soggetto('s-beta', [certificazione('ISO 9001', 'sbagliato', '2026-04-30')]), soggetto('s-x')] },
      { requisiti: [requisito('r-iso', scoped, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' })] },
    );
    expect(rimediDi(p, l, 'r-iso').map((r) => r.tipo)).not.toContain('rinnovo_documento');
  });
  it('propone il profilo mancante quando nessuna mossa applicabile esiste, con il delta', () => {
    const { p, l } = scenario(
      { soggetti: [soggetto('s-alfa', [fatturato(2025, 'x', 1)]), soggetto('s-beta'), soggetto('s-x')] },
      { requisiti: [requisito('r-fat', FATTURATO, { tipo: 'somma_membri' })] },
    );
    expect(rimediDi(p, l, 'r-fat')).toEqual([{ tipo: 'profilo_mancante', requisitoId: 'r-fat', criterio: FATTURATO, mancante: 1_000_000 }]);
  });
  it('calcola i rimedi anche per un requisito da verificare', () => {
    const scoped = { tipo: 'certificazione', norme: ['ISO 9001'], scope: 'giusto' } as const;
    const { p, l } = scenario(
      { soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'giusto')]), soggetto('s-beta', [certificazione('ISO 9001', 'altro')]), soggetto('s-x')] },
      { requisiti: [requisito('r-iso', scoped, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' })] },
    );
    expect(valutazione(p).esito.requisiti[0]?.stato).toBe('da_verificare');
    expect(rimediDi(p, l, 'r-iso')).toContainEqual({ tipo: 'riassegna_quota', prestazioneId: 'p-2', daSoggettoId: 's-beta', aSoggettoId: 's-alfa', quota: 1 });
  });
});

describe('peggiora', () => {
  it('riconosce un requisito degradato o una nuova anomalia bloccante', () => {
    const { p } = scenario();
    const prima = valutazione(p).esito;
    const degradato = { ...prima, requisiti: prima.requisiti.map((r) => ({ ...r, stato: 'scoperto' as const })) };
    expect(peggiora({ ...prima, requisiti: prima.requisiti.map((r) => ({ ...r, stato: 'coperto' as const })) }, degradato)).toBe(true);
    expect(peggiora(prima, prima)).toBe(false);
  });
});
