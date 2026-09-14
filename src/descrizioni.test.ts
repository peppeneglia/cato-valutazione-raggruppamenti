import { describe, expect, it } from 'vitest';
import { bersaglioAnomalia, descriviCriterio, descriviIndeterminatezza, descriviMossa, descriviRimedio, eApplicabile, etichettaAssunzione, etichettaFamiglia, etichettaRuolo, etichettaStato, etichettaVerdetto, nomePrestazione, nomeRequisito, nomeSoggetto } from './descrizioni';
import { creaAnomalia } from './engine/validazione';
import { bando, soggetti } from './fixture';

const contesto = { bando, soggetti };

describe('nomi', () => {
  it('traduce gli id in nomi reali e lascia l’id se non esiste', () => {
    expect(nomeSoggetto('s-farmalazio', contesto)).toBe('Farmadistribuzione Laziale S.p.A.');
    expect(nomeSoggetto('s-ignoto', contesto)).toBe('s-ignoto');
    expect(nomePrestazione('fornitura', contesto)).toBe('Fornitura di farmaci, parafarmaci, dispositivi medici e altro, da grossista con consegna veloce');
    expect(nomeRequisito('registro-imprese', contesto)).toBe("Iscrizione nel registro delle imprese oppure nell'Albo delle Imprese Artigiane per attività pertinenti con quelle oggetto della procedura");
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
    expect(descriviMossa({ tipo: 'riassegna_quota', prestazioneId: 'fornitura', daSoggettoId: 's-ospedalia', aSoggettoId: 's-farmalazio', quota: 0.25 }, contesto))
      .toBe('Riassegna il 25 % di «Fornitura di farmaci, parafarmaci, dispositivi medici e altro, da grossista con consegna veloce» da Ospedalia Forniture S.r.l. a Farmadistribuzione Laziale S.p.A.');
  });
  it('ingresso a quote zero, con quote proprie, o rilevando', () => {
    expect(descriviMossa({ tipo: 'ingresso_soggetto', soggettoId: 's-grossfarma', ruolo: 'mandante', quote: {} }, contesto))
      .toBe('Ingresso di Grossfarma Centro-Sud S.p.A. come mandante, senza quote di esecuzione');
    expect(descriviMossa({ tipo: 'ingresso_soggetto', soggettoId: 's-grossfarma', ruolo: 'mandante', quote: { fornitura: 0.25 }, rilevateDa: 's-ospedalia' }, contesto))
      .toBe('Ingresso di Grossfarma Centro-Sud S.p.A. come mandante, rilevando 25 % di «Fornitura di farmaci, parafarmaci, dispositivi medici e altro, da grossista con consegna veloce» da Ospedalia Forniture S.r.l.');
  });
  it('avvalimento e uscita', () => {
    expect(descriviMossa({ tipo: 'avvalimento', requisitoId: 'fatturato-globale', ausiliariaId: 's-grossfarma', ausiliataId: 's-farmalazio' }, contesto))
      .toBe("Avvalimento di Grossfarma Centro-Sud S.p.A. a favore di Farmadistribuzione Laziale S.p.A. per «Fatturato globale almeno pari al valore stimato dell'appalto, maturato complessivamente nel triennio 2020/2021/2022»");
    expect(descriviMossa({ tipo: 'uscita_soggetto', soggettoId: 's-ospedalia' }, contesto)).toBe('Uscita di Ospedalia Forniture S.r.l. dal raggruppamento');
  });
});

describe('descriviRimedio', () => {
  it('descrive i rimedi non applicabili', () => {
    expect(descriviRimedio({ tipo: 'rinnovo_documento', soggettoId: 's-ospedalia', requisitoId: 'r', fonte: { documento: 'Fascicolo', riferimento: 'certificato ISO 9001' }, scadutoIl: '2026-04-30' }, contesto))
      .toBe('Rinnovo di «certificato ISO 9001» di Ospedalia Forniture S.r.l., scaduto il 30/04/2026');
    expect(descriviRimedio({ tipo: 'profilo_mancante', requisitoId: 'r', criterio: { tipo: 'certificazione', norme: ['ISO 9001'], scope: 'formazione' } }, contesto))
      .toBe('Nessun soggetto disponibile copre questo requisito: serve certificazione ISO 9001 con scope «formazione»');
  });
  it('distingue applicabili e non', () => {
    expect(eApplicabile({ tipo: 'uscita_soggetto', soggettoId: 's' })).toBe(true);
    expect(eApplicabile({ tipo: 'profilo_mancante', requisitoId: 'r', criterio: { tipo: 'dichiarazione', oggetto: 'x' } })).toBe(false);
  });
});

