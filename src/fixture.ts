// Fixture di lavoro — gara ASL multi-lotto, forniture medico-sanitarie.
//
// I valori sono inventati e vanno sostituiti con un disciplinare reale.
// I riferimenti agli articoli sono placeholder espliciti: non inventare
// numeri di articolo. La FORMA invece è quella che il motore e la UI
// devono saper trattare.
//
// Cosa dimostra:
// - Lotto 1 (dispositivi): NON ammissibile. ISO 9001 di Beta scaduta,
//   fatturato sotto soglia di 100.000 €, referenze scoperte perché gli
//   arredi non sono della stessa classe CPV, scope di Gamma divergente
//   (da verificare), vincolo di esecuzione della prestazione principale
//   dichiarato e rispettato. Il percorso minimo è di due mosse e raggiunge
//   "con riserva": lo scope di Gamma lo scioglie solo una persona.
// - Lotto 2 (arredi): ammissibile, con CPV della stessa divisione da
//   verificare sul servizio di punta e un avviso: la ISO 9001 di Alfa
//   scade entro l'orizzonte. La ISO 13485 di Alfa (lotto 1) scade prima
//   del termine di presentazione.
// - Delta ed Epsilon non sono membri: sono i candidati reali della ricerca.
//   Epsilon ha una referenza con CPV dichiarato equivalente: conta come certa.

