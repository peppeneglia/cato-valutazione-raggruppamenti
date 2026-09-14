// Fixture: la gara REALE della ASL Roma 6, n. 9445747 — fornitura di
// farmaci e dispositivi da parte di grossista con consegna veloce.
//
// Il bando e i sei requisiti sono presi dal disciplinare di gara pubblico,
// con articolo e pagina per ogni valore (estrazione strutturata in
// Documenti/estrazione-disciplinare.md). Le IMPRESE sono inventate, con i
// loro fascicoli: fascicoli reali non ne abbiamo, e la pagina lo dichiara.
// I fascicoli sono costruiti perché la demo mostri i comportamenti del
// motore sul documento che non decide, non perché "vada bene".
//
// La gara è monolotto: un lotto vale più di due inventati. Il multi-lotto
// resta coperto dai test sintetici.

import type { Bando, Esito, Fonte, LottoId, Raggruppamento, Soggetto, ValoreBando } from './domain';

// ─── Fonti ───────────────────────────────────────────────────

const DISCIPLINARE = 'Disciplinare di gara ASL Roma 6, gara n. 9445747';

function D(riferimento: string, pagina: number): Fonte {
  return { documento: DISCIPLINARE, riferimento, pagina };
}

/** Fascicoli inventati: la fonte dice "di esempio" perché nessuno la scambi per un documento vero. */
function F(riferimento: string): Fonte {
  return { documento: 'Fascicolo aziendale (di esempio)', riferimento };
}

// ─── Valori nominati del bando ───────────────────────────────
// I criteri rinviano a questi per nome. Il "valore stimato dell'appalto"
// è scritto in due modi nella stessa pagina (art. 3.2, p. 10: € 966.144,50
// nel testo, € 1.025.000,00 nella tabella), e l'importo a base di gara
// (art. 3, p. 9) è il terzo candidato plausibile. Non scegliamo:
// rappresentiamo la contraddizione e il motore valuta sotto ciascuno.

const IMPORTO_BASE_ASTA: ValoreBando = {
  nome: "importo a base d'asta",
  candidati: [{ valore: 750_000, fonte: D('art. 3 — importo a base di gara, triennale, IVA esclusa', 9) }],
};

const VALORE_STIMATO: ValoreBando = {
  nome: "valore stimato dell'appalto",
  candidati: [
    { valore: 750_000, fonte: D('art. 3, importo a base di gara', 9) },
    { valore: 966_144.5, fonte: D('art. 3.2, testo', 10) },
    { valore: 1_025_000, fonte: D('art. 3.2, tabella', 10) },
  ],
};

// ─── Bando ───────────────────────────────────────────────────

const OGGETTO = 'Fornitura di farmaci di fascia A e C, parafarmaci, integratori, alimenti e dietetici, diagnostici, galenici e materie prime, dispositivi medici, da parte di grossista con consegna veloce';

const FORNITURE_ANALOGHE = { singolare: 'fornitura analoga', plurale: 'forniture analoghe' };

