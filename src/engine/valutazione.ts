// Valutazione senza rimedi: è la funzione che la ricerca richiama su
// ogni copia dell'input. Se il lotto non esiste o le date che governano
// la valutazione sono malformate, i requisiti non sono calcolabili e
// restano vuoti: le anomalie bloccanti dicono perché.

import type { Anomalia, Esito, ParametriValutazione, RequisitoId } from '../domain';
import { dataValida } from './date';
import { indicizza, trovaLotto } from './indici';
import { valutaRequisito, type FattoScadutoDi, type FattoUsatoDa, type MemoCriteri } from './requisito';
import { avvisiScadenza } from './scadenze';
import { anomalieFascicoli, anomalieStrutturali } from './validazione';
import { calcolaVerdetto } from './verdetto';

export type EsitoBase = Omit<Esito, 'percorsoMinimo'>;

export type Valutazione = { esito: EsitoBase; scaduti: Map<RequisitoId, FattoScadutoDi[]> };

/**
 * Ciò che non dipende dal raggruppamento e che la ricerca dei rimedi
 * ricalcolerebbe a ogni stato. Vale per un solo insieme di soggetti:
 * chi cambia i fascicoli (rinnovo simulato) non deve riusarla.
 */
export type Memo = { criteri: MemoCriteri; anomalieFascicoli: Anomalia[] };

export function creaMemo(parametri: ParametriValutazione): Memo {
  return { criteri: new Map(), anomalieFascicoli: anomalieFascicoli(parametri.soggetti) };
}

export function valutazione(parametri: ParametriValutazione, memo?: Memo): Valutazione {
  const { bando, lottoId, soggetti, raggruppamento, dataRiferimento, orizzonteScadenzeGiorni } = parametri;
  const anomalie = anomalieStrutturali(parametri, memo?.anomalieFascicoli);
  const lotto = trovaLotto(bando, lottoId);
  const dateValide = dataValida(dataRiferimento) && dataValida(bando.dataPubblicazione) && dataValida(bando.terminePresentazione);
  const scaduti = new Map<RequisitoId, FattoScadutoDi[]>();

  if (!lotto || !dateValide) {
    return { esito: { lottoId, valutatoAl: dataRiferimento, verdetto: 'non_ammissibile', requisiti: [], anomalie, avvisiScadenza: [] }, scaduti };
  }

  const contesto = {
    prestazioni: indicizza(lotto.prestazioni),
    soggetti: indicizza(soggetti),
    raggruppamento,
    criterio: { dataRiferimento, dataPubblicazione: bando.dataPubblicazione },
    memo: memo?.criteri,
  };

  const usati: FattoUsatoDa[] = [];
  const requisiti = lotto.requisiti.map((requisito) => {
    const valutato = valutaRequisito(requisito, contesto);
    usati.push(...valutato.usati);
    scaduti.set(requisito.id, valutato.scaduti);
    return valutato.esito;
  });

  const verdetto = calcolaVerdetto(
    lotto.requisiti.map((r, i) => ({ stato: requisiti[i]?.stato ?? 'scoperto', vincolante: r.vincolante })),
    anomalie,
  );

  return {
    esito: {
      lottoId,
      valutatoAl: dataRiferimento,
      verdetto,
      requisiti,
      anomalie,
      avvisiScadenza: avvisiScadenza(usati, { dataRiferimento, terminePresentazione: bando.terminePresentazione, orizzonteGiorni: orizzonteScadenzeGiorni }),
    },
    scaduti,
  };
}

export function valutaBase(parametri: ParametriValutazione, memo?: Memo): EsitoBase {
  return valutazione(parametri, memo).esito;
}