describe('descriviCriterio', () => {
  it('descrive ogni variante in parole con i numeri formattati', () => {
    expect(descriviCriterio({ tipo: 'fatturato', ambito: { tipo: 'specifico', settore: 'dispositivi' }, periodo: { tipo: 'a_ritroso', esercizi: 3, ancoraggio: 'riferimento' }, soglia: 3_000_000 }))
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

describe('descrizioni — il documento che non decide', () => {
  const contesto = { bando: { id: 'b', oggetto: 'o', stazioneAppaltante: 's', terminePresentazione: '2024-01-15', baseAsta: 1, valori: [], fonte: { documento: 'd', riferimento: 'r' }, lotti: [] }, soggetti: [{ id: 's-a', denominazione: 'Alfa', fascicolo: [] }] };

  it('la richiesta di chiarimenti dice il termine con l’ora e i quesiti', () => {
    expect(descriviRimedio({ tipo: 'richiesta_chiarimenti', requisitoId: 'r', quesiti: ['Chi lo possiede?'], termine: { data: '2023-12-27', ora: '12:00' }, decorso: false }, contesto))
      .toBe('Chiedi chiarimenti alla stazione appaltante entro le 12:00 del 27/12/2023: Chi lo possiede?');
  });
  it('a termine decorso lo dice, e l’ambiguità resta a rischio del concorrente', () => {
    expect(descriviRimedio({ tipo: 'richiesta_chiarimenti', requisitoId: 'r', quesiti: ['Chi lo possiede?'], termine: { data: '2023-12-27' }, decorso: true }, contesto))
      .toBe("Il termine per i chiarimenti (il 27/12/2023) è decorso: l'ambiguità resta a rischio del concorrente. Il quesito che andava posto: Chi lo possiede?");
    expect(eApplicabile({ tipo: 'richiesta_chiarimenti', requisitoId: 'r', quesiti: [], decorso: false })).toBe(false);
  });
  it('un criterio non determinato si descrive con le parole del documento', () => {
    expect(descriviCriterio({ tipo: 'non_determinato', testo: 'registri o albi se prescritti' })).toBe('«registri o albi se prescritti», che il disciplinare non determina');
    expect(descriviCriterio({ tipo: 'certificazione', norme: ['ISO 9001', 'ISO 13485'] })).toBe('certificazione ISO 9001 o ISO 13485');
    expect(descriviCriterio({ tipo: 'fatturato', ambito: { tipo: 'globale' }, periodo: { tipo: 'esercizi', anni: [2020, 2021, 2022] }, soglia: 750_000 })).toContain('negli esercizi 2020, 2021, 2022');
  });
  it('ogni indeterminatezza ha una frase per chi legge la riga', () => {
    expect(descriviIndeterminatezza({ tipo: 'regola_non_dichiarata' }, contesto)).toBe('Il disciplinare non dice chi debba possederlo nel raggruppamento.');
    expect(descriviIndeterminatezza({ tipo: 'giudizio_richiesto', soggettoId: 's-a', oggetto: 'equivalenza tra «x» e «y»', interpella: 'stazione_appaltante' }, contesto)).toBe('Per Alfa si chiede alla stazione appaltante: equivalenza tra «x» e «y».');
    expect(descriviIndeterminatezza({ tipo: 'giudizio_richiesto', soggettoId: 's-a', oggetto: 'analogia del CPV', interpella: 'concorrente' }, contesto)).toBe('Per Alfa decide il concorrente: analogia del CPV.');
    expect(descriviIndeterminatezza({ tipo: 'letture_discordanti', esiti: [{ etichetta: 'A', stato: 'coperto' }, { etichetta: 'B', stato: 'scoperto' }] }, contesto)).toBe('Il documento ammette più letture con esiti diversi: «A» coperto; «B» scoperto.');
  });
  it('le assunzioni nuove hanno un’etichetta', () => {
    expect(etichettaAssunzione('ancoraggio_termine_presentazione')).toBe('Finestra ancorata al termine di presentazione');
    expect(etichettaAssunzione('esito_concordante')).toBe('Esito valido con letture concordanti del documento');
  });
});
