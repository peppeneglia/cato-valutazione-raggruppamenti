// I dati della gara, sempre in vista: una card con tre livelli. Il titolo
// della card; i fatti del bando come riquadri, l'etichetta piccola sopra e il
// valore grande sotto; poi i valori a cui i requisiti rinviano e il lotto con
// le sue prestazioni. L'oggetto della gara non si ripete: sta nel titolo
// della pagina.

import { assertNever } from '../assertNever';
import type { Bando, Lotto, NaturaPrestazione } from '../domain';
import { descriviTermine } from '../descrizioni';
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

function Fatto({ etichetta, valore, nota, cifra }: { etichetta: string; valore: string; nota?: string; cifra?: boolean }) {
  return (
    <div className={styles.fatto}>
      <dt className="occhiello">{etichetta}</dt>
      <dd className={`${styles.valore} ${cifra ? styles.cifra : ''}`}>{valore}</dd>
      {nota ? <dd className={styles.nota}>{nota}</dd> : null}
    </div>
  );
}

export function IntestazioneBando({ bando, lotto }: { bando: Bando; lotto: Lotto | undefined }) {
  const chiarimenti = bando.termineChiarimenti;
  return (
    <section aria-labelledby="titolo-bando" className={styles.sezione}>
      <div className={styles.testata}>
        <h2 id="titolo-bando">Dati del bando e del lotto</h2>
        <p className={styles.fonte}><Fonte fonte={bando.fonte} /></p>
      </div>

      <dl className={styles.fatti}>
        <Fatto etichetta="Stazione appaltante" valore={bando.stazioneAppaltante} />
        <Fatto etichetta="Base d'asta" valore={formattaEuro(bando.baseAsta)} cifra />
        <Fatto etichetta="Termine di presentazione" valore={formattaData(bando.terminePresentazione)} cifra />
        {chiarimenti ? (
          <Fatto
            etichetta="Termine per i chiarimenti"
            valore={descriviTermine(chiarimenti).replace(/^entro /, '')}
            nota={chiarimenti.risposteEntro ? `Risposte entro il ${formattaData(chiarimenti.risposteEntro.valore)}` : undefined}
          />
        ) : null}
        <Fatto
          etichetta="Pubblicazione"
          valore={bando.dataPubblicazione === undefined ? 'Non indicata' : formattaData(bando.dataPubblicazione)}
          nota={bando.dataPubblicazione === undefined ? 'Il documento non la scrive' : undefined}
        />
      </dl>

      {bando.valori.length > 0 ? (
        <div className={styles.blocco}>
          <h3 className={styles.sottotitolo}>Valori a cui rinviano i requisiti</h3>
          <dl className={styles.valori}>
            {bando.valori.map((v) => (
              <div key={v.nome} className={styles.valoreBando}>
                <dt className={styles.nomeValore}>
                  {v.nome}
                  {v.candidati.length > 1 ? <span className={styles.avviso}> — il documento lo scrive in {v.candidati.length} modi</span> : null}
                </dt>
                <dd className={styles.candidati}>
                  {v.candidati.map((c, i) => (
                    <span key={i} className={styles.candidato}>
                      <span className={`${styles.importo} ${styles.cifra}`}>{formattaEuro(c.valore)}</span>
                      <span className={styles.nota}>{c.fonte.riferimento}{c.fonte.pagina === undefined ? '' : `, p. ${c.fonte.pagina}`}</span>
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {lotto ? (
        <div className={styles.blocco}>
          <p className="occhiello">
            Lotto · {lotto.id}
            {lotto.cig !== undefined ? ` · CIG ${lotto.cig}` : ''}
          </p>
          <div className={styles.lotto}>
            <h3 className={styles.oggettoLotto}>{lotto.oggetto}</h3>
            <p className={`${styles.importoLotto} ${styles.cifra}`}>{formattaEuro(lotto.importo)}</p>
          </div>
          {lotto.prestazioni.length > 0 ? (
            <ul className={styles.prestazioni} aria-label="Prestazioni del lotto">
              {lotto.prestazioni.map((p) => (
                <li key={p.id} id={`prestazione-${p.id}`} className={styles.prestazione}>
                  <span className={styles.descrizionePrestazione}>{p.descrizione}</span>
                  <span className={styles.natura}>{etichettaNatura(p.natura)}</span>
                  <span className={`${styles.importoPrestazione} ${styles.cifra}`}>{formattaEuro(p.importo)}</span>
                  <span className={styles.nota}><Fonte fonte={p.fonte} /></span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.nota}>Il lotto non dichiara prestazioni: senza prestazioni non ci sono quote da assegnare.</p>
          )}
          <p className={styles.nota}>Le prestazioni sono la scomposizione su cui si assegnano le quote.</p>
          {lotto.vincoloPrestazionePrincipale ? (
            <p className={styles.vincolo}>
              Vincolo dichiarato: la prestazione principale va eseguita dalla {lotto.vincoloPrestazionePrincipale.esecutore} per almeno il {formattaPercentuale(lotto.vincoloPrestazionePrincipale.quotaMinima)}.{' '}
              <Fonte fonte={lotto.vincoloPrestazionePrincipale.fonte} />
            </p>
          ) : null}
        </div>
      ) : (
        <p className={styles.nota}>Lotto non trovato nel bando: seleziona un lotto dall'elenco sopra.</p>
      )}
    </section>
  );
}
