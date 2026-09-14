// Un avvalimento già concordato va rappresentato, non solo suggerito.
// Tre scelte: chi è l'ausiliaria, a favore di chi, per quali requisiti.
// I requisiti non avvalibili restano visibili e disabilitati, con la ragione.

import { useState } from 'react';
import type { Lotto, Raggruppamento, RequisitoId, Soggetto } from '../domain';
import type { Azione } from '../lavoro';
import { nomeSoggetto, type ContestoDescrizioni } from '../descrizioni';
import styles from './AggiungiAusiliaria.module.css';

type Props = {
  lotto: Lotto;
  raggruppamento: Raggruppamento;
  soggetti: Soggetto[];
  contesto: ContestoDescrizioni;
  dispatch: (azione: Azione) => void;
};

export function AggiungiAusiliaria({ lotto, raggruppamento, soggetti, contesto, dispatch }: Props) {
  const membri = new Set(raggruppamento.membri.map((m) => m.soggettoId));
  const disponibili = soggetti.filter((s) => !membri.has(s.id));
  const esecutori = raggruppamento.membri.filter((m) => m.ruolo !== 'ausiliaria');
  const [soggettoId, setSoggettoId] = useState('');
  const [ausiliataId, setAusiliataId] = useState('');
  const [requisitiIds, setRequisitiIds] = useState<RequisitoId[]>([]);

  const ausiliaria = disponibili.find((s) => s.id === soggettoId) ?? disponibili[0];
  const ausiliata = esecutori.find((m) => m.soggettoId === ausiliataId) ?? esecutori[0];
  const avvalibili = lotto.requisiti.filter((r) => r.avvalibile);

  if (disponibili.length === 0) {
    return <p className={styles.vuoto}>Nessun soggetto disponibile come ausiliaria: sono già tutti nel raggruppamento.</p>;
  }
  if (esecutori.length === 0) {
    return <p className={styles.vuoto}>Un'ausiliaria integra un membro esecutore: aggiungi prima almeno una mandataria.</p>;
  }

  const alterna = (id: RequisitoId) => setRequisitiIds((attuali) => (attuali.includes(id) ? attuali.filter((x) => x !== id) : [...attuali, id]));

  return (
    <form
      className={styles.modulo}
      onSubmit={(e) => {
        e.preventDefault();
        if (!ausiliaria || !ausiliata) return;
        dispatch({ tipo: 'aggiungi_ausiliaria', soggettoId: ausiliaria.id, ausiliataId: ausiliata.soggettoId, requisitiIds });
        setRequisitiIds([]);
      }}
    >
      <h3 className={styles.titolo}>Aggiungi un'ausiliaria in avvalimento</h3>
      <div className={styles.riga}>
        <label className={styles.campo}>
          <span>Ausiliaria</span>
          <select value={ausiliaria?.id ?? ''} onChange={(e) => setSoggettoId(e.target.value)} className={styles.select}>
            {disponibili.map((s) => (
              <option key={s.id} value={s.id}>{s.denominazione}</option>
            ))}
          </select>
        </label>
        <label className={styles.campo}>
          <span>A favore di</span>
          <select value={ausiliata?.soggettoId ?? ''} onChange={(e) => setAusiliataId(e.target.value)} className={styles.select}>
            {esecutori.map((m) => (
              <option key={m.soggettoId} value={m.soggettoId}>{nomeSoggetto(m.soggettoId, contesto)}</option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className={styles.requisiti}>
        <legend>Per quali requisiti</legend>
        {lotto.requisiti.length === 0 ? <p className={styles.vuoto}>Il lotto non ha requisiti.</p> : null}
        {lotto.requisiti.map((r) => (
          <label key={r.id} className={`${styles.requisito} ${r.avvalibile ? '' : styles.nonAvvalibile}`}>
            <input
              type="checkbox"
              checked={requisitiIds.includes(r.id)}
              disabled={!r.avvalibile}
              onChange={() => alterna(r.id)}
            />
            <span>
              {r.descrizione}
              {r.avvalibile ? null : <span className={styles.ragione}> — non avvalibile: il disciplinare non lo ammette</span>}
            </span>
          </label>
        ))}
      </fieldset>
      <button type="submit" className={styles.bottone} disabled={avvalibili.length === 0 || requisitiIds.length === 0}>
        Aggiungi ausiliaria
      </button>
      {avvalibili.length === 0 ? <p className={styles.vuoto}>Nessun requisito di questo lotto è avvalibile.</p> : null}
    </form>
  );
}
