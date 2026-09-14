// Il canale lento: rimedi, percorso minimo e confronti si calcolano dopo
// che la modifica si è assestata. Finché il risultato non corrisponde
// ESATTAMENTE ai parametri correnti, lo stato è "in calcolo": mai un
// valore stantio spacciato per attuale.

import { useEffect, useState } from 'react';
import type { Esito, LottoId, ParametriValutazione, Raggruppamento, VoceConfronto } from '../domain';
import { confrontaLotti, confrontaRaggruppamenti, valuta } from '../engine';

export const RITARDO_MS = 250;

export const ETICHETTA_ATTUALE = 'Composizione attuale';
export const ETICHETTA_PRECEDENTE = "Prima dell'ultima prova";

export type ValutazioneDifferita =
  | { stato: 'in_calcolo' }
  | {
      stato: 'pronto';
      esito: Esito;
      lotti: VoceConfronto<LottoId>[];
      /** Presente solo se esiste una composizione precedente all'ultima prova. */
      confrontoProva: VoceConfronto<string>[] | undefined;
    };

type Calcolato = {
  parametri: ParametriValutazione;
  precedente: Raggruppamento | undefined;
  risultato: Extract<ValutazioneDifferita, { stato: 'pronto' }>;
};

export function useValutazioneDifferita(parametri: ParametriValutazione, precedente: Raggruppamento | undefined): ValutazioneDifferita {
  const [calcolato, setCalcolato] = useState<Calcolato | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      const esito = valuta(parametri);
      const { bando, soggetti, raggruppamento, dataRiferimento, orizzonteScadenzeGiorni, lottoId } = parametri;
      const lotti = confrontaLotti({ bando, soggetti, raggruppamento, dataRiferimento, orizzonteScadenzeGiorni });
      const confrontoProva = precedente === undefined
        ? undefined
        : confrontaRaggruppamenti({
            bando,
            soggetti,
            dataRiferimento,
            orizzonteScadenzeGiorni,
            lottoId,
            alternative: [
              { etichetta: ETICHETTA_ATTUALE, raggruppamento },
              { etichetta: ETICHETTA_PRECEDENTE, raggruppamento: precedente },
            ],
          });
      setCalcolato({ parametri, precedente, risultato: { stato: 'pronto', esito, lotti, confrontoProva } });
    }, RITARDO_MS);
    return () => clearTimeout(timer);
  }, [parametri, precedente]);

  // Il risultato vale solo per i parametri con cui è stato calcolato.
  if (calcolato && calcolato.parametri === parametri && calcolato.precedente === precedente) return calcolato.risultato;
  return { stato: 'in_calcolo' };
}
