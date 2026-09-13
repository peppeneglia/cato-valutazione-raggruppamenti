// Fixture di lavoro — gara ASL a tre prestazioni, RTI di tre soggetti.
//
// I valori sono inventati e vanno sostituiti col disciplinare reale (D-009).
// La FORMA invece è definitiva: è quella che l'UI deve saper rendere.

import type {
  Bando, Soggetto, Raggruppamento, Esito,
} from './domain';

// ─── Bando ───────────────────────────────────────────────────

export const bando: Bando = {
  id: 'gara-001',
  oggetto: 'Fornitura di dispositivi medici, manutenzione e formazione',
  stazioneAppaltante: 'ASL [da sostituire]',
  scadenza: '2026-11-14',
  prestazioni: [
    { id: 'p-fornitura', descrizione: 'Fornitura dispositivi', importo: 1_800_000 },
    { id: 'p-manutenzione', descrizione: 'Manutenzione e assistenza', importo: 600_000 },
    { id: 'p-formazione', descrizione: 'Formazione del personale', importo: 100_000 },
  ],
  requisiti: [
    {
      id: 'r-generale',
      famiglia: 'generale',
      descrizione: 'Assenza di cause di esclusione',
      regola: { tipo: 'ciascun_membro' },
      fonte: { documento: 'Disciplinare', riferimento: '[art. da leggere]' },
      vincolante: true,
    },
    {
      id: 'r-fatturato',
      famiglia: 'economico',
      descrizione: 'Fatturato specifico nel settore oggetto di gara, ultimi tre esercizi',
      soglia: 3_000_000,
      unita: 'euro',
      regola: { tipo: 'somma_membri', minimoMandataria: 0.4 },
      fonte: { documento: 'Disciplinare', riferimento: '[art. da leggere]' },
      vincolante: true,
    },
    {
      id: 'r-iso-13485',
      famiglia: 'certificazione',
      descrizione: 'ISO 13485 — dispositivi medici',
      regola: { tipo: 'esecutore_prestazione', prestazioneId: 'p-fornitura' },
      fonte: { documento: 'Disciplinare', riferimento: '[art. da leggere]' },
      vincolante: true,
    },
    {
      id: 'r-iso-9001',
      famiglia: 'certificazione',
      descrizione: 'ISO 9001 — servizi di assistenza tecnica',
      regola: { tipo: 'esecutore_prestazione', prestazioneId: 'p-manutenzione' },
      fonte: { documento: 'Disciplinare', riferimento: '[art. da leggere]' },
      vincolante: true,
    },
    {
      id: 'r-servizi-analoghi',
      famiglia: 'referenza',
      descrizione: "Tre forniture analoghe nell'ultimo quinquennio",
      soglia: 3,
      unita: 'conteggio',
      regola: { tipo: 'somma_membri' },
      fonte: { documento: 'Disciplinare', riferimento: '[art. da leggere]' },
      vincolante: true,
    },
    {
      id: 'r-cciaa',
      famiglia: 'iscrizione',
      descrizione: "Iscrizione CCIAA coerente con l'oggetto di gara",
      regola: { tipo: 'ciascun_membro' },
      fonte: { documento: 'Disciplinare', riferimento: '[art. da leggere]' },
      vincolante: true,
    },
  ],
};

// ─── Soggetti ────────────────────────────────────────────────

const F = (riferimento: string) => ({ documento: 'Fascicolo aziendale', riferimento });

