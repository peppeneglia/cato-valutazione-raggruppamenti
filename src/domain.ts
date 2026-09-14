// Modello di dominio — Valutazione ammissibilità raggruppamenti
//
// Tesi: il motore non conosce il diritto degli appalti. Un requisito porta
// con sé due dati letti dal disciplinare — il CRITERIO (quali fatti del
// fascicolo lo soddisfano) e la REGOLA DI COMPOSIZIONE (come quei fatti si
// compongono tra più soggetti). Il motore ramifica solo su questi due campi
// e sul tipo delle voci di fascicolo. Mai sulla famiglia, che è descrittiva.
//
// Ogni parametro normativo è un dato: soglie, finestre temporali, minimi per
// ruolo, avvalibilità, vincoli di esecuzione. Nulla è dedotto dal codice.
//
// E quando il documento NON dice — non dice come si compone un requisito,
// non dice quale registro, scrive due valori diversi per la stessa cosa —
// il modello lo rappresenta invece di scegliere in silenzio. Il caso reale
// che ha imposto ogni variante è citato nel suo commento: disciplinare ASL
// Roma 6, gara n. 9445747 (fornitura di farmaci e dispositivi da grossista).

// ─────────────────────────────────────────────────────────────
// Identificativi e date
// ─────────────────────────────────────────────────────────────

/** Data in formato ISO `YYYY-MM-DD`. Gli estremi delle finestre sono inclusi. */
export type DataISO = string;

export type BandoId = string;
export type LottoId = string;
export type PrestazioneId = string;
export type RequisitoId = string;
export type SoggettoId = string;

// ─────────────────────────────────────────────────────────────
// Provenienza
// ─────────────────────────────────────────────────────────────

/** Nessun valore entra nel motore senza sapere da dove viene. */
export type Fonte = {
  documento: string;      // "Disciplinare di gara"
  riferimento: string;    // "art. 7.2 lett. b"
  pagina?: number;
};

/** Un dato con provenienza e basta. Un bilancio non scade. */
export type Dato<T> = {
  valore: T;
  fonte: Fonte;
};

/**
 * Un fatto che può scadere: solo certificazioni e iscrizioni.
 * Estremi inclusi; oltre `validoA` il fatto non conta.
 */
export type Fatto<T> = Dato<T> & {
  validoDa?: DataISO;
  validoA?: DataISO;
};

// ─────────────────────────────────────────────────────────────
// Bando, lotti, prestazioni
// ─────────────────────────────────────────────────────────────

/**
 * Dichiarata dal disciplinare: serve ai raggruppamenti verticali.
 * `indivisibile`: la gara non scompone l'appalto e chiede "la percentuale
 * in caso di servizio/forniture indivisibili" (ASL Roma 6, §15.4 pp. 24–25).
 * Il lotto ha allora una prestazione sola per l'intero importo, e le quote
 * dei membri sono quella percentuale. È la parola del documento, non una
 * convenzione nostra.
 */
export type NaturaPrestazione = 'principale' | 'scorporabile' | 'indivisibile';

/** Le parti in cui si scompone l'oggetto del lotto. Servono per le quote. */
export type Prestazione = {
  id: PrestazioneId;
  descrizione: string;
  importo: number;        // euro
  natura: NaturaPrestazione;
  fonte: Fonte;
};

export type RuoloEsecutore = 'mandataria' | 'mandante' | 'consorziata_esecutrice';

/**
 * Vincolo di esecuzione della prestazione principale, se il disciplinare lo
 * dichiara: quale ruolo deve eseguirla e con quale quota minima (frazione).
 * Assente → nessun controllo. È un dato, non una regola di legge.
 */
export type VincoloPrestazionePrincipale = {
  esecutore: RuoloEsecutore;
  quotaMinima: number;
  fonte: Fonte;
};

export type Lotto = {
  id: LottoId;
  oggetto: string;
  importo: number;        // euro
  cig?: string;
  prestazioni: Prestazione[];
  requisiti: Requisito[];
  vincoloPrestazionePrincipale?: VincoloPrestazionePrincipale;
};

