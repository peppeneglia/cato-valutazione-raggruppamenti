// Il caricamento dei documenti: dallo stesso server che serve la pagina,
// oppure da un file che l'utente sceglie sul proprio disco. Nessun servizio
// esterno, nessun dato che lascia il browser.
//
// Un documento che non si legge, non è JSON o non ha la forma giusta non
// ferma gli altri: resta nell'elenco con i suoi errori.

import {
  controllaBando,
  controllaFascicoli,
  controllaIndice,
  NOME_FORMATO,
  type DocumentoBando,
  type DocumentoFascicoli,
  type Indice,
} from './formato';
import { suggerimento, type ErroreStruttura, type EsitoControllo } from './struttura';

export type ErroreDocumento =
  | { tipo: 'lettura'; motivo: string }
  | { tipo: 'sintassi'; riga?: number; colonna?: number }
  | ({ tipo: 'struttura' } & ErroreStruttura);

export type Caricato<T> =
  | { file: string; stato: 'valido'; documento: T }
  | { file: string; stato: 'non_valido'; errori: ErroreDocumento[] };

export type BandoCaricato = Caricato<DocumentoBando> & { dataRiferimentoProposta?: string; motivoDataProposta?: string };

export type Raccolta = {
  indice: Caricato<Indice>;
  bandi: BandoCaricato[];
  fascicoli: Caricato<DocumentoFascicoli>[];
};

