// I quesiti aperti: tutto ciò che va chiesto alla stazione appaltante, in un
// posto solo, con il termine. Il motore li scrive già come frasi complete,
// con il requisito dentro, perché si possano inviare così come sono; qui si
// raccolgono dai rimedi di ogni requisito, nell'ordine del lotto.
//
// I giudizi che restano al concorrente non stanno qui: la stazione appaltante
// non può rispondere su cosa c'è nel fascicolo di chi partecipa.

import { descriviTermine, formattaNumeroQuesiti } from '../descrizioni';
import type { Lotto, Rimedio } from '../domain';
import styles from './QuesitiAperti.module.css';

type Props = {
  lotto: Lotto;
  rimediPerRequisito: Map<string, Rimedio[]> | 'in_calcolo';
};

type Richiesta = Extract<Rimedio, { tipo: 'richiesta_chiarimenti' }>;

export function QuesitiAperti({ lotto, rimediPerRequisito }: Props) {
  if (rimediPerRequisito === 'in_calcolo') {
    return (
      <section aria-labelledby="titolo-quesiti" className={styles.card} aria-busy="true">
        <h2 id="titolo-quesiti">Quesiti aperti</h2>
        <p className={styles.tenue} role="status">Calcolo dei quesiti in corso…</p>
      </section>
    );
  }

  const gruppi = lotto.requisiti.flatMap((requisito) => {
    const richieste = (rimediPerRequisito.get(requisito.id) ?? []).filter((r): r is Richiesta => r.tipo === 'richiesta_chiarimenti');
    const quesiti = richieste.flatMap((r) => r.quesiti);
    return quesiti.length > 0 ? [{ requisito, quesiti, richiesta: richieste[0]! }] : [];
  });

  if (gruppi.length === 0) {
    return (
      <section aria-labelledby="titolo-quesiti" className={styles.card}>
        <h2 id="titolo-quesiti">Quesiti aperti</h2>
        <p className={styles.tenue}>Nessun quesito da porre: su ogni requisito il documento decide, o il dubbio resta al concorrente.</p>
      </section>
    );
  }

  const { termine, decorso } = gruppi[0]!.richiesta;
  const totale = gruppi.reduce((n, g) => n + g.quesiti.length, 0);
  let numero = 0;

  return (
    <section aria-labelledby="titolo-quesiti" className={styles.card}>
      <div className={styles.testata}>
        <h2 id="titolo-quesiti">Quesiti aperti</h2>
        <p className={decorso ? styles.decorso : styles.termine}>
          {termine === undefined
            ? `${formattaNumeroQuesiti(totale)} per la stazione appaltante: il bando non fissa un termine per i chiarimenti.`
            : decorso
              ? `${formattaNumeroQuesiti(totale)} che andavano posti ${descriviTermine(termine)}: il termine è decorso, e le ambiguità restano a rischio del concorrente.`
              : `${formattaNumeroQuesiti(totale)} da inviare alla stazione appaltante ${descriviTermine(termine)}.`}
        </p>
      </div>
      {gruppi.map(({ requisito, quesiti }) => {
        const inizio = numero + 1;
        numero += quesiti.length;
        return (
          <div key={requisito.id} className={styles.gruppo}>
            <h3 className={styles.requisito}>{requisito.nomeBreve}</h3>
            <ol className={styles.elenco} start={inizio}>
              {quesiti.map((q) => <li key={q}>{q}</li>)}
            </ol>
          </div>
        );
      })}
    </section>
  );
}