/**
 * Un valore del bando a cui i criteri possono rinviare per nome ("valore
 * stimato dell'appalto", "importo a base d'asta"). Ha uno o più candidati,
 * ciascuno con la propria fonte: più di uno significa che il documento lo
 * scrive in modi diversi, e noi lo rappresentiamo invece di scegliere.
 * Caso reale: ASL Roma 6, art. 3.2 p. 10 — € 966.144,50 nel testo,
 * € 1.025.000,00 nella tabella sottostante.
 */
export type ValoreBando = {
  nome: string;
  candidati: Dato<number>[];   // euro; vuoto = anomalia bloccante
};

/**
 * Il termine per chiedere chiarimenti alla stazione appaltante. È la data
 * che conta quando un requisito è indeterminato: oltre, l'ambiguità resta
 * a rischio del concorrente. L'ora è un dato mostrato, non calcolato: le
 * date del modello sono giornaliere. Caso reale: ASL Roma 6, §2.2 p. 7,
 * "ore 12:00 del 27/12/2023", risposte entro il 04/01/2024.
 */
export type TermineChiarimenti = {
  data: DataISO;
  ora?: string;
  fonte: Fonte;
  risposteEntro?: Dato<DataISO>;
};

export type Bando = {
  id: BandoId;
  oggetto: string;
  stazioneAppaltante: string;
  /**
   * Opzionale perché può mancare nel documento, non per comodità: il
   * disciplinare ASL Roma 6 (art. 1 p. 4) dice che il bando è stato
   * "inviato per la pubblicazione" senza mai scrivere la data. Diventa
   * un'anomalia solo se un criterio la richiede come ancoraggio.
   */
  dataPubblicazione?: DataISO;
  terminePresentazione: DataISO;
  termineChiarimenti?: TermineChiarimenti;
  /** Dichiarata dal bando: NON è la somma dei lotti per definizione. */
  baseAsta: number;
  /** I valori nominati a cui le soglie possono rinviare. */
  valori: ValoreBando[];
  fonte: Fonte;
  /** Un bando monolotto è un bando con un lotto. Nessun caso speciale. */
  lotti: Lotto[];
};

// ─────────────────────────────────────────────────────────────
// Requisiti
// ─────────────────────────────────────────────────────────────

/** Puramente descrittiva: raggruppa le righe a video. Il motore non la legge. */
export type FamigliaRequisito =
  | 'generale'            // assenza cause di esclusione
  | 'economico'           // fatturato, patrimonio
  | 'certificazione'      // ISO, abilitazioni
  | 'referenza'           // servizi o forniture analoghe
  | 'iscrizione';         // CCIAA, albi

/** La parola del disciplinare per ciò che si conta: referenze, forniture, contratti. */
export type Sostantivo = { singolare: string; plurale: string };

export type Unita =
  | { tipo: 'euro' }
  | { tipo: 'conteggio'; sostantivo: Sostantivo };

/**
 * Da dove parte una finestra temporale "a ritroso": lo dice il disciplinare.
 * `non_dichiarato`: il documento dice "nell'ultimo triennio" senza dire da
 * quando (ASL Roma 6, §6.3 b p. 14). Il motore usa allora l'unica data
 * certa del bando, il termine di presentazione, e lo dichiara come
 * assunzione con codice proprio.
 */
export type Ancoraggio = 'pubblicazione' | 'riferimento' | 'non_dichiarato';

/** Un'unione, non una convenzione: "Globale" con la maiuscola non esiste. */
export type AmbitoFatturato =
  | { tipo: 'globale' }
  | { tipo: 'specifico'; settore: string };

/**
 * Una soglia in euro è un numero, oppure un rinvio per nome a un valore del
 * bando: "almeno pari al valore stimato dell'appalto" (ASL Roma 6, §6.2 a
 * p. 13), "non inferiore all'importo a base d'asta" (§6.3 b p. 14). Il
 * rinvio si risolve sui candidati del valore: uno o più.
 */
export type Importo = number | { rinvio: string };

/**
 * Il periodo del fatturato: esercizi a ritroso da un ancoraggio, oppure
 * anni di calendario fissati dal documento — "maturato complessivamente
 * nel triennio 2020/2021/2022" (ASL Roma 6, §6.2 a p. 13).
 */
