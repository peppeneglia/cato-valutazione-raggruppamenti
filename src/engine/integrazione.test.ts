// Test di integrazione sui documenti veri: la gara reale ASL Roma 6.
// L'esito atteso è generato dal motore e fissato dopo lettura riga per
// riga: se il motore diverge, qui si scopre, e chi ha ragione va capito
// prima di riallineare (`npm run esito:atteso`). I fatti sotto sono
// verificati a mano sul disciplinare, indipendenti dall'esito generato.

import { describe, expect, it } from 'vitest';
import type { ParametriValutazione } from '../domain';
import type { Esito } from '../domain';
import { bando, DATA_RIFERIMENTO, raggruppamento, soggetti } from '../documenti/documentiDiProva';
import { ORIZZONTE_SCADENZE_GIORNI } from '../parametri';
import testoEsitoAtteso from './esito-atteso-asl-roma-6.json?raw';
import { valuta } from './index';

const esitoAtteso = JSON.parse(testoEsitoAtteso) as Esito;

function parametri(extra: Partial<ParametriValutazione> = {}): ParametriValutazione {
  return { bando, lottoId: 'lotto-unico', soggetti, raggruppamento, dataRiferimento: DATA_RIFERIMENTO, orizzonteScadenzeGiorni: ORIZZONTE_SCADENZE_GIORNI, ...extra };
}

describe('gara reale — esito completo', () => {
  it('il motore produce esattamente l’esito atteso sul lotto unico', () => {
    expect(valuta(parametri())).toEqual(esitoAtteso);
  });
  it('la gara è monolotto', () => {
    expect(bando.lotti.map((l) => l.id)).toEqual(['lotto-unico']);
  });
});

