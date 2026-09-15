// La pagina del formato: ciò che dimostra a chi arriva che lo strumento non è
// cucito su una gara. Dice cosa è il formato, ne mostra la forma — generata
// dagli stessi validatori che controllano i file, così non può divergere —
// poi un estratto vero con le note, e sotto il file completo.

import { useEffect, useState } from 'react';
import { estratto, stampaCompatta } from '../documenti/estratto';
import { FORMA_BANDO, FORMA_FASCICOLI } from '../documenti/formato';
import type { Scarica } from '../documenti/carica';
import type { Forma } from '../documenti/struttura';
import styles from './SchermataFormato.module.css';

type Esempio = { url: string; documento: string };

type Props = {
  esempioBando: Esempio | undefined;
  esempioFascicoli: Esempio | undefined;
  scarica: Scarica;
  onTorna: () => void;
};

function elencaValori(valori: (string | number | boolean)[]): string {
  return valori.map((v) => `«${String(v)}»`).join(', ');
}

/** La forma in parole, per ciò che sta su una riga; oggetti e unioni si aprono sotto. */
function inParole(forma: Forma): string {
  switch (forma.tipo) {
    case 'testo': return 'testo';
    case 'numero': return 'numero';
    case 'booleano': return 'true o false';
    case 'letterale': return forma.valori.length === 1 ? elencaValori(forma.valori) : `uno tra ${elencaValori(forma.valori)}`;
    case 'elenco': return `elenco${forma.nonVuoto ? ' non vuoto' : ''} di ${inParole(forma.di)}`;
    case 'oggetto': return 'oggetto';
    case 'unione': return `oggetto, la cui forma la sceglie «${forma.chiave}»`;
    case 'alternativa': return forma.opzioni.map(inParole).join(', oppure ');
  }
}

/**
 * Le forme già scritte per intero, per chiave strutturale: la seconda volta
 * che compare la stessa forma (una fonte, un dato con la sua fonte) si
 * richiama per nome invece di ripeterla, e la struttura vera resta visibile.
 */
type Visti = Map<string, string>;

function Sotto({ forma, visti }: { forma: Forma; visti: Visti }) {
  const interna = forma.tipo === 'elenco' ? forma.di : forma;
  if (interna.tipo === 'oggetto') return <Campi forma={interna} visti={visti} />;
  if (interna.tipo === 'unione') {
    return (
      <ul className={styles.albero}>
        {interna.varianti.map((v) => (
          <li key={v.valore}>
            <details className={styles.variante}>
              <summary><code>{interna.chiave}: «{v.valore}»</code></summary>
              {v.forma.tipo === 'oggetto' ? <Campi forma={{ ...v.forma, campi: v.forma.campi.filter((c) => c.nome !== interna.chiave) }} visti={visti} /> : null}
            </details>
          </li>
        ))}
      </ul>
    );
  }
  if (interna.tipo === 'alternativa') {
    const oggetto = interna.opzioni.find((o) => o.tipo === 'oggetto');
    return oggetto ? <Campi forma={oggetto as Extract<Forma, { tipo: 'oggetto' }>} visti={visti} /> : null;
  }
  return null;
}

function Campi({ forma, visti }: { forma: Extract<Forma, { tipo: 'oggetto' }>; visti: Visti }) {
  if (forma.campi.length === 0) return null;
  return (
    <ul className={styles.albero}>
      {forma.campi.map((c) => {
        const interna = c.forma.tipo === 'elenco' ? c.forma.di : c.forma;
        const chiave = interna.tipo === 'oggetto' && interna.campi.length > 1 ? JSON.stringify(interna) : undefined;
        const gia = chiave ? visti.get(chiave) : undefined;
        if (chiave && !gia) visti.set(chiave, c.nome);
        return (
          <li key={c.nome}>
            <span className={styles.campo}>
              <code className={styles.nome}>{c.nome}</code>
              {c.facoltativo ? <span className={styles.facoltativo}>facoltativo</span> : null}
              <span className={styles.tipo}>{inParole(c.forma)}{gia ? `, come «${gia}» sopra` : ''}</span>
            </span>
            {gia ? null : <Sotto forma={c.forma} visti={visti} />}
          </li>
        );
      })}
    </ul>
  );
}

function useTesto(url: string | undefined, scarica: Scarica): { stato: 'attesa' } | { stato: 'pronto'; testo: string } | { stato: 'errore' } {
  const [stato, setStato] = useState<{ stato: 'attesa' } | { stato: 'pronto'; testo: string } | { stato: 'errore' }>({ stato: 'attesa' });
  useEffect(() => {
    if (!url) return;
    let attivo = true;
    scarica(url)
      .then(async (r) => (r.ok ? { stato: 'pronto' as const, testo: await r.text() } : { stato: 'errore' as const }))
      .catch(() => ({ stato: 'errore' as const }))
      .then((s) => {
        if (attivo) setStato(s);
      });
    return () => {
      attivo = false;
    };
  }, [url, scarica]);
  return stato;
}

