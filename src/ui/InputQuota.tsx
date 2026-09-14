// Input controllato con bozza locale: mentre il campo ha il focus il testo
// è quello digitato ("6" prima di "60"); ogni valore valido viene inviato
// subito, quello non valido resta segnalato e non parte. Al blur la bozza
// torna al valore reale. Non è stato di dominio: è ciò che c'è sotto le dita.

import { useState } from 'react';
import { formattaNumero } from '../formato';
import { interpretaQuotaPercento } from '../lavoro';
import styles from './InputQuota.module.css';

type Props = {
  etichetta: string;
  quota: number;
  onQuota: (quota: number) => void;
};

function inPercento(quota: number): string {
  return formattaNumero(Number((quota * 100).toFixed(4)));
}

export function InputQuota({ etichetta, quota, onQuota }: Props) {
  const [bozza, setBozza] = useState<string | undefined>(undefined);
  const testo = bozza ?? inPercento(quota);
  const nonValida = bozza !== undefined && interpretaQuotaPercento(bozza) === undefined;

  return (
    <span className={styles.campo}>
      <input
        type="text"
        inputMode="decimal"
        aria-label={etichetta}
        aria-invalid={nonValida || undefined}
        className={`${styles.input} ${nonValida ? styles.nonValida : ''}`}
        value={testo}
        onFocus={() => setBozza(inPercento(quota))}
        onChange={(e) => {
          setBozza(e.target.value);
          const nuova = interpretaQuotaPercento(e.target.value);
          if (nuova !== undefined) onQuota(nuova);
        }}
        onBlur={() => setBozza(undefined)}
      />
      <span className={styles.unita} aria-hidden="true">%</span>
    </span>
  );
}
