// Ingresso di un soggetto tra quelli disponibili e non ancora membri.
// Entra a quote zero: le quote si compilano nella tabella, e finché sono
// zero il motore lo segnala.

import { useState } from 'react';
import { etichettaRuolo } from '../descrizioni';
import type { Raggruppamento, RuoloEsecutore, Soggetto } from '../domain';
import type { Azione } from '../lavoro';
import styles from './AggiungiMembro.module.css';

const RUOLI: RuoloEsecutore[] = ['mandante', 'consorziata_esecutrice', 'mandataria'];

type Props = {
  raggruppamento: Raggruppamento;
  soggetti: Soggetto[];
  dispatch: (azione: Azione) => void;
};

export function AggiungiMembro({ raggruppamento, soggetti, dispatch }: Props) {
  const membri = new Set(raggruppamento.membri.map((m) => m.soggettoId));
  const disponibili = soggetti.filter((s) => !membri.has(s.id));
  const [soggettoId, setSoggettoId] = useState<string>('');
  const [ruolo, setRuolo] = useState<RuoloEsecutore>('mandante');
  const scelto = disponibili.find((s) => s.id === soggettoId) ?? disponibili[0];

  if (disponibili.length === 0) {
    return <p className={styles.vuoto}>Tutti i soggetti disponibili sono già nel raggruppamento.</p>;
  }

  return (
    <form
      className={styles.modulo}
      onSubmit={(e) => {
        e.preventDefault();
        if (scelto) dispatch({ tipo: 'aggiungi_membro', soggettoId: scelto.id, ruolo });
      }}
    >
      <label className={styles.campo}>
        <span>Soggetto da aggiungere</span>
        <select value={scelto?.id ?? ''} onChange={(e) => setSoggettoId(e.target.value)} className={styles.select}>
          {disponibili.map((s) => (
            <option key={s.id} value={s.id}>{s.denominazione}</option>
          ))}
        </select>
      </label>
      <label className={styles.campo}>
        <span>Ruolo</span>
        <select value={ruolo} onChange={(e) => setRuolo(e.target.value as RuoloEsecutore)} className={styles.select}>
          {RUOLI.map((r) => (
            <option key={r} value={r}>{etichettaRuolo(r)}</option>
          ))}
        </select>
      </label>
      <button type="submit" className={styles.bottone}>Aggiungi al raggruppamento</button>
    </form>
  );
}
