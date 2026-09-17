// L'esito per requisito: una mini card per requisito, quattro cose in riga —
// i dettagli, nome breve con una frase che dice perché, quanto manca, stato
// — e tutto il resto nella card dei dettagli: descrizione integrale con la
// fonte, contributi per membro, motivazione, letture, assunzioni, rimedi. I
// requisiti coperti sono a un filtro di distanza: chi guarda cerca i problemi.

import { useRef, useState } from 'react';
import {
  azioneRichiesta,
  descriviIndeterminatezza,
  etichettaFamiglia,
  etichettaStato,
  nomeSoggetto,
  quantoManca,
  ragioneBreve,
  type ContestoDescrizioni,
} from '../descrizioni';
import { richiedeChiarimenti } from '../engine/rimedi';
import type { EsitoRequisito, Lotto, Membro, Requisito, Rimedio } from '../domain';
import { formattaConUnita } from '../formato';
import type { Azione } from '../lavoro';
import { RiferimentiAssunzioni } from './Assunzioni';
import type { Legenda } from './legenda';
import { CellaContributo } from './CellaContributo';
import { Fonte } from './Fonte';
import { Rimedi } from './Rimedi';
import { StatoRequisito } from './StatoRequisito';
import styles from './TabellaEsito.module.css';

type Props = {
  lotto: Lotto;
  requisiti: EsitoRequisito[];
  /** I rimedi arrivano dal canale differito: finché calcola, lo si dice. */
  rimediPerRequisito: Map<string, Rimedio[]> | 'in_calcolo';
  membri: Membro[];
  legenda: Legenda;
  contesto: ContestoDescrizioni;
  dispatch: (azione: Azione) => void;
};

type RigaProps = {
  requisito: Requisito;
  esito: EsitoRequisito | undefined;
  rimedi: Rimedio[] | 'in_calcolo';
  membri: Membro[];
  legenda: Legenda;
  contesto: ContestoDescrizioni;
  dispatch: Props['dispatch'];
  aperta: boolean;
  onApri: () => void;
};

