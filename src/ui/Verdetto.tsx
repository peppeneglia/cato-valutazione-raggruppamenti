// Verdetto e data di riferimento, sempre insieme: la data è la lente sul
// fascicolo e non è mai implicita.

import type { Verdetto as VerdettoTipo } from '../domain';
import { VerdettoBadge } from './StatoRequisito';
import styles from './Verdetto.module.css';

type Props = {
  verdetto: VerdettoTipo;
  dataRiferimento: string;
  onDataRiferimento: (valore: string) => void;
  scoperti: number;
  daVerificare: number;
  bloccanti: number;
};

export function Verdetto({ verdetto, dataRiferimento, onDataRiferimento, scoperti, daVerificare, bloccanti }: Props) {
  return (
    <section aria-labelledby="titolo-verdetto" className={styles.sezione}>
      <h2 id="titolo-verdetto" className={styles.titoloNascosto}>Verdetto</h2>
      <div className={styles.riga}>
        <VerdettoBadge verdetto={verdetto} />
        <p className={styles.conteggi}>
          {scoperti} {scoperti === 1 ? 'requisito scoperto' : 'requisiti scoperti'} · {daVerificare} da verificare
          {bloccanti > 0 ? ` · ${bloccanti} ${bloccanti === 1 ? 'anomalia bloccante' : 'anomalie bloccanti'}` : ''}
        </p>
        <label className={styles.data}>
          <span>Data di riferimento</span>
          <input
            type="date"
            value={dataRiferimento}
            onChange={(e) => onDataRiferimento(e.target.value)}
            className={styles.inputData}
          />
        </label>
      </div>
    </section>
  );
}
