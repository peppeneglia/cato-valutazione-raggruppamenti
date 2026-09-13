// Modello di dominio — Valutazione ammissibilità raggruppamenti
//
// Principio: il motore non conosce il diritto degli appalti.
// Conosce quattro operatori di composizione e li applica a dati
// che arrivano dal disciplinare. Ogni regola normativa è un dato.

// ─────────────────────────────────────────────────────────────
// Provenienza
// ─────────────────────────────────────────────────────────────

/** Nessun valore entra nel motore senza sapere da dove viene. */
export type Fonte = {
  documento: string;      // "Disciplinare di gara"
  riferimento: string;    // "art. 7.2 lett. b"
  pagina?: number;
};

/** Un fatto del fascicolo: ha un valore, una fonte e una finestra di validità. */
export type Fatto<T> = {
  valore: T;
  fonte: Fonte;
  validoDa?: string;      // ISO date
  validoA?: string;       // ISO date — oltre questa data il fatto non conta
};

// ─────────────────────────────────────────────────────────────
// Bando
// ─────────────────────────────────────────────────────────────

/** Le parti in cui si scompone l'oggetto della gara. Servono per le quote. */
export type Prestazione = {
  id: string;
  descrizione: string;    // "Fornitura dispositivi", "Manutenzione", "Formazione"
  importo: number;
};

export type FamigliaRequisito =
  | 'generale'            // assenza cause di esclusione
  | 'economico'           // fatturato, patrimonio
  | 'certificazione'      // ISO, abilitazioni
  | 'referenza'           // servizi o forniture analoghe
  | 'iscrizione';         // CCIAA, albi

/**
 * Come il requisito si compone quando i soggetti sono più di uno.
 * Letta dal disciplinare, MAI dedotta dal codice.
 */
export type RegolaComposizione =
  /** Ogni membro deve possederlo. Se manca a uno, salta tutto. */
  | { tipo: 'ciascun_membro' }
  /** I contributi si sommano. Eventuali minimi per ruolo. */
  | {
      tipo: 'somma_membri';
      minimoMandataria?: number;   // quota della soglia, es. 0.4
      minimoMandante?: number;
    }
  /** Lo deve avere chi esegue quella prestazione, chiunque sia. */
  | { tipo: 'esecutore_prestazione'; prestazioneId: string }
  /** Basta che almeno un membro lo possieda. */
  | { tipo: 'almeno_un_membro' };

export type Requisito = {
  id: string;
  famiglia: FamigliaRequisito;
  descrizione: string;
  /** Soglia da raggiungere. Assente per requisiti di possesso puro. */
  soglia?: number;
  unita?: 'euro' | 'conteggio' | 'anni';
  regola: RegolaComposizione;
  fonte: Fonte;
  /** Se true, la scopertura esclude dalla gara e non è sanabile in corsa. */
  vincolante: boolean;
};

export type Bando = {
  id: string;
  oggetto: string;
  stazioneAppaltante: string;
  scadenza: string;
  prestazioni: Prestazione[];
  requisiti: Requisito[];
};

// ─────────────────────────────────────────────────────────────
// Soggetto
// ─────────────────────────────────────────────────────────────

/** Il fascicolo è una lista di fatti tipizzati, non un insieme di campi. */
export type VoceFascicolo =
  | { tipo: 'fatturato'; esercizio: number; ambito: string; importo: Fatto<number> }
  | { tipo: 'certificazione'; norma: string; scope: string; possesso: Fatto<true> }
  | {
      tipo: 'servizio';
      oggetto: string;
      cpv?: string;
      committente: string;
      importo: number;
      periodo: Fatto<{ da: string; a: string }>;
    }
  | { tipo: 'iscrizione'; registro: string; attivita: string; possesso: Fatto<true> }
  /** Requisiti generali: non c'è un fatto positivo, c'è una dichiarazione. */
  | { tipo: 'dichiarazione'; oggetto: string; resa: Fatto<true> };

export type Soggetto = {
  id: string;
  denominazione: string;
  fascicolo: VoceFascicolo[];
};

// ─────────────────────────────────────────────────────────────
// Raggruppamento — la terza entità
// ─────────────────────────────────────────────────────────────

export type Ruolo = 'mandataria' | 'mandante';

export type Membro = {
  soggettoId: string;
  ruolo: Ruolo;
  /** Quota di esecuzione per prestazione, in frazione (0.6 = 60%). */
  quote: Record<Prestazione['id'], number>;
};

export type Raggruppamento = {
  membri: Membro[];
};

// ─────────────────────────────────────────────────────────────
// Esito
// ─────────────────────────────────────────────────────────────

/**
 * Tre stati, non due. "da_verificare" esiste perché l'analogia di un
 * servizio pregresso è un giudizio, non un confronto numerico: il motore
 * dichiara di non poter decidere invece di inventare un verdetto.
 */
export type StatoRequisito = 'coperto' | 'scoperto' | 'da_verificare';

export type Contributo = {
  soggettoId: string;
  valore: number | boolean;
  /** Perché questo contributo conta o non conta (fatto scaduto, fuori ambito…). */
  nota?: string;
};

export type Rimedio =
  | { tipo: 'nuovo_soggetto'; profiloMinimo: string }
  | { tipo: 'avvalimento'; requisitoId: string }
  | { tipo: 'riassegna_quota'; prestazioneId: string; daSoggettoId: string; aSoggettoId: string }
  | { tipo: 'rinuncia_lotto' };

export type EsitoRequisito = {
  requisitoId: string;
  stato: StatoRequisito;
  contributi: Contributo[];
  /** Quanto manca, nell'unità del requisito. Mai uno scoperto senza cifra. */
  delta?: number;
  motivazione: string;
  rimedi: Rimedio[];
};

export type Esito = {
  ammissibile: boolean;
  valutatoAl: string;          // data di riferimento: decide quali fatti sono ancora validi
  requisiti: EsitoRequisito[];
  /** La modifica minima che rende ammissibile il raggruppamento attuale. */
  percorsoMinimo: Rimedio[];
};

// ─────────────────────────────────────────────────────────────
// Il motore
// ─────────────────────────────────────────────────────────────

/**
 * Funzione pura: nessun I/O, nessuna rete, nessuna data implicita.
 * Interamente testabile, deterministica, zero infrastruttura.
 */
export type Valuta = (input: {
  bando: Bando;
  soggetti: Soggetto[];
  raggruppamento: Raggruppamento;
  dataRiferimento: string;
}) => Esito;