export const bando: Bando = {
  id: 'asl-roma-6-9445747',
  oggetto: OGGETTO,
  stazioneAppaltante: 'ASL Roma 6',
  // Il disciplinare NON scrive la data di pubblicazione: l'art. 1 (p. 4)
  // dice che il bando è stato "inviato per la pubblicazione", senza data.
  // È un dato del documento che è assente, non una dimenticanza nostra.
  dataPubblicazione: undefined,
  // "ore 12.00 del giorno 15 Gennaio 2024", termine perentorio (art. 13, p. 18).
  terminePresentazione: '2024-01-15',
  termineChiarimenti: {
    data: '2023-12-27',
    ora: '12:00',
    fonte: D('art. 2.2 — chiarimenti "entro le ore 12:00 del giorno 27/12/2023"', 7),
    risposteEntro: { valore: '2024-01-04', fonte: D('art. 2.2 — risposte pubblicate entro il 04/01/2024', 7) },
  },
  baseAsta: 750_000,
  valori: [IMPORTO_BASE_ASTA, VALORE_STIMATO],
  fonte: D('frontespizio e art. 1', 1),
  lotti: [
    {
      // Il documento non numera il lotto: "La presente procedura prevede un lotto unico" (art. 3, p. 9).
      id: 'lotto-unico',
      oggetto: OGGETTO,
      importo: 750_000,
      // Il documento lo chiama "Codice identificativo gara" (art. 1, p. 4).
      cig: 'A030255389',
      prestazioni: [
        {
          // Il disciplinare non scompone l'appalto in prestazioni: la
          // dichiarazione dei raggruppamenti indica "la percentuale in caso
          // di servizio/forniture indivisibili" (§15.4, pp. 24–25). La
          // prestazione è una, per l'intero importo.
          id: 'fornitura',
          descrizione: 'Fornitura di farmaci, parafarmaci, dispositivi medici e altro, da grossista con consegna veloce',
          importo: 750_000,
          natura: 'indivisibile',
          fonte: D('art. 3 (oggetto) e §15.4 (forniture indivisibili)', 9),
        },
      ],
      requisiti: [
        {
          id: 'requisiti-generali',
          famiglia: 'generale',
          descrizione: 'Requisiti di ordine generale: assenza delle cause di esclusione di cui agli articoli 94 e 95 del Codice',
          letture: [{ criterio: { tipo: 'dichiarazione', oggetto: 'Assenza delle cause di esclusione di cui agli articoli 94 e 95 del Codice' } }],
          // L'art. 5 (p. 12) dice come si possiedono nei CONSORZI; per i
          // raggruppamenti temporanei non lo dice, e il §6.4 tratta solo i
          // requisiti di ordine speciale.
          regola: { tipo: 'non_dichiarata' },
          // "Non è consentito l'avvalimento per soddisfare i requisiti di ordine generale" (art. 7, p. 15).
          avvalibile: false,
          vincolante: true,
          fonte: D('art. 5 — Requisiti generali', 12),
        },
        {
          id: 'registro-imprese',
          famiglia: 'iscrizione',
          descrizione: "Iscrizione nel registro delle imprese oppure nell'Albo delle Imprese Artigiane per attività pertinenti con quelle oggetto della procedura",
          // Il disciplinare non dice quali attività siano pertinenti: il
          // confronto è testuale, e ogni attività scritta diversamente è
          // un giudizio da verificare.
          letture: [{ criterio: { tipo: 'iscrizione', registro: 'Registro delle imprese', attivita: 'attività pertinenti con quelle oggetto della presente procedura di gara' } }],
          // "da ciascun componente del raggruppamento" (§6.4, p. 14).
          regola: { tipo: 'ciascun_membro' },
          // L'art. 7 (p. 15) esclude l'avvalimento per "l'iscrizione alla
          // Camera di commercio"; il §6.1 a) parla di "registro delle
          // imprese oppure Albo delle Imprese Artigiane". Le due espressioni
          // non coincidono testualmente; si legge come lo stesso requisito.
          avvalibile: false,
          vincolante: true,
          fonte: D('§6.1 lett. a) — Requisiti di idoneità professionale', 13),
        },
        {
          id: 'registri-di-settore',
          famiglia: 'iscrizione',
          descrizione: "Iscrizione in registri o albi se prescritta dalla legislazione vigente per l'esercizio dell'attività oggetto di appalto",
          // Il documento non nomina né il registro né la legge: non c'è
          // niente contro cui confrontare un fascicolo.
          letture: [{ criterio: { tipo: 'non_determinato', testo: "Iscrizione in registri o albi se prescritta dalla legislazione vigente per l'esercizio, da parte del concorrente, dell'attività oggetto di appalto" } }],
          // Il §6.4 (p. 14) non lo menziona.
          regola: { tipo: 'non_dichiarata' },
          // Deriva dalla clausola generale dell'art. 7 (p. 15) sui requisiti
          // "di ordine speciale di cui al punto 6", non da un silenzio
          // interpretato: questo requisito è nel punto 6 e non è tra le due
          // esclusioni espresse. Il criterio è comunque non determinato e
          // nessun avvalimento si calcola.
          avvalibile: true,
          vincolante: true,
          fonte: D('§6.1 lett. b) — Requisiti di idoneità professionale', 13),
        },
        {
          id: 'fatturato-globale',
          famiglia: 'economico',
          descrizione: "Fatturato globale almeno pari al valore stimato dell'appalto, maturato complessivamente nel triennio 2020/2021/2022",
          letture: [{
            criterio: {
              tipo: 'fatturato',
              ambito: { tipo: 'globale' },
              // Anni di calendario fissati dal documento, non a ritroso.
              periodo: { tipo: 'esercizi', anni: [2020, 2021, 2022] },
              // "almeno pari al valore stimato dell'appalto in oggetto": un rinvio, non una cifra.
              soglia: { rinvio: "valore stimato dell'appalto" },
            },
          }],
          // "deve essere soddisfatto dal raggruppamento temporaneo nel
          // complesso" (§6.4, p. 14). Nessuna percentuale minima per la
          // mandataria o le mandanti: il documento non ne prevede.
          regola: { tipo: 'somma_membri' },
          // Requisito di ordine speciale del punto 6, non escluso (art. 7, p. 15).
          avvalibile: true,
          vincolante: true,
          fonte: D('§6.2 lett. a) — Requisiti di capacità economica e finanziaria', 13),
        },
        {
          id: 'certificazione-qualita',
          famiglia: 'certificazione',
          descrizione: "Certificazione del sistema di gestione della qualità UNI EN ISO 9001:2015 nel settore oggetto dell'appalto e/o ISO 13485",
          // "e/o": ne basta una. Lo scope richiesto è testo libero del
          // documento: coincide, o è un giudizio.
          letture: [{ criterio: { tipo: 'certificazione', norme: ['UNI EN ISO 9001:2015', 'ISO 13485'], scope: "settore oggetto dell'appalto" } }],
          // Il §6.4 (p. 14) non la menziona: a pena di esclusione, senza
          // dire chi debba possederla nel raggruppamento.
          regola: { tipo: 'non_dichiarata' },
          // Clausola generale dell'art. 7 (p. 15) sui requisiti del punto 6.
          avvalibile: true,
          vincolante: true,
          fonte: D('§6.3 lett. a) — Requisiti di capacità tecnica e professionale', 13),
        },
        {
          id: 'forniture-analoghe',
          famiglia: 'referenza',
          descrizione: "Forniture analoghe nel settore di attività oggetto dell'appalto, regolarmente eseguite nell'ultimo triennio, di importo non inferiore all'importo a base d'asta",
          // Il documento non dice se la soglia vada raggiunta da un solo
          // contratto o dalla somma: due letture, entrambe esprimibili.
          // "Ultimo triennio" senza dies a quo: ancoraggio non dichiarato.
          // Il CPV di gara (art. 1, p. 4) è 33190000-8, "Dispositivi e
          // prodotti medici vari"; un CPV con le stesse prime due cifre è
          // analogo da verificare, uno diverso non conta.
          letture: [
            {
              testo: "un solo contratto di importo non inferiore all'importo a base d'asta",
              criterio: {
                tipo: 'servizi',
                cpv: '33190000-8',
                cifreCpvComuni: 2,
                anni: 3,
                ancoraggio: 'non_dichiarato',
                importoMinimoUnitario: { rinvio: "importo a base d'asta" },
                numeroMinimo: 1,
                sostantivo: FORNITURE_ANALOGHE,
              },
            },
            {
              testo: "la somma delle forniture non inferiore all'importo a base d'asta",
              criterio: {
                tipo: 'servizi_importo',
                cpv: '33190000-8',
                cifreCpvComuni: 2,
                anni: 3,
                ancoraggio: 'non_dichiarato',
                soglia: { rinvio: "importo a base d'asta" },
              },
            },
          ],
          // "deve essere posseduto dal raggruppamento nel complesso" (§6.4, p. 14).
          regola: { tipo: 'somma_membri' },
          avvalibile: true,
          vincolante: true,
          fonte: D('§6.3 lett. b) — Requisiti di capacità tecnica e professionale', 14),
        },
      ],
    },
  ],
};

