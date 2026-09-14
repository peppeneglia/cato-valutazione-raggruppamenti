// Fixture di lavoro — gara ASL multi-lotto, forniture medico-sanitarie.
//
// I valori sono inventati e vanno sostituiti con un disciplinare reale.
// I riferimenti agli articoli sono placeholder espliciti: non inventare
// numeri di articolo. La FORMA invece è quella che il motore e la UI
// devono saper trattare.
//
// Cosa dimostra:
// - Lotto 1 (dispositivi): NON ammissibile. ISO 9001 di Beta scaduta,
//   fatturato sotto soglia di 100.000 €, referenze con CPV divergente
//   (da verificare), scope di Gamma divergente (da verificare), vincolo di
//   esecuzione della prestazione principale dichiarato e rispettato.
//   Il percorso minimo richiede due mosse.
// - Lotto 2 (arredi): ammissibile, con un avviso: la ISO 9001 di Alfa
//   scade entro l'orizzonte. La ISO 13485 di Alfa (lotto 1) scade prima
//   del termine di presentazione.
// - Delta ed Epsilon non sono membri: sono i candidati reali della ricerca.

import type { Bando, Raggruppamento, Soggetto } from './domain';

const DISCIPLINARE = { documento: 'Disciplinare di gara', riferimento: '[art. da leggere]' };
const CAPITOLATO = { documento: 'Capitolato tecnico', riferimento: '[art. da leggere]' };
const F = (riferimento: string) => ({ documento: 'Fascicolo aziendale', riferimento });

/** Ambito del fatturato specifico, come lo dichiara il disciplinare. */
const SETTORE = 'dispositivi medici e servizi connessi';

// ─── Bando ───────────────────────────────────────────────────

