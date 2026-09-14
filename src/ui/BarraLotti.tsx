// I lotti come barra di selezione: un elemento per lotto, con il nome
// breve e la forma dello stato. Con un lotto solo è una chip sola, e il
// confronto tra lotti — una domanda diversa: dove conviene presentarsi —
// non compare. La classifica arriva dal motore sul canale differito.

import type { Bando, LottoId } from '../domain';
import { etichettaVerdetto, formaDelVerdetto, nomeLotto } from '../descrizioni';
import { Forma } from './StatoRequisito';
import type { ValutazioneDifferita } from './useValutazioneDifferita';
import styles from './BarraLotti.module.css';

type Props = {
  bando: Bando;
  lottoId: LottoId;
  differita: ValutazioneDifferita;
  onSeleziona: (lottoId: LottoId) => void;
  onConfronta: () => void;
};

export function BarraLotti({ bando, lottoId, differita, onSeleziona, onConfronta }: Props) {
  const verdetti = new Map(differita.stato === 'pronto' ? differita.lotti.map((v) => [v.chiave, v.esito.verdetto]) : []);
  return (
    <nav aria-labelledby="titolo-lotti" className={styles.barra}>
      <h2 id="titolo-lotti" className={styles.nascosto}>Lotti</h2>
      <ul className={styles.elenco}>
        {bando.lotti.map((lotto) => {
          const selezionato = lotto.id === lottoId;
          const verdetto = verdetti.get(lotto.id);
          return (
            <li key={lotto.id}>
              <button type="button" className={`${styles.chip} ${selezionato ? styles.attivo : ''}`} aria-pressed={selezionato} onClick={() => onSeleziona(lotto.id)}>
                {verdetto ? (
                  <span className={`${styles.forma} ${styles[formaDelVerdetto(verdetto)]}`}>
                    <Forma stato={formaDelVerdetto(verdetto)} />
                    <span className={styles.nascosto}>{etichettaVerdetto(verdetto)}</span>
                  </span>
                ) : (
                  <span className={`${styles.forma} ${styles.attesa}`} aria-hidden="true">·<span className={styles.nascosto}>Calcolo in corso…</span></span>
                )}
                <span className={styles.nome}>{nomeLotto(bando, lotto.id)}</span>
                <span className={styles.oggetto}>{lotto.oggetto}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {bando.lotti.length > 1 ? (
        <button type="button" className={styles.confronta} onClick={onConfronta}>Confronta tutti i lotti</button>
      ) : null}
    </nav>
  );
}
