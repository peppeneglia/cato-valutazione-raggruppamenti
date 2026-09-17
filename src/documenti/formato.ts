// La forma dei documenti che l'applicazione carica: il nostro formato di
// ingresso al motore. Un bando è il `Bando` del modello, dei fascicoli sono i
// `Soggetto` del modello, con davanti un'intestazione che dice cosa sono e da
// dove vengono. Nessuna traduzione: se il documento è valido, il motore lo
// riceve così com'è, senza le note.

import type {
  AmbitoFatturato,
  Bando,
  Criterio,
  Dato,
  Fatto,
  Fonte,
  Importo,
  Lettura,
  Lotto,
  PeriodoFatturato,
  Prestazione,
  RegolaComposizione,
  Requisito,
  Soggetto,
  Sostantivo,
  TermineChiarimenti,
  ValoreBando,
  VincoloPrestazionePrincipale,
  VoceFascicolo,
} from '../domain';
import {
  booleano,
  conForma,
  elenco,
  facoltativo,
  formaDi,
  letterale,
  numero,
  oggetto,
  testo,
  unione,
  type CampoDi,
  type EsitoControllo,
  type Forma,
  type Validatore,
} from './struttura';

// ─── Intestazione ────────────────────────────────────────────

const VERSIONE_FORMATO = 1;

export const NOME_FORMATO = {
  bando: 'requisiti-strutturati',
  fascicoli: 'fascicoli-imprese',
  indice: 'indice-documenti',
} as const;

/** `reale`: un documento pubblico. `esempio`: inventato, e la pagina lo dichiara. */
export type Natura = 'reale' | 'esempio';

export type Provenienza = { natura: Natura; documento: string };

type Formato<N extends string> = { nome: N; versione: typeof VERSIONE_FORMATO; descrizione: string };

export type DocumentoBando = {
  formato: Formato<typeof NOME_FORMATO.bando>;
  provenienza: Provenienza;
  bando: Bando;
};

export type DocumentoFascicoli = {
  formato: Formato<typeof NOME_FORMATO.fascicoli>;
  provenienza: Provenienza;
  soggetti: Soggetto[];
};

export type VoceIndiceBando = {
  file: string;
  /** Una scelta di chi pubblica i documenti, non un dato della gara. */
  dataRiferimentoProposta: string;
  /** Perché quella data: la pagina lo dichiara, perché la data sposta gli esiti. */
  motivoDataProposta?: string;
};

export type Indice = {
  formato: Formato<typeof NOME_FORMATO.indice>;
  bandi: VoceIndiceBando[];
  fascicoli: { file: string }[];
};

function formato<N extends string>(nome: N): Validatore<Formato<N>> {
  return oggetto<Formato<N>>({
    nome: letterale(nome) as CampoDi<N>,
    versione: letterale(VERSIONE_FORMATO),
    descrizione: testo,
  });
}

const provenienza = oggetto<Provenienza>({ natura: letterale('reale', 'esempio'), documento: testo });

// ─── Mattoni ─────────────────────────────────────────────────

const fonte = oggetto<Fonte>({ documento: testo, riferimento: testo, pagina: facoltativo(numero) });

function dato<T>(valore: Validatore<T>): Validatore<Dato<T>> {
  return oggetto<Dato<T>>({ valore: valore as CampoDi<T>, fonte });
}

function fatto<T>(valore: Validatore<T>): Validatore<Fatto<T>> {
  return oggetto<Fatto<T>>({ valore: valore as CampoDi<T>, fonte, validoDa: facoltativo(testo), validoA: facoltativo(testo) });
}

const rinvio = oggetto<{ rinvio: string }>({ rinvio: testo });

const importo: Validatore<Importo> = conForma<Importo>((v, p) => {
  if (typeof v === 'object' && v !== null && !Array.isArray(v)) return rinvio(v, p);
  const r = numero(v, p);
  if (r.ok) return r;
  return { ok: false, errori: r.errori.map((e) => ({ ...e, atteso: `${e.atteso}, oppure un rinvio a un valore del bando: { "rinvio": "valore stimato dell'appalto" }` })) };
}, { tipo: 'alternativa', opzioni: [formaDi(numero), formaDi(rinvio)] });

const sostantivo = oggetto<Sostantivo>({ singolare: testo, plurale: testo });

const ambito = unione<AmbitoFatturato, 'tipo'>('tipo', {
  globale: { tipo: letterale('globale') },
  specifico: { tipo: letterale('specifico'), settore: testo },
});

const ancoraggio = letterale('pubblicazione', 'riferimento', 'non_dichiarato');

const periodo = unione<PeriodoFatturato, 'tipo'>('tipo', {
  a_ritroso: { tipo: letterale('a_ritroso'), esercizi: numero, ancoraggio },
  esercizi: { tipo: letterale('esercizi'), anni: elenco(numero, { nonVuoto: true }) },
});

// ─── Bando ───────────────────────────────────────────────────

const criterio = unione<Criterio, 'tipo'>('tipo', {
  dichiarazione: { tipo: letterale('dichiarazione'), oggetto: testo },
  fatturato: { tipo: letterale('fatturato'), ambito, periodo, soglia: importo },
  certificazione: { tipo: letterale('certificazione'), norme: elenco(testo, { nonVuoto: true }), scope: facoltativo(testo) },
  servizi: {
    tipo: letterale('servizi'),
    cpv: testo,
    cpvEquivalenti: facoltativo(elenco(testo)),
    cifreCpvComuni: facoltativo(numero),
    anni: numero,
    ancoraggio,
    importoMinimoUnitario: facoltativo(importo),
    numeroMinimo: numero,
    sostantivo,
  },
  servizi_importo: {
    tipo: letterale('servizi_importo'),
    cpv: testo,
    cpvEquivalenti: facoltativo(elenco(testo)),
    cifreCpvComuni: facoltativo(numero),
    anni: numero,
    ancoraggio,
    importoMinimoUnitario: facoltativo(importo),
    soglia: importo,
  },
  iscrizione: { tipo: letterale('iscrizione'), registro: testo, attivita: facoltativo(testo) },
  non_determinato: { tipo: letterale('non_determinato'), testo },
});

