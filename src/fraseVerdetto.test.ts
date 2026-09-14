// La frase del verdetto: tre forme di pari rango, una per caso, più le
// anomalie bloccanti e il calcolo in corso. Funzione pura, senza JSX.

import { describe, expect, it } from 'vitest';
import type { EsitoRequisito, Indeterminatezza, PercorsoMinimo } from './domain';
import { fraseMossa, fraseVerdetto, inParole, nomeParlato } from './descrizioni';
import { richiedeChiarimenti } from './engine/rimedi';
import { bando, lotto, prestazione, requisito, soggetto } from './engine/prova';

const CONTRATTO = { tipo: 'dichiarazione', oggetto: 'x' } as const;
const L = lotto({
  prestazioni: [prestazione('p-1', { natura: 'indivisibile' })],
  requisiti: [
    requisito('r-gen', CONTRATTO, { tipo: 'non_dichiarata' }, { nomeBreve: 'Requisiti generali' }),
    requisito('r-fatt', CONTRATTO, { tipo: 'somma_membri' }, { nomeBreve: 'Fatturato globale' }),
    requisito('r-iso', CONTRATTO, { tipo: 'ciascun_membro' }, { nomeBreve: 'Certificazione ISO' }),
  ],
});
const B = bando([L], { termineChiarimenti: { data: '2023-12-27', ora: '12:00', fonte: { documento: 'd', riferimento: 'art. 2.2' } } });
const contesto = {
  bando: B,
  soggetti: [soggetto('s-a'), { id: 's-x', denominazione: 'Grossfarma Centro-Sud S.p.A.', fascicolo: [] }, { id: 's-b', denominazione: 'Ospedalia Forniture S.r.l.', fascicolo: [] }],
};

function esitoReq(requisitoId: string, stato: EsitoRequisito['stato'], indeterminatezze: Indeterminatezza[] = []): EsitoRequisito {
  return { requisitoId, stato, contributi: [], motivazione: '', assunzioni: [], indeterminatezze, rimedi: [] };
}

const GIA_CON_RISERVA: PercorsoMinimo = { esito: 'gia_ammissibile', verdetto: 'ammissibile_con_riserva', residui: ['r-gen', 'r-fatt'], miglioramenti: [] };

function frase(over: Partial<Parameters<typeof fraseVerdetto>[0]> = {}) {
  return fraseVerdetto({
    bando: B,
    lottoId: L.id,
    esito: {
      verdetto: 'ammissibile_con_riserva',
      requisiti: [
        esitoReq('r-gen', 'da_verificare', [{ tipo: 'regola_non_dichiarata' }]),
        esitoReq('r-fatt', 'da_verificare', [{ tipo: 'valore_contraddittorio', nome: 'v', esiti: [] }]),
        esitoReq('r-iso', 'coperto'),
      ],
      anomalie: [],
    },
    percorso: GIA_CON_RISERVA,
    dataRiferimento: '2023-12-20',
    contesto,
    richiedeChiarimenti,
    ...over,
  });
}

describe('inParole e nomeParlato', () => {
  it('scrive i numeri piccoli e lascia gli altri in cifre', () => {
    expect(inParole(5)).toBe('cinque');
    expect(inParole(1, true)).toBe('una');
    expect(inParole(12)).toBe('12');
  });
  it('toglie la forma giuridica, solo in coda', () => {
    expect(nomeParlato('s-x', contesto)).toBe('Grossfarma Centro-Sud');
    expect(nomeParlato('s-b', contesto)).toBe('Ospedalia Forniture');
    expect(nomeParlato('s-a', contesto)).toBe('Soggetto s-a');
  });
});

describe('fraseMossa', () => {
  it('ingresso: su un lotto con una prestazione sola non la nomina', () => {
    expect(fraseMossa({ tipo: 'ingresso_soggetto', soggettoId: 's-x', ruolo: 'mandante', quote: { 'p-1': 0.6 }, rilevateDa: 's-b' }, contesto)).toBe('far entrare Grossfarma Centro-Sud al posto di Ospedalia Forniture');
    expect(fraseMossa({ tipo: 'ingresso_soggetto', soggettoId: 's-x', ruolo: 'mandante', quote: {} }, contesto)).toBe('far entrare Grossfarma Centro-Sud senza quote di esecuzione');
  });
  it('avvalimento, uscita, riassegnazione', () => {
    expect(fraseMossa({ tipo: 'avvalimento', requisitoId: 'r-fatt', ausiliariaId: 's-x', ausiliataId: 's-b' }, contesto)).toBe("l'avvalimento di Grossfarma Centro-Sud a favore di Ospedalia Forniture su «Fatturato globale»");
    expect(fraseMossa({ tipo: 'uscita_soggetto', soggettoId: 's-b' }, contesto)).toBe('far uscire Ospedalia Forniture');
    expect(fraseMossa({ tipo: 'riassegna_quota', prestazioneId: 'p-1', daSoggettoId: 's-b', aSoggettoId: 's-x', quota: 0.25 }, contesto)).toMatch(/^spostare il 25.% da Ospedalia Forniture a Grossfarma Centro-Sud$/);
  });
});

