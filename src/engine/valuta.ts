// La funzione pura completa: valutazione, rimedi per requisito, percorso minimo.

import type { Valuta } from '../domain';
import { trovaLotto } from './indici';
import { percorsoMinimo } from './percorso';
import { rimediPerRequisito } from './rimedi';
import { eBloccante } from './validazione';
import { creaMemo, valutazione } from './valutazione';

export const valuta: Valuta = (parametri) => {
  const memo = creaMemo(parametri);
  const { esito, scaduti } = valutazione(parametri, memo);
  const lotto = trovaLotto(parametri.bando, parametri.lottoId);
  if (!lotto || esito.anomalie.some(eBloccante)) {
    return { ...esito, percorsoMinimo: { esito: 'bloccato_da_anomalie' } };
  }
  const rimedi = rimediPerRequisito(parametri, lotto, esito, scaduti, memo);
  return {
    ...esito,
    requisiti: esito.requisiti.map((r) => ({ ...r, rimedi: rimedi.get(r.requisitoId) ?? [] })),
    percorsoMinimo: percorsoMinimo(parametri, lotto, esito, memo),
  };
};