export type PeriodoFatturato =
  | { tipo: 'a_ritroso'; esercizi: number; ancoraggio: Ancoraggio }
  | { tipo: 'esercizi'; anni: number[] };

/**
 * Quali fatti del fascicolo soddisfano il requisito.
 * La misura (soglia) sta nel criterio: l'unità discende dal tipo.
 * Criteri di possesso: dichiarazione, certificazione, iscrizione.
 * Criteri misurati: fatturato (euro), servizi (conteggio), servizi_importo (euro).
 * `non_determinato`: il documento chiede qualcosa senza dire cosa lo
 * soddisfi — "iscrizione in registri o albi se prescritta dalla
 * legislazione vigente", senza nominare né il registro né la legge
 * (ASL Roma 6, §6.1 b p. 13). Esce sempre da verificare, senza contributi.
 *
 * Il parametro `I` distingue il criterio come è scritto (soglie anche per
 * rinvio) da quello risolto su cui il motore calcola (`CriterioRisolto`).
 */
export type Criterio<I = Importo> =
  | { tipo: 'dichiarazione'; oggetto: string }
  | {
      tipo: 'fatturato';
      ambito: AmbitoFatturato;
      periodo: PeriodoFatturato;
      soglia: I;          // euro
    }
  /**
   * Più norme in alternativa: ne basta una. "UNI EN ISO 9001:2015 … e/o
   * certificazione ISO 13485" (ASL Roma 6, §6.3 a pp. 13–14).
   */
  | { tipo: 'certificazione'; norme: readonly string[]; scope?: string }
  | {
      tipo: 'servizi';
      cpv: string;
      /** CPV che il disciplinare dichiara equivalenti: un servizio così è certo. */
      cpvEquivalenti?: string[];
      /**
       * Cifre iniziali del CPV che un servizio deve condividere con quello di
       * gara perché valga una verifica; altrimenti non conta. Se assente, ogni
       * CPV diverso è da verificare. La regola è un'assunzione del motore
       * sulla struttura del CPV, il numero è un dato del criterio.
       */
      cifreCpvComuni?: number;
      /** Finestra a ritroso in anni: conta chi si sovrappone, senza pro-rata. */
      anni: number;
      ancoraggio: Ancoraggio;
      /** Filtro: i servizi sotto questo importo non contano. */
      importoMinimoUnitario?: I;
      numeroMinimo: number;
      /** Servizio di punta: `numeroMinimo: 1` con `importoMinimoUnitario`. */
      sostantivo: Sostantivo;
    }
  | {
      tipo: 'servizi_importo';
      cpv: string;
      cpvEquivalenti?: string[];
      cifreCpvComuni?: number;
      anni: number;
      ancoraggio: Ancoraggio;
      importoMinimoUnitario?: I;
      soglia: I;          // euro, somma degli importi dei servizi che contano
    }
  | { tipo: 'iscrizione'; registro: string; attivita?: string }
  | { tipo: 'non_determinato'; testo: string };

/** Il criterio su cui il motore calcola: ogni rinvio è già un numero. */
export type CriterioRisolto = Criterio<number>;

/**
 * Una lettura del requisito: un criterio con, se le letture sono più di
 * una, il testo che dice come si è letto il documento. Le forniture
 * analoghe "di importo non inferiore all'importo a base d'asta" (ASL Roma
 * 6, §6.3 b p. 14) ammettono due letture: un solo contratto sopra soglia,
 * oppure la somma. Si usa quando il testo ammette letteralmente due letture
 * ed entrambe sono esprimibili nei criteri; un dubbio non esprimibile è
 * un'ambiguità dichiarata, non una lettura.
 */
export type Lettura = {
  testo?: string;
  criterio: Criterio;
};

/**
 * Come il requisito si compone quando i soggetti sono più di uno.
 * Letta dal disciplinare, MAI dedotta dal codice.
 * `non_dichiarata`: il documento non lo dice. Il §6.4 (p. 14) del
 * disciplinare ASL Roma 6 copre tre requisiti su sei: sui requisiti
 * generali per i RTI, sui registri di settore e sulla certificazione ISO
 * — a pena di esclusione — non dice chi debba possederli. Nessun operatore
 * di default: il motore valuta ogni membro, mostra i contributi ed esce
 * da verificare.
 */
