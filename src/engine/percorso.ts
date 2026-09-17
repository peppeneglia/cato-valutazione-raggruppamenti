// Percorso minimo: ricerca in ampiezza sulle sequenze di mosse applicabili.
// Coda FIFO, insieme degli stati visitati, nessun limite di profondità:
// le mosse sono finite e la ricerca termina da sola.
//
// Prima si cerca il percorso ad `ammissibile`; se non esiste, quello ad
// `ammissibile_con_riserva`. A parità di lunghezza vince chi lascia meno
// residui (domande aperte), poi meno segnalazioni, poi l'ordine di
// scoperta, che è l'ordine di invasività e poi alfabetico.

import { assertNever } from '../assertNever';
import type { Lotto, ParametriValutazione, PercorsoMinimo, Raggruppamento, Requisito, RequisitoId } from '../domain';
import { contestoCriterioDi, sogliaInterna } from './criteri';
import { quotaCanonica, quotaPositiva } from './quote';
import { contributoDi } from './requisito';
import { applicaMossa, mosseCandidate, type Mossa } from './rimedi';
import { eBloccante } from './validazione';
import { confrontaTesto } from './testo';
import { valutaBase, type EsitoBase, type Memo } from './valutazione';
import { variantiDi } from './varianti';

type Nodo = { raggruppamento: Raggruppamento; mosse: Mossa[]; esito: EsitoBase };

/** Chiave canonica dello stato: ordine dei membri e delle quote irrilevante, float arrotondati. */
export function chiaveStato(raggruppamento: Raggruppamento): string {
  const membri = raggruppamento.membri
    .map((m) => {
      if (m.ruolo === 'ausiliaria') return [m.soggettoId, m.ruolo, m.ausiliataId, [...m.requisitiIds].sort()];
      const quote = Object.entries(m.quote)
        .filter(([, q]) => quotaPositiva(q))
        .map(([p, q]) => [p, quotaCanonica(q)] as const)
        .sort(([a], [b]) => confrontaTesto(a, b));
      return [m.soggettoId, m.ruolo, quote];
    })
    .sort((a, b) => confrontaTesto(String(a[0]), String(b[0])));
  return JSON.stringify(membri);
}

// ─── Limite teorico ──────────────────────────────────────────

/**
 * Le mosse non inventano fatti: spostano soggetti e quote. Un requisito è
 * copribile solo se, tra TUTTI i soggetti disponibili, esiste chi lo
 * possiede con certezza (possesso) o la somma dei contributi certi
 * raggiunge la soglia (misura), e questo sotto OGNI variante. Con la
 * regola non dichiarata o il criterio non determinato nessuna mossa lo
 * porta a coperto: è lo stesso ragionamento applicato ai casi nuovi.
 * Se un requisito non è copribile nemmeno in teoria, `ammissibile` è
 * irraggiungibile e la ricerca non deve esplorare tutto per scoprirlo.
 */
function copribileInTeoria(requisito: Requisito, parametri: ParametriValutazione, memo: Memo | undefined): boolean {
  if (requisito.regola.tipo === 'non_dichiarata') return false;
  const { varianti } = variantiDi(requisito, parametri.bando, memo?.varianti);
  if (varianti.length === 0) return false;
  const contesto = {
    criterio: contestoCriterioDi(parametri),
    memo: memo?.criteri,
  };
  return varianti.every((variante) => {
    if (variante.criterio.tipo === 'non_determinato') return false;
    const soglia = sogliaInterna(variante.criterio);
    let somma = 0;
    for (const soggetto of parametri.soggetti) {
      const valore = contributoDi(variante, soggetto, contesto)?.valore;
      if (!valore) return false;
      switch (valore.tipo) {
        case 'possesso':
          if (valore.esito === 'posseduto') return true;
          break;
        case 'misura':
          somma += valore.certo;
          if (somma >= soglia) return true;
          break;
        default:
          assertNever(valore);
      }
    }
    return false;
  });
}

function ammissibileRaggiungibile(parametri: ParametriValutazione, lotto: Lotto, memo: Memo | undefined): boolean {
  return lotto.requisiti.every((r) => copribileInTeoria(r, parametri, memo));
}

// ─── Ricerca ─────────────────────────────────────────────────

function residuiDi(esito: EsitoBase): RequisitoId[] {
  return esito.requisiti.filter((r) => r.stato !== 'coperto').map((r) => r.requisitoId);
}

function scopertiVincolanti(esito: EsitoBase, lotto: Lotto): Set<RequisitoId> {
  const vincolanti = new Set(lotto.requisiti.filter((r) => r.vincolante).map((r) => r.id));
  return new Set(esito.requisiti.filter((r) => r.stato === 'scoperto' && vincolanti.has(r.requisitoId)).map((r) => r.requisitoId));
}

/**
 * Tra le soluzioni dello stesso livello: meno residui, poi meno
 * segnalazioni, poi la prima scoperta. Un residuo è una domanda aperta
 * che qualcuno deve risolvere; un socio a quote zero è un fastidio formale.
 */
