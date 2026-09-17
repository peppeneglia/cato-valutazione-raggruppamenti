// La scelta di cosa valutare: una gara, le imprese, la mandataria. Funzioni
// pure; la schermata iniziale le usa e i test le leggono senza interfaccia.
//
// I documenti disponibili vengono da due origini — il server che serve la
// pagina e il disco di chi la usa — e stanno in un elenco solo: chi sceglie
// non deve sapere da dove arriva una gara per poterla valutare.

import type { Caricato } from './documenti/carica';
import type { DocumentoBando, DocumentoFascicoli } from './documenti/formato';
import type { Soggetto, SoggettoId } from './domain';

type Origine = 'server' | 'disco';

export type VoceBando = {
  chiave: string;
  origine: Origine;
  caricato: Caricato<DocumentoBando>;
  /** Dall'indice, per i bandi del server. Per un file dal disco non c'è: la pagina propone la data di oggi. */
  dataRiferimentoProposta?: string;
  motivoDataProposta?: string;
};

export type VoceFascicoli = {
  chiave: string;
  origine: Origine;
  caricato: Caricato<DocumentoFascicoli>;
};

export type Scelta = {
  bando?: string;
  imprese: SoggettoId[];
  mandataria?: SoggettoId;
};

export const SCELTA_VUOTA: Scelta = { imprese: [] };

/** Un raggruppamento ne ha almeno due: con una sola impresa non c'è niente da comporre. */
const MINIMO_IMPRESE = 2;

/** Un'impresa con il fascicolo da cui viene: sempre uno valido, perché da un file rotto non esce nessuna impresa. */
export type ImpresaDisponibile = { soggetto: Soggetto; voce: VoceFascicoli & { caricato: { stato: 'valido' } } };

export function impreseDisponibili(fascicoli: VoceFascicoli[]): ImpresaDisponibile[] {
  return fascicoli.flatMap((voce) => {
    const { caricato } = voce;
    return caricato.stato === 'valido' ? caricato.documento.soggetti.map((soggetto) => ({ soggetto, voce: { ...voce, caricato } })) : [];
  });
}

export function includiImpresa(scelta: Scelta, id: SoggettoId, inclusa: boolean): Scelta {
  if (inclusa) return scelta.imprese.includes(id) ? scelta : { ...scelta, imprese: [...scelta.imprese, id] };
  const imprese = scelta.imprese.filter((x) => x !== id);
  return { ...scelta, imprese, mandataria: scelta.mandataria === id ? undefined : scelta.mandataria };
}

/** Scegliere la mandataria la include: non si è mandataria di un raggruppamento di cui non si fa parte. */
export function scegliMandataria(scelta: Scelta, id: SoggettoId): Scelta {
  return { ...includiImpresa(scelta, id, true), mandataria: id };
}

/** Le imprese nell'ordine dell'elenco, non in quello dei clic: la composizione non dipende da come si è arrivati. */
function impreseInOrdine(scelta: Scelta, disponibili: ImpresaDisponibile[]): SoggettoId[] {
  return disponibili.map((d) => d.soggetto.id).filter((id) => scelta.imprese.includes(id));
}

export type SceltaPronta = { bando: VoceBando & { caricato: { stato: 'valido' } }; imprese: SoggettoId[]; mandataria: SoggettoId };

/** Cosa manca per valutare, in una frase; undefined se non manca niente. */
export function cosaManca(scelta: Scelta, bandi: VoceBando[], disponibili: ImpresaDisponibile[]): string | undefined {
  const bando = bandi.find((b) => b.chiave === scelta.bando && b.caricato.stato === 'valido');
  const imprese = impreseInOrdine(scelta, disponibili);
  const mancanti: string[] = [];
  if (!bando) mancanti.push('la gara');
  if (imprese.length < MINIMO_IMPRESE) mancanti.push(imprese.length === 0 ? 'almeno due imprese' : 'almeno un’altra impresa');
  if (scelta.mandataria === undefined || !imprese.includes(scelta.mandataria)) mancanti.push('la mandataria');
  if (mancanti.length === 0) return undefined;
  const elenco = mancanti.length === 1 ? mancanti[0] : `${mancanti.slice(0, -1).join(', ')} e ${mancanti[mancanti.length - 1]}`;
  return `Per valutare scegli ${elenco}.`;
}

export function sceltaPronta(scelta: Scelta, bandi: VoceBando[], disponibili: ImpresaDisponibile[]): SceltaPronta | undefined {
  if (cosaManca(scelta, bandi, disponibili) !== undefined) return undefined;
  const bando = bandi.find((b) => b.chiave === scelta.bando) as SceltaPronta['bando'];
  return { bando, imprese: impreseInOrdine(scelta, disponibili), mandataria: scelta.mandataria! };
}

/**
 * Due imprese con lo stesso id si confonderebbero nel motore in silenzio: i
 * contributi dell'una finirebbero sull'altra. Dei fascicoli caricati dal disco
 * con un id già usato non entrano, e l'errore dice di chi è quell'id.
 */
export function controllaConflitti(caricato: Caricato<DocumentoFascicoli>, esistenti: ImpresaDisponibile[]): Caricato<DocumentoFascicoli> {
  if (caricato.stato !== 'valido') return caricato;
  const errori = caricato.documento.soggetti.flatMap((s) => {
    const gia = esistenti.find((e) => e.soggetto.id === s.id);
    if (!gia) return [];
    return [{
      tipo: 'struttura' as const,
      percorso: [{ tipo: 'campo' as const, nome: 'soggetti' }, { tipo: 'elemento' as const, indice: caricato.documento.soggetti.indexOf(s), id: s.id }, { tipo: 'campo' as const, nome: 'id' }],
      atteso: `un id non ancora usato: «${s.id}» è già di ${gia.soggetto.denominazione}, in ${gia.voce.caricato.file}`,
      trovato: `il testo «${s.id}»`,
    }];
  });
  return errori.length === 0 ? caricato : { file: caricato.file, stato: 'non_valido', errori };
}

/** L'esito di un file scelto dal disco, come la schermata lo racconta. */
export type EsitoCaricamento =
  | { tipo: 'bando'; file: string; oggetto: string }
  | { tipo: 'fascicoli'; file: string; imprese: number }
  | { tipo: 'errori'; caricato: Extract<Caricato<unknown>, { stato: 'non_valido' }> };