// ─── Soggetti (inventati) ────────────────────────────────────
// Grossisti farmaceutici di esempio. I valori sono scelti per mostrare i
// comportamenti nuovi: il fatturato del raggruppamento sta tra 966.144,50
// e 1.025.000 (sopra due candidati, sotto il terzo); un membro ha un
// contratto singolo sopra 750.000 (le due letture concordano); sulla ISO
// uno ha lo scope con le parole del disciplinare, uno uno scope diverso,
// uno niente; sul Registro imprese uno è pertinente alla lettera, uno
// richiede il giudizio. Gli importi sono al netto di IVA: il disciplinare
// non lo precisa e questa è una convenzione della fixture, non del motore.

const DICHIARAZIONE = 'Assenza delle cause di esclusione di cui agli articoli 94 e 95 del Codice';
const ATTIVITA_PERTINENTE = 'attività pertinenti con quelle oggetto della presente procedura di gara';
const SCOPE_APPALTO = "settore oggetto dell'appalto";

export const soggetti: Soggetto[] = [
  {
    id: 's-farmalazio',
    denominazione: 'Farmadistribuzione Laziale S.p.A.',
    fascicolo: [
      { tipo: 'dichiarazione', oggetto: DICHIARAZIONE, resa: { valore: true, fonte: F('DGUE') } },
      { tipo: 'iscrizione', registro: 'Registro delle imprese', attivita: ATTIVITA_PERTINENTE, possesso: { valore: true, fonte: F('visura camerale') } },
      { tipo: 'fatturato', esercizio: 2020, ambito: { tipo: 'globale' }, importo: { valore: 220_000, fonte: F('bilancio 2020') } },
      { tipo: 'fatturato', esercizio: 2021, ambito: { tipo: 'globale' }, importo: { valore: 230_000, fonte: F('bilancio 2021') } },
      { tipo: 'fatturato', esercizio: 2022, ambito: { tipo: 'globale' }, importo: { valore: 250_000, fonte: F('bilancio 2022') } },
      // Scope scritto con le parole del disciplinare: coincide, quindi è posseduta con certezza.
      { tipo: 'certificazione', norma: 'UNI EN ISO 9001:2015', scope: SCOPE_APPALTO, possesso: { valore: true, fonte: F('certificato ISO 9001:2015'), validoA: '2024-03-31' } },
      // Un contratto singolo sopra la base d'asta: le due letture delle forniture analoghe concordano.
      { tipo: 'servizio', oggetto: 'Fornitura di farmaci e dispositivi medici con consegna in urgenza', cpv: '33190000-8', committente: 'Azienda sanitaria di esempio A', importo: 800_000, periodo: { valore: { da: '2022-02-01', a: '2023-12-31' }, fonte: F('certificato di esecuzione — Azienda sanitaria di esempio A') } },
      // CPV dei farmaci (33600000-6): stesse prime due cifre, analogia da valutare.
      { tipo: 'servizio', oggetto: 'Fornitura di farmaci di fascia A', cpv: '33600000-6', committente: 'Azienda sanitaria di esempio B', importo: 150_000, periodo: { valore: { da: '2023-01-01', a: '2023-10-31' }, fonte: F('certificato di esecuzione — Azienda sanitaria di esempio B') } },
      // Finita prima della finestra ancorata al termine di presentazione: la nota dice di quanto dovrebbe arretrare l'ancoraggio.
      { tipo: 'servizio', oggetto: 'Fornitura di dispositivi medici monouso', cpv: '33190000-8', committente: 'Azienda sanitaria di esempio C', importo: 200_000, periodo: { valore: { da: '2019-06-01', a: '2020-12-20' }, fonte: F('certificato di esecuzione — Azienda sanitaria di esempio C') } },
    ],
  },
  {
    id: 's-ospedalia',
    denominazione: 'Ospedalia Forniture S.r.l.',
    fascicolo: [
      { tipo: 'dichiarazione', oggetto: DICHIARAZIONE, resa: { valore: true, fonte: F('DGUE') } },
      // Attività scritta diversamente: pertinente? Decide una persona.
      { tipo: 'iscrizione', registro: 'Registro delle imprese', attivita: "commercio all'ingrosso di articoli medicali e ortopedici", possesso: { valore: true, fonte: F('visura camerale') } },
      { tipo: 'fatturato', esercizio: 2020, ambito: { tipo: 'globale' }, importo: { valore: 60_000, fonte: F('bilancio 2020') } },
      { tipo: 'fatturato', esercizio: 2021, ambito: { tipo: 'globale' }, importo: { valore: 65_000, fonte: F('bilancio 2021') } },
      { tipo: 'fatturato', esercizio: 2022, ambito: { tipo: 'globale' }, importo: { valore: 65_000, fonte: F('bilancio 2022') } },
      // ISO 9001 valida, scope diverso: la riga in cui le due famiglie di indeterminatezza convivono.
      { tipo: 'certificazione', norma: 'UNI EN ISO 9001:2015', scope: 'commercializzazione di arredi e attrezzature per strutture sanitarie', possesso: { valore: true, fonte: F('certificato ISO 9001:2015'), validoA: '2025-09-30' } },
      { tipo: 'servizio', oggetto: 'Fornitura di dispositivi medici per reparti di degenza', cpv: '33190000-8', committente: 'Azienda sanitaria di esempio D', importo: 120_000, periodo: { valore: { da: '2022-09-01', a: '2023-08-31' }, fonte: F('certificato di esecuzione — Azienda sanitaria di esempio D') } },
    ],
  },
  {
    id: 's-medifarm',
    denominazione: 'Medifarm Logistica S.r.l.',
    fascicolo: [
      { tipo: 'dichiarazione', oggetto: DICHIARAZIONE, resa: { valore: true, fonte: F('DGUE') } },
      { tipo: 'iscrizione', registro: 'Registro delle imprese', attivita: ATTIVITA_PERTINENTE, possesso: { valore: true, fonte: F('visura camerale') } },
      { tipo: 'fatturato', esercizio: 2020, ambito: { tipo: 'globale' }, importo: { valore: 30_000, fonte: F('bilancio 2020') } },
      { tipo: 'fatturato', esercizio: 2021, ambito: { tipo: 'globale' }, importo: { valore: 35_000, fonte: F('bilancio 2021') } },
      { tipo: 'fatturato', esercizio: 2022, ambito: { tipo: 'globale' }, importo: { valore: 35_000, fonte: F('bilancio 2022') } },
      // Nessuna certificazione di qualità.
      { tipo: 'servizio', oggetto: 'Consegna urgente di farmaci e dispositivi a strutture territoriali', cpv: '33190000-8', committente: 'Azienda sanitaria di esempio E', importo: 60_000, periodo: { valore: { da: '2023-03-01', a: '2023-12-31' }, fonte: F('certificato di esecuzione — Azienda sanitaria di esempio E') } },
    ],
  },
  {
    // Non è nel raggruppamento: può entrare come ausiliaria sul fatturato,
    // che è avvalibile, e portare la somma sopra tutti e tre i candidati.
    id: 's-grossfarma',
    denominazione: 'Grossfarma Centro-Sud S.p.A.',
    fascicolo: [
      { tipo: 'dichiarazione', oggetto: DICHIARAZIONE, resa: { valore: true, fonte: F('DGUE') } },
      { tipo: 'iscrizione', registro: 'Registro delle imprese', attivita: ATTIVITA_PERTINENTE, possesso: { valore: true, fonte: F('visura camerale') } },
      { tipo: 'fatturato', esercizio: 2020, ambito: { tipo: 'globale' }, importo: { valore: 130_000, fonte: F('bilancio 2020') } },
      { tipo: 'fatturato', esercizio: 2021, ambito: { tipo: 'globale' }, importo: { valore: 135_000, fonte: F('bilancio 2021') } },
      { tipo: 'fatturato', esercizio: 2022, ambito: { tipo: 'globale' }, importo: { valore: 135_000, fonte: F('bilancio 2022') } },
      { tipo: 'certificazione', norma: 'ISO 13485', scope: SCOPE_APPALTO, possesso: { valore: true, fonte: F('certificato ISO 13485'), validoA: '2026-06-30' } },
      { tipo: 'servizio', oggetto: 'Fornitura di farmaci e parafarmaci con consegna in giornata', cpv: '33190000-8', committente: 'Azienda sanitaria di esempio F', importo: 500_000, periodo: { valore: { da: '2021-06-01', a: '2023-05-31' }, fonte: F('certificato di esecuzione — Azienda sanitaria di esempio F') } },
    ],
  },
];

