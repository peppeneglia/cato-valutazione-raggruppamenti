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

/** Un fatto: un valore, la sua fonte, una finestra di validità opzionale. */
export type Fatto<T> = {
  valore: T;
  fonte: Fonte;
  validoDa?: DataISO;
  validoA?: DataISO;      // oltre questa data il fatto non conta
};

// ─────────────────────────────────────────────────────────────
// Bando, lotti, prestazioni
// ─────────────────────────────────────────────────────────────

/** Dichiarata dal disciplinare: serve ai raggruppamenti verticali. */
export type NaturaPrestazione = 'principale' | 'scorporabile';

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

export type Bando = {
  id: BandoId;
  oggetto: string;
  stazioneAppaltante: string;
  dataPubblicazione: DataISO;
  terminePresentazione: DataISO;
  /** Dichiarata dal bando: NON è la somma dei lotti per definizione. */
  baseAsta: number;
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

export type Unita = 'euro' | 'conteggio';

/** Da dove parte una finestra temporale "a ritroso": lo dice il disciplinare. */
export type Ancoraggio = 'pubblicazione' | 'riferimento';

/** Un'unione, non una convenzione: "Globale" con la maiuscola non esiste. */
export type AmbitoFatturato =
  | { tipo: 'globale' }
  | { tipo: 'specifico'; settore: string };

/**
 * Quali fatti del fascicolo soddisfano il requisito.
 * La misura (soglia) sta nel criterio: l'unità discende dal tipo.
 * Criteri di possesso: dichiarazione, certificazione, iscrizione.
 * Criteri misurati: fatturato (euro), servizi (conteggio), servizi_importo (euro).
 */
export type Criterio =
  | { tipo: 'dichiarazione'; oggetto: string }
  | {
      tipo: 'fatturato';
      ambito: AmbitoFatturato;
      /** Esercizi da considerare a ritroso, escluso l'anno di ancoraggio. */
      esercizi: number;
      ancoraggio: Ancoraggio;
      soglia: number;     // euro
    }
  | { tipo: 'certificazione'; norma: string; scope?: string }
  | {
      tipo: 'servizi';
      cpv: string;
      /** Finestra a ritroso in anni: conta chi si sovrappone, senza pro-rata. */
      anni: number;
      ancoraggio: Ancoraggio;
      /** Filtro: i servizi sotto questo importo non contano. */
      importoMinimoUnitario?: number;
      numeroMinimo: number;
    }
  | {
      tipo: 'servizi_importo';
      cpv: string;
      anni: number;
      ancoraggio: Ancoraggio;
      importoMinimoUnitario?: number;
      soglia: number;     // euro, somma degli importi dei servizi che contano
    }
  | { tipo: 'iscrizione'; registro: string; attivita?: string };

/**
 * Come il requisito si compone quando i soggetti sono più di uno.
 * Letta dal disciplinare, MAI dedotta dal codice.
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
  | { tipo: 'almeno_un_membro' };

export type Requisito = {
  id: RequisitoId;
  famiglia: FamigliaRequisito;
  descrizione: string;
  criterio: Criterio;
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
  | { tipo: 'fatturato'; esercizio: number; ambito: AmbitoFatturato; importo: Fatto<number> }
  | { tipo: 'certificazione'; norma: string; scope: string; possesso: Fatto<true> }
  | {
      tipo: 'servizio';
      oggetto: string;
      cpv: string;
      committente: string;
      importo: number;    // euro
      periodo: Fatto<{ da: DataISO; a: DataISO }>;
    }
  | { tipo: 'iscrizione'; registro: string; attivita: string; possesso: Fatto<true> }
  /** Requisiti generali: non c'è un fatto positivo, c'è una dichiarazione. */
  | { tipo: 'dichiarazione'; oggetto: string; resa: Fatto<true> };

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
 * motore che dichiara di non poter decidere perché servirebbe un giudizio
 * semantico (analogia di CPV, scope di una certificazione, attività di
 * un'iscrizione). Regola: scoperto se nemmeno il massimo raggiunge la
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
  nota?: string;
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

export type EsitoRequisito = {
  requisitoId: RequisitoId;
  stato: StatoRequisito;
  contributi: Contributo[];
  misurazione?: Misurazione;
  motivazione: string;
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
  | { codice: 'membro_senza_quote'; soggettoId: SoggettoId }
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
    };

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
      criterio: Criterio;
      /** Nell'unità del criterio, se misurato. */
      mancante?: number;
    }
  | {
      tipo: 'rinnovo_documento';
      soggettoId: SoggettoId;
      requisitoId: RequisitoId;
      fonte: Fonte;
      scadutoIl: DataISO;
    };

export type Rimedio = RimedioApplicabile | RimedioNonApplicabile;

export type VerdettoRaggiungibile = Exclude<Verdetto, 'non_ammissibile'>;

/**
 * La sequenza più breve di mosse applicabili. Prima verso `ammissibile`;
 * se non esiste, verso `ammissibile_con_riserva` dichiarando i residui.
 */
export type PercorsoMinimo =
  | { esito: 'gia_ammissibile'; verdetto: VerdettoRaggiungibile; residui: RequisitoId[] }
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