function migliore(soluzioni: Nodo[]): Nodo | undefined {
  const costo = (n: Nodo) => [residuiDi(n.esito).length, n.esito.anomalie.length] as const;
  return soluzioni.reduce<Nodo | undefined>((acc, n) => {
    if (!acc) return n;
    const [residuiAcc, segnalazioniAcc] = costo(acc);
    const [residuiN, segnalazioniN] = costo(n);
    return residuiN < residuiAcc || (residuiN === residuiAcc && segnalazioniN < segnalazioniAcc) ? n : acc;
  }, undefined);
}

function trovato(nodo: Nodo, verdettoRaggiunto: 'ammissibile' | 'ammissibile_con_riserva'): PercorsoMinimo {
  return { esito: 'trovato', mosse: nodo.mosse, verdettoRaggiunto, residui: residuiDi(nodo.esito), segnalazioni: nodo.esito.anomalie.length };
}

/** "Già raggiunto": i miglioramenti li aggiunge `valuta`, dai rimedi già verificati. */
function giaRaggiunto(verdetto: 'ammissibile' | 'ammissibile_con_riserva', residui: RequisitoId[]): PercorsoMinimo {
  return { esito: 'gia_ammissibile', verdetto, residui, miglioramenti: [] };
}

type OpzioniRicerca = {
  /**
   * Se false, la ricerca ignora il limite teorico ed esplora tutto lo spazio.
   * Serve solo ai test che dimostrano che il limite non cambia l'esito.
   */
  limiteTeorico: boolean;
};

const OPZIONI_PREDEFINITE: OpzioniRicerca = { limiteTeorico: true };

export function percorsoMinimo(
  parametri: ParametriValutazione,
  lotto: Lotto,
  iniziale: EsitoBase,
  memo?: Memo,
  opzioni: OpzioniRicerca = OPZIONI_PREDEFINITE,
): PercorsoMinimo {
  if (iniziale.anomalie.some(eBloccante)) return { esito: 'bloccato_da_anomalie' };
  if (iniziale.verdetto === 'ammissibile') return giaRaggiunto('ammissibile', []);

  const partenzaConRiserva = iniziale.verdetto === 'ammissibile_con_riserva';
  const cercaPieno = opzioni.limiteTeorico ? ammissibileRaggiungibile(parametri, lotto, memo) : true;
  if (partenzaConRiserva && !cercaPieno) {
    return giaRaggiunto('ammissibile_con_riserva', residuiDi(iniziale));
  }

  const visitati = new Set<string>([chiaveStato(parametri.raggruppamento)]);
  let livello: Nodo[] = [{ raggruppamento: parametri.raggruppamento, mosse: [], esito: iniziale }];
  let migliorConRiserva: Nodo | undefined;
  let restanoScoperti = scopertiVincolanti(iniziale, lotto);

  while (livello.length > 0) {
    const prossimo: Nodo[] = [];
    const pieni: Nodo[] = [];
    const conRiserva: Nodo[] = [];

    for (const nodo of livello) {
      const parametriNodo = { ...parametri, raggruppamento: nodo.raggruppamento };
      for (const mossa of mosseCandidate(parametriNodo, lotto, nodo.esito, memo)) {
        const raggruppamento = applicaMossa(nodo.raggruppamento, mossa);
        const chiave = chiaveStato(raggruppamento);
        if (visitati.has(chiave)) continue;
        visitati.add(chiave);

        const esito = valutaBase({ ...parametri, raggruppamento }, memo);
        if (esito.anomalie.some(eBloccante)) continue;

        const figlio: Nodo = { raggruppamento, mosse: [...nodo.mosse, mossa], esito };
        const scoperti = scopertiVincolanti(esito, lotto);
        restanoScoperti = new Set([...restanoScoperti].filter((id) => scoperti.has(id)));

        if (esito.verdetto === 'ammissibile') pieni.push(figlio);
        else {
          if (esito.verdetto === 'ammissibile_con_riserva') conRiserva.push(figlio);
          prossimo.push(figlio);
        }
      }
    }

    const pieno = migliore(pieni);
    if (pieno) return trovato(pieno, 'ammissibile');
    if (!migliorConRiserva && !partenzaConRiserva) migliorConRiserva = migliore(conRiserva);
    // Se `ammissibile` è irraggiungibile in teoria, la prima riserva è la risposta.
    if (migliorConRiserva && !cercaPieno) return trovato(migliorConRiserva, 'ammissibile_con_riserva');
    livello = prossimo;
  }

  if (migliorConRiserva) return trovato(migliorConRiserva, 'ammissibile_con_riserva');
  if (partenzaConRiserva) return giaRaggiunto('ammissibile_con_riserva', residuiDi(iniziale));
  return { esito: 'inesistente', restanoScoperti: [...restanoScoperti] };
}