// ─── Raggruppamento ──────────────────────────────────────────
// Il disciplinare non distingue raggruppamenti orizzontali, verticali o
// misti (art. 4, pp. 10–12): l'etichetta qui è descrittiva. Le quote sono
// "la percentuale in caso di forniture indivisibili" (§15.4).

export const raggruppamento: Raggruppamento = {
  tipo: 'orizzontale',
  membri: [
    { ruolo: 'mandataria', soggettoId: 's-farmalazio', quote: { fornitura: 0.6 } },
    { ruolo: 'mandante', soggettoId: 's-ospedalia', quote: { fornitura: 0.25 } },
    { ruolo: 'mandante', soggettoId: 's-medifarm', quote: { fornitura: 0.15 } },
  ],
};

/**
 * Tra il termine per i chiarimenti (27/12/2023) e quello di presentazione
 * (15/01/2024): i rimedi di chiarimenti risultano decorsi, e si vede cosa
 * succede. I test coprono anche una data prima del 27/12/2023.
 */
export const DATA_RIFERIMENTO = '2024-01-08';
export const ORIZZONTE_SCADENZE_GIORNI = 90;

/** La pagina lo dice: il bando è vero, le imprese no. */
export const DICHIARAZIONE_DATI = 'Bando reale: ASL Roma 6, gara n. 9445747, disciplinare di gara pubblico. Le imprese e i loro fascicoli sono di esempio, inventati.';

// ─── Esito atteso ────────────────────────────────────────────
// GENERATO dal motore (`valuta`) su questa fixture, alla data di riferimento
// e con l'orizzonte qui sopra, e letto riga per riga prima di essere fissato.
// Non è scritto a mano: dove il motore cambia, questo cambia con lui e il
// test di integrazione lo dice. Per rigenerarlo: `npm run fixture:esito`.