export type RegolaComposizione =
  /** Ogni membro deve soddisfarlo. Se manca a uno, salta tutto. */
  | { tipo: 'ciascun_membro' }
  /** I contributi si sommano. Minimi opzionali per ruolo, frazione della soglia. */
  | {
      tipo: 'somma_membri';
      minimoMandataria?: number;
      /** Si applica a ciascuna mandante singolarmente. */
      minimoMandante?: number;
    }
  /** Lo devono possedere tutti i membri con quota > 0 su quella prestazione. */
  | { tipo: 'esecutore_prestazione'; prestazioneId: PrestazioneId }
  /** Basta che almeno un membro lo soddisfi. */
  | { tipo: 'almeno_un_membro' }
  | { tipo: 'non_dichiarata' };

export type Requisito = {
  id: RequisitoId;
  famiglia: FamigliaRequisito;
  /** Come lo chiama il documento, per esteso. Non si accorcia: sta nell'espansione. */
  descrizione: string;
  /** La forma breve che sta in riga e nelle frasi: "Fatturato globale". È un dato, non un troncamento. */
  nomeBreve: string;
  /** Sempre una lista, anche quando è una: il motore cicla sempre. Vuota = anomalia. */
  letture: Lettura[];
  regola: RegolaComposizione;
  /** Dato del disciplinare, non deduzione di legge. */
  avvalibile: boolean;
  /** Se true, la scopertura esclude dalla gara. */
  vincolante: boolean;
  fonte: Fonte;
};

// ─────────────────────────────────────────────────────────────
// Soggetti
// ─────────────────────────────────────────────────────────────

/** Il fascicolo è una lista di fatti tipizzati, non un insieme di campi. */
export type VoceFascicolo =
  | { tipo: 'fatturato'; esercizio: number; ambito: AmbitoFatturato; importo: Dato<number> }
  | { tipo: 'certificazione'; norma: string; scope: string; possesso: Fatto<true> }
  | {
      tipo: 'servizio';
      oggetto: string;
      cpv: string;
      committente: string;
      importo: number;    // euro
      /** Il periodo di esecuzione è un periodo, non una finestra di validità. */
      periodo: Dato<{ da: DataISO; a: DataISO }>;
    }
  | { tipo: 'iscrizione'; registro: string; attivita: string; possesso: Fatto<true> }
  /** Requisiti generali: non c'è un fatto positivo, c'è una dichiarazione. */
  | { tipo: 'dichiarazione'; oggetto: string; resa: Dato<true> };

export type Soggetto = {
  id: SoggettoId;
  denominazione: string;
  fascicolo: VoceFascicolo[];
};

// ─────────────────────────────────────────────────────────────
// Raggruppamento
// ─────────────────────────────────────────────────────────────

/** Etichetta che spiega perché un vincolo di esecuzione c'è. */
export type TipoRaggruppamento = 'orizzontale' | 'verticale' | 'misto';

/**
 * L'unione sul ruolo impedisce per costruzione un'ausiliaria con quote
 * o un esecutore senza. Senza le quote i requisiti legati all'esecutore
 * non sono calcolabili: è la ragione per cui il raggruppamento è un'entità.
 */
export type Membro =
  | {
      ruolo: RuoloEsecutore;
      soggettoId: SoggettoId;
      /** Quota di esecuzione per prestazione, in frazione (0.6 = 60%). */
      quote: Record<PrestazioneId, number>;
    }
  | {
      ruolo: 'ausiliaria';
      soggettoId: SoggettoId;
      /** Il membro esecutore di cui integra il fascicolo. */
      ausiliataId: SoggettoId;
      /** Partecipa solo ai requisiti per cui è indicata. */
      requisitiIds: RequisitoId[];
    };

export type Ruolo = Membro['ruolo'];

export type Raggruppamento = {
  tipo: TipoRaggruppamento;
  membri: Membro[];
};

// ─────────────────────────────────────────────────────────────
// Esito — requisiti e contributi
// ─────────────────────────────────────────────────────────────

