// La tabella principale: una riga per requisito, una colonna per membro,
// il numero che comanda a destra. Le righe sono raggruppate per famiglia,
// che è descrittiva e serve solo a questo.

import { descriviIndeterminatezza, etichettaFamiglia, etichettaStato, nomeSoggetto, type ContestoDescrizioni } from '../descrizioni';
import { richiedeChiarimenti } from '../engine/rimedi';
import type { EsitoRequisito, FamigliaRequisito, Lotto, Membro, Requisito, Rimedio } from '../domain';
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

function perFamiglia(requisiti: Requisito[]): { famiglia: FamigliaRequisito; requisiti: Requisito[] }[] {
  const gruppi: { famiglia: FamigliaRequisito; requisiti: Requisito[] }[] = [];
  for (const r of requisiti) {
    let gruppo = gruppi.find((g) => g.famiglia === r.famiglia);
    if (!gruppo) {
      gruppo = { famiglia: r.famiglia, requisiti: [] };
      gruppi.push(gruppo);
    }
    gruppo.requisiti.push(r);
  }
  return gruppi;
}

function RigaRequisito({ requisito, esito, rimedi, membri, legenda, contesto, dispatch }: {
  requisito: Requisito;
  esito: EsitoRequisito | undefined;
  rimedi: Rimedio[] | 'in_calcolo';
  membri: Membro[];
  legenda: Legenda;
  contesto: ContestoDescrizioni;
  dispatch: Props['dispatch'];
}) {
  if (!esito) {
    return (
      <tr id={`requisito-${requisito.id}`} className={styles.riga}>
        <td colSpan={5 + membri.length}>{requisito.descrizione}: non valutato (vedi anomalie).</td>
      </tr>
    );
  }
  const unita = esito.misurazione?.unita;
  const contributi = new Map(esito.contributi.map((c) => [c.soggettoId, c]));
  const m = esito.misurazione;
  return (
    <tr id={`requisito-${requisito.id}`} className={`${styles.riga} ${styles[esito.stato]}`}>
      <td className={styles.stato}><StatoRequisito stato={esito.stato} /></td>
      <td className={styles.requisito}>
        <div className={styles.descrizione}>{requisito.descrizione}</div>
        <div className={styles.meta}>
          <Fonte fonte={requisito.fonte} />
          {requisito.vincolante ? null : <span className={styles.nonVincolante}>non vincolante</span>}
          {requisito.avvalibile ? <span className={styles.avvalibile}>avvalibile</span> : null}
        </div>
        {esito.indeterminatezze.length > 0 ? (
          <ul className={styles.indeterminatezze}>
            {esito.indeterminatezze.map((i, k) => (
              <li key={k} className={richiedeChiarimenti(i) ? styles.documento : styles.giudizio}>{descriviIndeterminatezza(i, contesto)}</li>
            ))}
          </ul>
        ) : null}
        <details className={styles.dettagli}>
          <summary>Motivazione e rimedi</summary>
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
          <Rimedi rimedi={rimedi} contesto={contesto} dispatch={dispatch} />
        </details>
      </td>
      {membri.map((membro) => (
        <td key={membro.soggettoId} className={styles.contributo}>
          <CellaContributo contributo={contributi.get(membro.soggettoId)} unita={unita} />
        </td>
      ))}
      <td className={styles.cifra}>{m && unita ? formattaConUnita(m.raggiunto, unita) : '—'}</td>
      <td className={styles.cifra}>{m && unita ? formattaConUnita(m.soglia, unita) : '—'}</td>
      <td className={`${styles.cifra} ${m && m.delta > 0 ? styles.delta : ''}`}>{m && unita ? (m.delta > 0 ? `−${formattaConUnita(m.delta, unita)}` : '0') : '—'}</td>
      <td><RiferimentiAssunzioni codici={esito.assunzioni.map((a) => a.codice)} legenda={legenda} /></td>
    </tr>
  );
}

export function TabellaEsito({ lotto, requisiti, rimediPerRequisito, membri, legenda, contesto, dispatch }: Props) {
  const esiti = new Map(requisiti.map((r) => [r.requisitoId, r]));
  if (lotto.requisiti.length === 0) {
    return (
      <section aria-labelledby="titolo-esito">
        <h2 id="titolo-esito">Esito per requisito</h2>
        <p className={styles.vuoto}>Il lotto non dichiara requisiti di partecipazione: non c'è niente da coprire.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby="titolo-esito" className={styles.sezione}>
      <h2 id="titolo-esito">Esito per requisito</h2>
      <div className={styles.scorrimento}>
        <table className={styles.tabella}>
          <caption className={styles.didascalia}>
            Una riga per requisito, una colonna per membro. Il valore in cella è quello reale del fascicolo; «non conta qui» dice che la regola non lo considera.
          </caption>
          <thead>
            <tr>
              <th scope="col">Stato</th>
              <th scope="col">Requisito</th>
              {membri.map((m) => (
                <th scope="col" key={m.soggettoId} className={styles.intestazioneMembro}>
                  {nomeSoggetto(m.soggettoId, contesto)}
                  {m.ruolo === 'ausiliaria' ? <span className={styles.ruoloTenue}>ausiliaria</span> : null}
                </th>
              ))}
              <th scope="col" className={styles.cifra}>Raggiunto</th>
              <th scope="col" className={styles.cifra}>Soglia</th>
              <th scope="col" className={styles.cifra}>Delta</th>
              <th scope="col">Assunz.</th>
            </tr>
          </thead>
          {perFamiglia(lotto.requisiti).map((gruppo) => (
            <tbody key={gruppo.famiglia}>
              <tr className={styles.famiglia}>
                <th scope="rowgroup" colSpan={6 + membri.length}>{etichettaFamiglia(gruppo.famiglia)}</th>
              </tr>
              {gruppo.requisiti.map((requisito) => (
                <RigaRequisito
                  key={requisito.id}
                  requisito={requisito}
                  esito={esiti.get(requisito.id)}
                  rimedi={rimediPerRequisito === 'in_calcolo' ? 'in_calcolo' : (rimediPerRequisito.get(requisito.id) ?? [])}
                  membri={membri}
                  legenda={legenda}
                  contesto={contesto}
                  dispatch={dispatch}
                />
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </section>
  );
}
