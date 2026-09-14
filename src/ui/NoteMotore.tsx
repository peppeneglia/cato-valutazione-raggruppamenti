// Il contorno dell'esito in un solo pannello chiuso: avvisi di scadenza,
// segnalazioni, assunzioni del motore, perimetro. L'intestazione conta
// cosa c'è dentro. Le anomalie bloccanti non stanno qui: cambiano la
// risposta alla domanda principale e salgono accanto al verdetto.

import { titoloNote, type ContestoDescrizioni } from '../descrizioni';
import type { Anomalia, AvvisoScadenza } from '../domain';
import { Anomalie } from './Anomalie';
import { Assunzioni } from './Assunzioni';
import { Avvisi } from './Avvisi';
import type { Legenda } from './legenda';
import { NonValutato } from './NonValutato';
import styles from './NoteMotore.module.css';

type Props = {
  avvisi: AvvisoScadenza[];
  anomalie: Anomalia[];
  legenda: Legenda;
  terminePresentazione: string;
  orizzonteGiorni: number;
  contesto: ContestoDescrizioni;
};

export function NoteMotore({ avvisi, anomalie, legenda, terminePresentazione, orizzonteGiorni, contesto }: Props) {
  const segnalazioni = anomalie.filter((a) => a.gravita === 'segnalazione');
  return (
    <details className={styles.pannello}>
      <summary className={styles.titolo}>
        {titoloNote({ scadenze: avvisi.length, segnalazioni: segnalazioni.length, assunzioni: legenda.length })}
      </summary>
      <div className={styles.contenuto}>
        <Avvisi avvisi={avvisi} terminePresentazione={terminePresentazione} orizzonteGiorni={orizzonteGiorni} contesto={contesto} />
        <Anomalie anomalie={segnalazioni} contesto={contesto} />
        <Assunzioni legenda={legenda} />
        <NonValutato />
      </div>
    </details>
  );
}
