// Due schermate, nessun router. La prima chiede cosa valutare; la seconda
// è l'esito. Il passaggio entra nella cronologia del browser, così Indietro
// torna alla scelta come ci si aspetta, senza ricaricare niente.
//
// I documenti arrivano dallo stesso server che serve la pagina, oppure dal
// disco di chi la usa; finché non ci sono, non c'è niente da scegliere.
//
// Nell'esito lo stato mutabile è il foglio di lavoro; tutto il resto è
// derivato dal motore: il canale sincrono (requisiti, anomalie, avvisi,
// verdetto) risponde a ogni modifica, quello differito (rimedi, percorso,
// confronti) dopo che la modifica si è assestata.
//
// L'esito risponde a una domanda: sono dentro su questo lotto, e se no cosa
// mi manca. Ciò che risponde sta in alto e grande; ciò che motiva sotto; ciò
// che documenta dietro un'interazione.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Azione, Lavoro } from './lavoro';
import { composizionePrimaDellUltimaProva, raggruppamentoInPartiUguali, riduci } from './lavoro';
import type { Bando, ParametriValutazione, Raggruppamento, Soggetto } from './domain';
import { valutaBase } from './engine';
import { trovaLotto } from './engine/indici';
import { formattaData, oggiISO } from './formato';
import { dichiarazioneDati, fraseVerdetto } from './descrizioni';
import { richiedeChiarimenti } from './engine/rimedi';
import { caricaRaccolta, leggiDocumento, type Raccolta, type Scarica } from './documenti/carica';
import type { Provenienza } from './documenti/formato';
import { ORIZZONTE_SCADENZE_GIORNI } from './parametri';
import {
  controllaConflitti,
  impreseDisponibili,
  SCELTA_VUOTA,
  sceltaPronta,
  type EsitoCaricamento,
  type Scelta,
  type SceltaPronta,
  type VoceBando,
  type VoceFascicoli,
} from './scelta';
import { BarraLotti } from './ui/BarraLotti';
import { BloccoVerdetto } from './ui/BloccoVerdetto';
import { Composizione } from './ui/Composizione';
import { ConfrontoLotti } from './ui/ConfrontoLotti';
import { ConfrontoProva } from './ui/ConfrontoProva';
import { IntestazioneBando } from './ui/IntestazioneBando';
import { legendaAssunzioni } from './ui/legenda';
import { NoteMotore } from './ui/NoteMotore';
import { SchermataScelta } from './ui/SchermataScelta';
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

type Schermata = 'scelta' | 'esito';

function schermataDi(stato: unknown): Schermata | undefined {
  return (stato as { schermata?: Schermata } | null)?.schermata;
}

/**
 * La schermata corrente, legata alla cronologia: entrare nell'esito aggiunge
 * un passo, Indietro lo toglie. Un ricaricamento riparte dalla scelta, perché
 * la scelta non sopravvive al ricaricamento.
 */
function useSchermata(): { schermata: Schermata; entra: () => void; esci: () => void } {
  const [schermata, setSchermata] = useState<Schermata>('scelta');
  useEffect(() => {
    if (schermataDi(window.history.state)) window.history.replaceState(null, '');
    const suPopState = (e: PopStateEvent) => setSchermata(schermataDi(e.state) === 'esito' ? 'esito' : 'scelta');
    window.addEventListener('popstate', suPopState);
    return () => window.removeEventListener('popstate', suPopState);
  }, []);
  const entra = useCallback(() => {
    window.history.pushState({ schermata: 'esito' }, '');
    setSchermata('esito');
  }, []);
  const esci = useCallback(() => {
    if (schermataDi(window.history.state) === 'esito') window.history.back();
    else setSchermata('scelta');
  }, []);
  return { schermata, entra, esci };
}

function leggiTesto(file: File): Promise<string> {
  return new Promise((risolvi, rifiuta) => {
    const lettore = new FileReader();
    lettore.onload = () => risolvi(String(lettore.result));
    lettore.onerror = () => rifiuta(lettore.error);
    lettore.readAsText(file);
  });
}

