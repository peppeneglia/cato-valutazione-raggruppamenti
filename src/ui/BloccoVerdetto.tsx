// L'unico elemento memorabile della pagina: il verdetto come frase, e
// subito sotto la mossa che sblocca, o la scadenza entro cui chiedere, o
// il termine decorso. Le anomalie bloccanti salgono qui perché cambiano
// la risposta alla domanda principale. Tutto il resto sta zitto.

import type { FraseVerdetto } from '../descrizioni';
import { formaDelVerdetto } from '../descrizioni';
import type { Verdetto } from '../domain';
import type { Azione } from '../lavoro';
import { Forma } from './StatoRequisito';
import styles from './BloccoVerdetto.module.css';

type Props = {
  verdetto: Verdetto;
  frase: FraseVerdetto;
  dispatch: (azione: Azione) => void;
};

export function BloccoVerdetto({ verdetto, frase, dispatch }: Props) {
  const forma = formaDelVerdetto(verdetto);
  return (
    <section aria-labelledby="titolo-verdetto" className={`${styles.blocco} ${styles[forma]}`} aria-busy={frase.inCalcolo}>
      <h2 id="titolo-verdetto" className={styles.nascosto}>Verdetto</h2>
      <p className={styles.verdetto}>
        <span className={styles.forma}><Forma stato={forma} /></span>
        <span>
          <span className={styles.stato}>{frase.stato}</span>
          {frase.lotto ? <span className={styles.lotto}> {frase.lotto}</span> : null}
          <span className={styles.lotto}>.</span>
        </span>
      </p>
      {frase.situazione ? <p className={styles.situazione}>{frase.situazione}</p> : null}
      {frase.bloccanti.length > 0 ? (
        <ul className={styles.bloccanti}>
          {frase.bloccanti.map((testo, i) => <li key={i}>{testo}</li>)}
        </ul>
      ) : null}
      {frase.scadenza ? (
        <p className={frase.scadenza.decorsa ? styles.decorsa : styles.scadenza}>{frase.scadenza.testo}</p>
      ) : null}
      {frase.inCalcolo ? (
        <p className={styles.attesa} role="status">Calcolo del percorso minimo in corso…</p>
      ) : frase.azione ? (
        <>
          <p className={styles.azione}>{frase.azione}</p>
          {frase.mosse.length > 0 ? (
            <ul className={styles.mosse}>
              {frase.mosse.map((m, i) => (
                <li key={i} className={styles.mossa}>
                  <span>{m.testo}</span>
                  <button type="button" className={styles.prova} onClick={() => dispatch({ tipo: 'prova_rimedio', mossa: m.mossa })}>
                    Prova
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {frase.residui ? <p className={styles.residui}>{frase.residui}</p> : null}
    </section>
  );
}
