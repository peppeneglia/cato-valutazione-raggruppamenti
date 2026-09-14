// La funzione pura completa: valutazione, rimedi per requisito, percorso minimo.

import type { Miglioramento, Rimedio, RimedioApplicabile, RequisitoId, Valuta } from '../domain';
import { trovaLotto } from './indici';
import { percorsoMinimo } from './percorso';
import { rimediPerRequisito } from './rimedi';
import { eBloccante } from './validazione';
import { creaMemo, valutazione } from './valutazione';

function eApplicabile(rimedio: Rimedio): rimedio is RimedioApplicabile {
  return rimedio.tipo === 'riassegna_quota' || rimedio.tipo === 'uscita_soggetto' || rimedio.tipo === 'ingresso_soggetto' || rimedio.tipo === 'avvalimento';
}

/**
 * Le mosse che, da sole, rendono coperto almeno un requisito residuo:
 * sono i rimedi applicabili già verificati, raccolti per mossa. Servono
 * quando il verdetto massimo è già raggiunto e il percorso, altrimenti,
 * sembrerebbe inerte.
 */
function miglioramentiDa(rimedi: ReadonlyMap<RequisitoId, Rimedio[]>): Miglioramento[] {
  const perMossa = new Map<string, Miglioramento>();
  for (const [requisitoId, elenco] of rimedi) {
    for (const rimedio of elenco) {
      if (!eApplicabile(rimedio)) continue;
      const chiave = JSON.stringify(rimedio);
      const voce = perMossa.get(chiave);
      if (voce) voce.requisitiRisolti.push(requisitoId);
      else perMossa.set(chiave, { mossa: rimedio, requisitiRisolti: [requisitoId] });
    }
  }
  return [...perMossa.values()];
}

export const valuta: Valuta = (parametri) => {
  const memo = creaMemo(parametri);
  const { esito, scaduti } = valutazione(parametri, memo);
  const lotto = trovaLotto(parametri.bando, parametri.lottoId);
  if (!lotto || esito.anomalie.some(eBloccante)) {
    return { ...esito, percorsoMinimo: { esito: 'bloccato_da_anomalie' } };
  }
  const rimedi = rimediPerRequisito(parametri, lotto, esito, scaduti, memo);
  const percorso = percorsoMinimo(parametri, lotto, esito, memo);
  return {
    ...esito,
    requisiti: esito.requisiti.map((r) => ({ ...r, rimedi: rimedi.get(r.requisitoId) ?? [] })),
    percorsoMinimo: percorso.esito === 'gia_ammissibile' ? { ...percorso, miglioramenti: miglioramentiDa(rimedi) } : percorso,
  };
};