export const bando: Bando = {
  id: 'gara-001',
  oggetto: 'Fornitura di dispositivi elettromedicali e arredi sanitari con servizi connessi',
  stazioneAppaltante: 'ASL [da sostituire]',
  dataPubblicazione: '2026-09-01',
  terminePresentazione: '2026-11-14',
  baseAsta: 3_400_000,
  fonte: { documento: 'Bando di gara', riferimento: '[sezione da leggere]' },
  lotti: [
    {
      id: 'lotto-1',
      oggetto: 'Dispositivi elettromedicali con manutenzione e formazione',
      importo: 2_500_000,
      cig: '[CIG da sostituire]',
      prestazioni: [
        { id: 'l1-fornitura', descrizione: 'Fornitura dispositivi elettromedicali', importo: 1_800_000, natura: 'principale', fonte: CAPITOLATO },
        { id: 'l1-manutenzione', descrizione: 'Manutenzione e assistenza tecnica', importo: 600_000, natura: 'scorporabile', fonte: CAPITOLATO },
        { id: 'l1-formazione', descrizione: 'Formazione del personale sanitario', importo: 100_000, natura: 'scorporabile', fonte: CAPITOLATO },
      ],
      vincoloPrestazionePrincipale: { esecutore: 'mandataria', quotaMinima: 0.6, fonte: DISCIPLINARE },
      requisiti: [
        {
          id: 'l1-generale',
          famiglia: 'generale',
          descrizione: 'Assenza delle cause di esclusione',
          criterio: { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione' },
          regola: { tipo: 'ciascun_membro' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l1-cciaa',
          famiglia: 'iscrizione',
          descrizione: 'Iscrizione al registro delle imprese (CCIAA)',
          criterio: { tipo: 'iscrizione', registro: 'CCIAA' },
          regola: { tipo: 'ciascun_membro' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l1-fatturato',
          famiglia: 'economico',
          descrizione: 'Fatturato specifico nel settore oggetto di gara, ultimi tre esercizi',
          criterio: { tipo: 'fatturato', ambito: { tipo: 'specifico', settore: SETTORE }, esercizi: 3, ancoraggio: 'pubblicazione', soglia: 3_000_000 },
          regola: { tipo: 'somma_membri', minimoMandataria: 0.4 },
          avvalibile: true,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l1-iso-13485',
          famiglia: 'certificazione',
          descrizione: 'ISO 13485 per chi esegue la fornitura',
          criterio: { tipo: 'certificazione', norma: 'ISO 13485' },
          regola: { tipo: 'esecutore_prestazione', prestazioneId: 'l1-fornitura' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l1-iso-9001-manutenzione',
          famiglia: 'certificazione',
          descrizione: 'ISO 9001 con scope di assistenza tecnica per chi esegue la manutenzione',
          criterio: { tipo: 'certificazione', norma: 'ISO 9001', scope: 'assistenza tecnica su apparecchiature elettromedicali' },
          regola: { tipo: 'esecutore_prestazione', prestazioneId: 'l1-manutenzione' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l1-iso-9001-formazione',
          famiglia: 'certificazione',
          descrizione: 'ISO 9001 con scope di formazione sanitaria per chi esegue la formazione',
          criterio: { tipo: 'certificazione', norma: 'ISO 9001', scope: 'progettazione ed erogazione di formazione in ambito sanitario' },
          regola: { tipo: 'esecutore_prestazione', prestazioneId: 'l1-formazione' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l1-referenze',
          famiglia: 'referenza',
          descrizione: 'Tre forniture analoghe nel quinquennio antecedente la pubblicazione',
          criterio: {
            tipo: 'servizi',
            cpv: '33100000',
            // Il disciplinare dichiara equivalenti le apparecchiature per imaging.
            cpvEquivalenti: ['33110000'],
            // Quattro cifre = classe CPV (3310 «apparecchiature mediche»). Per
            // una fornitura di elettromedicali un arredo per reparto di degenza
            // (3319 «dispositivi medici vari») non è analogo: lo stesso settore
            // merceologico non basta, serve la stessa classe di apparecchiatura.
            cifreCpvComuni: 4,
            anni: 5,
            ancoraggio: 'pubblicazione',
            numeroMinimo: 3,
            sostantivo: { singolare: 'fornitura analoga', plurale: 'forniture analoghe' },
          },
          regola: { tipo: 'somma_membri' },
          avvalibile: true,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
      ],
    },
    {
      id: 'lotto-2',
      oggetto: 'Arredi sanitari e sistemi di movimentazione pazienti',
      importo: 900_000,
      cig: '[CIG da sostituire]',
      prestazioni: [
        { id: 'l2-fornitura', descrizione: 'Fornitura arredi sanitari', importo: 700_000, natura: 'principale', fonte: CAPITOLATO },
        { id: 'l2-installazione', descrizione: 'Installazione e collaudo', importo: 150_000, natura: 'scorporabile', fonte: CAPITOLATO },
        { id: 'l2-formazione', descrizione: "Formazione all'uso dei sistemi di movimentazione", importo: 50_000, natura: 'scorporabile', fonte: CAPITOLATO },
      ],
      requisiti: [
        {
          id: 'l2-generale',
          famiglia: 'generale',
          descrizione: 'Assenza delle cause di esclusione',
          criterio: { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione' },
          regola: { tipo: 'ciascun_membro' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l2-cciaa',
          famiglia: 'iscrizione',
          descrizione: 'Iscrizione CCIAA per il commercio di articoli medicali, per chi esegue la fornitura',
          criterio: { tipo: 'iscrizione', registro: 'CCIAA', attivita: "commercio all'ingrosso di articoli medicali e ortopedici" },
          regola: { tipo: 'esecutore_prestazione', prestazioneId: 'l2-fornitura' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l2-fatturato-globale',
          famiglia: 'economico',
          descrizione: 'Fatturato globale, ultimi tre esercizi',
          criterio: { tipo: 'fatturato', ambito: { tipo: 'globale' }, esercizi: 3, ancoraggio: 'pubblicazione', soglia: 1_800_000 },
          regola: { tipo: 'somma_membri' },
          avvalibile: true,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l2-iso-9001',
          famiglia: 'certificazione',
          descrizione: 'ISO 9001 per chi esegue la fornitura',
          criterio: { tipo: 'certificazione', norma: 'ISO 9001' },
          regola: { tipo: 'esecutore_prestazione', prestazioneId: 'l2-fornitura' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          // Servizio di punta: è l'idioma `numeroMinimo: 1` + `importoMinimoUnitario`.
          // "Una fornitura analoga di importo non inferiore a 300.000 €": i servizi
          // sotto l'importo non contano, poi se ne conta almeno uno.
          id: 'l2-punta',
          famiglia: 'referenza',
          descrizione: 'Una fornitura di arredi sanitari di importo non inferiore a 300.000 € nel quinquennio',
          criterio: {
            tipo: 'servizi',
            cpv: '33192000',
            // Due cifre = divisione CPV (33 «apparecchiature mediche e vari»).
            // Per gli arredi sanitari basta essere fornitori del settore medicale:
            // una fornitura di dispositivi merita la verifica, una di mobili da
            // ufficio (divisione 39) no.
            cifreCpvComuni: 2,
            anni: 5,
            ancoraggio: 'pubblicazione',
            importoMinimoUnitario: 300_000,
            numeroMinimo: 1,
            sostantivo: { singolare: 'fornitura', plurale: 'forniture' },
          },
          regola: { tipo: 'almeno_un_membro' },
          avvalibile: true,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
      ],
    },
  ],
};

// ─── Soggetti ────────────────────────────────────────────────

export const soggetti: Soggetto[] = [
  {
    id: 's-alfa',
    denominazione: 'Alfa Medical S.p.A.',
    fascicolo: [
      { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione', resa: { valore: true, fonte: F('DGUE') } },
      { tipo: 'iscrizione', registro: 'CCIAA', attivita: "commercio all'ingrosso di articoli medicali e ortopedici", possesso: { valore: true, fonte: F('visura camerale') } },
      { tipo: 'fatturato', esercizio: 2023, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 600_000, fonte: F('bilancio 2023') } },
      { tipo: 'fatturato', esercizio: 2024, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 700_000, fonte: F('bilancio 2024') } },
      { tipo: 'fatturato', esercizio: 2025, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 800_000, fonte: F('bilancio 2025') } },
      { tipo: 'fatturato', esercizio: 2023, ambito: { tipo: 'globale' }, importo: { valore: 900_000, fonte: F('bilancio 2023') } },
      { tipo: 'fatturato', esercizio: 2024, ambito: { tipo: 'globale' }, importo: { valore: 1_000_000, fonte: F('bilancio 2024') } },
      { tipo: 'fatturato', esercizio: 2025, ambito: { tipo: 'globale' }, importo: { valore: 1_100_000, fonte: F('bilancio 2025') } },
      // Scade prima del termine di presentazione: deve produrre un avviso, non uno scoperto.
      { tipo: 'certificazione', norma: 'ISO 13485', scope: 'progettazione, produzione e commercializzazione di dispositivi medici', possesso: { valore: true, fonte: F('certificato ISO 13485'), validoA: '2026-10-31' } },
      // Scade dopo il termine ma entro l'orizzonte di 90 giorni.
      { tipo: 'certificazione', norma: 'ISO 9001', scope: 'produzione e commercializzazione di dispositivi medici', possesso: { valore: true, fonte: F('certificato ISO 9001'), validoA: '2026-11-30' } },
      { tipo: 'servizio', oggetto: 'Fornitura di apparecchiature elettromedicali', cpv: '33100000', committente: 'ASL X', importo: 900_000, periodo: { valore: { da: '2023-01-01', a: '2024-12-31' }, fonte: F('certificato di esecuzione ASL X') } },
      { tipo: 'servizio', oggetto: 'Fornitura di monitor multiparametrici', cpv: '33100000', committente: 'AO Y', importo: 450_000, periodo: { valore: { da: '2024-03-01', a: '2025-06-30' }, fonte: F('certificato di esecuzione AO Y') } },
      { tipo: 'servizio', oggetto: 'Fornitura di arredi per reparto di degenza', cpv: '33192000', committente: 'AO Y', importo: 450_000, periodo: { valore: { da: '2024-01-15', a: '2024-10-31' }, fonte: F('certificato di esecuzione AO Y — arredi') } },
    ],
  },
  {
    id: 's-beta',
    denominazione: 'Beta Service S.r.l.',
    fascicolo: [
      { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione', resa: { valore: true, fonte: F('DGUE') } },
      { tipo: 'iscrizione', registro: 'CCIAA', attivita: 'manutenzione e riparazione di apparecchiature elettromedicali', possesso: { valore: true, fonte: F('visura camerale') } },
      { tipo: 'fatturato', esercizio: 2023, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 180_000, fonte: F('bilancio 2023') } },
      { tipo: 'fatturato', esercizio: 2024, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 200_000, fonte: F('bilancio 2024') } },
      { tipo: 'fatturato', esercizio: 2025, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 220_000, fonte: F('bilancio 2025') } },
      // Scaduta rispetto alla data di riferimento: fa fallire l1-iso-9001-manutenzione.
      { tipo: 'certificazione', norma: 'ISO 9001', scope: 'assistenza tecnica su apparecchiature elettromedicali', possesso: { valore: true, fonte: F('certificato ISO 9001'), validoA: '2026-04-30' } },
      // CPV di manutenzione contro CPV di gara di fornitura: analogia da valutare.
      { tipo: 'servizio', oggetto: 'Manutenzione di apparecchiature elettromedicali', cpv: '50421000', committente: 'ASL Z', importo: 300_000, periodo: { valore: { da: '2023-06-01', a: '2025-05-31' }, fonte: F('certificato di esecuzione ASL Z') } },
    ],
  },
  {
    id: 's-gamma',
    denominazione: 'Gamma Formazione S.r.l.',
    fascicolo: [
      { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione', resa: { valore: true, fonte: F('DGUE') } },
      { tipo: 'iscrizione', registro: 'CCIAA', attivita: 'formazione professionale', possesso: { valore: true, fonte: F('visura camerale') } },
      { tipo: 'fatturato', esercizio: 2023, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 60_000, fonte: F('bilancio 2023') } },
      { tipo: 'fatturato', esercizio: 2024, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 70_000, fonte: F('bilancio 2024') } },
      { tipo: 'fatturato', esercizio: 2025, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 70_000, fonte: F('bilancio 2025') } },
      // Scope diverso da quello richiesto per la formazione sanitaria: da verificare.
      { tipo: 'certificazione', norma: 'ISO 9001', scope: 'progettazione ed erogazione di corsi di formazione professionale', possesso: { valore: true, fonte: F('certificato ISO 9001'), validoA: '2028-01-31' } },
      { tipo: 'servizio', oggetto: 'Formazione del personale infermieristico', cpv: '80500000', committente: 'ASL X', importo: 80_000, periodo: { valore: { da: '2024-09-01', a: '2025-06-30' }, fonte: F('certificato di esecuzione ASL X — formazione') } },
    ],
  },
  {
    // Non membro: candidato reale per la manutenzione del lotto 1.
    id: 's-delta',
    denominazione: 'Delta Tecnica S.r.l.',
    fascicolo: [
      { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione', resa: { valore: true, fonte: F('DGUE') } },
      { tipo: 'iscrizione', registro: 'CCIAA', attivita: 'manutenzione e riparazione di apparecchiature elettromedicali', possesso: { valore: true, fonte: F('visura camerale') } },
      { tipo: 'fatturato', esercizio: 2023, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 140_000, fonte: F('bilancio 2023') } },
      { tipo: 'fatturato', esercizio: 2024, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 150_000, fonte: F('bilancio 2024') } },
      { tipo: 'fatturato', esercizio: 2025, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 160_000, fonte: F('bilancio 2025') } },
      { tipo: 'certificazione', norma: 'ISO 9001', scope: 'assistenza tecnica su apparecchiature elettromedicali', possesso: { valore: true, fonte: F('certificato ISO 9001'), validoA: '2027-05-31' } },
      { tipo: 'servizio', oggetto: 'Manutenzione full-risk di apparecchiature elettromedicali', cpv: '50421000', committente: 'AO W', importo: 400_000, periodo: { valore: { da: '2024-01-01', a: '2026-12-31' }, fonte: F('certificato di esecuzione AO W') } },
    ],
  },
  {
    // Non membro: ha le referenze di fornitura che al raggruppamento mancano.
    id: 's-epsilon',
    denominazione: 'Epsilon Hospital Supply S.r.l.',
    fascicolo: [
      { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione', resa: { valore: true, fonte: F('DGUE') } },
      { tipo: 'iscrizione', registro: 'CCIAA', attivita: "commercio all'ingrosso di articoli medicali e ortopedici", possesso: { valore: true, fonte: F('visura camerale') } },
      { tipo: 'fatturato', esercizio: 2023, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 300_000, fonte: F('bilancio 2023') } },
      { tipo: 'fatturato', esercizio: 2024, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 300_000, fonte: F('bilancio 2024') } },
      { tipo: 'fatturato', esercizio: 2025, ambito: { tipo: 'specifico', settore: SETTORE }, importo: { valore: 300_000, fonte: F('bilancio 2025') } },
      { tipo: 'servizio', oggetto: 'Fornitura di ventilatori polmonari', cpv: '33100000', committente: 'ASL V', importo: 600_000, periodo: { valore: { da: '2023-02-01', a: '2023-11-30' }, fonte: F('certificato di esecuzione ASL V') } },
      // CPV dichiarato equivalente dal disciplinare del lotto 1: conta come certo.
      { tipo: 'servizio', oggetto: 'Fornitura di apparecchiature per imaging', cpv: '33110000', committente: 'AO U', importo: 380_000, periodo: { valore: { da: '2025-01-10', a: '2025-09-30' }, fonte: F('certificato di esecuzione AO U') } },
    ],
  },
];

// ─── Raggruppamento ──────────────────────────────────────────

export const raggruppamento: Raggruppamento = {
  tipo: 'verticale',
  membri: [
    { ruolo: 'mandataria', soggettoId: 's-alfa', quote: { 'l1-fornitura': 1, 'l1-manutenzione': 0, 'l1-formazione': 0, 'l2-fornitura': 1, 'l2-installazione': 0, 'l2-formazione': 0 } },
    { ruolo: 'mandante', soggettoId: 's-beta', quote: { 'l1-fornitura': 0, 'l1-manutenzione': 1, 'l1-formazione': 0, 'l2-fornitura': 0, 'l2-installazione': 1, 'l2-formazione': 0 } },
    { ruolo: 'mandante', soggettoId: 's-gamma', quote: { 'l1-fornitura': 0, 'l1-manutenzione': 0, 'l1-formazione': 1, 'l2-fornitura': 0, 'l2-installazione': 0, 'l2-formazione': 1 } },
  ],
};

export const DATA_RIFERIMENTO = '2026-09-14';
export const ORIZZONTE_SCADENZE_GIORNI = 90;