describe('fraseVerdetto — le tre forme', () => {
  it('stato e situazione in parole, senza il lotto quando è unico', () => {
    const f = frase();
    expect(f.stato).toBe('Ammissibile con riserva');
    expect(f.lotto).toBeUndefined();
    expect(f.situazione).toBe('Due requisiti su tre restano da verificare: su uno il disciplinare non dice chi debba possederlo nel raggruppamento, su uno il documento ammette più letture.');
  });
  it('nessuna mossa, termine aperto: la scadenza è la cosa da fare', () => {
    const f = frase();
    expect(f.scadenza).toEqual({ testo: 'Hai tempo fino alle 12:00 del 27/12/2023 per chiedere chiarimenti su due requisiti.', decorsa: false });
    expect(f.azione).toBeUndefined();
    expect(f.mosse).toEqual([]);
  });
  it('termine decorso: si dice, e l’ambiguità resta a rischio del concorrente', () => {
    const f = frase({ dataRiferimento: '2024-01-08' });
    expect(f.scadenza).toEqual({ testo: 'Il termine per i chiarimenti è decorso il 27/12/2023: le ambiguità restano a rischio del concorrente.', decorsa: true });
  });
  it('esiste una mossa: la frase la porta con il verdetto raggiunto, e i residui in forma breve', () => {
    const f = frase({
      esito: { verdetto: 'non_ammissibile', requisiti: [esitoReq('r-gen', 'da_verificare', [{ tipo: 'regola_non_dichiarata' }]), esitoReq('r-fatt', 'scoperto'), esitoReq('r-iso', 'coperto')], anomalie: [] },
      percorso: { esito: 'trovato', mosse: [{ tipo: 'avvalimento', requisitoId: 'r-fatt', ausiliariaId: 's-x', ausiliataId: 's-b' }], verdettoRaggiunto: 'ammissibile_con_riserva', residui: ['r-gen'], segnalazioni: 0 },
    });
    expect(f.stato).toBe('Non ammissibile');
    expect(f.situazione).toBe('Un requisito su tre è scoperto. Un requisito su tre resta da verificare: su uno il disciplinare non dice chi debba possederlo nel raggruppamento.');
    expect(f.azione).toBe('Una mossa ti porta ad ammissibile con riserva:');
    expect(f.mosse.map((m) => m.testo)).toEqual(["L'avvalimento di Grossfarma Centro-Sud a favore di Ospedalia Forniture su «Fatturato globale»"]);
    expect(f.residui).toBe('Resta da verificare a mano: «Requisiti generali».');
  });
  it('verdetto massimo già raggiunto ma una mossa toglie un’incertezza: lo dice', () => {
    const f = frase({ percorso: { ...GIA_CON_RISERVA, miglioramenti: [{ mossa: { tipo: 'avvalimento', requisitoId: 'r-fatt', ausiliariaId: 's-x', ausiliataId: 's-b' }, requisitiRisolti: ['r-fatt'] }] } });
    expect(f.azione).toBe("Una mossa toglierebbe anche l'incertezza su «Fatturato globale»:");
    expect(f.mosse).toHaveLength(1);
  });
  it('nessun percorso: lo dice e nomina gli scoperti', () => {
    const f = frase({ esito: { verdetto: 'non_ammissibile', requisiti: [esitoReq('r-fatt', 'scoperto')], anomalie: [] }, percorso: { esito: 'inesistente', restanoScoperti: ['r-fatt'] } });
    expect(f.azione).toBe('Nessuna mossa con i soggetti disponibili ti porta dentro. Restano scoperti: «Fatturato globale».');
  });
  it('anomalie bloccanti: prima si sistemano i dati, e il resto tace', () => {
    const f = frase({ esito: { verdetto: 'non_ammissibile', requisiti: [], anomalie: [{ codice: 'mandataria_assente', gravita: 'bloccante', messaggio: 'Il raggruppamento non ha una mandataria.' }] } });
    expect(f.situazione).toBe('Prima sistema i dati: 1 anomalia bloccante.');
    expect(f.bloccanti).toEqual(['Il raggruppamento non ha una mandataria.']);
    expect(f.scadenza).toBeUndefined();
  });
  it('in calcolo: la situazione e la scadenza ci sono già, la mossa no', () => {
    const f = frase({ percorso: 'in_calcolo' });
    expect(f.inCalcolo).toBe(true);
    expect(f.situazione).toBeDefined();
    expect(f.scadenza).toBeDefined();
    expect(f.azione).toBeUndefined();
  });
  it('con più lotti il verdetto nomina il lotto per posizione', () => {
    const B2 = bando([L, lotto({ id: 'l-2' })]);
    const f = fraseVerdetto({ bando: B2, lottoId: 'l-2', esito: { verdetto: 'ammissibile', requisiti: [], anomalie: [] }, percorso: { esito: 'gia_ammissibile', verdetto: 'ammissibile', residui: [], miglioramenti: [] }, dataRiferimento: '2023-12-20', contesto: { ...contesto, bando: B2 }, richiedeChiarimenti });
    expect(f.lotto).toBe('sul Lotto 2');
    expect(f.situazione).toBeUndefined();
  });
});