function Espansione({ requisito, esito, rimedi, membri, legenda, contesto, dispatch }: Omit<RigaProps, 'aperta' | 'onApri'> & { esito: EsitoRequisito }) {
  const unita = esito.misurazione?.unita;
  const contributi = new Map(esito.contributi.map((c) => [c.soggettoId, c]));
  const m = esito.misurazione;
  return (
    <div className={styles.espansione}>
      <p className={styles.descrizione}>
        {requisito.descrizione}
        <span className={styles.meta}>
          <Fonte fonte={requisito.fonte} />
          <span>{etichettaFamiglia(requisito.famiglia).toLowerCase()}</span>
          {requisito.vincolante ? null : <span>non vincolante</span>}
          {requisito.avvalibile ? <span>avvalibile</span> : null}
        </span>
      </p>

      {esito.indeterminatezze.length > 0 ? (
        <ul className={styles.indeterminatezze}>
          {esito.indeterminatezze.map((i, k) => (
            <li key={k} className={richiedeChiarimenti(i) ? styles.documento : styles.giudizio}>{descriviIndeterminatezza(i, contesto)}</li>
          ))}
        </ul>
      ) : null}

      {esito.contributi.length > 0 ? (
        <table className={styles.membri}>
          <caption className={styles.didascalia}>Il valore reale del fascicolo di ogni membro; «non conta qui» dice che la regola non lo considera.</caption>
          <tbody>
            {membri.map((membro) => (
              <tr key={membro.soggettoId}>
                <th scope="row" className={styles.membro}>
                  {nomeSoggetto(membro.soggettoId, contesto)}
                  {membro.ruolo === 'ausiliaria' ? <span className={styles.ruoloTenue}>ausiliaria</span> : null}
                </th>
                <td><CellaContributo contributo={contributi.get(membro.soggettoId)} unita={unita} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {m && unita ? (
        <p className={styles.misura}>
          Raggiunto <span className={styles.cifra}>{formattaConUnita(m.raggiunto, unita)}</span> su una soglia di <span className={styles.cifra}>{formattaConUnita(m.soglia, unita)}</span>
          {m.massimo > m.raggiunto ? <>, fino a <span className={styles.cifra}>{formattaConUnita(m.massimo, unita)}</span> contando i fatti da verificare</> : null}.
        </p>
      ) : null}

      <p className={styles.motivazione}>{esito.motivazione}</p>

      {esito.varianti ? (
        <ul className={styles.varianti}>
          {esito.varianti.map((v) => (
            <li key={v.etichetta}>
              <span className={styles.etichettaVariante}>{v.etichetta || 'lettura unica'}</span>: {etichettaStato(v.stato).toLowerCase()}
              {v.misurazione && v.misurazione.delta > 0 ? ` (mancano ${formattaConUnita(v.misurazione.delta, v.misurazione.unita)})` : ''}
            </li>
          ))}
        </ul>
      ) : null}

      {esito.assunzioni.length > 0 ? (
        <p className={styles.assunzioni}>Assunzioni del motore: <RiferimentiAssunzioni codici={esito.assunzioni.map((a) => a.codice)} legenda={legenda} /></p>
      ) : null}

      <Rimedi rimedi={rimedi} contesto={contesto} dispatch={dispatch} />
    </div>
  );
}

function Chiudi() {
  return (
    <svg className={styles.iconaChiudi} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Una mini card per requisito: Dettagli a sinistra, poi il nome con la
 * ragione, quanto manca, e lo stato a destra. Lo stato dice già il colore:
 * l'azione in riga resta nel colore del testo, per non ripeterlo. I dettagli
 * si aprono in una card sotto, che si chiude con la X in alto a destra.
 */
function SchedaRequisito(props: RigaProps) {
  const { requisito, esito, contesto, aperta, onApri } = props;
  const bottone = useRef<HTMLButtonElement>(null);
  if (!esito) {
    return (
      <li className={styles.voce}>
        <div id={`requisito-${requisito.id}`} className={styles.scheda}>
          <p className={styles.requisito}>{requisito.nomeBreve}: non valutato (vedi anomalie).</p>
        </div>
      </li>
    );
  }
  const ragione = ragioneBreve(esito, requisito, contesto);
  const azione = azioneRichiesta(esito, richiedeChiarimenti);
  const manca = quantoManca(esito, contesto);
  const idDettagli = `dettagli-${requisito.id}`;
  const idTitolo = `titolo-dettagli-${requisito.id}`;
  return (
    <li className={styles.voce}>
      <div id={`requisito-${requisito.id}`} className={`${styles.scheda} ${aperta ? styles.schedaAperta : ''}`}>
        <button ref={bottone} type="button" className={styles.dettagli} aria-label={`Dettagli di ${requisito.nomeBreve}`} aria-expanded={aperta} aria-controls={idDettagli} onClick={onApri}>
          Dettagli
        </button>
        <div className={styles.requisito}>
          <h3 className={styles.nome}>{requisito.nomeBreve}</h3>
          {ragione ? (
            <p className={styles.ragione}>
              {ragione}
              {azione ? <span className={styles.azione}> {azione}</span> : null}
            </p>
          ) : null}
        </div>
        {/* Solo lo scoperto ha un colore suo: quanto manca «da verificare» resta nel colore del testo. */}
        {manca ? <p className={`${styles.manca} ${esito.stato === 'scoperto' ? styles.scoperto : ''}`}>{manca}</p> : null}
        <span className={styles.stato}><StatoRequisito stato={esito.stato} /></span>
      </div>
      {aperta ? (
        <div id={idDettagli} className={styles.cardDettagli} aria-labelledby={idTitolo}>
          <div className={styles.testataDettagli}>
            <h4 id={idTitolo} className={styles.titoloDettagli}>
              <span className="occhiello">Dettagli</span>
              <span>{requisito.nomeBreve}</span>
            </h4>
            <button
              type="button"
              className={styles.chiudi}
              aria-label={`Chiudi i dettagli di ${requisito.nomeBreve}`}
              onClick={() => {
                onApri();
                bottone.current?.focus();
              }}
            >
              <Chiudi />
            </button>
          </div>
          <Espansione {...props} esito={esito} />
        </div>
      ) : null}
    </li>
  );
}

const ORDINE = { scoperto: 0, da_verificare: 1, coperto: 2 } as const;

/** Chi guarda cerca i problemi: si parte da quelli, e i coperti sono a un clic. */
type Filtro = 'da_risolvere' | 'coperti' | 'tutti';

const FILTRI: { chiave: Filtro; etichetta: string }[] = [
  { chiave: 'da_risolvere', etichetta: 'Da risolvere' },
  { chiave: 'coperti', etichetta: 'Coperti' },
  { chiave: 'tutti', etichetta: 'Tutti' },
];

export function TabellaEsito({ lotto, requisiti, rimediPerRequisito, membri, legenda, contesto, dispatch }: Props) {
  const [aperte, setAperte] = useState<ReadonlySet<string>>(new Set());
  const [filtro, setFiltro] = useState<Filtro>('da_risolvere');
  const esiti = new Map(requisiti.map((r) => [r.requisitoId, r]));

  if (lotto.requisiti.length === 0) {
    return (
      <section aria-labelledby="titolo-esito" className={styles.sezione}>
        <h2 id="titolo-esito">Esito per requisito</h2>
        <p className={styles.vuoto}>Il lotto non dichiara requisiti di partecipazione: non c'è niente da coprire.</p>
      </section>
    );
  }

  const apri = (id: string) => setAperte((prima) => {
    const dopo = new Set(prima);
    if (dopo.has(id)) dopo.delete(id);
    else dopo.add(id);
    return dopo;
  });

  // Prima i problemi, nell'ordine del documento; i coperti in fondo, raccolti.
  const ordinati = [...lotto.requisiti].sort((a, b) => ORDINE[esiti.get(a.id)?.stato ?? 'scoperto'] - ORDINE[esiti.get(b.id)?.stato ?? 'scoperto']);
  const problemi = ordinati.filter((r) => esiti.get(r.id)?.stato !== 'coperto');
  const coperti = ordinati.filter((r) => esiti.get(r.id)?.stato === 'coperto');
  const visibili = filtro === 'da_risolvere' ? problemi : filtro === 'coperti' ? coperti : [...problemi, ...coperti];

  const scheda = (requisito: Requisito) => (
    <SchedaRequisito
      key={requisito.id}
      requisito={requisito}
      esito={esiti.get(requisito.id)}
      rimedi={rimediPerRequisito === 'in_calcolo' ? 'in_calcolo' : (rimediPerRequisito.get(requisito.id) ?? [])}
      membri={membri}
      legenda={legenda}
      contesto={contesto}
      dispatch={dispatch}
      aperta={aperte.has(requisito.id)}
      onApri={() => apri(requisito.id)}
    />
  );

  return (
    <section aria-labelledby="titolo-esito" className={styles.sezione}>
      <div className={styles.testata}>
        <h2 id="titolo-esito">Esito per requisito</h2>
        <div className={styles.segmenti} role="group" aria-label="Quali requisiti mostrare">
          {FILTRI.map((f) => (
            <button key={f.chiave} type="button" className={styles.segmento} aria-pressed={filtro === f.chiave} onClick={() => setFiltro(f.chiave)}>
              {f.etichetta} <span className={styles.conteggio}>({f.chiave === 'da_risolvere' ? problemi.length : f.chiave === 'coperti' ? coperti.length : ordinati.length})</span>
            </button>
          ))}
        </div>
      </div>
      {visibili.length > 0 ? (
        <ul className={styles.elenco} aria-label="Requisiti">
          {visibili.map(scheda)}
        </ul>
      ) : (
        <p className={styles.vuoto}>
          {filtro === 'da_risolvere' ? 'Tutti i requisiti sono coperti.' : 'Nessun requisito è coperto.'}
        </p>
      )}
    </section>
  );
}