export const soggetti: Soggetto[] = [
  {
    id: 's-alfa',
    denominazione: 'Alfa Medical S.p.A.',
    fascicolo: [
      { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione', resa: { valore: true, fonte: F('DGUE') } },
      { tipo: 'fatturato', esercizio: 2025, ambito: 'dispositivi medici', importo: { valore: 2_100_000, fonte: F('bilancio 2025') } },
      { tipo: 'certificazione', norma: 'ISO 13485', scope: 'produzione dispositivi', possesso: { valore: true, fonte: F('certificato'), validoA: '2028-03-31' } },
      { tipo: 'certificazione', norma: 'ISO 9001', scope: 'produzione', possesso: { valore: true, fonte: F('certificato'), validoA: '2027-09-30' } },
      { tipo: 'servizio', oggetto: 'Fornitura elettromedicali', cpv: '33100000', committente: 'ASL X', importo: 900_000, periodo: { valore: { da: '2023-01-01', a: '2024-12-31' }, fonte: F('certificato esecuzione') } },
      { tipo: 'servizio', oggetto: 'Fornitura monitor multiparametrici', cpv: '33100000', committente: 'AO Y', importo: 450_000, periodo: { valore: { da: '2024-03-01', a: '2025-06-30' }, fonte: F('certificato esecuzione') } },
      { tipo: 'iscrizione', registro: 'CCIAA', attivita: 'commercio dispositivi medici', possesso: { valore: true, fonte: F('visura') } },
    ],
  },
  {
    id: 's-beta',
    denominazione: 'Beta Service S.r.l.',
    fascicolo: [
      { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione', resa: { valore: true, fonte: F('DGUE') } },
      { tipo: 'fatturato', esercizio: 2025, ambito: 'assistenza tecnica', importo: { valore: 600_000, fonte: F('bilancio 2025') } },
      // scaduta: deve far fallire r-iso-9001 senza che nessuno lo scriva a mano
      { tipo: 'certificazione', norma: 'ISO 9001', scope: 'assistenza tecnica', possesso: { valore: true, fonte: F('certificato'), validoA: '2026-04-30' } },
      { tipo: 'servizio', oggetto: 'Manutenzione apparecchiature', cpv: '50421000', committente: 'ASL Z', importo: 300_000, periodo: { valore: { da: '2023-06-01', a: '2025-05-31' }, fonte: F('certificato esecuzione') } },
      { tipo: 'iscrizione', registro: 'CCIAA', attivita: 'manutenzione apparecchiature elettromedicali', possesso: { valore: true, fonte: F('visura') } },
    ],
  },
  {
    id: 's-gamma',
    denominazione: 'Gamma Formazione S.r.l.',
    fascicolo: [
      { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione', resa: { valore: true, fonte: F('DGUE') } },
      { tipo: 'fatturato', esercizio: 2025, ambito: 'formazione sanitaria', importo: { valore: 200_000, fonte: F('bilancio 2025') } },
      { tipo: 'certificazione', norma: 'ISO 9001', scope: 'erogazione formazione', possesso: { valore: true, fonte: F('certificato'), validoA: '2028-01-31' } },
      { tipo: 'iscrizione', registro: 'CCIAA', attivita: 'formazione professionale', possesso: { valore: true, fonte: F('visura') } },
    ],
  },
];

// ─── Raggruppamento ──────────────────────────────────────────

export const raggruppamento: Raggruppamento = {
  membri: [
    { soggettoId: 's-alfa', ruolo: 'mandataria', quote: { 'p-fornitura': 1, 'p-manutenzione': 0, 'p-formazione': 0 } },
    { soggettoId: 's-beta', ruolo: 'mandante', quote: { 'p-fornitura': 0, 'p-manutenzione': 1, 'p-formazione': 0 } },
    { soggettoId: 's-gamma', ruolo: 'mandante', quote: { 'p-fornitura': 0, 'p-manutenzione': 0, 'p-formazione': 1 } },
  ],
};

// ─── Esito atteso ────────────────────────────────────────────
// Scritto a mano. Serve a due cose: far costruire l'UI prima che il
// motore esista, e fare da caso di test quando il motore esisterà.

export const esitoAtteso: Esito = {
  ammissibile: false,
  valutatoAl: '2026-09-14',
  requisiti: [
    {
      requisitoId: 'r-generale',
      stato: 'coperto',
      contributi: [
        { soggettoId: 's-alfa', valore: true },
        { soggettoId: 's-beta', valore: true },
        { soggettoId: 's-gamma', valore: true },
      ],
      motivazione: 'Dichiarazione resa da ciascun membro del raggruppamento.',
      rimedi: [],
    },
    {
      requisitoId: 'r-fatturato',
      stato: 'scoperto',
      contributi: [
        { soggettoId: 's-alfa', valore: 2_100_000 },
        { soggettoId: 's-beta', valore: 600_000 },
        { soggettoId: 's-gamma', valore: 200_000 },
      ],
      delta: 100_000,
      motivazione: 'La somma dei fatturati specifici è 2.900.000 € su una soglia di 3.000.000 €. Nessun membro attuale copre la differenza.',
      rimedi: [
        { tipo: 'nuovo_soggetto', profiloMinimo: 'Fatturato specifico ≥ 100.000 € nel settore dispositivi medici' },
        { tipo: 'avvalimento', requisitoId: 'r-fatturato' },
      ],
    },
    {
      requisitoId: 'r-iso-13485',
      stato: 'coperto',
      contributi: [{ soggettoId: 's-alfa', valore: true, nota: 'Esegue il 100% della fornitura' }],
      motivazione: 'La certificazione è posseduta dal soggetto che esegue la prestazione a cui si riferisce.',
      rimedi: [],
    },
    {
      requisitoId: 'r-iso-9001',
      stato: 'scoperto',
      contributi: [
        { soggettoId: 's-beta', valore: false, nota: 'Certificazione scaduta il 30/04/2026 — esegue il 100% della manutenzione' },
        { soggettoId: 's-gamma', valore: true, nota: 'Certificazione valida, ma non esegue la manutenzione' },
      ],
      motivazione: 'Chi esegue la manutenzione non ha una certificazione valida alla data di riferimento.',
      rimedi: [
        { tipo: 'riassegna_quota', prestazioneId: 'p-manutenzione', daSoggettoId: 's-beta', aSoggettoId: 's-gamma' },
        { tipo: 'nuovo_soggetto', profiloMinimo: 'ISO 9001 in corso di validità con scope assistenza tecnica' },
      ],
    },
    {
      requisitoId: 'r-servizi-analoghi',
      stato: 'da_verificare',
      contributi: [
        { soggettoId: 's-alfa', valore: 2 },
        { soggettoId: 's-beta', valore: 1, nota: 'CPV 50421000 (manutenzione) contro CPV di gara 33100000: analogia da valutare' },
        { soggettoId: 's-gamma', valore: 0 },
      ],
      motivazione: "La somma raggiunge 3, ma una delle referenze ha un CPV diverso da quello di gara. L'analogia è un giudizio, non un confronto: il motore non decide.",
      rimedi: [],
    },
    {
      requisitoId: 'r-cciaa',
      stato: 'coperto',
      contributi: [
        { soggettoId: 's-alfa', valore: true },
        { soggettoId: 's-beta', valore: true },
        { soggettoId: 's-gamma', valore: true },
      ],
      motivazione: 'Requisito richiesto a ciascun membro: tutti e tre lo possiedono con attività coerente.',
      rimedi: [],
    },
  ],
  percorsoMinimo: [
    { tipo: 'riassegna_quota', prestazioneId: 'p-manutenzione', daSoggettoId: 's-beta', aSoggettoId: 's-gamma' },
    { tipo: 'avvalimento', requisitoId: 'r-fatturato' },
  ],
};