/**
 * Tre stati, non due. "da_verificare" non è incertezza del motore: è il
 * motore che dichiara di non poter decidere, e dice perché nelle
 * `indeterminatezze`. Regola: scoperto se nemmeno il massimo raggiunge la
 * soglia; coperto se bastano i certi; altrimenti da verificare.
 */
export type StatoRequisito = 'coperto' | 'scoperto' | 'da_verificare';

/**
 * Il valore di un contributo è determinato dal criterio: tri-stato per il
 * possesso, coppia certo/incerto per la misura. Un membro con un servizio
 * certo e uno con CPV divergente vale (1, 1): lo stato ne deriva.
 */
export type ValoreContributo =
  | { tipo: 'possesso'; esito: 'posseduto' | 'da_verificare' | 'assente' }
  | { tipo: 'misura'; certo: number; incerto: number };

export type Contributo = {
  soggettoId: SoggettoId;
  /** Il valore REALE del fascicolo, mai alterato dalla composizione. */
  valore: ValoreContributo;
  /** false = possiede ma la regola non lo considera (non esegue la prestazione). */
  conteggiato: boolean;
  /** Le fonti dei fatti effettivamente usati. Vuota se non contribuisce. */
  fonti: Fonte[];
  /** Ciò che spiega il valore: entra nella motivazione. */
  nota?: string;
  /** Ciò che rassicura o approfondisce: solo nell'espansione, mai in riga. */
  dettagli?: string[];
};

/** Minimo per ruolo su una regola di somma: una scopertura diversa dal totale. */
export type MinimoRuolo = {
  soggettoId: SoggettoId;
  ruolo: RuoloEsecutore;
  richiesto: number;
  raggiunto: number;
  delta: number;
};

/** Presente solo per i criteri misurati. Valori in euro o in conteggio. */
export type Misurazione = {
  unita: Unita;
  soglia: number;
  /** Somma (o minimo/massimo, secondo la regola) dei contributi certi. */
  raggiunto: number;
  /** Idem includendo i contributi da verificare. */
  massimo: number;
  /** Quanto manca sui certi. Zero se raggiunto. */
  delta: number;
  minimiRuolo: MinimoRuolo[];
};

/**
 * Regole del motore, non del disciplinare, che possono incidere su un
 * esito. Il codice permette alla UI di raccoglierle in una legenda unica
 * e referenziarle dalle righe; il testo dice cosa è stato assunto qui.
 * - `ancoraggio_termine_presentazione`: finestra "a ritroso" senza dies a
 *   quo, ancorata al termine di presentazione.
 * - `esito_concordante`: letture o candidati diversi nel testo ma
 *   concordanti nell'esito: l'esito vale anche se il documento è ambiguo.
 */
export type CodiceAssunzione = 'arrotondamento_minimi' | 'classe_cpv' | 'ancoraggio_termine_presentazione' | 'esito_concordante';

export type Assunzione = {
  codice: CodiceAssunzione;
  testo: string;
};

/** Lo stato di una variante, per nome: serve alle indeterminatezze discordanti. */
export type EsitoVariante = { etichetta: string; stato: StatoRequisito };

/**
 * Chi può sciogliere un giudizio. La stazione appaltante può rispondere su
 * cosa significa il proprio documento — se un'attività è pertinente, se uno
 * scope rientra nel settore — e quel giudizio genera un quesito. Non può
 * rispondere su cosa c'è nel fascicolo del concorrente — se una sua
 * fornitura è analoga a quella di gara — e quel giudizio resta a lui.
 */
export type Interpellato = 'stazione_appaltante' | 'concorrente';

/**
 * Perché il motore non può decidere. Due famiglie, due azioni:
 * - il DOCUMENTO non lo dice (regola non dichiarata, criterio non
 *   determinato, letture discordanti, valore contraddittorio): si chiedono
 *   chiarimenti alla stazione appaltante, entro il termine;
 * - serve un GIUDIZIO (scope, attività, CPV che non coincidono): una
 *   persona decide — la stazione appaltante se interpellata, altrimenti il
 *   concorrente con il disciplinare in mano.
 * Un requisito può averle entrambe: sulla gara ASL Roma 6 la ISO ha la
 * regola non dichiarata e, per un membro, uno scope da valutare.
 */
