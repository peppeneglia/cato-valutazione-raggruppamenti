// Il perimetro dello strumento, dichiarato. Non è una scusa: è ciò che
// questo strumento fa e ciò che non fa, perché chi lo usa sappia cosa
// sta guardando.

import styles from './NonValutato.module.css';

const VOCI: { titolo: string; testo: string }[] = [
  {
    titolo: 'Requisiti generali: verifica che la dichiarazione esista, non che sia vera',
    testo: 'Per l’assenza di cause di esclusione lo strumento controlla che ogni membro abbia reso la dichiarazione (DGUE). Non verifica che quanto dichiarato corrisponda al vero: casellario, regolarità contributiva e fiscale, misure interdittive sono accertamenti che si fanno altrove.',
  },
  {
    titolo: 'Giudizi di equivalenza',
    testo: 'Se lo scope di una certificazione, l’attività di un’iscrizione o il CPV di una referenza non coincidono con quelli richiesti, lo strumento dice «da verificare» e si ferma. L’equivalenza la giudica una persona, con il disciplinare in mano.',
  },
  {
    titolo: 'Capacità tecnica non documentale',
    testo: 'Organico medio, attrezzature, sedi operative e ogni requisito che non si esprime come un fatto del fascicolo (dichiarazione, fatturato, certificazione, servizio eseguito, iscrizione) non sono modellati e vanno verificati a parte.',
  },
  {
    titolo: 'Subappalto',
    testo: 'Il subappalto è un flusso a valle della partecipazione e non entra nella valutazione dell’ammissibilità del raggruppamento.',
  },
  {
    titolo: 'Lettura del disciplinare',
    testo: 'Requisiti, regole di composizione, soglie e finestre arrivano già strutturati: lo strumento non legge il PDF del disciplinare. Ciò che vedi è un modello del documento, non il documento: non sostituisce la sua lettura.',
  },
];

export function NonValutato() {
  return (
    <section aria-labelledby="titolo-perimetro" className={styles.sezione}>
      <h2 id="titolo-perimetro">Cosa questo strumento non valuta</h2>
      <dl className={styles.elenco}>
        {VOCI.map((v) => (
          <div key={v.titolo} className={styles.voce}>
            <dt>{v.titolo}</dt>
            <dd>{v.testo}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
