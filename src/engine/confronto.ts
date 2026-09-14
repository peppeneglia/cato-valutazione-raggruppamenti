// Confronto tra composizioni: la valutazione è pura, quindi si può
// applicare a più raggruppamenti sullo stesso lotto o a più lotti per lo
// stesso raggruppamento. Ordinamento: verdetto, poi lunghezza del percorso
// minimo, poi numero di requisiti scoperti. Oltre non si va: il pareggio
// viene dichiarato, perché un quarto criterio arbitrario produrrebbe un
// ordine che sembra significativo e non lo è.

import { assertNever } from '../assertNever';
import type { ConfrontaLotti, ConfrontaRaggruppamenti, Esito, Verdetto, VoceConfronto } from '../domain';
import { valuta } from './valuta';

const RANGO_VERDETTO: Record<Verdetto, number> = { ammissibile: 0, ammissibile_con_riserva: 1, non_ammissibile: 2 };

/** Lunghezza del percorso minimo: zero se già ammissibile, infinito se non esiste. */
function lunghezzaPercorso(esito: Esito): number {
  const percorso = esito.percorsoMinimo;
  switch (percorso.esito) {
    case 'gia_ammissibile':
      return 0;
    case 'trovato':
      return percorso.mosse.length;
    case 'inesistente':
    case 'bloccato_da_anomalie':
      return Number.POSITIVE_INFINITY;
    default:
      return assertNever(percorso);
  }
}

function scoperti(esito: Esito): number {
  return esito.requisiti.filter((r) => r.stato === 'scoperto').length;
}

type Costo = readonly [number, number, number];

function costoDi(esito: Esito): Costo {
  return [RANGO_VERDETTO[esito.verdetto], lunghezzaPercorso(esito), scoperti(esito)];
}

function confrontaCosti(a: Costo, b: Costo): number {
  for (let i = 0; i < a.length; i++) {
    const da = a[i] ?? 0;
    const db = b[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

/** Ordina e assegna le posizioni; le voci a pari merito condividono la posizione. */
export function classifica<Chiave>(voci: { chiave: Chiave; esito: Esito }[]): VoceConfronto<Chiave>[] {
  const ordinate = voci
    .map((v, indice) => ({ ...v, indice, costo: costoDi(v.esito) }))
    .sort((a, b) => confrontaCosti(a.costo, b.costo) || a.indice - b.indice);

  const risultato: VoceConfronto<Chiave>[] = [];
  ordinate.forEach((voce, i) => {
    const precedente = ordinate[i - 1];
    const pariAlPrecedente = precedente !== undefined && confrontaCosti(precedente.costo, voce.costo) === 0;
    const successivo = ordinate[i + 1];
    const pariAlSuccessivo = successivo !== undefined && confrontaCosti(successivo.costo, voce.costo) === 0;
    const posizione = pariAlPrecedente ? (risultato[i - 1]?.posizione ?? i + 1) : i + 1;
    risultato.push({ chiave: voce.chiave, esito: voce.esito, posizione, pariMerito: pariAlPrecedente || pariAlSuccessivo });
  });
  return risultato;
}

export const confrontaRaggruppamenti: ConfrontaRaggruppamenti = (parametri) => {
  const { alternative, ...comuni } = parametri;
  return classifica(alternative.map((a) => ({ chiave: a.etichetta, esito: valuta({ ...comuni, raggruppamento: a.raggruppamento }) })));
};

export const confrontaLotti: ConfrontaLotti = (parametri) =>
  classifica(parametri.bando.lotti.map((lotto) => ({ chiave: lotto.id, esito: valuta({ ...parametri, lottoId: lotto.id }) })));
