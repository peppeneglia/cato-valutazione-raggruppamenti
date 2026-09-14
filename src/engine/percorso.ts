// Percorso minimo: ricerca in ampiezza sulle sequenze di mosse applicabili.
// Coda FIFO, insieme degli stati visitati, nessun limite di profondità:
// le mosse sono finite e la ricerca termina da sola.
//
// Prima si cerca il percorso ad `ammissibile`; se non esiste, quello ad
// `ammissibile_con_riserva`. A parità di lunghezza vince chi lascia meno
// segnalazioni, poi l'ordine di scoperta, che è l'ordine di invasività.

import { assertNever } from '../assertNever';
import type { Lotto, ParametriValutazione, PercorsoMinimo, Raggruppamento, Requisito, RequisitoId } from '../domain';
import { sogliaInterna } from './criteri';
import { quotaCanonica, quotaPositiva } from './quote';
import { contributoDi } from './requisito';
import { applicaMossa, mosseCandidate, type Mossa } from './rimedi';
import { eBloccante } from './validazione';
import { valutaBase, type EsitoBase, type Memo } from './valutazione';

type Nodo = { raggruppamento: Raggruppamento; mosse: Mossa[]; esito: EsitoBase };

/** Chiave canonica dello stato: ordine dei membri e delle quote irrilevante, float arrotondati. */
export function chiaveStato(raggruppamento: Raggruppamento): string {
  const membri = raggruppamento.membri
    .map((m) => {
      if (m.ruolo === 'ausiliaria') return [m.soggettoId, m.ruolo, m.ausiliataId, [...m.requisitiIds].sort()];
      const quote = Object.entries(m.quote)
        .filter(([, q]) => quotaPositiva(q))
        .map(([p, q]) => [p, quotaCanonica(q)] as const)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return [m.soggettoId, m.ruolo, quote];
    })
    .sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1));
  return JSON.stringify(membri);
}

// ─── Limite teorico ──────────────────────────────────────────

/**
 * Le mosse non inventano fatti: spostano soggetti e quote. Un requisito è
 * copribile solo se, tra TUTTI i soggetti disponibili, esiste chi lo
 * possiede con certezza (possesso) o la somma dei contributi certi
 * raggiunge la soglia (misura). Se un requisito non è copribile nemmeno
 * in teoria, `ammissibile` è irraggiungibile e la ricerca non deve
 * esplorare l'intero spazio per scoprirlo.
 */
function copribileInTeoria(requisito: Requisito, parametri: ParametriValutazione, memo: Memo | undefined): boolean {
  const contesto = { criterio: { dataRiferimento: parametri.dataRiferimento, dataPubblicazione: parametri.bando.dataPubblicazione }, memo: memo?.criteri };
  const soglia = sogliaInterna(requisito.criterio);
  let somma = 0;
  for (const soggetto of parametri.soggetti) {
    const valore = contributoDi(requisito, soggetto, contesto).valore;
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

/** Tra le soluzioni dello stesso livello: meno segnalazioni, poi la prima scoperta. */
function migliore(soluzioni: Nodo[]): Nodo | undefined {
  return soluzioni.reduce<Nodo | undefined>((acc, n) => (!acc || n.esito.anomalie.length < acc.esito.anomalie.length ? n : acc), undefined);
}

function trovato(nodo: Nodo, verdettoRaggiunto: 'ammissibile' | 'ammissibile_con_riserva'): PercorsoMinimo {
  return { esito: 'trovato', mosse: nodo.mosse, verdettoRaggiunto, residui: residuiDi(nodo.esito), segnalazioni: nodo.esito.anomalie.length };
}

export function percorsoMinimo(parametri: ParametriValutazione, lotto: Lotto, iniziale: EsitoBase, memo?: Memo): PercorsoMinimo {
  if (iniziale.anomalie.some(eBloccante)) return { esito: 'bloccato_da_anomalie' };
  if (iniziale.verdetto === 'ammissibile') return { esito: 'gia_ammissibile', verdetto: 'ammissibile', residui: [] };

  const partenzaConRiserva = iniziale.verdetto === 'ammissibile_con_riserva';
  const cercaPieno = ammissibileRaggiungibile(parametri, lotto, memo);
  if (partenzaConRiserva && !cercaPieno) {
    return { esito: 'gia_ammissibile', verdetto: 'ammissibile_con_riserva', residui: residuiDi(iniziale) };
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
      for (const mossa of mosseCandidate(parametriNodo, lotto, nodo.esito)) {
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
  if (partenzaConRiserva) return { esito: 'gia_ammissibile', verdetto: 'ammissibile_con_riserva', residui: residuiDi(iniziale) };
  return { esito: 'inesistente', restanoScoperti: [...restanoScoperti] };
}