export type Indeterminatezza =
  | { tipo: 'regola_non_dichiarata' }
  | { tipo: 'criterio_non_determinato'; testo: string }
  | { tipo: 'letture_discordanti'; esiti: EsitoVariante[] }
  | { tipo: 'valore_contraddittorio'; nome: string; esiti: EsitoVariante[] }
  | {
      tipo: 'giudizio_richiesto';
      soggettoId: SoggettoId;
      oggetto: string;
      interpella: Interpellato;
      /** La domanda, senza il requisito: la completa chi conosce il requisito. Solo se interpella la stazione appaltante. */
      quesito?: string;
    };

/** L'esito di una variante (lettura × candidati), quando le varianti sono più di una. */
export type EsitoVarianteCompleto = {
  etichetta: string;
  stato: StatoRequisito;
  misurazione?: Misurazione;
  motivazione: string;
};

export type EsitoRequisito = {
  requisitoId: RequisitoId;
  stato: StatoRequisito;
  contributi: Contributo[];
  misurazione?: Misurazione;
  motivazione: string;
  /** Dichiarate una volta per requisito, anche se hanno inciso su più membri. */
  assunzioni: Assunzione[];
  indeterminatezze: Indeterminatezza[];
  /** Presente solo se le varianti sono più di una: trasparenza sulla fusione. */
  varianti?: EsitoVarianteCompleto[];
  rimedi: Rimedio[];
};

// ─────────────────────────────────────────────────────────────
// Esito — verdetto, anomalie, avvisi
// ─────────────────────────────────────────────────────────────

/**
 * Uno scoperto su requisito vincolante → non ammissibile.
 * Nessuno scoperto vincolante, ma almeno un da verificare o uno scoperto
 * non vincolante → ammissibile con riserva. Tutto coperto → ammissibile.
 * Un'anomalia bloccante forza non ammissibile.
 */
export type Verdetto = 'ammissibile' | 'ammissibile_con_riserva' | 'non_ammissibile';

export type GravitaAnomalia = 'bloccante' | 'segnalazione';

/** Gli errori nei dati sono dati, non eccezioni: il motore non lancia. */
export type DettaglioAnomalia =
  | { codice: 'mandataria_assente' }
  | { codice: 'mandataria_multipla'; soggettiIds: SoggettoId[] }
  | { codice: 'membro_duplicato'; soggettoId: SoggettoId }
  /** Riferita al lotto in esame: in multi-lotto è normale. */
  | { codice: 'membro_senza_quote'; soggettoId: SoggettoId; lottoId: LottoId }
  /** Gli id di prestazione e requisito sono globali sul bando: un duplicato mescola le quote in silenzio. */
  | { codice: 'identificativo_duplicato'; entita: 'prestazione' | 'requisito'; id: string; lottiIds: LottoId[] }
  | { codice: 'quota_fuori_intervallo'; soggettoId: SoggettoId; prestazioneId: PrestazioneId; quota: number }
  /** Totale > 0 e ≠ 100%. Il totale zero è `prestazione_senza_esecutore`. */
  | { codice: 'quote_non_totali'; prestazioneId: PrestazioneId; totale: number }
  | { codice: 'prestazione_senza_esecutore'; prestazioneId: PrestazioneId }
  | {
      codice: 'riferimento_inesistente';
      entita: 'lotto' | 'soggetto' | 'prestazione' | 'requisito' | 'ausiliata';
      id: string;
    }
  | { codice: 'regola_somma_su_criterio_di_possesso'; requisitoId: RequisitoId }
  /** Soglie e finestre ≤ 0, minimi per ruolo fuori da 0–1: una soglia zero è coperta da chiunque. */
  | { codice: 'parametro_requisito_non_valido'; requisitoId: RequisitoId; parametro: string; valore: number }
  | { codice: 'avvalimento_su_requisito_non_avvalibile'; soggettoId: SoggettoId; requisitoId: RequisitoId }
  | { codice: 'data_malformata'; origine: 'parametri' | 'bando' | 'fascicolo'; dove: string; valore: string }
  | { codice: 'periodo_invertito'; soggettoId: SoggettoId; dove: string }
  | { codice: 'termine_presentazione_decorso'; terminePresentazione: DataISO }
  | { codice: 'vincolo_senza_prestazione_principale' }
  | {
      codice: 'vincolo_prestazione_principale_violato';
      prestazioneId: PrestazioneId;
      esecutore: RuoloEsecutore;
      quotaMinima: number;
      quotaEffettiva: number;
    }
  /** Una soglia rinvia a un valore che il bando non nomina. */
  | { codice: 'rinvio_a_valore_inesistente'; requisitoId: RequisitoId; nome: string }
  /** Un valore nominato senza nemmeno un candidato: non c'è niente su cui calcolare. */
  | { codice: 'valore_bando_senza_candidati'; nome: string }
  /** Un criterio ancorato alla pubblicazione, ma il bando non ne scrive la data. */
  | { codice: 'ancoraggio_a_pubblicazione_senza_data'; requisitoId: RequisitoId }
  /** Una prestazione indivisibile è, per definizione, l'unica del lotto. */
  | { codice: 'prestazione_indivisibile_non_unica'; lottoId: LottoId; prestazioneId: PrestazioneId }
  /** Un requisito senza letture non si può valutare. */
  | { codice: 'requisito_senza_letture'; requisitoId: RequisitoId };

