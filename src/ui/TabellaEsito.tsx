// La tabella principale: una riga per requisito, quattro cose in riga —
// stato, nome breve, quanto manca, una frase che dice perché — e tutto
// il resto nell'espansione: descrizione integrale con la fonte, contributi
// per membro, motivazione, letture, assunzioni, rimedi. I requisiti
// coperti stanno raccolti e chiusi: chi guarda cerca i problemi.

import { useState } from 'react';
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

const COLONNE = 4;

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

function RigaRequisito(props: RigaProps) {
  const { requisito, esito, contesto, aperta, onApri } = props;
  if (!esito) {
    return (
      <tr id={`requisito-${requisito.id}`} className={styles.riga}>
        <td colSpan={COLONNE}>{requisito.nomeBreve}: non valutato (vedi anomalie).</td>
      </tr>
    );
  }
  const ragione = ragioneBreve(esito, requisito, contesto);
  const azione = azioneRichiesta(esito, richiedeChiarimenti);
  const idDettagli = `dettagli-${requisito.id}`;
  return (
    <>
      <tr id={`requisito-${requisito.id}`} className={`${styles.riga} ${styles[esito.stato]}`}>
        <td className={styles.stato}><StatoRequisito stato={esito.stato} /></td>
        <td className={styles.requisito}>
          <span className={styles.nome}>{requisito.nomeBreve}</span>
          {ragione ? (
            <span className={styles.ragione}>
              {ragione}
              {azione ? <span className={azione === 'chiarimenti' ? styles.chiarimenti : styles.daValutare}> {azione}</span> : null}
            </span>
          ) : null}
        </td>
        <td className={styles.manca}>{quantoManca(esito, contesto)}</td>
        <td className={styles.azioni}>
          <button type="button" className={styles.dettagli} aria-expanded={aperta} aria-controls={idDettagli} onClick={onApri}>
            {aperta ? 'Chiudi' : 'Dettagli'}
          </button>
        </td>
      </tr>
      {aperta ? (
        <tr id={idDettagli} className={styles.rigaEspansione}>
          <td colSpan={COLONNE}>
            <Espansione {...props} esito={esito} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

const ORDINE = { scoperto: 0, da_verificare: 1, coperto: 2 } as const;

export function TabellaEsito({ lotto, requisiti, rimediPerRequisito, membri, legenda, contesto, dispatch }: Props) {
  const [aperte, setAperte] = useState<ReadonlySet<string>>(new Set());
  const [copertiAperti, setCopertiAperti] = useState(false);
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

  const riga = (requisito: Requisito) => (
    <RigaRequisito
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
      <h2 id="titolo-esito">Esito per requisito</h2>
      <table className={styles.tabella}>
        <thead>
          <tr>
            <th scope="col">Stato</th>
            <th scope="col">Requisito</th>
            <th scope="col">Quanto manca</th>
            <th scope="col"><span className={styles.nascosto}>Dettagli</span></th>
          </tr>
        </thead>
        <tbody>
          {problemi.map(riga)}
          {problemi.length === 0 ? (
            <tr className={styles.riga}>
              <td colSpan={COLONNE} className={styles.vuoto}>Tutti i requisiti sono coperti.</td>
            </tr>
          ) : null}
        </tbody>
        {coperti.length > 0 ? (
          <tbody>
            <tr className={styles.gruppo}>
              <td colSpan={COLONNE}>
                <button type="button" className={styles.apriGruppo} aria-expanded={copertiAperti} onClick={() => setCopertiAperti((v) => !v)}>
                  {coperti.length === 1 ? '1 requisito coperto' : `${coperti.length} requisiti coperti`}
                </button>
              </td>
            </tr>
            {copertiAperti ? coperti.map(riga) : null}
          </tbody>
        ) : null}
      </table>
    </section>
  );
}
