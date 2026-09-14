// Una pagina, nessun routing. Lo stato mutabile è il foglio di lavoro;
// tutto il resto è derivato dal motore: il canale sincrono (requisiti,
// anomalie, avvisi, verdetto) risponde a ogni modifica, quello differito
// (rimedi, percorso, confronti) dopo che la modifica si è assestata.

import { useMemo, useReducer } from 'react';
import type { Azione, Lavoro } from './lavoro';
import { composizionePrimaDellUltimaProva, riduci } from './lavoro';
import type { ParametriValutazione } from './domain';
import { valutaBase } from './engine';
import { bando, DATA_RIFERIMENTO, ORIZZONTE_SCADENZE_GIORNI, raggruppamento, soggetti } from './fixture';
import { trovaLotto } from './engine/indici';
import { Composizione } from './ui/Composizione';
import { ConfrontoLotti } from './ui/ConfrontoLotti';
import { IntestazioneBando } from './ui/IntestazioneBando';
import { Storia } from './ui/Storia';
import { Verdetto } from './ui/Verdetto';
import { useValutazioneDifferita } from './ui/useValutazioneDifferita';
import styles from './App.module.css';

const CONTESTO = { bando, soggetti };

const LAVORO_INIZIALE: Lavoro = {
  lottoId: bando.lotti[0]?.id ?? '',
  dataRiferimento: DATA_RIFERIMENTO,
  raggruppamento,
  storia: [],
};

function riduttore(lavoro: Lavoro, azione: Azione): Lavoro {
  return riduci(lavoro, azione, CONTESTO);
}

export default function App() {
  const [lavoro, dispatch] = useReducer(riduttore, LAVORO_INIZIALE);

  const parametri = useMemo<ParametriValutazione>(
    () => ({
      bando,
      lottoId: lavoro.lottoId,
      soggetti,
      raggruppamento: lavoro.raggruppamento,
      dataRiferimento: lavoro.dataRiferimento,
      orizzonteScadenzeGiorni: ORIZZONTE_SCADENZE_GIORNI,
    }),
    [lavoro.lottoId, lavoro.raggruppamento, lavoro.dataRiferimento],
  );

  const esito = useMemo(() => valutaBase(parametri), [parametri]);
  const precedente = composizionePrimaDellUltimaProva(lavoro)?.raggruppamento;
  const differita = useValutazioneDifferita(parametri, precedente);
  const lotto = trovaLotto(bando, lavoro.lottoId);

  return (
    <main className={styles.pagina}>
      <header className={styles.testata}>
        <h1>Valutazione ammissibilità del raggruppamento</h1>
      </header>

      <ConfrontoLotti bando={bando} lottoId={lavoro.lottoId} differita={differita} onSeleziona={(lottoId) => dispatch({ tipo: 'seleziona_lotto', lottoId })} />

      <IntestazioneBando bando={bando} lotto={lotto} />

      <Verdetto
        verdetto={esito.verdetto}
        dataRiferimento={lavoro.dataRiferimento}
        onDataRiferimento={(valore) => dispatch({ tipo: 'imposta_data', valore })}
        scoperti={esito.requisiti.filter((r) => r.stato === 'scoperto').length}
        daVerificare={esito.requisiti.filter((r) => r.stato === 'da_verificare').length}
        bloccanti={esito.anomalie.filter((a) => a.gravita === 'bloccante').length}
      />

      <Composizione lotto={lotto} raggruppamento={lavoro.raggruppamento} soggetti={soggetti} contesto={CONTESTO} dispatch={dispatch} />
      <Storia storia={lavoro.storia} onAnnulla={() => dispatch({ tipo: 'annulla' })} />
    </main>
  );
}
