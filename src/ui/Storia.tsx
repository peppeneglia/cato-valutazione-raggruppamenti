// La pila delle modifiche, dall'ultima alla prima, con un solo bottone:
// annulla l'ultima. Prove e modifiche manuali stanno nella stessa pila
// perché si intrecciano e l'annullamento deve seguire l'ordine vero.

import type { Passo } from '../lavoro';
import styles from './Storia.module.css';

export function Storia({ storia, onAnnulla }: { storia: Passo[]; onAnnulla: () => void }) {
  return (
    <section aria-labelledby="titolo-storia" className={styles.sezione}>
      <div className={styles.testata}>
        <h3 id="titolo-storia">Modifiche</h3>
        <button type="button" className={styles.annulla} onClick={onAnnulla} disabled={storia.length === 0}>
          Annulla ultima modifica
        </button>
      </div>
      {storia.length === 0 ? (
        <p className={styles.vuoto}>Nessuna modifica: questa è la composizione di partenza.</p>
      ) : (
        <ol className={styles.elenco} reversed>
          {[...storia].reverse().map((passo, i) => (
            <li key={storia.length - i} className={passo.genere === 'prova' ? styles.prova : undefined}>
              {passo.etichetta}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
