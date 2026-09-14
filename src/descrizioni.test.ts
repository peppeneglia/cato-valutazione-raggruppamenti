import { describe, expect, it } from 'vitest';
import { bersaglioAnomalia, descriviCriterio, descriviMossa, descriviRimedio, eApplicabile, etichettaAssunzione, etichettaFamiglia, etichettaRuolo, etichettaStato, etichettaVerdetto, nomePrestazione, nomeRequisito, nomeSoggetto } from './descrizioni';
import { creaAnomalia } from './engine/validazione';
import { bando, soggetti } from './fixture';

const contesto = { bando, soggetti };

describe('nomi', () => {
  it('traduce gli id in nomi reali e lascia l’id se non esiste', () => {
    expect(nomeSoggetto('s-alfa', contesto)).toBe('Alfa Medical S.p.A.');
    expect(nomeSoggetto('s-ignoto', contesto)).toBe('s-ignoto');
    expect(nomePrestazione('l1-manutenzione', contesto)).toBe('Manutenzione e assistenza tecnica');
    expect(nomeRequisito('l1-referenze', contesto)).toBe('Tre forniture analoghe nel quinquennio antecedente la pubblicazione');
  });
});

describe('etichette', () => {
  it('sono testo, non colore', () => {
    expect(etichettaStato('da_verificare')).toBe('Da verificare');
    expect(etichettaVerdetto('ammissibile_con_riserva')).toBe('Ammissibile con riserva');
    expect(etichettaRuolo('consorziata_esecutrice')).toBe('Consorziata esecutrice');
    expect(etichettaFamiglia('economico')).toBe('Capacità economico-finanziaria');
    expect(etichettaAssunzione('classe_cpv')).toBe('Esclusione dei servizi per classe CPV');
  });
});

describe('descriviMossa', () => {
  it('riassegnazione con percentuale e nomi', () => {
    expect(descriviMossa({ tipo: 'riassegna_quota', prestazioneId: 'l1-manutenzione', daSoggettoId: 's-beta', aSoggettoId: 's-alfa', quota: 1 }, contesto))
      .toBe('Riassegna il 100 % di «Manutenzione e assistenza tecnica» da Beta Service S.r.l. a Alfa Medical S.p.A.');
  });
  it('ingresso a quote zero, con quote proprie, o rilevando', () => {
    expect(descriviMossa({ tipo: 'ingresso_soggetto', soggettoId: 's-delta', ruolo: 'mandante', quote: {} }, contesto))
      .toBe('Ingresso di Delta Tecnica S.r.l. come mandante, senza quote di esecuzione');
    expect(descriviMossa({ tipo: 'ingresso_soggetto', soggettoId: 's-delta', ruolo: 'mandante', quote: { 'l1-manutenzione': 1 }, rilevateDa: 's-beta' }, contesto))
      .toBe('Ingresso di Delta Tecnica S.r.l. come mandante, rilevando 100 % di «Manutenzione e assistenza tecnica» da Beta Service S.r.l.');
  });
  it('avvalimento e uscita', () => {
    expect(descriviMossa({ tipo: 'avvalimento', requisitoId: 'l1-referenze', ausiliariaId: 's-epsilon', ausiliataId: 's-alfa' }, contesto))
      .toBe('Avvalimento di Epsilon Hospital Supply S.r.l. a favore di Alfa Medical S.p.A. per «Tre forniture analoghe nel quinquennio antecedente la pubblicazione»');
    expect(descriviMossa({ tipo: 'uscita_soggetto', soggettoId: 's-beta' }, contesto)).toBe('Uscita di Beta Service S.r.l. dal raggruppamento');
  });
});

describe('descriviRimedio', () => {
  it('descrive i rimedi non applicabili', () => {
    expect(descriviRimedio({ tipo: 'rinnovo_documento', soggettoId: 's-beta', requisitoId: 'r', fonte: { documento: 'Fascicolo', riferimento: 'certificato ISO 9001' }, scadutoIl: '2026-04-30' }, contesto))
      .toBe('Rinnovo di «certificato ISO 9001» di Beta Service S.r.l., scaduto il 30/04/2026');
    expect(descriviRimedio({ tipo: 'profilo_mancante', requisitoId: 'r', criterio: { tipo: 'certificazione', norma: 'ISO 9001', scope: 'formazione' } }, contesto))
      .toBe('Nessun soggetto disponibile copre questo requisito: serve certificazione ISO 9001 con scope «formazione»');
  });
  it('distingue applicabili e non', () => {
    expect(eApplicabile({ tipo: 'uscita_soggetto', soggettoId: 's' })).toBe(true);
    expect(eApplicabile({ tipo: 'profilo_mancante', requisitoId: 'r', criterio: { tipo: 'dichiarazione', oggetto: 'x' } })).toBe(false);
  });
});

describe('descriviCriterio', () => {
  it('descrive ogni variante in parole con i numeri formattati', () => {
    expect(descriviCriterio({ tipo: 'fatturato', ambito: { tipo: 'specifico', settore: 'dispositivi' }, esercizi: 3, ancoraggio: 'riferimento', soglia: 3_000_000 }))
      .toBe('fatturato nel settore «dispositivi» di almeno 3.000.000 € negli ultimi 3 esercizi');
    expect(descriviCriterio({ tipo: 'servizi', cpv: '33100000', anni: 5, ancoraggio: 'riferimento', numeroMinimo: 1, importoMinimoUnitario: 300_000, sostantivo: { singolare: 'fornitura', plurale: 'forniture' } }))
      .toBe('almeno 1 fornitura con CPV 33100000 negli ultimi 5 anni, ciascuna da almeno 300.000 €');
    expect(descriviCriterio({ tipo: 'servizi_importo', cpv: '33192000', anni: 5, ancoraggio: 'riferimento', soglia: 800_000 }))
      .toBe('servizi con CPV 33192000 negli ultimi 5 anni per almeno 800.000 € complessivi');
    expect(descriviCriterio({ tipo: 'iscrizione', registro: 'CCIAA', attivita: 'commercio' })).toBe('iscrizione CCIAA per «commercio»');
    expect(descriviCriterio({ tipo: 'dichiarazione', oggetto: 'x' })).toBe('dichiarazione «x»');
  });
});

describe('bersaglioAnomalia', () => {
  it('indica l’oggetto in pagina che causa l’anomalia', () => {
    expect(bersaglioAnomalia(creaAnomalia({ codice: 'quote_non_totali', prestazioneId: 'p', totale: 0.5 }))).toEqual({ tipo: 'prestazione', id: 'p' });
    expect(bersaglioAnomalia(creaAnomalia({ codice: 'membro_senza_quote', soggettoId: 's', lottoId: 'l' }))).toEqual({ tipo: 'membro', id: 's' });
    expect(bersaglioAnomalia(creaAnomalia({ codice: 'parametro_requisito_non_valido', requisitoId: 'r', parametro: 'x', valore: 0 }))).toEqual({ tipo: 'requisito', id: 'r' });
    expect(bersaglioAnomalia(creaAnomalia({ codice: 'mandataria_assente' }))).toBeUndefined();
  });
});
