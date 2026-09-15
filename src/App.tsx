// Tre schermate, nessun router: la scelta di cosa valutare, l'esito, e il
// formato dei documenti. I passaggi entrano nella cronologia del browser,
// così Indietro torna dove ci si aspetta, senza ricaricare niente. Il formato
// ha anche un indirizzo suo, perché si possa aprire in un'altra scheda.
//
// I documenti arrivano dallo stesso server che serve la pagina, oppure dal
// disco di chi la usa; finché non ci sono, non c'è niente da scegliere.
//
// Il foglio di lavoro sta qui e non nell'esito: tornare alla scelta per
// aggiungere un'impresa non deve buttare le quote appena sistemate. Si
// riparte da capo solo se cambia la gara.
//
// Nell'esito tutto il resto è derivato dal motore: il canale sincrono
// (requisiti, anomalie, avvisi, verdetto) risponde a ogni modifica, quello
// differito (rimedi, percorso, confronti) dopo che la modifica si è assestata.
//
// L'esito risponde a una domanda: sono dentro su questo lotto, e se no cosa
// mi manca. Ciò che risponde sta in alto e grande; ciò che motiva sotto; ciò
// che documenta dietro un'interazione.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Azione, Ingresso, Lavoro, Sessione } from './lavoro';
import { composizionePrimaDellUltimaProva, riduci, sessioneAllIngresso } from './lavoro';
import type { Bando, ParametriValutazione, Soggetto } from './domain';
import { valutaBase } from './engine';
import { trovaLotto } from './engine/indici';
import { formattaData, oggiISO } from './formato';
import { dichiarazioneDati, fraseDataRiferimento, fraseVerdetto } from './descrizioni';
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
import { SchermataFormato } from './ui/SchermataFormato';
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

// ─── Schermate e cronologia ──────────────────────────────────

type Schermata = 'scelta' | 'esito' | 'formato';

/** L'indirizzo del formato: si apre anche in un'altra scheda, e sopravvive a un ricaricamento. */
export const INDIRIZZO_FORMATO = '?vista=formato';

type StatoCronologia = { schermata: Schermata; dallaPagina: true };

function statoDi(stato: unknown): StatoCronologia | undefined {
  const s = stato as Partial<StatoCronologia> | null;
  return s?.dallaPagina ? (s as StatoCronologia) : undefined;
}

function schermataDallIndirizzo(): Schermata {
  return new URLSearchParams(window.location.search).get('vista') === 'formato' ? 'formato' : 'scelta';
}

/**
 * La schermata corrente, legata alla cronologia: aprirne una aggiunge un
 * passo, Indietro lo toglie. L'esito non ha indirizzo: un ricaricamento
 * riparte dalla scelta, perché la scelta non sopravvive al ricaricamento.
 */
function useSchermata(): { schermata: Schermata; apri: (s: Exclude<Schermata, 'scelta'>) => void; torna: () => void } {
  const [schermata, setSchermata] = useState<Schermata>(schermataDallIndirizzo);
  useEffect(() => {
    if (statoDi(window.history.state)?.schermata === 'esito') window.history.replaceState(null, '', window.location.pathname);
    const suPopState = (e: PopStateEvent) => setSchermata(statoDi(e.state)?.schermata ?? schermataDallIndirizzo());
    window.addEventListener('popstate', suPopState);
    return () => window.removeEventListener('popstate', suPopState);
  }, []);
  const apri = useCallback((s: Exclude<Schermata, 'scelta'>) => {
    const stato: StatoCronologia = { schermata: s, dallaPagina: true };
    window.history.pushState(stato, '', s === 'formato' ? INDIRIZZO_FORMATO : window.location.pathname);
    setSchermata(s);
  }, []);
  const torna = useCallback(() => {
    // Se il passo l'ha aggiunto la pagina, Indietro è la cosa giusta; se si è arrivati da un link, si torna alla scelta sul posto.
    if (statoDi(window.history.state)) {
      window.history.back();
    } else {
      window.history.replaceState(null, '', window.location.pathname);
      setSchermata('scelta');
    }
  }, []);
  return { schermata, apri, torna };
}

function leggiTesto(file: File): Promise<string> {
  return new Promise((risolvi, rifiuta) => {
    const lettore = new FileReader();
    lettore.onload = () => risolvi(String(lettore.result));
    lettore.onerror = () => rifiuta(lettore.error);
    lettore.readAsText(file);
  });
}

function ingressoDi(pronta: SceltaPronta): Ingresso {
  return { bando: pronta.bando.chiave, imprese: pronta.imprese, mandataria: pronta.mandataria };
}

function stessoIngresso(a: Ingresso, b: Ingresso): boolean {
  return a.bando === b.bando && a.mandataria === b.mandataria && a.imprese.length === b.imprese.length && a.imprese.every((x) => b.imprese.includes(x));
}

// ─── Pagina ──────────────────────────────────────────────────

