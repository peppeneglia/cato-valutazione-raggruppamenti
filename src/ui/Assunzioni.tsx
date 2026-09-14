// Le regole del motore che hanno inciso sull'esito, in una legenda che si
// legge una volta. Le righe le referenziano per codice (A1, A2…).

import { etichettaAssunzione } from '../descrizioni';
import type { CodiceAssunzione } from '../domain';
import { siglaAssunzione, type Legenda } from './legenda';
import styles from './Assunzioni.module.css';

export function RiferimentiAssunzioni({ codici, legenda }: { codici: CodiceAssunzione[]; legenda: Legenda }) {
  const voci = legenda.filter((v) => codici.includes(v.codice));
  if (voci.length === 0) return null;
  return (
    <span className={styles.riferimenti}>
      {voci.map((v) => (
        <a key={v.codice} href={`#assunzione-${v.codice}`} className={styles.sigla} title={etichettaAssunzione(v.codice)}>
          {siglaAssunzione(v.numero)}
        </a>
      ))}
    </span>
  );
}

export function Assunzioni({ legenda }: { legenda: Legenda }) {
  return (
    <section aria-labelledby="titolo-assunzioni" className={styles.sezione}>
      <h2 id="titolo-assunzioni">Assunzioni del motore</h2>
      {legenda.length === 0 ? (
        <p className={styles.vuoto}>Nessuna regola del motore ha inciso su questo esito: ogni numero viene dal disciplinare o dai fascicoli.</p>
      ) : (
        <>
          <p className={styles.intro}>Regole del motore, non del disciplinare, che hanno inciso sull'esito di questo lotto. Le righe le richiamano con la sigla.</p>
          <dl className={styles.legenda}>
            {legenda.map((v) => (
              <div key={v.codice} id={`assunzione-${v.codice}`} className={styles.voce}>
                <dt>
                  <span className={styles.sigla}>{siglaAssunzione(v.numero)}</span> {etichettaAssunzione(v.codice)}
                </dt>
                {v.testi.map((t) => (
                  <dd key={t}>{t}</dd>
                ))}
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
