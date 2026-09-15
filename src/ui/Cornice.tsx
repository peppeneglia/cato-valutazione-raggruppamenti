// La cornice di ogni schermata, in due card scure nel navy dell'app: in alto
// il nome e il comando per cambiare gara, sempre uguali; in basso il
// perimetro — cosa sono i dati, cosa lo strumento non valuta, dove vanno i
// dati — e il rimando al repository. Il perimetro nasce dai documenti caricati.

import type { ReactNode } from 'react';
import styles from './Cornice.module.css';

export const REPOSITORY = 'https://github.com/peppeneglia/cato-valutazione-raggruppamenti';

/** Il segno del prodotto: lo stesso rombo tagliato della favicon, monocromo navy. */
export function Segno({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 1 15 7H1Z M1 9H15L8 15Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Uguale in ogni schermata: il nome e il comando per cambiare gara. La gara
 * non sta qui: sta intera nel titolo della pagina, dove si legge.
 */
export function Intestazione({ onCambiaGara }: { onCambiaGara: () => void }) {
  return (
    <header className={styles.intestazione}>
      <div className={styles.barra}>
        <p className={styles.marchio}>
          <span className={styles.logo}><Segno className={styles.segno} /></span>
          <span className={styles.nome}>Cato</span>
          <span className={styles.prodotto}> Valutazione Raggruppamenti</span>
        </p>
        <button type="button" className={styles.cambia} onClick={onCambiaGara}>Cambia gara</button>
      </div>
    </header>
  );
}

export function PiePagina({ dati }: { dati: ReactNode }) {
  return (
    <footer className={styles.pie}>
      <div className={styles.pannello}>
        <section aria-labelledby="pie-dati">
          <h2 id="pie-dati" className={styles.etichetta}>I dati</h2>
          <p>{dati}</p>
          <p>
            Nessun servizio esterno, nessun dato che lascia il browser: i documenti sono caricati dallo stesso
            server che serve la pagina, e un file scelto dal tuo computer si legge solo qui.
          </p>
        </section>
        <section aria-labelledby="pie-non-valuta">
          <h2 id="pie-non-valuta" className={styles.etichetta}>Cosa non valuta</h2>
          <p>
            Non legge il documento di gara: riceve i requisiti già strutturati. Sui requisiti generali verifica
            che la dichiarazione esista, non che sia vera. Non giudica equivalenze, non modella consorzi, reti
            e GEIE, garanzia provvisoria, subappalto e offerta tecnica. L'elenco completo, con la fonte di ogni
            voce, sta nelle note del motore di ogni esito.
          </p>
        </section>
        <section aria-labelledby="pie-progetto">
          <h2 id="pie-progetto" className={styles.etichetta}>Il progetto</h2>
          <p>Progetto personale a scopo dimostrativo, non affiliato ad alcuna azienda.</p>
          <p>
            <a className={styles.link} href={REPOSITORY} target="_blank" rel="noreferrer">Il codice sorgente su GitHub</a>
          </p>
        </section>
      </div>
    </footer>
  );
}
