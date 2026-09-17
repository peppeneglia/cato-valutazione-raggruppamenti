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
// che documenta dietro un'interazione. Una colonna sola, card a tutta
// larghezza: il verdetto, i dati della gara, la composizione da manipolare,
// l'esito per requisito, i quesiti, le note.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Azione, Ingresso, Lavoro, Sessione } from './lavoro';
import { composizionePrimaDellUltimaProva, riduci, sessioneAllIngresso } from './lavoro';
import type { Bando, ParametriValutazione, Soggetto } from './domain';
import { valutaBase } from './engine';
import { trovaLotto } from './engine/indici';
import { formattaData, oggiISO } from './formato';
import { dichiarazioneDati, fraseDataRiferimento, fraseVerdetto, perimetroDocumenti } from './descrizioni';
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
import { Intestazione, PiePagina } from './ui/Cornice';
import { IntestazioneBando } from './ui/IntestazioneBando';
import { legendaAssunzioni } from './ui/legenda';
import { NoteMotore } from './ui/NoteMotore';
import { QuesitiAperti } from './ui/QuesitiAperti';
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
const INDIRIZZO_FORMATO = '?vista=formato';

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
function useSchermata(): { schermata: Schermata; apri: (s: Exclude<Schermata, 'scelta'>) => void; torna: () => void; riallinea: () => void } {
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
  /** La scelta al posto del passo corrente, senza toccare la cronologia: il passo non era della pagina, o non vale più. */
  const riallinea = useCallback(() => {
    window.history.replaceState(null, '', window.location.pathname);
    setSchermata('scelta');
  }, []);
  const torna = useCallback(() => {
    // Se il passo l'ha aggiunto la pagina, Indietro è la cosa giusta; se si è arrivati da un link, si torna alla scelta sul posto.
    if (statoDi(window.history.state)) window.history.back();
    else riallinea();
  }, [riallinea]);
  return { schermata, apri, torna, riallinea };
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
  const { schermata, apri, torna, riallinea } = useSchermata();
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
  const pronta = useMemo(() => sceltaPronta(scelta, bandi, imprese), [scelta, bandi, imprese]);

  // L'esito senza una scelta pronta — Avanti del browser dopo un ricaricamento — non ha niente da mostrare: il passo torna a essere la scelta.
  useEffect(() => {
    if (schermata === 'esito' && !pronta) riallinea();
  }, [schermata, pronta, riallinea]);

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

  const perimetro = perimetroDocumenti(
    (raccolta?.bandi ?? []).flatMap((b) => (b.stato === 'valido' ? [b.documento.provenienza] : [])),
    (raccolta?.fascicoli ?? []).flatMap((f) => (f.stato === 'valido' ? [f.documento.provenienza] : [])),
  );
  /** Il marchio porta alla home: dall'esito e dal formato torna alla scelta, sulla scelta riparte dall'alto. */
  const home = () => {
    if (schermata !== 'scelta') torna();
    else window.scrollTo(0, 0);
  };
  /** Ogni schermata sta nella stessa cornice. */
  const conCornice = (contenuto: ReactNode) => (
    <div className={styles.app}>
      <Intestazione onHome={home} />
      {contenuto}
      <PiePagina dati={raccolta ? perimetro : 'Caricamento dei documenti…'} onHome={home} />
    </div>
  );

  if (!raccolta) {
    return conCornice(
      <main className={styles.pagina}>
        <p role="status">Caricamento dei documenti…</p>
      </main>,
    );
  }

  const esempioBando = raccolta.bandi.find((b) => b.stato === 'valido');
  const esempioFascicoli = raccolta.fascicoli.find((f) => f.stato === 'valido');

  if (schermata === 'formato') {
    return conCornice(
      <SchermataFormato
        esempioBando={esempioBando?.stato === 'valido' ? { url: `${BASE_DOCUMENTI}${esempioBando.file}`, documento: esempioBando.documento.provenienza.documento } : undefined}
        esempioFascicoli={esempioFascicoli?.stato === 'valido' ? { url: `${BASE_DOCUMENTI}${esempioFascicoli.file}`, documento: esempioFascicoli.documento.provenienza.documento } : undefined}
        scarica={scarica}
        onTorna={torna}
      />,
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
    return conCornice(
      <Valutazione
        bando={bando}
        soggetti={soggetti}
        provenienze={{ bando: provenienza, fascicoli: provenienzeFascicoli }}
        lavoro={sessione.lavoro}
        onAzione={suAzione}
        onTorna={torna}
        fraseData={sessione.lavoro.dataRiferimento === sessione.dataIniziale ? fraseDataRiferimento(sessione.dataIniziale, proposta) : undefined}
      />,
    );
  }
  // Nell'esito ma la sessione non è ancora allineata (ci pensa l'effetto sopra), o la scelta non è pronta (si torna alla scelta): niente da disegnare.
  if (schermata === 'esito') return conCornice(null);

  return conCornice(
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
    />,
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
  /** Indietro, alla scelta: il lavoro resta. */
  onTorna: () => void;
  /** Da dove viene la data di riferimento, finché è quella di partenza. */
  fraseData: string | undefined;
};

function Valutazione({ bando, soggetti, provenienze, lavoro, onAzione: dispatch, onTorna, fraseData }: PropsValutazione) {
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
  const conteggi = useMemo(() => {
    const n = { coperto: 0, scoperto: 0, da_verificare: 0 };
    for (const r of esito.requisiti) n[r.stato] += 1;
    return n;
  }, [esito]);
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
      <div className={styles.testata}>
        <p>
          <button type="button" className={styles.torna} onClick={onTorna}>← Torna alla scelta</button>
        </p>
        <p className="occhiello">{bando.stazioneAppaltante} · Gara in valutazione</p>
        <h1 className={styles.oggetto}>{bando.oggetto}</h1>
        <div className={styles.fatti}>
          <p className={styles.fatto}>
            <span className="occhiello">Offerte entro</span>
            <span className={styles.valoreFatto}>{formattaData(bando.terminePresentazione)}</span>
          </p>
          <label className={styles.fatto}>
            <span className="occhiello">Data di riferimento</span>
            <input type="date" value={lavoro.dataRiferimento} onChange={(e) => dispatch({ tipo: 'imposta_data', valore: e.target.value })} className={styles.inputData} />
          </label>
        </div>
        {fraseData ? <p className={styles.dichiarazione}>{fraseData}</p> : null}
        <p className={styles.dichiarazione}>{dichiarazioneDati(provenienze.bando, provenienze.fascicoli)}</p>
      </div>

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
          <BloccoVerdetto verdetto={esito.verdetto} frase={frase} conteggi={conteggi} dispatch={dispatch} />

          <IntestazioneBando bando={bando} lotto={lotto} />

          <div className={styles.composizione}>
            <Composizione lotto={lotto} raggruppamento={lavoro.raggruppamento} soggetti={soggetti} contesto={contesto} dispatch={dispatch} />
            <div className={styles.registro}>
              <Storia storia={lavoro.storia} onAnnulla={() => dispatch({ tipo: 'annulla' })} />
              <ConfrontoProva differita={differita} haProve={precedente !== undefined} />
            </div>
          </div>

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
          {lotto ? <QuesitiAperti lotto={lotto} rimediPerRequisito={rimediPerRequisito} /> : null}

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
