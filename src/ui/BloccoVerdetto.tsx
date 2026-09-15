// L'unico elemento memorabile della pagina: la card scura del risultato. In
// alto il verdetto come frase, grande, e accanto i requisiti contati per
// stato in cifre grandi — la risposta si capisce prima di leggere. Sotto la
// situazione in parole, la scadenza entro cui chiedere o il termine decorso,
// e le mosse che sbloccano, ciascuna da provare. Le anomalie bloccanti
// salgono qui perché cambiano la risposta alla domanda principale.

import type { FraseVerdetto } from '../descrizioni';
import { formaDelVerdetto } from '../descrizioni';
import type { StatoRequisito, Verdetto } from '../domain';
import type { Azione } from '../lavoro';
import { Forma } from './StatoRequisito';
import styles from './BloccoVerdetto.module.css';

type Props = {
  verdetto: Verdetto;
  frase: FraseVerdetto;
  /** Quanti requisiti del lotto in ogni stato: i tre numeri della card. */
  conteggi: Record<StatoRequisito, number>;
  dispatch: (azione: Azione) => void;
};

const NUMERI: { stato: StatoRequisito; etichetta: (n: number) => string }[] = [
  { stato: 'scoperto', etichetta: (n) => (n === 1 ? 'Scoperto' : 'Scoperti') },
  { stato: 'da_verificare', etichetta: () => 'Da verificare' },
  { stato: 'coperto', etichetta: (n) => (n === 1 ? 'Coperto' : 'Coperti') },
];

function Calendario() {
  return (
    <svg className={styles.icona} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BloccoVerdetto({ verdetto, frase, conteggi, dispatch }: Props) {
  const forma = formaDelVerdetto(verdetto);
  return (
    <section aria-labelledby="titolo-verdetto" className={`${styles.blocco} ${styles[forma]}`} aria-busy={frase.inCalcolo}>
      <div className={styles.alto}>
        <div className={styles.risposta}>
          <h2 id="titolo-verdetto" className="occhiello">Verdetto</h2>
          <p className={styles.verdetto}>
            <span className={styles.forma}><Forma stato={forma} /></span>
            <span>
              <span className={styles.stato}>{frase.stato}</span>
              {frase.lotto ? <span className={styles.lotto}> {frase.lotto}</span> : null}
              <span className={styles.lotto}>.</span>
            </span>
          </p>
          {frase.situazione ? <p className={styles.situazione}>{frase.situazione}</p> : null}
        </div>
        <dl className={styles.numeri} aria-label="Requisiti per stato">
          {NUMERI.map(({ stato, etichetta }) => (
            <div key={stato} className={`${styles.numero} ${styles[stato]}`}>
              <dt className="occhiello">{etichetta(conteggi[stato])}</dt>
              <dd className={styles.cifraGrande}>{conteggi[stato]}</dd>
            </div>
          ))}
        </dl>
      </div>

      {frase.bloccanti.length > 0 ? (
        <ul className={styles.bloccanti}>
          {frase.bloccanti.map((testo, i) => <li key={i}>{testo}</li>)}
        </ul>
      ) : null}

      {frase.scadenza ? (
        <p className={frase.scadenza.decorsa ? styles.decorsa : styles.scadenza}>
          <Calendario />
          <span>{frase.scadenza.testo}</span>
        </p>
      ) : null}

      {frase.inCalcolo ? (
        <p className={styles.attesa} role="status">Calcolo del percorso minimo in corso…</p>
      ) : frase.azione ? (
        <div className={styles.mosseBlocco}>
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
        </div>
      ) : null}
      {frase.residui ? <p className={styles.residui}>{frase.residui}</p> : null}
    </section>
  );
}
