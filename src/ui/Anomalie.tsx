// Le segnalazioni nei dati, con il link in pagina all'oggetto che le causa.
// Non cambiano il verdetto, ma vanno lette. Le bloccanti stanno accanto al
// verdetto, non qui.

import { assertNever } from '../assertNever';
import { bersaglioAnomalia, descriviAnomalia, nomePrestazione, nomeRequisito, nomeSoggetto, type BersaglioAnomalia, type ContestoDescrizioni } from '../descrizioni';
import type { Anomalia } from '../domain';
import styles from './Anomalie.module.css';

function LinkBersaglio({ bersaglio, contesto }: { bersaglio: BersaglioAnomalia; contesto: ContestoDescrizioni }) {
  switch (bersaglio.tipo) {
    case 'membro':
      return <a href={`#membro-${bersaglio.id}`} className={styles.link}>vai a {nomeSoggetto(bersaglio.id, contesto)}</a>;
    case 'prestazione':
      return <a href={`#prestazione-${bersaglio.id}`} className={styles.link}>vai a «{nomePrestazione(bersaglio.id, contesto)}»</a>;
    case 'requisito':
      return <a href={`#requisito-${bersaglio.id}`} className={styles.link}>vai a «{nomeRequisito(bersaglio.id, contesto)}»</a>;
    default:
      return assertNever(bersaglio);
  }
}

export function Anomalie({ anomalie, contesto }: { anomalie: Anomalia[]; contesto: ContestoDescrizioni }) {
  return (
    <section aria-labelledby="titolo-anomalie" className={styles.sezione}>
      <h2 id="titolo-anomalie">Segnalazioni nei dati</h2>
      {anomalie.length === 0 ? (
        <p className={styles.vuoto}>Nessuna segnalazione: bando, fascicoli e composizione sono coerenti.</p>
      ) : (
        <ul className={styles.elenco}>
          {anomalie.map((a, i) => {
            const bersaglio = bersaglioAnomalia(a);
            return (
              <li key={i} className={`${styles.anomalia} ${styles[`${a.gravita}Voce`]}`}>
                <span>{descriviAnomalia(a, contesto)}</span>
                {bersaglio ? <LinkBersaglio bersaglio={bersaglio} contesto={contesto} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