export default function App() {
  const raccolta = useRaccolta();
  const [daDisco, setDaDisco] = useState<{ bandi: VoceBando[]; fascicoli: VoceFascicoli[] }>({ bandi: [], fascicoli: [] });
  const [ultimoCaricamento, setUltimoCaricamento] = useState<EsitoCaricamento>();
  const [scelta, setScelta] = useState<Scelta>(SCELTA_VUOTA);
  const [sessione, setSessione] = useState<Sessione & { dataIniziale: string }>();
  const { schermata, apri, torna } = useSchermata();
  const contatore = useRef(0);

  // Cambiare schermata riparte dall'alto: la nuova schermata non eredita lo scorrimento della vecchia.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [schermata]);

  const bandi = useMemo<VoceBando[]>(
    () => [
      ...(raccolta?.bandi ?? []).map((b): VoceBando => ({
        chiave: `server:${b.file}`,
        origine: 'server',
        caricato: b,
        dataRiferimentoProposta: b.dataRiferimentoProposta,
        motivoDataProposta: b.motivoDataProposta,
      })),
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
  const pronta = sceltaPronta(scelta, bandi, imprese);

  // Entrando nell'esito — dal bottone o con Avanti del browser — la sessione si allinea alla scelta prima di disegnare.
  useLayoutEffect(() => {
    if (schermata !== 'esito' || !pronta) return;
    const ingresso = ingressoDi(pronta);
    if (sessione && stessoIngresso(sessione.ingresso, ingresso)) return;
    const bando = pronta.bando.caricato.documento.bando;
    const cambiaGara = !sessione || sessione.ingresso.bando !== ingresso.bando;
    const dataIniziale = cambiaGara ? (pronta.bando.dataRiferimentoProposta ?? oggiISO()) : sessione.dataIniziale;
    const prossima = sessioneAllIngresso(sessione, ingresso, { bando, contesto: { bando, soggetti }, dataRiferimento: dataIniziale });
    setSessione({ ...prossima, dataIniziale });
  }, [schermata, pronta, sessione, soggetti]);

  const suAzione = useCallback(
    (azione: Azione) => setSessione((s) => {
      const bando = bandi.find((b) => b.chiave === s?.ingresso.bando)?.caricato;
      if (!s || bando?.stato !== 'valido') return s;
      return { ...s, lavoro: riduci(s.lavoro, azione, { bando: bando.documento.bando, soggetti }) };
    }),
    [bandi, soggetti],
  );

  if (!raccolta) {
    return (
      <main className={styles.pagina}>
        <p role="status">Caricamento dei documenti…</p>
      </main>
    );
  }

  const esempioBando = raccolta.bandi.find((b) => b.stato === 'valido');
  const esempioFascicoli = raccolta.fascicoli.find((f) => f.stato === 'valido');

  if (schermata === 'formato') {
    return (
      <SchermataFormato
        esempioBando={esempioBando?.stato === 'valido' ? { url: `${BASE_DOCUMENTI}${esempioBando.file}`, documento: esempioBando.documento.provenienza.documento } : undefined}
        esempioFascicoli={esempioFascicoli?.stato === 'valido' ? { url: `${BASE_DOCUMENTI}${esempioFascicoli.file}`, documento: esempioFascicoli.documento.provenienza.documento } : undefined}
        scarica={scarica}
        onTorna={torna}
      />
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

  if (schermata === 'esito' && pronta && sessione && stessoIngresso(sessione.ingresso, ingressoDi(pronta))) {
    const { bando, provenienza } = pronta.bando.caricato.documento;
    const provenienzeFascicoli = fascicoli.flatMap((f) => (f.caricato.stato === 'valido' ? [f.caricato.documento.provenienza] : []));
    const proposta = pronta.bando.dataRiferimentoProposta !== undefined ? { motivo: pronta.bando.motivoDataProposta } : undefined;
    return (
      <Valutazione
        bando={bando}
        soggetti={soggetti}
        provenienze={{ bando: provenienza, fascicoli: provenienzeFascicoli }}
        lavoro={sessione.lavoro}
        onAzione={suAzione}
        fraseData={sessione.lavoro.dataRiferimento === sessione.dataIniziale ? fraseDataRiferimento(sessione.dataIniziale, proposta) : undefined}
        onCambiaGara={torna}
      />
    );
  }
  if (schermata === 'esito' && pronta) return null;

  return (
    <SchermataScelta
      bandi={bandi}
      fascicoli={fascicoli}
      altri={[raccolta.indice]}
      scelta={scelta}
      onScelta={setScelta}
      ultimoCaricamento={ultimoCaricamento}
      onFile={(file) => void suFile(file)}
      indirizzoFormato={INDIRIZZO_FORMATO}
      onFormato={() => apri('formato')}
      oggi={oggiISO()}
      onValuta={() => apri('esito')}
    />
  );
}

/** "Dove conviene presentarsi" è una domanda diversa da "sono dentro": ha la sua schermata. */
type Vista = 'lotto' | 'confronto';

type PropsValutazione = {
  bando: Bando;
  soggetti: Soggetto[];
  provenienze: { bando: Provenienza; fascicoli: Provenienza[] };
  lavoro: Lavoro;
  onAzione: (azione: Azione) => void;
  /** Da dove viene la data di riferimento, finché è quella di partenza. */
  fraseData: string | undefined;
  onCambiaGara: () => void;
};

function Valutazione({ bando, soggetti, provenienze, lavoro, onAzione: dispatch, fraseData, onCambiaGara }: PropsValutazione) {
  const contesto = useMemo(() => ({ bando, soggetti }), [bando, soggetti]);
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
        {fraseData ? <p className={styles.dichiarazione}>{fraseData}</p> : null}
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
