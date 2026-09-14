// I rimedi di un requisito. Gli applicabili si PROVANO: la mossa entra nel
// foglio di lavoro come una modifica annullabile con l'etichetta onesta.
// I non applicabili dipendono dal mondo esterno e restano testo.

import { descriviRimedio, eApplicabile, type ContestoDescrizioni } from '../descrizioni';
import type { Rimedio } from '../domain';
import type { Azione } from '../lavoro';
import styles from './Rimedi.module.css';

type Props = {
  rimedi: Rimedio[] | 'in_calcolo';
  contesto: ContestoDescrizioni;
  dispatch: (azione: Azione) => void;
};

export function Rimedi({ rimedi, contesto, dispatch }: Props) {
  if (rimedi === 'in_calcolo') return <p className={styles.attesa}>Rimedi in calcolo…</p>;
  if (rimedi.length === 0) return <p className={styles.vuoto}>Nessun rimedio: il requisito è coperto.</p>;
  return (
    <ul className={styles.elenco}>
      {rimedi.map((rimedio, i) => (
        <li key={i} className={styles.voce}>
          <span>{descriviRimedio(rimedio, contesto)}</span>
          {eApplicabile(rimedio) ? (
            <button type="button" className={styles.prova} onClick={() => dispatch({ tipo: 'prova_rimedio', mossa: rimedio })}>
              Prova
            </button>
          ) : (
            <span className={styles.esterno}>da fare fuori dallo strumento</span>
          )}
        </li>
      ))}
    </ul>
  );
}
