// Una pagina, nessun routing. I documenti arrivano dallo stesso server che
// serve la pagina; finché non ci sono, non c'è niente da valutare.
//
// Lo stato mutabile è il foglio di lavoro; tutto il resto è derivato dal
// motore: il canale sincrono (requisiti, anomalie, avvisi, verdetto) risponde
// a ogni modifica, quello differito (rimedi, percorso, confronti) dopo che la
// modifica si è assestata.
//
// La schermata risponde a una domanda: sono dentro su questo lotto, e se
// no cosa mi manca. Ciò che risponde sta in alto e grande; ciò che motiva
// sotto; ciò che documenta dietro un'interazione.

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import type { Azione, Lavoro } from './lavoro';
import { composizionePrimaDellUltimaProva, raggruppamentoInPartiUguali, riduci } from './lavoro';
import type { Bando, ParametriValutazione, Raggruppamento, Soggetto } from './domain';
import { valutaBase } from './engine';
import { trovaLotto } from './engine/indici';
import { formattaData } from './formato';
import { dichiarazioneDati, fraseVerdetto } from './descrizioni';
import { richiedeChiarimenti } from './engine/rimedi';
import { caricaRaccolta, soggettiDi, type Raccolta, type Scarica } from './documenti/carica';
import type { Provenienza } from './documenti/formato';
import { ORIZZONTE_SCADENZE_GIORNI } from './parametri';
import { BarraLotti } from './ui/BarraLotti';
import { BloccoVerdetto } from './ui/BloccoVerdetto';
import { Composizione } from './ui/Composizione';
import { ConfrontoLotti } from './ui/ConfrontoLotti';
import { ConfrontoProva } from './ui/ConfrontoProva';
import { ErroriDocumenti } from './ui/ErroriDocumenti';
import { IntestazioneBando } from './ui/IntestazioneBando';
import { legendaAssunzioni } from './ui/legenda';
import { NoteMotore } from './ui/NoteMotore';
import { Storia } from './ui/Storia';
import { TabellaEsito } from './ui/TabellaEsito';
import { useValutazioneDifferita } from './ui/useValutazioneDifferita';
import styles from './App.module.css';

const BASE_DOCUMENTI = `${import.meta.env.BASE_URL}documenti/`;

const scarica: Scarica = (url) => fetch(url);

function useRaccolta(): Raccolta | undefined {
  const [raccolta, setRaccolta] = useState<Raccolta>();
  useEffect(() => {
    let attivo = true;
    void caricaRaccolta(scarica, BASE_DOCUMENTI).then((r) => {
      if (attivo) setRaccolta(r);
    });
    return () => {
      attivo = false;
    };
  }, []);
  return raccolta;
}

/**
 * PROVVISORIO: finché non c'è la schermata iniziale, la pagina apre il primo
 * bando valido con le prime tre imprese, in parti uguali. Sparisce con la
 * schermata in cui l'utente sceglie gara e imprese.
 */
const IMPRESE_PROVVISORIE = 3;

export default function App() {
  const raccolta = useRaccolta();

  if (!raccolta) {
    return (
      <main className={styles.pagina}>
        <p role="status">Caricamento dei documenti…</p>
      </main>
    );
  }

  const primo = raccolta.bandi.find((b) => b.stato === 'valido');
  const fascicoliValidi = raccolta.fascicoli.filter((f) => f.stato === 'valido');
  const soggetti = soggettiDi(raccolta.fascicoli);
  const nonValidi = [raccolta.indice, ...raccolta.bandi, ...raccolta.fascicoli].filter((d) => d.stato === 'non_valido');

  if (!primo || primo.stato !== 'valido' || soggetti.length < IMPRESE_PROVVISORIE) {
    return (
      <main className={styles.pagina}>
        <ErroriDocumenti documenti={nonValidi} />
      </main>
    );
  }

  const imprese = soggetti.slice(0, IMPRESE_PROVVISORIE).map((s) => s.id);
  return (
    <Valutazione
      bando={primo.documento.bando}
      soggetti={soggetti}
      provenienze={{ bando: primo.documento.provenienza, fascicoli: fascicoliValidi.map((f) => f.stato === 'valido' ? f.documento.provenienza : null).filter((p): p is Provenienza => p !== null) }}
      dataRiferimento={primo.dataRiferimentoProposta ?? ''}
      raggruppamento={raggruppamentoInPartiUguali(primo.documento.bando, imprese, imprese[0]!)}
    />
  );
}

/** "Dove conviene presentarsi" è una domanda diversa da "sono dentro": ha la sua schermata. */
type Vista = 'lotto' | 'confronto';

type PropsValutazione = {
  bando: Bando;
  soggetti: Soggetto[];
  provenienze: { bando: Provenienza; fascicoli: Provenienza[] };
  dataRiferimento: string;
  raggruppamento: Raggruppamento;
};

function Valutazione({ bando, soggetti, provenienze, dataRiferimento, raggruppamento }: PropsValutazione) {
  const contesto = useMemo(() => ({ bando, soggetti }), [bando, soggetti]);
  const riduttore = useCallback((lavoro: Lavoro, azione: Azione) => riduci(lavoro, azione, contesto), [contesto]);
  const [lavoro, dispatch] = useReducer(riduttore, undefined, (): Lavoro => ({
    lottoId: bando.lotti[0]?.id ?? '',
    dataRiferimento,
    raggruppamento,
    storia: [],
  }));
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
    [bando, soggetti, lavoro.lottoId, lavoro.raggruppamento, lavoro.dataRiferimento],
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
      contesto,
      dataRiferimento: lavoro.dataRiferimento,
      richiedeChiarimenti,
    }),
    [bando, contesto, esito, differita, lavoro.lottoId, lavoro.dataRiferimento],
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
        <p className={styles.dichiarazione}>{dichiarazioneDati(provenienze.bando, provenienze.fascicoli)}</p>
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
                  contesto={contesto}
                  dispatch={dispatch}
                />
              ) : null}
            </div>
            <aside className={styles.laterale}>
              <Composizione lotto={lotto} raggruppamento={lavoro.raggruppamento} soggetti={soggetti} contesto={contesto} dispatch={dispatch} />
              <Storia storia={lavoro.storia} onAnnulla={() => dispatch({ tipo: 'annulla' })} />
              <ConfrontoProva differita={differita} haProve={precedente !== undefined} />
            </aside>
          </div>

          <NoteMotore
            avvisi={esito.avvisiScadenza}
            anomalie={esito.anomalie}
            legenda={legenda}
            terminePresentazione={bando.terminePresentazione}
            orizzonteGiorni={ORIZZONTE_SCADENZE_GIORNI}
            contesto={contesto}
          />
        </>
      )}
    </main>
  );
}
