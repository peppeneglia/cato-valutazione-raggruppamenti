// Anomalie nei dati, separate per gravità, con il link in pagina
// all'oggetto che le causa. Le bloccanti forzano il verdetto; le
// segnalazioni no, e lo si dice.

import { assertNever } from '../assertNever';
import { bersaglioAnomalia, etichettaGravita, nomePrestazione, nomeRequisito, nomeSoggetto, type BersaglioAnomalia, type ContestoDescrizioni } from '../descrizioni';
import type { Anomalia, GravitaAnomalia } from '../domain';
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

function Elenco({ gravita, anomalie, contesto }: { gravita: GravitaAnomalia; anomalie: Anomalia[]; contesto: ContestoDescrizioni }) {
  const spiegazione = gravita === 'bloccante'
    ? 'Rendono il raggruppamento non ammissibile finché non sono risolte nei dati.'
    : 'Non cambiano il verdetto, ma vanno lette.';
  return (
    <div className={styles.gruppo}>
      <h3 className={styles[gravita]}>{etichettaGravita(gravita)} ({anomalie.length})</h3>
      <p className={styles.spiegazione}>{spiegazione}</p>
      {anomalie.length === 0 ? (
        <p className={styles.vuoto}>Nessuna.</p>
      ) : (
        <ul className={styles.elenco}>
          {anomalie.map((a, i) => {
            const bersaglio = bersaglioAnomalia(a);
            return (
              <li key={i} className={`${styles.anomalia} ${styles[`${gravita}Voce`]}`}>
                <span className={styles.codice}>{a.codice}</span>
                <span>{a.messaggio}</span>
                {bersaglio ? <LinkBersaglio bersaglio={bersaglio} contesto={contesto} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Anomalie({ anomalie, contesto }: { anomalie: Anomalia[]; contesto: ContestoDescrizioni }) {
  const bloccanti = anomalie.filter((a) => a.gravita === 'bloccante');
  const segnalazioni = anomalie.filter((a) => a.gravita === 'segnalazione');
  return (
    <section aria-labelledby="titolo-anomalie" className={styles.sezione}>
      <h2 id="titolo-anomalie">Anomalie nei dati</h2>
      {anomalie.length === 0 ? (
        <p className={styles.vuoto}>Nessuna anomalia: bando, fascicoli e composizione sono coerenti.</p>
      ) : (
        <>
          <Elenco gravita="bloccante" anomalie={bloccanti} contesto={contesto} />
          <Elenco gravita="segnalazione" anomalie={segnalazioni} contesto={contesto} />
        </>
      )}
    </section>
  );
}