export default function App() {
  const raccolta = useRaccolta();
  const [daDisco, setDaDisco] = useState<{ bandi: VoceBando[]; fascicoli: VoceFascicoli[] }>({ bandi: [], fascicoli: [] });
  const [ultimoCaricamento, setUltimoCaricamento] = useState<EsitoCaricamento>();
  const [scelta, setScelta] = useState<Scelta>(SCELTA_VUOTA);
  const { schermata, entra, esci } = useSchermata();
  const contatore = useRef(0);

  // Cambiare schermata riparte dall'alto: la nuova schermata non eredita lo scorrimento della vecchia.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [schermata]);

  const bandi = useMemo<VoceBando[]>(
    () => [
      ...(raccolta?.bandi ?? []).map((b): VoceBando => ({ chiave: `server:${b.file}`, origine: 'server', caricato: b, dataRiferimentoProposta: b.dataRiferimentoProposta })),
      ...daDisco.bandi,
    ],
    [raccolta, daDisco.bandi],
  );
  const fascicoli = useMemo<VoceFascicoli[]>(
    () => [...(raccolta?.fascicoli ?? []).map((f): VoceFascicoli => ({ chiave: `server:${f.file}`, origine: 'server', caricato: f })), ...daDisco.fascicoli],
    [raccolta, daDisco.fascicoli],
  );
  const imprese = useMemo(() => impreseDisponibili(fascicoli), [fascicoli]);
  const soggetti = useMemo(() => imprese.map((i) => i.soggetto), [imprese]);

  if (!raccolta) {
    return (
      <main className={styles.pagina}>
        <p role="status">Caricamento dei documenti…</p>
      </main>
    );
  }

  const suFile = async (file: File) => {
    let testo: string;
    try {
      testo = await leggiTesto(file);
    } catch {
      setUltimoCaricamento({ tipo: 'errori', caricato: { file: file.name, stato: 'non_valido', errori: [{ tipo: 'lettura', motivo: 'il browser non è riuscito a leggere il file' }] } });
      return;
    }
    const letto = leggiDocumento(file.name, testo);
    contatore.current += 1;
    const chiave = `disco:${contatore.current}:${file.name}`;
    if (letto.genere === 'bando' && letto.caricato.stato === 'valido') {
      const voce: VoceBando = { chiave, origine: 'disco', caricato: letto.caricato };
      setDaDisco((d) => ({ ...d, bandi: [...d.bandi, voce] }));
      setScelta((s) => ({ ...s, bando: chiave }));
      setUltimoCaricamento({ tipo: 'bando', file: file.name, oggetto: letto.caricato.documento.bando.oggetto });
      return;
    }
    if (letto.genere === 'fascicoli') {
      const controllato = controllaConflitti(letto.caricato, imprese);
      if (controllato.stato === 'valido') {
        setDaDisco((d) => ({ ...d, fascicoli: [...d.fascicoli, { chiave, origine: 'disco', caricato: controllato }] }));
        setUltimoCaricamento({ tipo: 'fascicoli', file: file.name, imprese: controllato.documento.soggetti.length });
        return;
      }
      setUltimoCaricamento({ tipo: 'errori', caricato: controllato });
      return;
    }
    if (letto.caricato.stato === 'non_valido') setUltimoCaricamento({ tipo: 'errori', caricato: letto.caricato });
  };

  const pronta = sceltaPronta(scelta, bandi, imprese);
  const esempio = raccolta.bandi.find((b) => b.stato === 'valido');

  if (schermata === 'esito' && pronta) {
    return <Esito pronta={pronta} fascicoli={fascicoli} soggetti={soggetti} onCambiaGara={esci} />;
  }

  return (
    <SchermataScelta
      bandi={bandi}
      fascicoli={fascicoli}
      altri={[raccolta.indice]}
      scelta={scelta}
      onScelta={setScelta}
      ultimoCaricamento={ultimoCaricamento}
      onFile={(file) => void suFile(file)}
      esempioFormato={esempio ? `${BASE_DOCUMENTI}${esempio.file}` : undefined}
      onValuta={entra}
    />
  );
}

/** Dalla scelta all'esito: la composizione di partenza e i dati che la pagina dichiara. */
function Esito({ pronta, fascicoli, soggetti, onCambiaGara }: { pronta: SceltaPronta; fascicoli: VoceFascicoli[]; soggetti: Soggetto[]; onCambiaGara: () => void }) {
  const { bando, provenienza } = pronta.bando.caricato.documento;
  const provenienzeFascicoli = fascicoli.flatMap((f) => (f.caricato.stato === 'valido' ? [f.caricato.documento.provenienza] : []));
  const raggruppamento = raggruppamentoInPartiUguali(bando, pronta.imprese, pronta.mandataria);
  return (
    <Valutazione
      bando={bando}
      soggetti={soggetti}
      provenienze={{ bando: provenienza, fascicoli: provenienzeFascicoli }}
      dataRiferimento={pronta.bando.dataRiferimentoProposta ?? oggiISO()}
      raggruppamento={raggruppamento}
      onCambiaGara={onCambiaGara}
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
  onCambiaGara: () => void;
};

function Valutazione({ bando, soggetti, provenienze, dataRiferimento, raggruppamento, onCambiaGara }: PropsValutazione) {
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
        <div className={styles.rigaTitolo}>
          <h1 className={styles.titolo}>Valutazione ammissibilità del raggruppamento</h1>
          <button type="button" className={styles.cambiaGara} onClick={onCambiaGara}>Cambia gara</button>
        </div>
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
