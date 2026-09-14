// Una pagina, nessun routing. Lo stato mutabile è il foglio di lavoro;
// tutto il resto è derivato dal motore: il canale sincrono (requisiti,
// anomalie, avvisi, verdetto) risponde a ogni modifica, quello differito
// (rimedi, percorso, confronti) dopo che la modifica si è assestata.
//
// La schermata risponde a una domanda: sono dentro su questo lotto, e se
// no cosa mi manca. Ciò che risponde sta in alto e grande; ciò che motiva
// sotto; ciò che documenta dietro un'interazione.

import { useMemo, useReducer, useState } from 'react';
import type { Azione, Lavoro } from './lavoro';
import { composizionePrimaDellUltimaProva, riduci } from './lavoro';
import type { ParametriValutazione } from './domain';
import { valutaBase } from './engine';
import { bando, DATA_RIFERIMENTO, DICHIARAZIONE_DATI, ORIZZONTE_SCADENZE_GIORNI, raggruppamento, soggetti } from './fixture';
import { trovaLotto } from './engine/indici';
import { formattaData } from './formato';
import { fraseVerdetto } from './descrizioni';
import { richiedeChiarimenti } from './engine/rimedi';
import { Anomalie } from './ui/Anomalie';
import { Assunzioni } from './ui/Assunzioni';
import { Avvisi } from './ui/Avvisi';
import { BarraLotti } from './ui/BarraLotti';
import { BloccoVerdetto } from './ui/BloccoVerdetto';
import { Composizione } from './ui/Composizione';
import { ConfrontoLotti } from './ui/ConfrontoLotti';
import { ConfrontoProva } from './ui/ConfrontoProva';
import { IntestazioneBando } from './ui/IntestazioneBando';
import { legendaAssunzioni } from './ui/legenda';
import { NonValutato } from './ui/NonValutato';
import { Storia } from './ui/Storia';
import { TabellaEsito } from './ui/TabellaEsito';
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

/** "Dove conviene presentarsi" è una domanda diversa da "sono dentro": ha la sua schermata. */
type Vista = 'lotto' | 'confronto';

export default function App() {
  const [lavoro, dispatch] = useReducer(riduttore, LAVORO_INIZIALE);
  const [vista, setVista] = useState<Vista>('lotto');

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
  const legenda = useMemo(() => legendaAssunzioni(esito.requisiti), [esito]);
  const rimediPerRequisito = useMemo(
    () => (differita.stato === 'pronto' ? new Map(differita.esito.requisiti.map((r) => [r.requisitoId, r.rimedi])) : ('in_calcolo' as const)),
    [differita],
  );
  const frase = useMemo(
    () => fraseVerdetto({
      bando,
      lottoId: lavoro.lottoId,
      esito,
      percorso: differita.stato === 'pronto' ? differita.esito.percorsoMinimo : 'in_calcolo',
      dataRiferimento: lavoro.dataRiferimento,
      contesto: CONTESTO,
      richiedeChiarimenti,
    }),
    [esito, differita, lavoro.lottoId, lavoro.dataRiferimento],
  );

  return (
    <main className={styles.pagina}>
      <header className={styles.testata}>
        <h1 className={styles.titolo}>Valutazione ammissibilità del raggruppamento</h1>
        <p className={styles.gara}>
          <span className={styles.oggetto}>{bando.oggetto}</span>
          <span className={styles.dato}>{bando.stazioneAppaltante}</span>
          <span className={styles.dato}>Offerte entro il {formattaData(bando.terminePresentazione)}</span>
          <label className={styles.data}>
            <span>Data di riferimento</span>
            <input type="date" value={lavoro.dataRiferimento} onChange={(e) => dispatch({ tipo: 'imposta_data', valore: e.target.value })} className={styles.inputData} />
          </label>
        </p>
        <p className={styles.dichiarazione}>{DICHIARAZIONE_DATI}</p>
      </header>

      <BarraLotti
        bando={bando}
        lottoId={lavoro.lottoId}
        differita={differita}
        onSeleziona={(lottoId) => {
          dispatch({ tipo: 'seleziona_lotto', lottoId });
          setVista('lotto');
        }}
        onConfronta={() => setVista('confronto')}
      />

      {vista === 'confronto' ? (
        <section className={styles.confronto} aria-labelledby="titolo-confronto-lotti">
          <div className={styles.testataConfronto}>
            <h2 id="titolo-confronto-lotti">Dove conviene presentarsi</h2>
            <button type="button" className={styles.torna} onClick={() => setVista('lotto')}>Torna al lotto</button>
          </div>
          <ConfrontoLotti
            bando={bando}
            lottoId={lavoro.lottoId}
            differita={differita}
            onSeleziona={(lottoId) => {
              dispatch({ tipo: 'seleziona_lotto', lottoId });
              setVista('lotto');
            }}
          />
        </section>
      ) : (
        <>
          <BloccoVerdetto verdetto={esito.verdetto} frase={frase} dispatch={dispatch} />

          <details className={styles.datiBando}>
            <summary>Dati del bando e del lotto</summary>
            <IntestazioneBando bando={bando} lotto={lotto} />
          </details>

          <div className={styles.corpo}>
            <div className={styles.principale}>
              {lotto ? (
                <TabellaEsito
                  lotto={lotto}
                  requisiti={esito.requisiti}
                  rimediPerRequisito={rimediPerRequisito}
                  membri={lavoro.raggruppamento.membri}
                  legenda={legenda}
                  contesto={CONTESTO}
                  dispatch={dispatch}
                />
              ) : null}
            </div>
            <aside className={styles.laterale}>
              <Composizione lotto={lotto} raggruppamento={lavoro.raggruppamento} soggetti={soggetti} contesto={CONTESTO} dispatch={dispatch} />
              <Storia storia={lavoro.storia} onAnnulla={() => dispatch({ tipo: 'annulla' })} />
              <ConfrontoProva differita={differita} haProve={precedente !== undefined} />
            </aside>
          </div>

          <div className={styles.note}>
            <Avvisi avvisi={esito.avvisiScadenza} terminePresentazione={bando.terminePresentazione} orizzonteGiorni={ORIZZONTE_SCADENZE_GIORNI} contesto={CONTESTO} />
            <Anomalie anomalie={esito.anomalie} contesto={CONTESTO} />
            <Assunzioni legenda={legenda} />
            <NonValutato />
          </div>
        </>
      )}
    </main>
  );
}
