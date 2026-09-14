// Ogni valore mostrato ha una provenienza. Questa è la sua forma.

import type { Fonte as FonteTipo } from '../domain';
import styles from './Fonte.module.css';

export function Fonte({ fonte }: { fonte: FonteTipo }) {
  return (
    <span className={styles.fonte}>
      {fonte.documento} · {fonte.riferimento}
      {fonte.pagina !== undefined ? ` · p. ${fonte.pagina}` : ''}
    </span>
  );
}

export function Fonti({ fonti }: { fonti: FonteTipo[] }) {
  if (fonti.length === 0) return <span className={styles.fonte}>nessuna fonte usata</span>;
  return (
    <ul className={styles.elenco}>
      {fonti.map((f, i) => (
        <li key={`${f.documento}-${f.riferimento}-${i}`}>
          <Fonte fonte={f} />
        </li>
      ))}
    </ul>
  );
}
