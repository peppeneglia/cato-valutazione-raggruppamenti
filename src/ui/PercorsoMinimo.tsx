// Il percorso minimo con le mosse nominate, il verdetto raggiunto e i
// residui dichiarati. Arriva dal canale differito: finché calcola lo
// dice, e non mostra mai il percorso di una composizione precedente.

import { assertNever } from '../assertNever';
import { descriviMossa, etichettaVerdetto, nomeRequisito, type ContestoDescrizioni } from '../descrizioni';
import type { PercorsoMinimo as PercorsoTipo } from '../domain';
import type { Azione } from '../lavoro';
import { VerdettoBadge } from './StatoRequisito';
import type { ValutazioneDifferita } from './useValutazioneDifferita';
import styles from './PercorsoMinimo.module.css';

type Props = {
  differita: ValutazioneDifferita;
  contesto: ContestoDescrizioni;
  dispatch: (azione: Azione) => void;
};

function Residui({ ids, contesto }: { ids: string[]; contesto: ContestoDescrizioni }) {
  if (ids.length === 0) return null;
  return (
    <p className={styles.residui}>
      Restano da risolvere fuori dallo strumento: {ids.map((id) => `«${nomeRequisito(id, contesto)}»`).join(', ')}.
    </p>
  );
}

function Contenuto({ percorso, contesto, dispatch }: { percorso: PercorsoTipo; contesto: ContestoDescrizioni; dispatch: Props['dispatch'] }) {
  switch (percorso.esito) {
    case 'gia_ammissibile':
      return (
        <>
          <p>Nessuna mossa necessaria: il raggruppamento è già <strong>{etichettaVerdetto(percorso.verdetto).toLowerCase()}</strong>.</p>
          <Residui ids={percorso.residui} contesto={contesto} />
        </>
      );
    case 'trovato':
      return (
        <>
          <p>
            {percorso.mosse.length} {percorso.mosse.length === 1 ? 'mossa porta' : 'mosse portano'} a <VerdettoBadge verdetto={percorso.verdettoRaggiunto} />
            {percorso.segnalazioni > 0 ? ` con ${percorso.segnalazioni} ${percorso.segnalazioni === 1 ? 'segnalazione' : 'segnalazioni'}` : ''}.
          </p>
          <ol className={styles.mosse}>
            {percorso.mosse.map((mossa, i) => (
              <li key={i} className={styles.mossa}>
                <span>{descriviMossa(mossa, contesto)}</span>
                <button type="button" className={styles.prova} onClick={() => dispatch({ tipo: 'prova_rimedio', mossa })}>
                  Prova
                </button>
              </li>
            ))}
          </ol>
          <Residui ids={percorso.residui} contesto={contesto} />
        </>
      );
    case 'inesistente':
      return (
        <p>
          Nessuna sequenza di mosse con i soggetti disponibili rende ammissibile il raggruppamento. Restano scoperti:{' '}
          {percorso.restanoScoperti.map((id) => `«${nomeRequisito(id, contesto)}»`).join(', ')}.
        </p>
      );
    case 'bloccato_da_anomalie':
      return <p>Il percorso non si calcola finché ci sono anomalie bloccanti: vanno risolte nei dati, non con una mossa.</p>;
    default:
      return assertNever(percorso);
  }
}

export function PercorsoMinimo({ differita, contesto, dispatch }: Props) {
  return (
    <section aria-labelledby="titolo-percorso" className={styles.sezione} aria-busy={differita.stato === 'in_calcolo'}>
      <h2 id="titolo-percorso">Percorso minimo</h2>
      {differita.stato === 'in_calcolo' ? (
        <p className={styles.attesa} role="status">Calcolo del percorso minimo in corso…</p>
      ) : (
        <Contenuto percorso={differita.esito.percorsoMinimo} contesto={contesto} dispatch={dispatch} />
      )}
    </section>
  );
}