describe('gara reale — fatti verificati a mano sul disciplinare', () => {
  const esito = valuta(parametri());
  const requisito = (id: string) => {
    const r = esito.requisiti.find((x) => x.requisitoId === id);
    if (!r) throw new Error(`requisito ${id} assente`);
    return r;
  };

  it('ammissibile con riserva: nessuno scoperto, quattro requisiti su sei indeterminati dal documento', () => {
    expect(esito.verdetto).toBe('ammissibile_con_riserva');
    expect(esito.requisiti.map((r) => [r.requisitoId, r.stato])).toEqual([
      ['requisiti-generali', 'da_verificare'],
      ['registro-imprese', 'da_verificare'],
      ['registri-di-settore', 'da_verificare'],
      ['fatturato-globale', 'da_verificare'],
      ['certificazione-qualita', 'da_verificare'],
      ['forniture-analoghe', 'coperto'],
    ]);
    const conChiarimenti = esito.requisiti.filter((r) => r.rimedi.some((m) => m.tipo === 'richiesta_chiarimenti')).map((r) => r.requisitoId);
    expect(conChiarimenti).toEqual(['requisiti-generali', 'registro-imprese', 'registri-di-settore', 'fatturato-globale', 'certificazione-qualita']);
  });
  it('requisiti generali: tutti dichiarano, ma l’art. 5 non dice come si possiede nei RTI', () => {
    const r = requisito('requisiti-generali');
    expect(r.contributi.every((c) => c.conteggiato && c.valore.tipo === 'possesso' && c.valore.esito === 'posseduto')).toBe(true);
    expect(r.indeterminatezze).toEqual([{ tipo: 'regola_non_dichiarata' }]);
    expect(r.misurazione).toBeUndefined();
  });
  it('registro imprese: da ciascun componente; per Ospedalia la pertinenza dell’attività la scioglie la stazione appaltante, e il quesito la nomina', () => {
    const r = requisito('registro-imprese');
    expect(r.indeterminatezze.map((i) => i.tipo === 'giudizio_richiesto' && i.interpella)).toEqual(['stazione_appaltante']);
    const chiarimenti = r.rimedi.find((m) => m.tipo === 'richiesta_chiarimenti');
    expect(chiarimenti?.tipo === 'richiesta_chiarimenti' && chiarimenti.quesiti[0]).toMatch(/^L'attività «commercio all'ingrosso di articoli medicali e ortopedici» dell'iscrizione Registro delle imprese è pertinente rispetto a «attività pertinenti con quelle oggetto della presente procedura di gara» ai fini del requisito «Iscrizione nel registro delle imprese/);
  });
  it('registri di settore: criterio non determinato e regola non dichiarata, nessun contributo, due quesiti', () => {
    const r = requisito('registri-di-settore');
    expect(r.contributi).toEqual([]);
    expect(r.indeterminatezze.map((i) => i.tipo)).toEqual(['criterio_non_determinato', 'regola_non_dichiarata']);
    const chiarimenti = r.rimedi.find((m) => m.tipo === 'richiesta_chiarimenti');
    expect(chiarimenti?.tipo === 'richiesta_chiarimenti' && chiarimenti.quesiti).toHaveLength(2);
  });
  it('fatturato: 990.000 € sopra due candidati e sotto il terzo; si mostra la lettura peggiore', () => {
    const r = requisito('fatturato-globale');
    expect(r.misurazione).toMatchObject({ soglia: 1_025_000, raggiunto: 990_000, delta: 35_000, minimiRuolo: [] });
    expect(r.varianti?.map((v) => v.stato)).toEqual(['coperto', 'coperto', 'scoperto']);
    expect(r.indeterminatezze.map((i) => i.tipo)).toEqual(['valore_contraddittorio']);
  });
  it('fatturato: Grossfarma, per ingresso o avvalimento, porta la somma sopra tutti e tre i candidati; le varianti di quota sono una mossa sola', () => {
    expect(requisito('fatturato-globale').rimedi.map((m) => m.tipo)).toEqual(['ingresso_soggetto', 'avvalimento', 'richiesta_chiarimenti']);
  });
  it('ISO: le due famiglie di indeterminatezza sulla stessa riga, con i contributi visibili', () => {
    const r = requisito('certificazione-qualita');
    expect(r.contributi.map((c) => [c.soggettoId, c.valore.tipo === 'possesso' && c.valore.esito])).toEqual([
      ['s-farmalazio', 'posseduto'],
      ['s-ospedalia', 'da_verificare'],
      ['s-medifarm', 'assente'],
    ]);
    expect(r.indeterminatezze.map((i) => i.tipo)).toEqual(['regola_non_dichiarata', 'giudizio_richiesto']);
  });
  it('forniture analoghe: il contratto da 800.000 € copre sotto entrambe le letture, con le due assunzioni', () => {
    const r = requisito('forniture-analoghe');
    expect(r.stato).toBe('coperto');
    expect(r.indeterminatezze).toEqual([]);
    expect(r.assunzioni.map((a) => a.codice)).toEqual(['ancoraggio_termine_presentazione', 'esito_concordante']);
    expect(r.varianti?.map((v) => v.stato)).toEqual(['coperto', 'coperto']);
  });
  it('le assunzioni del motore stanno solo sulle forniture analoghe', () => {
    expect(esito.requisiti.filter((r) => r.assunzioni.length > 0).map((r) => r.requisitoId)).toEqual(['forniture-analoghe']);
  });
  it('alla data di riferimento i chiarimenti si possono ancora chiedere; dall’08/01/2024 il termine è decorso', () => {
    const decorsi = (e: typeof esito) => e.requisiti.flatMap((r) => r.rimedi).filter((m) => m.tipo === 'richiesta_chiarimenti').map((m) => m.tipo === 'richiesta_chiarimenti' && m.decorso);
    expect(decorsi(esito)).toEqual([false, false, false, false, false]);
    const dopo = valuta(parametri({ dataRiferimento: '2024-01-08' }));
    expect(decorsi(dopo)).toEqual([true, true, true, true, true]);
    expect(dopo.verdetto).toBe('ammissibile_con_riserva');
  });
  it('percorso: il massimo raggiungibile è già raggiunto, e le mosse sul fatturato sono dichiarate come miglioramenti', () => {
    expect(esito.percorsoMinimo).toMatchObject({
      esito: 'gia_ammissibile',
      verdetto: 'ammissibile_con_riserva',
      residui: ['requisiti-generali', 'registro-imprese', 'registri-di-settore', 'fatturato-globale', 'certificazione-qualita'],
    });
    if (esito.percorsoMinimo.esito !== 'gia_ammissibile') throw new Error('atteso gia_ammissibile');
    expect(esito.percorsoMinimo.miglioramenti.every((m) => m.requisitiRisolti.length === 1 && m.requisitiRisolti[0] === 'fatturato-globale')).toBe(true);
    expect(esito.percorsoMinimo.miglioramenti.map((m) => m.mossa.tipo)).toContain('avvalimento');
  });
  it('la ISO 9001 di Farmadistribuzione entra nell’orizzonte dei 90 giorni solo dopo l’inizio di gennaio', () => {
    expect(esito.avvisiScadenza).toEqual([]);
    const dopo = valuta(parametri({ dataRiferimento: '2024-01-08' }));
    expect(dopo.avvisiScadenza).toEqual([expect.objectContaining({ soggettoId: 's-farmalazio', scadeIl: '2024-03-31', primaDelTermine: false, entroOrizzonte: true, requisitiIds: ['certificazione-qualita'] })]);
  });
  it('nessuna anomalia: la data di pubblicazione assente non lo è, finché nessun criterio la chiede', () => {
    expect(esito.anomalie).toEqual([]);
    expect(bando.dataPubblicazione).toBeUndefined();
  });
});
