// Contesto compatto: bando, lotto selezionato, prestazioni. Non è un hero.

import { assertNever } from '../assertNever';
import type { Bando, Lotto, NaturaPrestazione } from '../domain';
import { formattaData, formattaEuro, formattaPercentuale } from '../formato';
import { Fonte } from './Fonte';
import styles from './IntestazioneBando.module.css';

function etichettaNatura(natura: NaturaPrestazione): string {
  switch (natura) {
    case 'principale':
      return 'Principale';
    case 'scorporabile':
      return 'Scorporabile';
    case 'indivisibile':
      return 'Indivisibile';
    default:
      return assertNever(natura);
  }
}

export function IntestazioneBando({ bando, lotto }: { bando: Bando; lotto: Lotto | undefined }) {
  return (
    <section aria-labelledby="titolo-bando" className={styles.sezione}>
      <h2 id="titolo-bando" className={styles.titolo}>{bando.oggetto}</h2>
      <dl className={styles.dati}>
        <div><dt>Stazione appaltante</dt><dd>{bando.stazioneAppaltante}</dd></div>
        <div><dt>Pubblicazione</dt><dd>{bando.dataPubblicazione === undefined ? 'non indicata nel documento' : formattaData(bando.dataPubblicazione)}</dd></div>
        <div><dt>Termine di presentazione</dt><dd>{formattaData(bando.terminePresentazione)}</dd></div>
        <div><dt>Base d'asta</dt><dd className={styles.cifra}>{formattaEuro(bando.baseAsta)}</dd></div>
        <div><dt>Fonte</dt><dd><Fonte fonte={bando.fonte} /></dd></div>
      </dl>

      {lotto ? (
        <>
          <h3 className={styles.sottotitolo}>
            <span className={styles.idLotto}>{lotto.id}</span> {lotto.oggetto}
            <span className={styles.importoLotto}>{formattaEuro(lotto.importo)}</span>
            {lotto.cig !== undefined ? <span className={styles.cig}>CIG {lotto.cig}</span> : null}
          </h3>
          <table className={styles.prestazioni}>
            <caption className={styles.didascalia}>Prestazioni del lotto: la scomposizione su cui si assegnano le quote.</caption>
            <thead>
              <tr>
                <th scope="col">Prestazione</th>
                <th scope="col">Natura</th>
                <th scope="col" className={styles.cifra}>Importo</th>
                <th scope="col">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {lotto.prestazioni.map((p) => (
                <tr key={p.id} id={`prestazione-${p.id}`}>
                  <td>{p.descrizione}</td>
                  <td>{etichettaNatura(p.natura)}</td>
                  <td className={styles.cifra}>{formattaEuro(p.importo)}</td>
                  <td><Fonte fonte={p.fonte} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {lotto.prestazioni.length === 0 ? <p className={styles.vuoto}>Il lotto non dichiara prestazioni: senza prestazioni non ci sono quote da assegnare.</p> : null}
          {lotto.vincoloPrestazionePrincipale ? (
            <p className={styles.vincolo}>
              Vincolo dichiarato: la prestazione principale va eseguita dalla {lotto.vincoloPrestazionePrincipale.esecutore} per almeno il {formattaPercentuale(lotto.vincoloPrestazionePrincipale.quotaMinima)}.{' '}
              <Fonte fonte={lotto.vincoloPrestazionePrincipale.fonte} />
            </p>
          ) : null}
        </>
      ) : (
        <p className={styles.vuoto}>Lotto non trovato nel bando: seleziona un lotto dalla tabella sopra.</p>
      )}
    </section>
  );
}