function Estratto({ esempio, scarica }: { esempio: Esempio; scarica: Scarica }) {
  const file = useTesto(esempio.url, scarica);
  if (file.stato === 'attesa') return <p className={styles.tenue} role="status">Caricamento del documento…</p>;
  if (file.stato === 'errore') return <p className={styles.tenue}>Il documento di esempio non si è potuto leggere dal server.</p>;
  let parziale: string;
  try {
    parziale = stampaCompatta(estratto(JSON.parse(file.testo)));
  } catch {
    parziale = file.testo;
  }
  const righe = file.testo.split('\n').length;
  return (
    <>
      <pre className={styles.codice} aria-label="Estratto del documento">{parziale}</pre>
      <details className={styles.completo}>
        <summary>Il file completo, {righe} righe</summary>
        <pre className={`${styles.codice} ${styles.lungo}`} aria-label="File completo">{file.testo}</pre>
      </details>
      <a className={styles.link} href={esempio.url} target="_blank" rel="noreferrer">Apri il file JSON così com'è</a>
    </>
  );
}

export function SchermataFormato({ esempioBando, esempioFascicoli, scarica, onTorna }: Props) {
  return (
    <main className={styles.pagina}>
      <p>
        <button type="button" className={styles.torna} onClick={onTorna}>← Torna alla scelta</button>
      </p>

      <header className={styles.intro}>
        <h1 className={styles.titolo}>Il formato dei requisiti strutturati</h1>
        <p className={styles.lead}>
          È ciò che il motore di valutazione riceve: i requisiti di un bando già strutturati, prodotti a valle
          dell'estrazione dal documento di gara. L'estrazione questo progetto non la fa, per scelta. Chiunque
          produca un file in questa forma può far valutare il proprio bando.
        </p>
        <ul className={styles.fatti}>
          <li><strong>Ogni valore porta la sua fonte:</strong> documento, riferimento e pagina.</li>
          <li><strong>Le note spiegano le scelte:</strong> il campo <code>note</code>, su qualunque oggetto, associa a un campo il testo che lo motiva — l'articolo, la pagina, il perché. Ogni chiave deve essere un campo di quell'oggetto. Il motore non le legge.</li>
          <li><strong>Il documento che non decide si scrive com'è:</strong> una regola non dichiarata, più letture di un requisito, più candidati per lo stesso valore.</li>
          <li><strong>Il controllo è severo:</strong> un campo mancante, di tipo sbagliato o in più è un errore, con il percorso e il nome vicino quando uno è scritto male.</li>
        </ul>
      </header>

      <section className={styles.card} aria-labelledby="titolo-forma-bando">
        <h2 id="titolo-forma-bando">La forma di un bando</h2>
        <p className={styles.tenue}>Generata dagli stessi controlli che leggono i file: quello che c'è scritto qui è quello che il controllo pretende.</p>
        {FORMA_BANDO.tipo === 'oggetto' ? <Campi forma={FORMA_BANDO} visti={new Map()} /> : null}
      </section>

      <section className={styles.card} aria-labelledby="titolo-estratto">
        <h2 id="titolo-estratto">Un estratto vero{esempioBando ? `: ${esempioBando.documento}` : ''}</h2>
        <p className={styles.tenue}>
          Di ogni elenco resta un elemento, quello con più note; il resto è nel file completo, sotto.
        </p>
        {esempioBando ? <Estratto esempio={esempioBando} scarica={scarica} /> : <p className={styles.tenue}>Nessun bando di esempio disponibile sul server.</p>}
      </section>

      <section className={styles.card} aria-labelledby="titolo-forma-fascicoli">
        <h2 id="titolo-forma-fascicoli">I fascicoli delle imprese</h2>
        <p className={styles.tenue}>
          Stessa intestazione, e al posto del bando l'elenco dei soggetti, ciascuno con i fatti del suo fascicolo.
        </p>
        <details className={styles.completo}>
          <summary>La forma dei fascicoli</summary>
          {FORMA_FASCICOLI.tipo === 'oggetto' ? <Campi forma={FORMA_FASCICOLI} visti={new Map()} /> : null}
        </details>
        {esempioFascicoli ? <a className={styles.link} href={esempioFascicoli.url} target="_blank" rel="noreferrer">Apri un esempio: {esempioFascicoli.documento}</a> : null}
      </section>
    </main>
  );
}