export const esitoAtteso: Record<LottoId, Esito> = {
  "lotto-unico": {
    "lottoId": "lotto-unico",
    "valutatoAl": "2024-01-08",
    "verdetto": "ammissibile_con_riserva",
    "requisiti": [
      {
        "requisitoId": "requisiti-generali",
        "stato": "da_verificare",
        "contributi": [
          {
            "soggettoId": "s-farmalazio",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "DGUE"
              }
            ]
          },
          {
            "soggettoId": "s-ospedalia",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "DGUE"
              }
            ]
          },
          {
            "soggettoId": "s-medifarm",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "DGUE"
              }
            ]
          }
        ],
        "motivazione": "Il disciplinare non dice come il requisito si componga nel raggruppamento: nessuna regola è stata applicata. Per membro: Farmadistribuzione Laziale S.p.A. lo possiede; Ospedalia Forniture S.r.l. lo possiede; Medifarm Logistica S.r.l. lo possiede.",
        "assunzioni": [],
        "indeterminatezze": [
          {
            "tipo": "regola_non_dichiarata"
          }
        ],
        "rimedi": [
          {
            "tipo": "richiesta_chiarimenti",
            "requisitoId": "requisiti-generali",
            "quesiti": [
              "In caso di raggruppamento temporaneo, da chi deve essere posseduto il requisito «Requisiti di ordine generale: assenza delle cause di esclusione di cui agli articoli 94 e 95 del Codice»: da ciascun componente, dalla sola mandataria o dal raggruppamento nel complesso?"
            ],
            "termine": {
              "data": "2023-12-27",
              "ora": "12:00"
            },
            "decorso": true
          }
        ]
      },
      {
        "requisitoId": "registro-imprese",
        "stato": "da_verificare",
        "contributi": [
          {
            "soggettoId": "s-farmalazio",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "visura camerale"
              }
            ]
          },
          {
            "soggettoId": "s-ospedalia",
            "valore": {
              "tipo": "possesso",
              "esito": "da_verificare"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "visura camerale"
              }
            ],
            "nota": "iscrizione Registro delle imprese con «commercio all'ingrosso di articoli medicali e ortopedici» invece di «attività pertinenti con quelle oggetto della presente procedura di gara»: equivalenza da valutare"
          },
          {
            "soggettoId": "s-medifarm",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "visura camerale"
              }
            ]
          }
        ],
        "motivazione": "Richiesto a ciascun membro: Ospedalia Forniture S.r.l. (iscrizione Registro delle imprese con «commercio all'ingrosso di articoli medicali e ortopedici» invece di «attività pertinenti con quelle oggetto della presente procedura di gara»: equivalenza da valutare) lo possiede con riserva. Il confronto che manca è un giudizio semantico: decide una persona, non il motore.",
        "assunzioni": [],
        "indeterminatezze": [
          {
            "tipo": "giudizio_richiesto",
            "soggettoId": "s-ospedalia",
            "oggetto": "equivalenza tra «commercio all'ingrosso di articoli medicali e ortopedici» e «attività pertinenti con quelle oggetto della presente procedura di gara» (iscrizione Registro delle imprese)"
          }
        ],
        "rimedi": []
      },
      {
        "requisitoId": "registri-di-settore",
        "stato": "da_verificare",
        "contributi": [],
        "motivazione": "Il disciplinare non dice cosa soddisfi il requisito: lo formula come «Iscrizione in registri o albi se prescritta dalla legislazione vigente per l'esercizio, da parte del concorrente, dell'attività oggetto di appalto» senza nominare un registro, una norma o un documento. Nessun fascicolo si può confrontare.",
        "assunzioni": [],
        "indeterminatezze": [
          {
            "tipo": "criterio_non_determinato",
            "testo": "Iscrizione in registri o albi se prescritta dalla legislazione vigente per l'esercizio, da parte del concorrente, dell'attività oggetto di appalto"
          },
          {
            "tipo": "regola_non_dichiarata"
          }
        ],
        "rimedi": [
          {
            "tipo": "richiesta_chiarimenti",
            "requisitoId": "registri-di-settore",
            "quesiti": [
              "Quale registro, albo o documento soddisfa il requisito «Iscrizione in registri o albi se prescritta dalla legislazione vigente per l'esercizio dell'attività oggetto di appalto»? Il disciplinare non lo nomina.",
              "In caso di raggruppamento temporaneo, da chi deve essere posseduto il requisito «Iscrizione in registri o albi se prescritta dalla legislazione vigente per l'esercizio dell'attività oggetto di appalto»: da ciascun componente, dalla sola mandataria o dal raggruppamento nel complesso?"
            ],
            "termine": {
              "data": "2023-12-27",
              "ora": "12:00"
            },
            "decorso": true
          }
        ]
      },
      {
        "requisitoId": "fatturato-globale",
        "stato": "da_verificare",
        "contributi": [
          {
            "soggettoId": "s-farmalazio",
            "valore": {
              "tipo": "misura",
              "certo": 700000,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "bilancio 2020"
              },
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "bilancio 2021"
              },
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "bilancio 2022"
              }
            ]
          },
          {
            "soggettoId": "s-ospedalia",
            "valore": {
              "tipo": "misura",
              "certo": 190000,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "bilancio 2020"
              },
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "bilancio 2021"
              },
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "bilancio 2022"
              }
            ]
          },
          {
            "soggettoId": "s-medifarm",
            "valore": {
              "tipo": "misura",
              "certo": 100000,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "bilancio 2020"
              },
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "bilancio 2021"
              },
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "bilancio 2022"
              }
            ]
          }
        ],
        "motivazione": "Il documento ammette 3 letture con esiti diversi: sotto «valore stimato dell'appalto = 750.000 € (art. 3, importo a base di gara, p. 9)» coperto; sotto «valore stimato dell'appalto = 966.144,50 € (art. 3.2, testo, p. 10)» coperto; sotto «valore stimato dell'appalto = 1.025.000 € (art. 3.2, tabella, p. 10)» scoperto (mancano 35.000 €). Fino a un chiarimento non si può decidere; i numeri mostrati sono della lettura peggiore.",
        "assunzioni": [],
        "indeterminatezze": [
          {
            "tipo": "valore_contraddittorio",
            "nome": "valore stimato dell'appalto",
            "esiti": [
              {
                "etichetta": "750.000 € (art. 3, importo a base di gara, p. 9)",
                "stato": "coperto"
              },
              {
                "etichetta": "966.144,50 € (art. 3.2, testo, p. 10)",
                "stato": "coperto"
              },
              {
                "etichetta": "1.025.000 € (art. 3.2, tabella, p. 10)",
                "stato": "scoperto"
              }
            ]
          }
        ],
        "rimedi": [
          {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-grossfarma",
            "ruolo": "mandante",
            "quote": {}
          },
          {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-grossfarma",
            "ruolo": "mandante",
            "quote": {
              "fornitura": 0.6
            },
            "rilevateDa": "s-farmalazio"
          },
          {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-grossfarma",
            "ruolo": "mandante",
            "quote": {
              "fornitura": 0.15
            },
            "rilevateDa": "s-medifarm"
          },
          {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-grossfarma",
            "ruolo": "mandante",
            "quote": {
              "fornitura": 0.25
            },
            "rilevateDa": "s-ospedalia"
          },
          {
            "tipo": "avvalimento",
            "requisitoId": "fatturato-globale",
            "ausiliariaId": "s-grossfarma",
            "ausiliataId": "s-farmalazio"
          },
          {
            "tipo": "richiesta_chiarimenti",
            "requisitoId": "fatturato-globale",
            "quesiti": [
              "Quale valore di «valore stimato dell'appalto» vale per il requisito «Fatturato globale almeno pari al valore stimato dell'appalto, maturato complessivamente nel triennio 2020/2021/2022»: 750.000 € (art. 3, importo a base di gara, p. 9) oppure 966.144,50 € (art. 3.2, testo, p. 10) oppure 1.025.000 € (art. 3.2, tabella, p. 10)?"
            ],
            "termine": {
              "data": "2023-12-27",
              "ora": "12:00"
            },
            "decorso": true
          }
        ],
        "misurazione": {
          "unita": {
            "tipo": "euro"
          },
          "soglia": 1025000,
          "raggiunto": 990000,
          "massimo": 990000,
          "delta": 35000,
          "minimiRuolo": []
        },
        "varianti": [
          {
            "etichetta": "valore stimato dell'appalto = 750.000 € (art. 3, importo a base di gara, p. 9)",
            "stato": "coperto",
            "misurazione": {
              "unita": {
                "tipo": "euro"
              },
              "soglia": 750000,
              "raggiunto": 990000,
              "massimo": 990000,
              "delta": 0,
              "minimiRuolo": []
            },
            "motivazione": "Somma dei contributi certi: 990.000 € su una soglia di 750.000 €: soglia raggiunta. Contributi: Farmadistribuzione Laziale S.p.A. 700.000 €; Ospedalia Forniture S.r.l. 190.000 €; Medifarm Logistica S.r.l. 100.000 €."
          },
          {
            "etichetta": "valore stimato dell'appalto = 966.144,50 € (art. 3.2, testo, p. 10)",
            "stato": "coperto",
            "misurazione": {
              "unita": {
                "tipo": "euro"
              },
              "soglia": 966144.5,
              "raggiunto": 990000,
              "massimo": 990000,
              "delta": 0,
              "minimiRuolo": []
            },
            "motivazione": "Somma dei contributi certi: 990.000 € su una soglia di 966.144,50 €: soglia raggiunta. Contributi: Farmadistribuzione Laziale S.p.A. 700.000 €; Ospedalia Forniture S.r.l. 190.000 €; Medifarm Logistica S.r.l. 100.000 €."
          },
          {
            "etichetta": "valore stimato dell'appalto = 1.025.000 € (art. 3.2, tabella, p. 10)",
            "stato": "scoperto",
            "misurazione": {
              "unita": {
                "tipo": "euro"
              },
              "soglia": 1025000,
              "raggiunto": 990000,
              "massimo": 990000,
              "delta": 35000,
              "minimiRuolo": []
            },
            "motivazione": "Somma dei contributi certi: 990.000 € su una soglia di 1.025.000 €: mancano 35.000 €. Contributi: Farmadistribuzione Laziale S.p.A. 700.000 €; Ospedalia Forniture S.r.l. 190.000 €; Medifarm Logistica S.r.l. 100.000 €."
          }
        ]
      },
      {
        "requisitoId": "certificazione-qualita",
        "stato": "da_verificare",
        "contributi": [
          {
            "soggettoId": "s-farmalazio",
            "valore": {
              "tipo": "possesso",
              "esito": "posseduto"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "certificato ISO 9001:2015"
              }
            ]
          },
          {
            "soggettoId": "s-ospedalia",
            "valore": {
              "tipo": "possesso",
              "esito": "da_verificare"
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "certificato ISO 9001:2015"
              }
            ],
            "nota": "certificazione UNI EN ISO 9001:2015 o ISO 13485 con «commercializzazione di arredi e attrezzature per strutture sanitarie» invece di «settore oggetto dell'appalto»: equivalenza da valutare"
          },
          {
            "soggettoId": "s-medifarm",
            "valore": {
              "tipo": "possesso",
              "esito": "assente"
            },
            "conteggiato": true,
            "fonti": [],
            "nota": "nessuna certificazione UNI EN ISO 9001:2015 o ISO 13485 nel fascicolo"
          }
        ],
        "motivazione": "Il disciplinare non dice come il requisito si componga nel raggruppamento: nessuna regola è stata applicata. Per membro: Farmadistribuzione Laziale S.p.A. lo possiede; Ospedalia Forniture S.r.l. lo possiede con riserva (certificazione UNI EN ISO 9001:2015 o ISO 13485 con «commercializzazione di arredi e attrezzature per strutture sanitarie» invece di «settore oggetto dell'appalto»: equivalenza da valutare); Medifarm Logistica S.r.l. non lo possiede (nessuna certificazione UNI EN ISO 9001:2015 o ISO 13485 nel fascicolo). Il confronto che manca è un giudizio semantico: decide una persona, non il motore.",
        "assunzioni": [],
        "indeterminatezze": [
          {
            "tipo": "regola_non_dichiarata"
          },
          {
            "tipo": "giudizio_richiesto",
            "soggettoId": "s-ospedalia",
            "oggetto": "equivalenza tra «commercializzazione di arredi e attrezzature per strutture sanitarie» e «settore oggetto dell'appalto» (certificazione UNI EN ISO 9001:2015 o ISO 13485)"
          }
        ],
        "rimedi": [
          {
            "tipo": "richiesta_chiarimenti",
            "requisitoId": "certificazione-qualita",
            "quesiti": [
              "In caso di raggruppamento temporaneo, da chi deve essere posseduto il requisito «Certificazione del sistema di gestione della qualità UNI EN ISO 9001:2015 nel settore oggetto dell'appalto e/o ISO 13485»: da ciascun componente, dalla sola mandataria o dal raggruppamento nel complesso?"
            ],
            "termine": {
              "data": "2023-12-27",
              "ora": "12:00"
            },
            "decorso": true
          }
        ]
      },
      {
        "requisitoId": "forniture-analoghe",
        "stato": "coperto",
        "contributi": [
          {
            "soggettoId": "s-farmalazio",
            "valore": {
              "tipo": "misura",
              "certo": 1,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [
              {
                "documento": "Fascicolo aziendale (di esempio)",
                "riferimento": "certificato di esecuzione — Azienda sanitaria di esempio A"
              }
            ],
            "nota": "servizio «Fornitura di farmaci di fascia A» per Azienda sanitaria di esempio B: importo 150.000 € sotto il minimo unitario di 750.000 €; fuori dalla finestra 15/01/2021 – 15/01/2024: «Fornitura di dispositivi medici monouso» (01/06/2019 – 20/12/2020); ancoraggio assunto al termine di presentazione: quelle contate restano nella finestra fino a un arretramento di 713 giorni (la più esposta è «Fornitura di farmaci e dispositivi medici con consegna in urgenza»); con un arretramento di almeno 26 giorni conterebbe anche «Fornitura di dispositivi medici monouso»"
          },
          {
            "soggettoId": "s-ospedalia",
            "valore": {
              "tipo": "misura",
              "certo": 0,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [],
            "nota": "servizio «Fornitura di dispositivi medici per reparti di degenza» per Azienda sanitaria di esempio D: importo 120.000 € sotto il minimo unitario di 750.000 €"
          },
          {
            "soggettoId": "s-medifarm",
            "valore": {
              "tipo": "misura",
              "certo": 0,
              "incerto": 0
            },
            "conteggiato": true,
            "fonti": [],
            "nota": "servizio «Consegna urgente di farmaci e dispositivi a strutture territoriali» per Azienda sanitaria di esempio E: importo 60.000 € sotto il minimo unitario di 750.000 €"
          }
        ],
        "motivazione": "Somma dei contributi certi: 1 fornitura analoga su una soglia di 1 fornitura analoga: soglia raggiunta. Contributi: Farmadistribuzione Laziale S.p.A. 1 fornitura analoga (servizio «Fornitura di farmaci di fascia A» per Azienda sanitaria di esempio B: importo 150.000 € sotto il minimo unitario di 750.000 €; fuori dalla finestra 15/01/2021 – 15/01/2024: «Fornitura di dispositivi medici monouso» (01/06/2019 – 20/12/2020); ancoraggio assunto al termine di presentazione: quelle contate restano nella finestra fino a un arretramento di 713 giorni (la più esposta è «Fornitura di farmaci e dispositivi medici con consegna in urgenza»); con un arretramento di almeno 26 giorni conterebbe anche «Fornitura di dispositivi medici monouso»); Ospedalia Forniture S.r.l. 0 forniture analoghe (servizio «Fornitura di dispositivi medici per reparti di degenza» per Azienda sanitaria di esempio D: importo 120.000 € sotto il minimo unitario di 750.000 €); Medifarm Logistica S.r.l. 0 forniture analoghe (servizio «Consegna urgente di farmaci e dispositivi a strutture territoriali» per Azienda sanitaria di esempio E: importo 60.000 € sotto il minimo unitario di 750.000 €). Le letture misurano cose diverse (forniture analoghe, euro) e l'esito coincide sotto tutte.",
        "assunzioni": [
          {
            "codice": "ancoraggio_termine_presentazione",
            "testo": "La finestra «ultimi 3 anni» non ha un ancoraggio dichiarato nel disciplinare: è stata ancorata al termine di presentazione (15/01/2024), l'unica data certa del bando. È un'assunzione del motore, non del disciplinare."
          },
          {
            "codice": "esito_concordante",
            "testo": "Il documento ammette più letture del requisito (un solo contratto di importo non inferiore all'importo a base d'asta; la somma delle forniture non inferiore all'importo a base d'asta). L'esito è lo stesso sotto ciascuna, e vale anche se il documento è ambiguo. È un'assunzione del motore, non del disciplinare."
          }
        ],
        "indeterminatezze": [],
        "rimedi": [],
        "misurazione": {
          "unita": {
            "tipo": "conteggio",
            "sostantivo": {
              "singolare": "fornitura analoga",
              "plurale": "forniture analoghe"
            }
          },
          "soglia": 1,
          "raggiunto": 1,
          "massimo": 1,
          "delta": 0,
          "minimiRuolo": []
        },
        "varianti": [
          {
            "etichetta": "un solo contratto di importo non inferiore all'importo a base d'asta",
            "stato": "coperto",
            "misurazione": {
              "unita": {
                "tipo": "conteggio",
                "sostantivo": {
                  "singolare": "fornitura analoga",
                  "plurale": "forniture analoghe"
                }
              },
              "soglia": 1,
              "raggiunto": 1,
              "massimo": 1,
              "delta": 0,
              "minimiRuolo": []
            },
            "motivazione": "Somma dei contributi certi: 1 fornitura analoga su una soglia di 1 fornitura analoga: soglia raggiunta. Contributi: Farmadistribuzione Laziale S.p.A. 1 fornitura analoga (servizio «Fornitura di farmaci di fascia A» per Azienda sanitaria di esempio B: importo 150.000 € sotto il minimo unitario di 750.000 €; fuori dalla finestra 15/01/2021 – 15/01/2024: «Fornitura di dispositivi medici monouso» (01/06/2019 – 20/12/2020); ancoraggio assunto al termine di presentazione: quelle contate restano nella finestra fino a un arretramento di 713 giorni (la più esposta è «Fornitura di farmaci e dispositivi medici con consegna in urgenza»); con un arretramento di almeno 26 giorni conterebbe anche «Fornitura di dispositivi medici monouso»); Ospedalia Forniture S.r.l. 0 forniture analoghe (servizio «Fornitura di dispositivi medici per reparti di degenza» per Azienda sanitaria di esempio D: importo 120.000 € sotto il minimo unitario di 750.000 €); Medifarm Logistica S.r.l. 0 forniture analoghe (servizio «Consegna urgente di farmaci e dispositivi a strutture territoriali» per Azienda sanitaria di esempio E: importo 60.000 € sotto il minimo unitario di 750.000 €)."
          },
          {
            "etichetta": "la somma delle forniture non inferiore all'importo a base d'asta",
            "stato": "coperto",
            "misurazione": {
              "unita": {
                "tipo": "euro"
              },
              "soglia": 750000,
              "raggiunto": 980000,
              "massimo": 1130000,
              "delta": 0,
              "minimiRuolo": []
            },
            "motivazione": "Somma dei contributi certi: 980.000 € su una soglia di 750.000 €: soglia raggiunta. Altri 150.000 € dipendono da fatti da verificare: se reggono, la soglia è raggiunta. Contributi: Farmadistribuzione Laziale S.p.A. 800.000 € più 150.000 € da verificare (servizio «Fornitura di farmaci di fascia A» per Azienda sanitaria di esempio B: CPV 33600000-6 diverso da quello di gara 33190000-8, analogia da valutare; fuori dalla finestra 15/01/2021 – 15/01/2024: «Fornitura di dispositivi medici monouso» (01/06/2019 – 20/12/2020); ancoraggio assunto al termine di presentazione: quelle contate restano nella finestra fino a un arretramento di 379 giorni (la più esposta è «Fornitura di farmaci di fascia A»); con un arretramento di almeno 26 giorni conterebbe anche «Fornitura di dispositivi medici monouso»); Ospedalia Forniture S.r.l. 120.000 € (ancoraggio assunto al termine di presentazione: quelle contate restano nella finestra fino a un arretramento di 501 giorni (la più esposta è «Fornitura di dispositivi medici per reparti di degenza»)); Medifarm Logistica S.r.l. 60.000 € (ancoraggio assunto al termine di presentazione: quelle contate restano nella finestra fino a un arretramento di 320 giorni (la più esposta è «Consegna urgente di farmaci e dispositivi a strutture territoriali»))."
          }
        ]
      }
    ],
    "anomalie": [],
    "avvisiScadenza": [
      {
        "soggettoId": "s-farmalazio",
        "descrizioneVoce": "certificazione UNI EN ISO 9001:2015 — settore oggetto dell'appalto",
        "scadeIl": "2024-03-31",
        "fonte": {
          "documento": "Fascicolo aziendale (di esempio)",
          "riferimento": "certificato ISO 9001:2015"
        },
        "requisitiIds": [
          "certificazione-qualita"
        ],
        "primaDelTermine": false,
        "entroOrizzonte": true
      }
    ],
    "percorsoMinimo": {
      "esito": "gia_ammissibile",
      "verdetto": "ammissibile_con_riserva",
      "residui": [
        "requisiti-generali",
        "registro-imprese",
        "registri-di-settore",
        "fatturato-globale",
        "certificazione-qualita"
      ],
      "miglioramenti": [
        {
          "mossa": {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-grossfarma",
            "ruolo": "mandante",
            "quote": {}
          },
          "requisitiRisolti": [
            "fatturato-globale"
          ]
        },
        {
          "mossa": {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-grossfarma",
            "ruolo": "mandante",
            "quote": {
              "fornitura": 0.6
            },
            "rilevateDa": "s-farmalazio"
          },
          "requisitiRisolti": [
            "fatturato-globale"
          ]
        },
        {
          "mossa": {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-grossfarma",
            "ruolo": "mandante",
            "quote": {
              "fornitura": 0.15
            },
            "rilevateDa": "s-medifarm"
          },
          "requisitiRisolti": [
            "fatturato-globale"
          ]
        },
        {
          "mossa": {
            "tipo": "ingresso_soggetto",
            "soggettoId": "s-grossfarma",
            "ruolo": "mandante",
            "quote": {
              "fornitura": 0.25
            },
            "rilevateDa": "s-ospedalia"
          },
          "requisitiRisolti": [
            "fatturato-globale"
          ]
        },
        {
          "mossa": {
            "tipo": "avvalimento",
            "requisitoId": "fatturato-globale",
            "ausiliariaId": "s-grossfarma",
            "ausiliataId": "s-farmalazio"
          },
          "requisitiRisolti": [
            "fatturato-globale"
          ]
        }
      ]
    }
  }
};