const lettura = oggetto<Lettura>({ testo: facoltativo(testo), criterio });

const regola = unione<RegolaComposizione, 'tipo'>('tipo', {
  ciascun_membro: { tipo: letterale('ciascun_membro') },
  somma_membri: { tipo: letterale('somma_membri'), minimoMandataria: facoltativo(numero), minimoMandante: facoltativo(numero) },
  esecutore_prestazione: { tipo: letterale('esecutore_prestazione'), prestazioneId: testo },
  almeno_un_membro: { tipo: letterale('almeno_un_membro') },
  non_dichiarata: { tipo: letterale('non_dichiarata') },
});

const requisito = oggetto<Requisito>({
  id: testo,
  famiglia: letterale('generale', 'economico', 'certificazione', 'referenza', 'iscrizione'),
  descrizione: testo,
  nomeBreve: testo,
  // Vuoto è ammesso qui: un requisito senza letture è un'anomalia del motore, non un errore di forma.
  letture: elenco(lettura),
  regola,
  avvalibile: booleano,
  vincolante: booleano,
  fonte,
});

const prestazione = oggetto<Prestazione>({
  id: testo,
  descrizione: testo,
  importo: numero,
  natura: letterale('principale', 'scorporabile', 'indivisibile'),
  fonte,
});

const vincolo = oggetto<VincoloPrestazionePrincipale>({
  esecutore: letterale('mandataria', 'mandante', 'consorziata_esecutrice'),
  quotaMinima: numero,
  fonte,
});

const lotto = oggetto<Lotto>({
  id: testo,
  oggetto: testo,
  importo: numero,
  cig: facoltativo(testo),
  prestazioni: elenco(prestazione, { nonVuoto: true }),
  requisiti: elenco(requisito, { nonVuoto: true }),
  vincoloPrestazionePrincipale: facoltativo(vincolo),
});

const valoreBando = oggetto<ValoreBando>({
  nome: testo,
  // Vuoto è ammesso qui: un valore senza candidati è un'anomalia bloccante del motore.
  candidati: elenco(dato(numero)),
});

const termineChiarimenti = oggetto<TermineChiarimenti>({
  data: testo,
  ora: facoltativo(testo),
  fonte,
  risposteEntro: facoltativo(dato(testo)),
});

export const bando = oggetto<Bando>({
  id: testo,
  oggetto: testo,
  stazioneAppaltante: testo,
  dataPubblicazione: facoltativo(testo),
  terminePresentazione: testo,
  termineChiarimenti: facoltativo(termineChiarimenti),
  baseAsta: numero,
  valori: elenco(valoreBando),
  fonte,
  lotti: elenco(lotto, { nonVuoto: true }),
});

// ─── Fascicoli ───────────────────────────────────────────────

const voce = unione<VoceFascicolo, 'tipo'>('tipo', {
  fatturato: { tipo: letterale('fatturato'), esercizio: numero, ambito, importo: dato(numero) },
  certificazione: { tipo: letterale('certificazione'), norma: testo, scope: testo, possesso: fatto(letterale(true)) },
  servizio: {
    tipo: letterale('servizio'),
    oggetto: testo,
    cpv: testo,
    committente: testo,
    importo: numero,
    periodo: dato(oggetto<{ da: string; a: string }>({ da: testo, a: testo })),
  },
  iscrizione: { tipo: letterale('iscrizione'), registro: testo, attivita: testo, possesso: fatto(letterale(true)) },
  dichiarazione: { tipo: letterale('dichiarazione'), oggetto: testo, resa: dato(letterale(true)) },
});

export const soggetto = oggetto<Soggetto>({ id: testo, denominazione: testo, fascicolo: elenco(voce) });

// ─── Documenti ───────────────────────────────────────────────

const documentoBando = oggetto<DocumentoBando>({ formato: formato(NOME_FORMATO.bando), provenienza, bando });

const documentoFascicoli = oggetto<DocumentoFascicoli>({
  formato: formato(NOME_FORMATO.fascicoli),
  provenienza,
  soggetti: elenco(soggetto, { nonVuoto: true }),
});

const indice = oggetto<Indice>({
  formato: formato(NOME_FORMATO.indice),
  bandi: elenco(oggetto<VoceIndiceBando>({ file: testo, dataRiferimentoProposta: testo, motivoDataProposta: facoltativo(testo) })),
  fascicoli: elenco(oggetto<{ file: string }>({ file: testo })),
});

export function controllaBando(valore: unknown): EsitoControllo<DocumentoBando> {
  return documentoBando(valore, []);
}

export function controllaFascicoli(valore: unknown): EsitoControllo<DocumentoFascicoli> {
  return documentoFascicoli(valore, []);
}

export function controllaIndice(valore: unknown): EsitoControllo<Indice> {
  return indice(valore, []);
}

/** La forma dei documenti, dagli stessi validatori che li controllano: per la pagina del formato. */
export const FORMA_BANDO: Forma = formaDi(documentoBando);
export const FORMA_FASCICOLI: Forma = formaDi(documentoFascicoli);