/** Quanto serve di `fetch`: nei test lo sostituisce una lettura dai file. */
export type Scarica = (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

// ─── Lettura del testo ───────────────────────────────────────

/**
 * I browser non concordano sul messaggio di JSON.parse: Chrome e Node danno
 * la posizione («at position 812», a volte «line 3 column 5»), Firefox riga e
 * colonna. Se nessuno dei due c'è, l'errore resta senza posizione.
 */
function posizioneErrore(messaggio: string, testo: string): { riga?: number; colonna?: number } {
  const rigaColonna = /line (\d+) column (\d+)/i.exec(messaggio);
  if (rigaColonna) return { riga: Number(rigaColonna[1]), colonna: Number(rigaColonna[2]) };
  const posizione = /position (\d+)/i.exec(messaggio);
  if (!posizione) return {};
  const prima = testo.slice(0, Number(posizione[1]));
  const righe = prima.split('\n');
  return { riga: righe.length, colonna: righe[righe.length - 1]!.length + 1 };
}

export function leggiJson(testo: string): { ok: true; valore: unknown } | { ok: false; errore: ErroreDocumento } {
  const pulito = testo.charCodeAt(0) === 0xfeff ? testo.slice(1) : testo;
  if (pulito.trim() === '') return { ok: false, errore: { tipo: 'lettura', motivo: 'il file è vuoto' } };
  try {
    return { ok: true, valore: JSON.parse(pulito) };
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : String(e);
    return { ok: false, errore: { tipo: 'sintassi', ...posizioneErrore(messaggio, pulito) } };
  }
}

function daControllo<T>(file: string, esito: EsitoControllo<T>): Caricato<T> {
  return esito.ok
    ? { file, stato: 'valido', documento: esito.valore }
    : { file, stato: 'non_valido', errori: esito.errori.map((e) => ({ tipo: 'struttura', ...e })) };
}

function nonValido<T>(file: string, errore: ErroreDocumento): Caricato<T> {
  return { file, stato: 'non_valido', errori: [errore] };
}

export function leggiBando(file: string, testo: string): Caricato<DocumentoBando> {
  const json = leggiJson(testo);
  return json.ok ? daControllo(file, controllaBando(json.valore)) : nonValido(file, json.errore);
}

export function leggiFascicoli(file: string, testo: string): Caricato<DocumentoFascicoli> {
  const json = leggiJson(testo);
  return json.ok ? daControllo(file, controllaFascicoli(json.valore)) : nonValido(file, json.errore);
}

export function leggiIndice(file: string, testo: string): Caricato<Indice> {
  const json = leggiJson(testo);
  return json.ok ? daControllo(file, controllaIndice(json.valore)) : nonValido(file, json.errore);
}

export type DocumentoLetto =
  | { genere: 'bando'; caricato: Caricato<DocumentoBando> }
  | { genere: 'fascicoli'; caricato: Caricato<DocumentoFascicoli> }
  | { genere: 'sconosciuto'; caricato: Caricato<never> };

/**
 * Un file scelto dall'utente: cosa sia lo dice la sua intestazione, non il
 * nome del file. Senza un `formato.nome` riconoscibile non si può nemmeno
 * dire contro quale forma controllarlo, e l'errore è quello.
 */
export function leggiDocumento(file: string, testo: string): DocumentoLetto {
  const json = leggiJson(testo);
  if (!json.ok) return { genere: 'sconosciuto', caricato: nonValido(file, json.errore) };
  const valore = json.valore as { formato?: { nome?: unknown } } | null;
  const nome = typeof valore === 'object' && valore !== null ? valore.formato?.nome : undefined;
  if (nome === NOME_FORMATO.bando) return { genere: 'bando', caricato: daControllo(file, controllaBando(json.valore)) };
  if (nome === NOME_FORMATO.fascicoli) return { genere: 'fascicoli', caricato: daControllo(file, controllaFascicoli(json.valore)) };
  const ammessi = [NOME_FORMATO.bando, NOME_FORMATO.fascicoli];
  return {
    genere: 'sconosciuto',
    caricato: nonValido(file, {
      tipo: 'struttura',
      percorso: [{ tipo: 'campo', nome: 'formato' }, { tipo: 'campo', nome: 'nome' }],
      atteso: `«${NOME_FORMATO.bando}» per un bando, oppure «${NOME_FORMATO.fascicoli}» per i fascicoli delle imprese${typeof nome === 'string' ? suggerimento(nome, ammessi) : ''}`,
      trovato: nome === undefined ? 'il campo non c\'è: il documento non dichiara cosa contiene' : typeof nome === 'string' ? `il testo «${nome}»` : 'un valore che non è un testo',
    }),
  };
}

// ─── Dal server ──────────────────────────────────────────────

export const FILE_INDICE = 'indice.json';

async function scaricaTesto(scarica: Scarica, base: string, file: string): Promise<{ ok: true; testo: string } | { ok: false; errore: ErroreDocumento }> {
  try {
    const risposta = await scarica(`${base}${file}`);
    if (!risposta.ok) {
      const motivo = risposta.status === 404 ? 'il file non esiste sul server (404)' : `il server ha risposto con un errore (${risposta.status})`;
      return { ok: false, errore: { tipo: 'lettura', motivo } };
    }
    return { ok: true, testo: await risposta.text() };
  } catch {
    return { ok: false, errore: { tipo: 'lettura', motivo: 'il server non ha risposto' } };
  }
}

/** Legge l'indice e poi, in parallelo, ogni documento che elenca. */
export async function caricaRaccolta(scarica: Scarica, base: string): Promise<Raccolta> {
  const testoIndice = await scaricaTesto(scarica, base, FILE_INDICE);
  const indice = testoIndice.ok ? leggiIndice(FILE_INDICE, testoIndice.testo) : nonValido<Indice>(FILE_INDICE, testoIndice.errore);
  if (indice.stato !== 'valido') return { indice, bandi: [], fascicoli: [] };

  const [bandi, fascicoli] = await Promise.all([
    Promise.all(indice.documento.bandi.map(async (voce): Promise<BandoCaricato> => {
      const t = await scaricaTesto(scarica, base, voce.file);
      const caricato = t.ok ? leggiBando(voce.file, t.testo) : nonValido<DocumentoBando>(voce.file, t.errore);
      return { ...caricato, dataRiferimentoProposta: voce.dataRiferimentoProposta, motivoDataProposta: voce.motivoDataProposta };
    })),
    Promise.all(indice.documento.fascicoli.map(async (voce) => {
      const t = await scaricaTesto(scarica, base, voce.file);
      return t.ok ? leggiFascicoli(voce.file, t.testo) : nonValido<DocumentoFascicoli>(voce.file, t.errore);
    })),
  ]);
  return { indice, bandi, fascicoli };
}
