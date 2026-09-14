// La cella di un membro su un requisito: il valore REALE del fascicolo e,
// se la regola non lo considera, "non conta qui". Chi possiede ma non
// esegue si legge "ce l'ha, non serve qui", mai come una mancanza.

import { assertNever } from '../assertNever';
import type { Contributo, Unita, ValoreContributo } from '../domain';
import { formattaConUnita } from '../formato';
import { Fonti } from './Fonte';
import styles from './CellaContributo.module.css';

function testoValore(valore: ValoreContributo, unita: Unita | undefined): { testo: string; classe: string } {
  switch (valore.tipo) {
    case 'possesso':
      switch (valore.esito) {
        case 'posseduto':
          return { testo: 'Possiede', classe: styles.coperto };
        case 'da_verificare':
          return { testo: 'Possiede, da verificare', classe: styles.daVerificare };
        case 'assente':
          return { testo: 'Non possiede', classe: styles.scoperto };
        default:
          return assertNever(valore.esito);
      }
    case 'misura': {
      const formatta = (v: number) => (unita ? formattaConUnita(v, unita) : String(v));
      const testo = valore.incerto > 0 ? `${formatta(valore.certo)} + ${formatta(valore.incerto)} da verificare` : formatta(valore.certo);
      return { testo, classe: styles.cifra };
    }
    default:
      return assertNever(valore);
  }
}

export function CellaContributo({ contributo, unita }: { contributo: Contributo | undefined; unita: Unita | undefined }) {
  if (!contributo) {
    return <span className={styles.nonConsiderato}>non considerato</span>;
  }
  const { testo, classe } = testoValore(contributo.valore, unita);
  return (
    <div className={`${styles.cella} ${contributo.conteggiato ? '' : styles.nonConteggiato}`}>
      <span className={classe}>{testo}</span>
      {contributo.conteggiato ? null : <span className={styles.nonConta}>non conta qui</span>}
      {contributo.nota !== undefined || contributo.fonti.length > 0 || contributo.dettagli ? (
        <details className={styles.dettagli}>
          <summary>{contributo.fonti.length} {contributo.fonti.length === 1 ? 'fonte' : 'fonti'}{contributo.nota !== undefined ? ' · nota' : ''}</summary>
          {contributo.nota !== undefined ? <p className={styles.nota}>{contributo.nota}</p> : null}
          {contributo.dettagli?.map((d) => <p key={d} className={styles.nota}>{d}</p>)}
          <Fonti fonti={contributo.fonti} />
        </details>
      ) : null}
    </div>
  );
}
