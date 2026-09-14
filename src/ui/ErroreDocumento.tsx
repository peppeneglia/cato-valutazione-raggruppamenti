// Un documento che non si può usare, con i suoi errori. Ogni errore ha
// tre parti impaginate come tali: dove, cosa ci voleva, cosa c'è. Chi legge
// deve poter aprire il file e correggerlo senza indovinare.

import type { Caricato } from '../documenti/carica';
import { contaErrori, descriviErroreDocumento } from '../documenti/messaggi';
import styles from './ErroreDocumento.module.css';

type NonValido = Extract<Caricato<unknown>, { stato: 'non_valido' }>;

export function ErroreDocumento({ documento }: { documento: NonValido }) {
  return (
    <section className={styles.documento} aria-label={`Errori in ${documento.file}`}>
      <p className={styles.intestazione}>
        <span className={styles.file}>{documento.file}</span>
        <span className={styles.conteggio}>non è utilizzabile: {contaErrori(documento.errori.length)}</span>
      </p>
      <ol className={styles.elenco}>
        {documento.errori.map((errore, i) => {
          const m = descriviErroreDocumento(errore);
          return (
            <li key={i} className={styles.errore}>
              <p className={styles.dove}>{m.dove}</p>
              <dl className={styles.coppie}>
                {m.atteso !== undefined ? (
                  <div className={styles.coppia}>
                    <dt>Atteso</dt>
                    <dd>{m.atteso}</dd>
                  </div>
                ) : null}
                {m.trovato !== undefined ? (
                  <div className={styles.coppia}>
                    <dt>Trovato</dt>
                    <dd>{m.trovato}</dd>
                  </div>
                ) : null}
              </dl>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
