// La cornice di ogni schermata, in due card scure nel navy dell'app: in alto
// il marchio, sempre uguale; in basso il marchio di nuovo e il perimetro —
// cosa sono i dati, cosa lo strumento non valuta, dove vanno i dati — con il
// rimando al repository. Il marchio porta alla home, cioè alla scelta. Il
// perimetro nasce dai documenti caricati.

import type { MouseEvent, ReactNode } from 'react';
import styles from './Cornice.module.css';

const REPOSITORY = 'https://github.com/peppeneglia/cato-valutazione-raggruppamenti';

/** Il segno del prodotto: lo stesso rombo tagliato della favicon, monocromo navy. */
function Segno({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 1 15 7H1Z M1 9H15L8 15Z" fill="currentColor" />
    </svg>
  );
}

/**
 * Il marchio è un link vero alla home: si apre anche in un'altra scheda. Il
 * clic semplice torna alla scelta senza ricaricare, e senza buttare il lavoro.
 */
function Marchio({ onHome }: { onHome: () => void }) {
  const suClic = (e: MouseEvent<HTMLAnchorElement>) => {
    // Con un modificatore il link fa il suo mestiere: nuova scheda o nuova finestra.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onHome();
  };
  return (
    <a className={styles.marchio} href={import.meta.env.BASE_URL} title="Torna alla home" onClick={suClic}>
      <span className={styles.logo}><Segno className={styles.segno} /></span>
      <span className={styles.nome}>Cato Valutazione Raggruppamenti</span>
    </a>
  );
}

/** Uguale in ogni schermata: il marchio. La gara non sta qui: sta intera nel titolo della pagina, dove si legge. */
export function Intestazione({ onHome }: { onHome: () => void }) {
  return (
    <header className={styles.intestazione}>
      <div className={styles.barra}>
        <Marchio onHome={onHome} />
      </div>
    </header>
  );
}

export function PiePagina({ dati, onHome }: { dati: ReactNode; onHome: () => void }) {
  return (
    <footer className={styles.pie}>
      <div className={styles.pannello}>
        <div className={styles.testataPie}>
          <Marchio onHome={onHome} />
        </div>
        <div className={styles.colonne}>
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
              e GEIE, garanzia provvisoria, subappalto e offerta tecnica. L'elenco completo sta nelle note del
              motore di ogni esito.
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
      </div>
    </footer>
  );
}