import type { Bando, Esito, LottoId, Raggruppamento, Soggetto } from './domain';

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
  valori: [],
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
          letture: [{ criterio: { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione' } }],
          regola: { tipo: 'ciascun_membro' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l1-cciaa',
          famiglia: 'iscrizione',
          descrizione: 'Iscrizione al registro delle imprese (CCIAA)',
          letture: [{ criterio: { tipo: 'iscrizione', registro: 'CCIAA' } }],
          regola: { tipo: 'ciascun_membro' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l1-fatturato',
          famiglia: 'economico',
          descrizione: 'Fatturato specifico nel settore oggetto di gara, ultimi tre esercizi',
          letture: [{ criterio: { tipo: 'fatturato', ambito: { tipo: 'specifico', settore: SETTORE }, periodo: { tipo: 'a_ritroso', esercizi: 3, ancoraggio: 'pubblicazione' }, soglia: 3_000_000 } }],
          regola: { tipo: 'somma_membri', minimoMandataria: 0.4 },
          avvalibile: true,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l1-iso-13485',
          famiglia: 'certificazione',
          descrizione: 'ISO 13485 per chi esegue la fornitura',
          letture: [{ criterio: { tipo: 'certificazione', norme: ['ISO 13485'] } }],
          regola: { tipo: 'esecutore_prestazione', prestazioneId: 'l1-fornitura' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l1-iso-9001-manutenzione',
          famiglia: 'certificazione',
          descrizione: 'ISO 9001 con scope di assistenza tecnica per chi esegue la manutenzione',
          letture: [{ criterio: { tipo: 'certificazione', norme: ['ISO 9001'], scope: 'assistenza tecnica su apparecchiature elettromedicali' } }],
          regola: { tipo: 'esecutore_prestazione', prestazioneId: 'l1-manutenzione' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l1-iso-9001-formazione',
          famiglia: 'certificazione',
          descrizione: 'ISO 9001 con scope di formazione sanitaria per chi esegue la formazione',
          letture: [{ criterio: { tipo: 'certificazione', norme: ['ISO 9001'], scope: 'progettazione ed erogazione di formazione in ambito sanitario' } }],
          regola: { tipo: 'esecutore_prestazione', prestazioneId: 'l1-formazione' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l1-referenze',
          famiglia: 'referenza',
          descrizione: 'Tre forniture analoghe nel quinquennio antecedente la pubblicazione',
          letture: [{ criterio: {
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
          } }],
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
          letture: [{ criterio: { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione' } }],
          regola: { tipo: 'ciascun_membro' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l2-cciaa',
          famiglia: 'iscrizione',
          descrizione: 'Iscrizione CCIAA per il commercio di articoli medicali, per chi esegue la fornitura',
          letture: [{ criterio: { tipo: 'iscrizione', registro: 'CCIAA', attivita: "commercio all'ingrosso di articoli medicali e ortopedici" } }],
          regola: { tipo: 'esecutore_prestazione', prestazioneId: 'l2-fornitura' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l2-fatturato-globale',
          famiglia: 'economico',
          descrizione: 'Fatturato globale, ultimi tre esercizi',
          letture: [{ criterio: { tipo: 'fatturato', ambito: { tipo: 'globale' }, periodo: { tipo: 'a_ritroso', esercizi: 3, ancoraggio: 'pubblicazione' }, soglia: 1_800_000 } }],
          regola: { tipo: 'somma_membri' },
          avvalibile: true,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          id: 'l2-iso-9001',
          famiglia: 'certificazione',
          descrizione: 'ISO 9001 per chi esegue la fornitura',
          letture: [{ criterio: { tipo: 'certificazione', norme: ['ISO 9001'] } }],
          regola: { tipo: 'esecutore_prestazione', prestazioneId: 'l2-fornitura' },
          avvalibile: false,
          vincolante: true,
          fonte: DISCIPLINARE,
        },
        {
          // Fatturato complessivo sui servizi: unità euro, somma degli importi dei
          // servizi che contano. Il disciplinare dichiara equivalenti agli arredi le
          // apparecchiature mediche: forniture di dispositivi contano come certe.
          id: 'l2-servizi-importo',
          famiglia: 'referenza',
          descrizione: 'Forniture di arredi o apparecchiature sanitarie nel quinquennio per un importo complessivo non inferiore a 800.000 €',
          letture: [{ criterio: {
            tipo: 'servizi_importo',
            cpv: '33192000',
            cpvEquivalenti: ['33100000'],
            cifreCpvComuni: 2,
            anni: 5,
            ancoraggio: 'pubblicazione',
            soglia: 800_000,
          } }],
          regola: { tipo: 'somma_membri' },
          avvalibile: true,
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
          letture: [{ criterio: {
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
          } }],
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

// ─── Esito atteso ────────────────────────────────────────────
// GENERATO dal motore (`valuta`) su questa fixture, alla data di riferimento
// e con l'orizzonte qui sopra, e letto riga per riga prima di essere fissato.
// Non è scritto a mano: dove il motore cambia, questo cambia con lui e il
// test di integrazione lo dice. Per rigenerarlo: `npm run fixture:esito`.

export const esitoAtteso: Record<LottoId, Esito> = {
  "lotto-1": {
    "lottoId": "lotto-1",
    "valutatoAl": "2026-09-14",
    "verdetto": "non_ammissibile",
    "requisiti": [
      {
        "requisitoId": "l1-generale",
        "stato": "coperto",
        "contributi": [
          {
            "soggettoId": "s-alfa",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "DGUE"
              }
            ]
          },
          {
            "soggettoId": "s-beta",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "DGUE"
              }
            ]
          },
          {
            "soggettoId": "s-gamma",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "DGUE"
              }
            ]
          }
        ],
        "motivazione": "Richiesto a ciascun membro: tutti e 3 i membri lo possiedono.",
        "assunzioni": [],
        "indeterminatezze": [],
        "rimedi": []
      },
      {
        "requisitoId": "l1-cciaa",
        "stato": "coperto",
        "contributi": [
          {
            "soggettoId": "s-alfa",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "visura camerale"
              }
            ]
          },
          {
            "soggettoId": "s-beta",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "visura camerale"
              }
            ]
          },
          {
            "soggettoId": "s-gamma",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "visura camerale"
              }
            ]
          }
        ],
        "motivazione": "Richiesto a ciascun membro: tutti e 3 i membri lo possiedono.",
        "assunzioni": [],
        "indeterminatezze": [],
        "rimedi": []
      },
      {
        "requisitoId": "l1-fatturato",
        "stato": "scoperto",
        "contributi": [
          {
            "soggettoId": "s-alfa",
            "valore": {
              "tipo": "misura",
              "certo": 2100000,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "bilancio 2023"
              },
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "bilancio 2024"
              },
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "bilancio 2025"
              }
            ]
          },
          {
            "soggettoId": "s-beta",
            "valore": {
              "tipo": "misura",
              "certo": 600000,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "bilancio 2023"
              },
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "bilancio 2024"
              },
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "bilancio 2025"
              }
            ]
          },
          {
            "soggettoId": "s-gamma",
            "valore": {
              "tipo": "misura",
              "certo": 200000,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "bilancio 2023"
              },
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "bilancio 2024"
              },
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "bilancio 2025"
              }
            ]
          }
        ],
        "motivazione": "Somma dei contributi certi: 2.900.000 € su una soglia di 3.000.000 €: mancano 100.000 €. Contributi: Alfa Medical S.p.A. 2.100.000 €; Beta Service S.r.l. 600.000 €; Gamma Formazione S.r.l. 200.000 €. Minimo della mandataria: 40 % di 3.000.000 € = 1.200.000 €; Alfa Medical S.p.A. raggiunge 2.100.000 €.",
        "assunzioni": [],
        "indeterminatezze": [],
        "rimedi": [
          {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-delta",
            "ruolo": "mandante",
            "quote": {}
          },
          {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-delta",
            "ruolo": "mandante",
            "quote": {
              "l1-formazione": 1
            },
            "rilevateDa": "s-gamma"
          },
          {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-delta",
            "ruolo": "mandante",
            "quote": {
              "l1-manutenzione": 1
            },
            "rilevateDa": "s-beta"
          },
          {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-epsilon",
            "ruolo": "mandante",
            "quote": {}
          },
          {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-epsilon",
            "ruolo": "mandante",
            "quote": {
              "l1-manutenzione": 1
            },
            "rilevateDa": "s-beta"
          },
          {
            "tipo": "avvalimento",
            "requisitoId": "l1-fatturato",
            "ausiliariaId": "s-delta",
            "ausiliataId": "s-alfa"
          },
          {
            "tipo": "avvalimento",
            "requisitoId": "l1-fatturato",
            "ausiliariaId": "s-epsilon",
            "ausiliataId": "s-alfa"
          }
        ],
        "misurazione": {
          "unita": {
            "tipo": "euro"
          },
          "soglia": 3000000,
          "raggiunto": 2900000,
          "massimo": 2900000,
          "delta": 100000,
          "minimiRuolo": [
            {
              "soggettoId": "s-alfa",
              "ruolo": "mandataria",
              "richiesto": 1200000,
              "raggiunto": 2100000,
              "delta": 0
            }
          ]
        }
      },
      {
        "requisitoId": "l1-iso-13485",
        "stato": "coperto",
        "contributi": [
          {
            "soggettoId": "s-alfa",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato ISO 13485"
              }
            ]
          },
          {
            "soggettoId": "s-beta",
            "valore": {
              "tipo": "possesso",
              "esito": "assente"
            },
            "conteggiato": false,
            "fonti": [],
            "nota": "non esegue la prestazione «Fornitura dispositivi elettromedicali»; nessuna certificazione ISO 13485 nel fascicolo"
          },
          {
            "soggettoId": "s-gamma",
            "valore": {
              "tipo": "possesso",
              "esito": "assente"
            },
            "conteggiato": false,
            "fonti": [],
            "nota": "non esegue la prestazione «Fornitura dispositivi elettromedicali»; nessuna certificazione ISO 13485 nel fascicolo"
          }
        ],
        "motivazione": "Richiesto a chi esegue «Fornitura dispositivi elettromedicali», cioè Alfa Medical S.p.A. (100 %): Alfa Medical S.p.A. lo possiede.",
        "assunzioni": [],
        "indeterminatezze": [],
        "rimedi": []
      },
      {
        "requisitoId": "l1-iso-9001-manutenzione",
        "stato": "scoperto",
        "contributi": [
          {
            "soggettoId": "s-alfa",
            "valore": {
              "tipo": "possesso",
              "esito": "da_verificare"
            },
            "conteggiato": false,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato ISO 9001"
              }
            ],
            "nota": "non esegue la prestazione «Manutenzione e assistenza tecnica»; certificazione ISO 9001 con «produzione e commercializzazione di dispositivi medici» invece di «assistenza tecnica su apparecchiature elettromedicali»: equivalenza da valutare"
          },
          {
            "soggettoId": "s-beta",
            "valore": {
              "tipo": "possesso",
              "esito": "assente"
            },
            "conteggiato": true,
            "fonti": [],
            "nota": "certificazione ISO 9001 — assistenza tecnica su apparecchiature elettromedicali: scaduto il 30/04/2026"
          },
          {
            "soggettoId": "s-gamma",
            "valore": {
              "tipo": "possesso",
              "esito": "da_verificare"
            },
            "conteggiato": false,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato ISO 9001"
              }
            ],
            "nota": "non esegue la prestazione «Manutenzione e assistenza tecnica»; certificazione ISO 9001 con «progettazione ed erogazione di corsi di formazione professionale» invece di «assistenza tecnica su apparecchiature elettromedicali»: equivalenza da valutare"
          }
        ],
        "motivazione": "Richiesto a chi esegue «Manutenzione e assistenza tecnica», cioè Beta Service S.r.l. (100 %): manca a Beta Service S.r.l. (certificazione ISO 9001 — assistenza tecnica su apparecchiature elettromedicali: scaduto il 30/04/2026).",
        "assunzioni": [],
        "indeterminatezze": [],
        "rimedi": [
          {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-delta",
            "ruolo": "mandante",
            "quote": {
              "l1-manutenzione": 1
            },
            "rilevateDa": "s-beta"
          },
          {
            "tipo": "rinnovo_documento",
            "soggettoId": "s-beta",
            "requisitoId": "l1-iso-9001-manutenzione",
            "fonte": {
              "documento": "Fascicolo aziendale",
              "riferimento": "certificato ISO 9001"
            },
            "scadutoIl": "2026-04-30"
          }
        ]
      },
      {
        "requisitoId": "l1-iso-9001-formazione",
        "stato": "da_verificare",
        "contributi": [
          {
            "soggettoId": "s-alfa",
            "valore": {
              "tipo": "possesso",
              "esito": "da_verificare"
            },
            "conteggiato": false,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato ISO 9001"
              }
            ],
            "nota": "non esegue la prestazione «Formazione del personale sanitario»; certificazione ISO 9001 con «produzione e commercializzazione di dispositivi medici» invece di «progettazione ed erogazione di formazione in ambito sanitario»: equivalenza da valutare"
          },
          {
            "soggettoId": "s-beta",
            "valore": {
              "tipo": "possesso",
              "esito": "assente"
            },
            "conteggiato": false,
            "fonti": [],
            "nota": "non esegue la prestazione «Formazione del personale sanitario»; certificazione ISO 9001 — assistenza tecnica su apparecchiature elettromedicali: scaduto il 30/04/2026"
          },
          {
            "soggettoId": "s-gamma",
            "valore": {
              "tipo": "possesso",
              "esito": "da_verificare"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato ISO 9001"
              }
            ],
            "nota": "certificazione ISO 9001 con «progettazione ed erogazione di corsi di formazione professionale» invece di «progettazione ed erogazione di formazione in ambito sanitario»: equivalenza da valutare"
          }
        ],
        "motivazione": "Richiesto a chi esegue «Formazione del personale sanitario», cioè Gamma Formazione S.r.l. (100 %): Gamma Formazione S.r.l. (certificazione ISO 9001 con «progettazione ed erogazione di corsi di formazione professionale» invece di «progettazione ed erogazione di formazione in ambito sanitario»: equivalenza da valutare) lo possiede con riserva. Il confronto che manca è un giudizio semantico: decide una persona, non il motore.",
        "assunzioni": [],
        "indeterminatezze": [
          {
            "tipo": "giudizio_richiesto",
            "soggettoId": "s-gamma",
            "oggetto": "equivalenza tra «progettazione ed erogazione di corsi di formazione professionale» e «progettazione ed erogazione di formazione in ambito sanitario» (certificazione ISO 9001)"
          }
        ],
        "rimedi": [
          {
            "tipo": "profilo_mancante",
            "requisitoId": "l1-iso-9001-formazione",
            "criterio": {
              "tipo": "certificazione",
              "norme": [
                "ISO 9001"
              ],
              "scope": "progettazione ed erogazione di formazione in ambito sanitario"
            }
          }
        ]
      },
      {
        "requisitoId": "l1-referenze",
        "stato": "scoperto",
        "contributi": [
          {
            "soggettoId": "s-alfa",
            "valore": {
              "tipo": "misura",
              "certo": 2,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato di esecuzione ASL X"
              },
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato di esecuzione AO Y"
              }
            ],
            "nota": "non analoghi per classe CPV, non contati: «Fornitura di arredi per reparto di degenza» (CPV 33192000)"
          },
          {
            "soggettoId": "s-beta",
            "valore": {
              "tipo": "misura",
              "certo": 0,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [],
            "nota": "non analoghi per classe CPV, non contati: «Manutenzione di apparecchiature elettromedicali» (CPV 50421000)"
          },
          {
            "soggettoId": "s-gamma",
            "valore": {
              "tipo": "misura",
              "certo": 0,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [],
            "nota": "non analoghi per classe CPV, non contati: «Formazione del personale infermieristico» (CPV 80500000)"
          }
        ],
        "motivazione": "Somma dei contributi certi: 2 forniture analoghe su una soglia di 3 forniture analoghe: mancano 1 fornitura analoga. Contributi: Alfa Medical S.p.A. 2 forniture analoghe (non analoghi per classe CPV, non contati: «Fornitura di arredi per reparto di degenza» (CPV 33192000)); Beta Service S.r.l. 0 forniture analoghe (non analoghi per classe CPV, non contati: «Manutenzione di apparecchiature elettromedicali» (CPV 50421000)); Gamma Formazione S.r.l. 0 forniture analoghe (non analoghi per classe CPV, non contati: «Formazione del personale infermieristico» (CPV 80500000)).",
        "assunzioni": [
          {
            "codice": "classe_cpv",
            "testo": "I servizi il cui CPV non condivide le prime 4 cifre con 33100000 o 33110000 sono stati esclusi come non analoghi: il numero di cifre è un dato del criterio, la regola sulla struttura del CPV è del motore, non del disciplinare."
          }
        ],
        "indeterminatezze": [],
        "rimedi": [
          {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-epsilon",
            "ruolo": "mandante",
            "quote": {}
          },
          {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-epsilon",
            "ruolo": "mandante",
            "quote": {
              "l1-manutenzione": 1
            },
            "rilevateDa": "s-beta"
          },
          {
            "tipo": "avvalimento",
            "requisitoId": "l1-referenze",
            "ausiliariaId": "s-epsilon",
            "ausiliataId": "s-alfa"
          }
        ],
        "misurazione": {
          "unita": {
            "tipo": "conteggio",
            "sostantivo": {
              "singolare": "fornitura analoga",
              "plurale": "forniture analoghe"
            }
          },
          "soglia": 3,
          "raggiunto": 2,
          "massimo": 2,
          "delta": 1,
          "minimiRuolo": []
        }
      }
    ],
    "anomalie": [],
    "avvisiScadenza": [
      {
        "soggettoId": "s-alfa",
        "descrizioneVoce": "certificazione ISO 13485 — progettazione, produzione e commercializzazione di dispositivi medici",
        "scadeIl": "2026-10-31",
        "fonte": {
          "documento": "Fascicolo aziendale",
          "riferimento": "certificato ISO 13485"
        },
        "requisitiIds": [
          "l1-iso-13485"
        ],
        "primaDelTermine": true,
        "entroOrizzonte": true
      }
    ],
    "percorsoMinimo": {
      "esito": "trovato",
      "mosse": [
        {
          "tipo": "ingresso_soggetto",
          "soggettoId": "s-delta",
          "ruolo": "mandante",
          "quote": {
            "l1-manutenzione": 1
          },
          "rilevateDa": "s-beta"
        },
        {
          "tipo": "avvalimento",
          "requisitoId": "l1-referenze",
          "ausiliariaId": "s-epsilon",
          "ausiliataId": "s-alfa"
        }
      ],
      "verdettoRaggiunto": "ammissibile_con_riserva",
      "residui": [
        "l1-iso-9001-formazione"
      ],
      "segnalazioni": 1
    }
  },
  "lotto-2": {
    "lottoId": "lotto-2",
    "valutatoAl": "2026-09-14",
    "verdetto": "ammissibile",
    "requisiti": [
      {
        "requisitoId": "l2-generale",
        "stato": "coperto",
        "contributi": [
          {
            "soggettoId": "s-alfa",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "DGUE"
              }
            ]
          },
          {
            "soggettoId": "s-beta",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "DGUE"
              }
            ]
          },
          {
            "soggettoId": "s-gamma",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "DGUE"
              }
            ]
          }
        ],
        "motivazione": "Richiesto a ciascun membro: tutti e 3 i membri lo possiedono.",
        "assunzioni": [],
        "indeterminatezze": [],
        "rimedi": []
      },
      {
        "requisitoId": "l2-cciaa",
        "stato": "coperto",
        "contributi": [
          {
            "soggettoId": "s-alfa",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "visura camerale"
              }
            ]
          },
          {
            "soggettoId": "s-beta",
            "valore": {
              "tipo": "possesso",
              "esito": "da_verificare"
            },
            "conteggiato": false,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "visura camerale"
              }
            ],
            "nota": "non esegue la prestazione «Fornitura arredi sanitari»; iscrizione CCIAA con «manutenzione e riparazione di apparecchiature elettromedicali» invece di «commercio all'ingrosso di articoli medicali e ortopedici»: equivalenza da valutare"
          },
          {
            "soggettoId": "s-gamma",
            "valore": {
              "tipo": "possesso",
              "esito": "da_verificare"
            },
            "conteggiato": false,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "visura camerale"
              }
            ],
            "nota": "non esegue la prestazione «Fornitura arredi sanitari»; iscrizione CCIAA con «formazione professionale» invece di «commercio all'ingrosso di articoli medicali e ortopedici»: equivalenza da valutare"
          }
        ],
        "motivazione": "Richiesto a chi esegue «Fornitura arredi sanitari», cioè Alfa Medical S.p.A. (100 %): Alfa Medical S.p.A. lo possiede.",
        "assunzioni": [],
        "indeterminatezze": [],
        "rimedi": []
      },
      {
        "requisitoId": "l2-fatturato-globale",
        "stato": "coperto",
        "contributi": [
          {
            "soggettoId": "s-alfa",
            "valore": {
              "tipo": "misura",
              "certo": 3000000,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "bilancio 2023"
              },
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "bilancio 2024"
              },
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "bilancio 2025"
              }
            ]
          },
          {
            "soggettoId": "s-beta",
            "valore": {
              "tipo": "misura",
              "certo": 0,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [],
            "nota": "nessun fatturato nell'ambito globale per gli esercizi 2023–2025"
          },
          {
            "soggettoId": "s-gamma",
            "valore": {
              "tipo": "misura",
              "certo": 0,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [],
            "nota": "nessun fatturato nell'ambito globale per gli esercizi 2023–2025"
          }
        ],
        "motivazione": "Somma dei contributi certi: 3.000.000 € su una soglia di 1.800.000 €: soglia raggiunta. Contributi: Alfa Medical S.p.A. 3.000.000 €; Beta Service S.r.l. 0 € (nessun fatturato nell'ambito globale per gli esercizi 2023–2025); Gamma Formazione S.r.l. 0 € (nessun fatturato nell'ambito globale per gli esercizi 2023–2025).",
        "assunzioni": [],
        "indeterminatezze": [],
        "rimedi": [],
        "misurazione": {
          "unita": {
            "tipo": "euro"
          },
          "soglia": 1800000,
          "raggiunto": 3000000,
          "massimo": 3000000,
          "delta": 0,
          "minimiRuolo": []
        }
      },
      {
        "requisitoId": "l2-iso-9001",
        "stato": "coperto",
        "contributi": [
          {
            "soggettoId": "s-alfa",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato ISO 9001"
              }
            ]
          },
          {
            "soggettoId": "s-beta",
            "valore": {
              "tipo": "possesso",
              "esito": "assente"
            },
            "conteggiato": false,
            "fonti": [],
            "nota": "non esegue la prestazione «Fornitura arredi sanitari»; certificazione ISO 9001 — assistenza tecnica su apparecchiature elettromedicali: scaduto il 30/04/2026"
          },
          {
            "soggettoId": "s-gamma",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": false,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato ISO 9001"
              }
            ],
            "nota": "non esegue la prestazione «Fornitura arredi sanitari»"
          }
        ],
        "motivazione": "Richiesto a chi esegue «Fornitura arredi sanitari», cioè Alfa Medical S.p.A. (100 %): Alfa Medical S.p.A. lo possiede. Gamma Formazione S.r.l. lo possiede ma non esegue la prestazione.",
        "assunzioni": [],
        "indeterminatezze": [],
        "rimedi": []
      },
      {
        "requisitoId": "l2-servizi-importo",
        "stato": "coperto",
        "contributi": [
          {
            "soggettoId": "s-alfa",
            "valore": {
              "tipo": "misura",
              "certo": 1800000,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato di esecuzione ASL X"
              },
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato di esecuzione AO Y"
              },
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato di esecuzione AO Y — arredi"
              }
            ]
          },
          {
            "soggettoId": "s-beta",
            "valore": {
              "tipo": "misura",
              "certo": 0,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [],
            "nota": "non analoghi per classe CPV, non contati: «Manutenzione di apparecchiature elettromedicali» (CPV 50421000)"
          },
          {
            "soggettoId": "s-gamma",
            "valore": {
              "tipo": "misura",
              "certo": 0,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [],
            "nota": "non analoghi per classe CPV, non contati: «Formazione del personale infermieristico» (CPV 80500000)"
          }
        ],
        "motivazione": "Somma dei contributi certi: 1.800.000 € su una soglia di 800.000 €: soglia raggiunta. Contributi: Alfa Medical S.p.A. 1.800.000 €; Beta Service S.r.l. 0 € (non analoghi per classe CPV, non contati: «Manutenzione di apparecchiature elettromedicali» (CPV 50421000)); Gamma Formazione S.r.l. 0 € (non analoghi per classe CPV, non contati: «Formazione del personale infermieristico» (CPV 80500000)).",
        "assunzioni": [
          {
            "codice": "classe_cpv",
            "testo": "I servizi il cui CPV non condivide le prime 2 cifre con 33192000 o 33100000 sono stati esclusi come non analoghi: il numero di cifre è un dato del criterio, la regola sulla struttura del CPV è del motore, non del disciplinare."
          }
        ],
        "indeterminatezze": [],
        "rimedi": [],
        "misurazione": {
          "unita": {
            "tipo": "euro"
          },
          "soglia": 800000,
          "raggiunto": 1800000,
          "massimo": 1800000,
          "delta": 0,
          "minimiRuolo": []
        }
      },
      {
        "requisitoId": "l2-punta",
        "stato": "coperto",
        "contributi": [
          {
            "soggettoId": "s-alfa",
            "valore": {
              "tipo": "misura",
              "certo": 1,
              "incerto": 2
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato di esecuzione ASL X"
              },
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato di esecuzione AO Y"
              },
              {
                "documento": "Fascicolo aziendale",
                "riferimento": "certificato di esecuzione AO Y — arredi"
              }
            ],
            "nota": "servizio «Fornitura di apparecchiature elettromedicali» per ASL X: CPV 33100000 diverso da quello di gara 33192000, analogia da valutare; servizio «Fornitura di monitor multiparametrici» per AO Y: CPV 33100000 diverso da quello di gara 33192000, analogia da valutare"
          },
          {
            "soggettoId": "s-beta",
            "valore": {
              "tipo": "misura",
              "certo": 0,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [],
            "nota": "non analoghi per classe CPV, non contati: «Manutenzione di apparecchiature elettromedicali» (CPV 50421000)"
          },
          {
            "soggettoId": "s-gamma",
            "valore": {
              "tipo": "misura",
              "certo": 0,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [],
            "nota": "servizio «Formazione del personale infermieristico» per ASL X: importo 80.000 € sotto il minimo unitario di 300.000 €"
          }
        ],
        "motivazione": "Basta un membro con almeno 1 fornitura: il migliore è Alfa Medical S.p.A. con 1 fornitura.",
        "assunzioni": [
          {
            "codice": "classe_cpv",
            "testo": "I servizi il cui CPV non condivide le prime 2 cifre con 33192000 sono stati esclusi come non analoghi: il numero di cifre è un dato del criterio, la regola sulla struttura del CPV è del motore, non del disciplinare."
          }
        ],
        "indeterminatezze": [],
        "rimedi": [],
        "misurazione": {
          "unita": {
            "tipo": "conteggio",
            "sostantivo": {
              "singolare": "fornitura",
              "plurale": "forniture"
            }
          },
          "soglia": 1,
          "raggiunto": 1,
          "massimo": 3,
          "delta": 0,
          "minimiRuolo": []
        }
      }
    ],
    "anomalie": [],
    "avvisiScadenza": [
      {
        "soggettoId": "s-alfa",
        "descrizioneVoce": "certificazione ISO 9001 — produzione e commercializzazione di dispositivi medici",
        "scadeIl": "2026-11-30",
        "fonte": {
          "documento": "Fascicolo aziendale",
          "riferimento": "certificato ISO 9001"
        },
        "requisitiIds": [
          "l2-iso-9001"
        ],
        "primaDelTermine": false,
        "entroOrizzonte": true
      }
    ],
    "percorsoMinimo": {
      "esito": "gia_ammissibile",
      "verdetto": "ammissibile",
      "residui": [],
      "miglioramenti": []
    }
  }
};
