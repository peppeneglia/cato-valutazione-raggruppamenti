// Avvisi di scadenza: documenti validi oggi che scadono prima del termine
// di presentazione o entro l'orizzonte. Non sono scoperture: sono i
// problemi di fra un mese, e vanno tenuti distinti da quelli di oggi.

import { nomeRequisito, nomeSoggetto, type ContestoDescrizioni } from '../descrizioni';
import type { AvvisoScadenza } from '../domain';
import { formattaData } from '../formato';
import { Fonte } from './Fonte';
import styles from './Avvisi.module.css';

type Props = {
  avvisi: AvvisoScadenza[];
  terminePresentazione: string;
  orizzonteGiorni: number;
  contesto: ContestoDescrizioni;
};

export function Avvisi({ avvisi, terminePresentazione, orizzonteGiorni, contesto }: Props) {
  return (
    <section aria-labelledby="titolo-avvisi" className={styles.sezione}>
      <h2 id="titolo-avvisi">Avvisi di scadenza</h2>
      <p className={styles.intro}>
        Documenti che oggi contano e che scadono prima del termine di presentazione ({formattaData(terminePresentazione)}) o entro {orizzonteGiorni} giorni dalla data di riferimento.
      </p>
      {avvisi.length === 0 ? (
        <p className={styles.vuoto}>Nessun documento usato scade prima del termine o entro l'orizzonte.</p>
      ) : (
        <ul className={styles.elenco}>
          {avvisi.map((a, i) => (
            <li key={i} className={`${styles.avviso} ${a.primaDelTermine ? styles.primaDelTermine : styles.entroOrizzonte}`}>
              <span className={styles.etichetta}>{a.primaDelTermine ? 'Prima del termine' : 'Entro l’orizzonte'}</span>
              <span className={styles.data}>{formattaData(a.scadeIl)}</span>
              <span>
                <strong>{nomeSoggetto(a.soggettoId, contesto)}</strong> · {a.descrizioneVoce}
                <span className={styles.requisiti}> — usato per: {a.requisitiIds.map((id) => `«${nomeRequisito(id, contesto)}»`).join(', ')}</span>
              </span>
              <Fonte fonte={a.fonte} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