export type CodiceAnomalia = DettaglioAnomalia['codice'];

export type Anomalia = DettaglioAnomalia & {
  gravita: GravitaAnomalia;
  messaggio: string;
};

/**
 * Un fatto usato per un requisito del lotto, valido oggi, che scade prima del
 * termine di presentazione e/o entro l'orizzonte richiesto. Almeno uno dei
 * due flag è vero, altrimenti l'avviso non viene emesso.
 */
export type AvvisoScadenza = {
  soggettoId: SoggettoId;
  descrizioneVoce: string;
  scadeIl: DataISO;
  fonte: Fonte;
  requisitiIds: RequisitoId[];
  primaDelTermine: boolean;
  entroOrizzonte: boolean;
};

// ─────────────────────────────────────────────────────────────
// Rimedi e percorso minimo
// ─────────────────────────────────────────────────────────────

/**
 * Il motore può applicarli a una copia dell'input e rivalutare. Un rimedio
 * viene proposto solo se la rivalutazione lo conferma. Ordine di
 * invasività: riassegnazione, uscita, ingresso, avvalimento.
 */
export type RimedioApplicabile =
  | {
      tipo: 'riassegna_quota';
      prestazioneId: PrestazioneId;
      daSoggettoId: SoggettoId;
      aSoggettoId: SoggettoId;
      quota: number;
    }
  | { tipo: 'uscita_soggetto'; soggettoId: SoggettoId }
  | {
      tipo: 'ingresso_soggetto';
      soggettoId: SoggettoId;
      ruolo: 'mandante';
      /** Le quote che il nuovo membro esegue. */
      quote: Record<PrestazioneId, number>;
      /** Se presente, le quote vengono sottratte a questo membro. */
      rilevateDa?: SoggettoId;
    }
  | {
      tipo: 'avvalimento';
      requisitoId: RequisitoId;
      ausiliariaId: SoggettoId;
      ausiliataId: SoggettoId;
    };

/** Suggerimenti che dipendono dal mondo esterno: non entrano nella ricerca. */
export type RimedioNonApplicabile =
  | {
      tipo: 'profilo_mancante';
      requisitoId: RequisitoId;
      /** Della prima lettura, risolta: il profilo che manca in parole. */
      criterio: CriterioRisolto;
      /** Nell'unità del criterio, se misurato. */
      mancante?: number;
    }
  | {
      tipo: 'rinnovo_documento';
      soggettoId: SoggettoId;
      requisitoId: RequisitoId;
      fonte: Fonte;
      scadutoIl: DataISO;
    }
  /**
   * Il documento non dice: si chiede alla stazione appaltante, un quesito
   * per ogni indeterminatezza del documento, entro il termine del bando.
   * Se il termine è decorso lo si dice, e il requisito resta da verificare:
   * l'ambiguità va risolta a rischio del concorrente. Sulla gara ASL Roma 6
   * (§2.2 p. 7) si applica a quattro requisiti su sei.
   */
  | {
      tipo: 'richiesta_chiarimenti';
      requisitoId: RequisitoId;
      quesiti: string[];
      termine?: { data: DataISO; ora?: string };
      /** Vero se la data di riferimento è oltre il giorno del termine. Falso se il bando non lo fissa. */
      decorso: boolean;
    };

