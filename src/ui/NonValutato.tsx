// Il perimetro dello strumento, dichiarato con la fonte. Non è una scusa:
// è ciò che questo strumento fa e ciò che non fa, perché chi lo usa
// sappia cosa sta guardando. I riferimenti sono al disciplinare di gara
// ASL Roma 6, n. 9445747.

import styles from './NonValutato.module.css';

const VOCI: { titolo: string; testo: string; fonte?: string }[] = [
  {
    titolo: 'Requisiti generali: verifica che la dichiarazione esista, non che sia vera',
    testo: 'Per l’assenza delle cause di esclusione lo strumento controlla che ogni membro abbia reso la dichiarazione (DGUE). Non verifica che quanto dichiarato corrisponda al vero: casellario, regolarità contributiva e fiscale, misure interdittive sono accertamenti che si fanno altrove. Non conta il triennio antecedente la pubblicazione del bando, di cui il documento non scrive la data.',
    fonte: 'art. 5, p. 12; §15.1, p. 22',
  },
  {
    titolo: 'Giudizi di equivalenza',
    testo: 'Se lo scope di una certificazione, l’attività di un’iscrizione o il CPV di una fornitura non coincidono con quelli richiesti, lo strumento dice «da verificare» e si ferma. L’equivalenza la giudica una persona, con il disciplinare in mano.',
  },
  {
    titolo: 'Certificazione ISO del produttore, o in corso di rilascio',
    testo: 'Il requisito parla del «proprio» sistema di qualità e insieme «del produttore o del distributore», e ammette una procedura di certificazione in atto con dichiarazione dell’ente. Lo strumento confronta solo certificazioni del concorrente già rilasciate: il resto è un’ambiguità da chiarire con la stazione appaltante.',
    fonte: '§6.3 lett. a), pp. 13–14',
  },
  {
    titolo: 'Imprese con meno di un anno di attività',
    testo: 'Il fatturato «rapportato al periodo di attività» non è modellato: il disciplinare non indica il criterio di ragguaglio.',
    fonte: '§6.2 lett. a), p. 13',
  },
  {
    titolo: 'Consorzi come entità',
    testo: 'Le regole per cui i consorzi «utilizzano i requisiti propri» o «cumulano» quelli delle consorziate non sono modellate: il raggruppamento qui è fatto di soggetti, non di consorzi con consorziate.',
    fonte: '§6.5, p. 15',
  },
  {
    titolo: 'Reti d’impresa, GEIE e sub-associazioni',
    testo: 'Le forme di partecipazione diverse dal raggruppamento temporaneo — aggregazioni di retisti con o senza organo comune, GEIE, sub-associazioni dentro un raggruppamento — hanno regole proprie che lo strumento non rappresenta.',
    fonte: 'art. 4, pp. 10–12',
  },
  {
    titolo: 'Garanzia provvisoria e sue riduzioni',
    testo: 'La riduzione del 30 % per la certificazione ISO 9000 ha, in forma associata, regole di composizione diverse da quelle dei requisiti di partecipazione: tutti i membri devono possederla. Non è un requisito e non viene valutata.',
    fonte: 'art. 10, pp. 16–18',
  },
  {
    titolo: 'Comprova tramite FVOE',
    testo: 'La stazione appaltante verifica i requisiti speciali accedendo al fascicolo virtuale dell’operatore economico. Lo strumento legge fascicoli strutturati forniti da chi lo usa, non il FVOE.',
    fonte: 'art. 6, p. 13',
  },
  {
    titolo: 'Offerta tecnica e criteri di valutazione',
    testo: 'Tempi di consegna, magazzini nel territorio, doppia consegna, ecocompatibilità dei mezzi: sono criteri di attribuzione del punteggio, non requisiti di partecipazione. Un’offerta con consegna oltre 72 ore prende zero, non è esclusa. Fuori perimetro.',
    fonte: 'art. 18, pp. 27–30',
  },
  {
    titolo: 'IVA sul fatturato',
    testo: 'Il disciplinare non precisa se il fatturato vada letto al netto o al lordo di IVA. I fascicoli di esempio sono al netto: è una convenzione dei dati, non del motore.',
    fonte: '§6.2, p. 13',
  },
  {
    titolo: 'Adempimenti e accertamenti',
    testo: 'DGUE e PASSOE dell’ausiliaria, contributo ANAC, registrazione alla piattaforma di ogni partecipante, self cleaning, divieto di partecipazione plurima, sostituzione del membro privo di requisiti: sono adempimenti e accertamenti, non requisiti valutabili sui fascicoli.',
    fonte: '§15.3, p. 24; art. 12, p. 18; §2.4, p. 9; art. 5, p. 12; art. 4, p. 10; §6.4, p. 14',
  },
  {
    titolo: 'Subappalto',
    testo: 'Il subappalto è un flusso a valle della partecipazione e non entra nella valutazione dell’ammissibilità del raggruppamento.',
    fonte: 'art. 8, p. 16',
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
            <dt>{v.titolo}{v.fonte ? <span className={styles.fonte}> — {v.fonte}</span> : null}</dt>
            <dd>{v.testo}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
