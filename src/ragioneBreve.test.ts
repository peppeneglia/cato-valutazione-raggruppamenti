// La frase in riga: al massimo quindici parole, dai dati, mai un troncamento.

import { describe, expect, it } from 'vitest';
import type { EsitoRequisito, Indeterminatezza } from './domain';
import { azioneRichiesta, quantoManca, ragioneBreve } from './descrizioni';
import { richiedeChiarimenti } from './engine/rimedi';
import { bando, lotto, requisito, soggetto } from './engine/prova';

const CRITERIO = { tipo: 'dichiarazione', oggetto: 'x' } as const;
const contesto = {
  bando: bando([lotto()]),
  soggetti: [{ id: 's-a', denominazione: 'Alfa Medical S.p.A.', fascicolo: [] }, { id: 's-b', denominazione: 'Beta Service S.r.l.', fascicolo: [] }],
};

function esito(stato: EsitoRequisito['stato'], extra: Partial<EsitoRequisito> = {}): EsitoRequisito {
  return { requisitoId: 'r', stato, contributi: [], motivazione: '', assunzioni: [], indeterminatezze: [], rimedi: [], ...extra };
}

function parole(testo: string | undefined): number {
  return (testo ?? '').split(/\s+/).filter(Boolean).length;
}

describe('ragioneBreve', () => {
  it('coperto: nessuna ragione', () => {
    expect(ragioneBreve(esito('coperto'), requisito('r', CRITERIO, { tipo: 'ciascun_membro' }), contesto)).toBeUndefined();
  });
  it('le indeterminatezze del documento vengono prima di tutto, nell’ordine di gravità', () => {
    const nonDeterminato = requisito('r', CRITERIO, { tipo: 'non_dichiarata' });
    expect(ragioneBreve(esito('da_verificare', { indeterminatezze: [{ tipo: 'regola_non_dichiarata' }, { tipo: 'criterio_non_determinato', testo: 'x' }] }), nonDeterminato, contesto)).toBe("Il disciplinare non nomina il registro, l'albo o il documento richiesto.");
    const r = requisito('r', CRITERIO, { tipo: 'non_dichiarata' });
    const entrambe: Indeterminatezza[] = [{ tipo: 'regola_non_dichiarata' }, { tipo: 'giudizio_richiesto', soggettoId: 's-b', oggetto: 'equivalenza tra «a» e «b» (certificazione ISO 9001)', interpella: 'stazione_appaltante' }];
    expect(ragioneBreve(esito('da_verificare', { indeterminatezze: entrambe }), r, contesto)).toBe('Il disciplinare non dice chi debba possederlo nel raggruppamento.');
    expect(ragioneBreve(esito('da_verificare', { indeterminatezze: [{ tipo: 'criterio_non_determinato', testo: 'x' }] }), r, contesto)).toBe("Il disciplinare non nomina il registro, l'albo o il documento richiesto.");
  });
  it('valore contraddittorio e letture discordanti dicono cosa succede sotto ciascuna, in parole', () => {
    const r = requisito('r', CRITERIO, { tipo: 'somma_membri' });
    const valore: Indeterminatezza = { tipo: 'valore_contraddittorio', nome: 'valore stimato', esiti: [{ etichetta: 'a', stato: 'coperto' }, { etichetta: 'b', stato: 'coperto' }, { etichetta: 'c', stato: 'scoperto' }] };
    expect(ragioneBreve(esito('da_verificare', { indeterminatezze: [valore] }), r, contesto)).toBe('Il bando dà tre valori: coperto con due, scoperto con uno.');
    const letture: Indeterminatezza = { tipo: 'letture_discordanti', esiti: [{ etichetta: 'a', stato: 'scoperto' }, { etichetta: 'b', stato: 'coperto' }] };
    expect(ragioneBreve(esito('da_verificare', { indeterminatezze: [letture] }), r, contesto)).toBe('Il documento ammette due letture: coperto con una, scoperto con una.');
  });
  it('un giudizio dice per chi e cosa non coincide, senza la forma giuridica', () => {
    const r = requisito('r', CRITERIO, { tipo: 'ciascun_membro' });
    const scope: Indeterminatezza = { tipo: 'giudizio_richiesto', soggettoId: 's-b', oggetto: 'equivalenza tra «a» e «b» (certificazione ISO 9001)', interpella: 'stazione_appaltante' };
    expect(ragioneBreve(esito('da_verificare', { indeterminatezze: [scope] }), r, contesto)).toBe('Per Beta Service lo scope della certificazione non coincide con il settore richiesto.');
    const attivita: Indeterminatezza = { tipo: 'giudizio_richiesto', soggettoId: 's-b', oggetto: 'equivalenza tra «a» e «b» (iscrizione CCIAA)', interpella: 'stazione_appaltante' };
    expect(ragioneBreve(esito('da_verificare', { indeterminatezze: [attivita] }), r, contesto)).toBe("Per Beta Service l'attività iscritta non coincide con quella richiesta.");
    const cpv: Indeterminatezza = { tipo: 'giudizio_richiesto', soggettoId: 's-a', oggetto: 'analogia del CPV 1 con 2 per «x»', interpella: 'concorrente' };
    expect(ragioneBreve(esito('da_verificare', { indeterminatezze: [cpv] }), r, contesto)).toBe('Per Alfa Medical il CPV della fornitura non coincide con quello di gara.');
  });
  it('scoperto per somma, per ciascuno con un documento scaduto, per almeno uno', () => {
    const somma = requisito('r', CRITERIO, { tipo: 'somma_membri' });
    expect(ragioneBreve(esito('scoperto', { misurazione: { unita: { tipo: 'euro' }, soglia: 3, raggiunto: 2, massimo: 2, delta: 1, minimiRuolo: [] } }), somma, contesto)).toBe('La somma dei membri non raggiunge la soglia.');
    const ciascuno = requisito('r', CRITERIO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-1' });
    const scaduto = esito('scoperto', { contributi: [{ soggettoId: 's-b', valore: { tipo: 'possesso', esito: 'assente' }, conteggiato: true, fonti: [], nota: 'certificazione ISO 9001 — x: scaduto il 30/04/2026' }] });
    expect(ragioneBreve(scaduto, ciascuno, contesto)).toBe('Manca a Beta Service: il documento è scaduto il 30/04/2026.');
    const almeno = requisito('r', CRITERIO, { tipo: 'almeno_un_membro' });
    expect(ragioneBreve(esito('scoperto'), almeno, contesto)).toBe('Nessun membro lo possiede.');
  });
  it('mai più di quindici parole', () => {
    const r = requisito('r', CRITERIO, { tipo: 'somma_membri' });
    const casi: Indeterminatezza[][] = [
      [{ tipo: 'regola_non_dichiarata' }],
      [{ tipo: 'criterio_non_determinato', testo: 'x' }],
      [{ tipo: 'valore_contraddittorio', nome: "valore stimato dell'appalto", esiti: [{ etichetta: 'a', stato: 'coperto' }, { etichetta: 'b', stato: 'da_verificare' }, { etichetta: 'c', stato: 'scoperto' }] }],
      [{ tipo: 'giudizio_richiesto', soggettoId: 's-b', oggetto: 'equivalenza tra «a» e «b» (certificazione ISO 9001)', interpella: 'stazione_appaltante' }],
    ];
    for (const indeterminatezze of casi) {
      expect(parole(ragioneBreve(esito('da_verificare', { indeterminatezze }), r, contesto))).toBeLessThanOrEqual(15);
    }
  });
});

describe('quantoManca e azioneRichiesta', () => {
  it('dice il delta nell’unità, chi manca, o da verificare', () => {
    expect(quantoManca(esito('coperto'), contesto)).toBe('');
    expect(quantoManca(esito('scoperto', { misurazione: { unita: { tipo: 'euro' }, soglia: 3, raggiunto: 2, massimo: 2, delta: 100_000, minimiRuolo: [] } }), contesto)).toMatch(/^mancano 100\.000.€$/);
    expect(quantoManca(esito('scoperto', { misurazione: { unita: { tipo: 'conteggio', sostantivo: { singolare: 'fornitura', plurale: 'forniture' } }, soglia: 3, raggiunto: 2, massimo: 2, delta: 1, minimiRuolo: [] } }), contesto)).toBe('manca 1 fornitura');
    expect(quantoManca(esito('scoperto', { contributi: [{ soggettoId: 's-b', valore: { tipo: 'possesso', esito: 'assente' }, conteggiato: true, fonti: [] }] }), contesto)).toBe('manca a Beta Service');
    expect(quantoManca(esito('da_verificare'), contesto)).toBe('');
    expect(quantoManca(esito('da_verificare', { misurazione: { unita: { tipo: 'euro' }, soglia: 3, raggiunto: 2, massimo: 2, delta: 35_000, minimiRuolo: [] } }), contesto)).toMatch(/^mancano fino a 35\.000.€$/);
  });
  it('chiarimenti se la stazione appaltante può rispondere, da valutare altrimenti', () => {
    expect(azioneRichiesta(esito('da_verificare', { indeterminatezze: [{ tipo: 'regola_non_dichiarata' }] }), richiedeChiarimenti)).toBe('chiarimenti');
    expect(azioneRichiesta(esito('da_verificare', { indeterminatezze: [{ tipo: 'giudizio_richiesto', soggettoId: 's-a', oggetto: 'analogia del CPV', interpella: 'concorrente' }] }), richiedeChiarimenti)).toBe('da valutare');
    expect(azioneRichiesta(esito('scoperto'), richiedeChiarimenti)).toBeUndefined();
  });
});

void soggetto;