export type Rimedio = RimedioApplicabile | RimedioNonApplicabile;

export type VerdettoRaggiungibile = Exclude<Verdetto, 'non_ammissibile'>;

/**
 * Una mossa che non cambia il verdetto ma toglie una domanda aperta:
 * rende coperto almeno un requisito residuo senza peggiorare il resto.
 * Verificata per rivalutazione come ogni rimedio.
 */
export type Miglioramento = {
  mossa: RimedioApplicabile;
  requisitiRisolti: RequisitoId[];
};

/**
 * La sequenza più breve di mosse applicabili. Prima verso `ammissibile`;
 * se non esiste, verso `ammissibile_con_riserva` dichiarando i residui.
 * Quando il verdetto massimo è già raggiunto ma qualche residuo si può
 * togliere, i `miglioramenti` lo dicono: il percorso non deve sembrare
 * inerte quando non lo è.
 */
export type PercorsoMinimo =
  | { esito: 'gia_ammissibile'; verdetto: VerdettoRaggiungibile; residui: RequisitoId[]; miglioramenti: Miglioramento[] }
  | {
      esito: 'trovato';
      mosse: RimedioApplicabile[];
      verdettoRaggiunto: VerdettoRaggiungibile;
      /** Requisiti che restano da verificare o scoperti non vincolanti. */
      residui: RequisitoId[];
      /** Segnalazioni che il raggruppamento finale porta con sé. */
      segnalazioni: number;
    }
  /** Nessuna sequenza esce da non ammissibile. */
  | { esito: 'inesistente'; restanoScoperti: RequisitoId[] }
  /** Le anomalie bloccanti non si riparano con mosse. */
  | { esito: 'bloccato_da_anomalie' };

// ─────────────────────────────────────────────────────────────
// Esito e motore
// ─────────────────────────────────────────────────────────────

export type Esito = {
  lottoId: LottoId;
  valutatoAl: DataISO;
  verdetto: Verdetto;
  requisiti: EsitoRequisito[];
  anomalie: Anomalia[];
  avvisiScadenza: AvvisoScadenza[];
  percorsoMinimo: PercorsoMinimo;
};

export type ParametriValutazione = {
  bando: Bando;
  /** Il raggruppamento si valuta contro un lotto specifico. */
  lottoId: LottoId;
  soggetti: Soggetto[];
  raggruppamento: Raggruppamento;
  /** Decide quali fatti sono validi. Nessuna data implicita. */
  dataRiferimento: DataISO;
  /** Avvisi per i fatti che scadono entro questi giorni dalla data di riferimento. */
  orizzonteScadenzeGiorni: number;
};

/**
 * Funzione pura: nessun I/O, nessuna rete, nessuna data implicita, nessuna
 * mutazione degli input. Interamente testabile e deterministica.
 */
export type Valuta = (parametri: ParametriValutazione) => Esito;

// ─────────────────────────────────────────────────────────────
// Confronto tra composizioni
// ─────────────────────────────────────────────────────────────

/**
 * Ordinamento: verdetto, poi lunghezza del percorso minimo, poi numero di
 * requisiti scoperti. Oltre non si va: il pareggio viene dichiarato.
 */
export type VoceConfronto<Chiave> = {
  chiave: Chiave;
  esito: Esito;
  /** 1-based; le voci a pari merito condividono la posizione. */
  posizione: number;
  pariMerito: boolean;
};

export type ConfrontaRaggruppamenti = (
  parametri: Omit<ParametriValutazione, 'raggruppamento'> & {
    alternative: { etichetta: string; raggruppamento: Raggruppamento }[];
  },
) => VoceConfronto<string>[];

export type ConfrontaLotti = (
  parametri: Omit<ParametriValutazione, 'lottoId'>,
) => VoceConfronto<LottoId>[];
