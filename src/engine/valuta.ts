// Orchestrazione della valutazione, senza rimedi: è la funzione che la
// ricerca dei rimedi richiama su ogni copia dell'input.

import type { Esito, ParametriValutazione } from '../domain';
import { dataValida } from './date';
import { indicizza, trovaLotto } from './indici';
import { valutaRequisito, type FattoUsatoDa } from './requisito';
import { avvisiScadenza } from './scadenze';
import { anomalieStrutturali } from './validazione';
import { calcolaVerdetto } from './verdetto';

export type EsitoBase = Omit<Esito, 'percorsoMinimo'>;

/**
 * Valuta tutto tranne i rimedi. Se il lotto non esiste o le date che
 * governano la valutazione sono malformate, i requisiti non sono
 * calcolabili e restano vuoti: le anomalie bloccanti dicono perché.
 */
export function valutaBase(parametri: ParametriValutazione): EsitoBase {
  const { bando, lottoId, soggetti, raggruppamento, dataRiferimento, orizzonteScadenzeGiorni } = parametri;
  const anomalie = anomalieStrutturali(parametri);
  const lotto = trovaLotto(bando, lottoId);
  const dateValide = dataValida(dataRiferimento) && dataValida(bando.dataPubblicazione) && dataValida(bando.terminePresentazione);

  if (!lotto || !dateValide) {
    return { lottoId, valutatoAl: dataRiferimento, verdetto: 'non_ammissibile', requisiti: [], anomalie, avvisiScadenza: [] };
  }

  const contesto = {
    prestazioni: indicizza(lotto.prestazioni),
    soggetti: indicizza(soggetti),
    raggruppamento,
    criterio: { dataRiferimento, dataPubblicazione: bando.dataPubblicazione },
  };

  const usati: FattoUsatoDa[] = [];
  const requisiti = lotto.requisiti.map((requisito) => {
    const valutato = valutaRequisito(requisito, contesto);
    usati.push(...valutato.usati);
    return valutato.esito;
  });

  const verdetto = calcolaVerdetto(
    lotto.requisiti.map((r, i) => ({ stato: requisiti[i]?.stato ?? 'scoperto', vincolante: r.vincolante })),
    anomalie,
  );

  return {
    lottoId,
    valutatoAl: dataRiferimento,
    verdetto,
    requisiti,
    anomalie,
    avvisiScadenza: avvisiScadenza(usati, { dataRiferimento, terminePresentazione: bando.terminePresentazione, orizzonteGiorni: orizzonteScadenzeGiorni }),
  };
}
