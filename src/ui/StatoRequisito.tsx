// Tre segnali indipendenti per lo stato: etichetta testuale, forma SVG,
// colore dai token. Nessuno dei tre è da solo.

import { assertNever } from '../assertNever';
import { etichettaStato, etichettaVerdetto, formaDelVerdetto } from '../descrizioni';
import type { StatoRequisito as Stato, Verdetto } from '../domain';
import styles from './StatoRequisito.module.css';

export function Forma({ stato }: { stato: Stato }) {
  switch (stato) {
    case 'coperto':
      return (
        <svg className={styles.forma} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="6.5" fill="currentColor" />
          <path d="M4.5 8.2l2.3 2.3 4.7-4.9" fill="none" stroke="var(--c-sfondo)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'scoperto':
      return (
        <svg className={styles.forma} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" fill="currentColor" />
          <path d="M5 5l6 6M11 5l-6 6" fill="none" stroke="var(--c-sfondo)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'da_verificare':
      return (
        <svg className={styles.forma} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M8 1.2L14.8 8 8 14.8 1.2 8z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <text x="8" y="11.2" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="currentColor">?</text>
        </svg>
      );
    default:
      return assertNever(stato);
  }
}

export function StatoRequisito({ stato }: { stato: Stato }) {
  return (
    <span className={`${styles.stato} ${styles[stato]}`}>
      <Forma stato={stato} />
      <span>{etichettaStato(stato)}</span>
    </span>
  );
}

export function VerdettoBadge({ verdetto }: { verdetto: Verdetto }) {
  const stato = formaDelVerdetto(verdetto);
  return (
    <span className={`${styles.stato} ${styles.verdetto} ${styles[stato]}`}>
      <Forma stato={stato} />
      <span>{etichettaVerdetto(verdetto)}</span>
    </span>
  );
}
