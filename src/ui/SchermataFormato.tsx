// La pagina del formato: ciò che dimostra a chi arriva che lo strumento non è
// cucito su una gara. Dice cosa è il formato, ne mostra la forma — generata
// dagli stessi validatori che controllano i file, così non può divergere —
// poi un estratto vero con le note, e sotto il file completo.

import { useEffect, useMemo, useState } from 'react';
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

type Oggetto = Extract<Forma, { tipo: 'oggetto' }>;

/**
 * I rimandi: per ogni campo (identificato dal suo percorso nell'albero) il
 * nome del campo che ha già scritto per intero la stessa forma. La seconda
 * volta che compare la stessa forma (una fonte, un dato con la sua fonte)
 * si richiama per nome invece di ripeterla, e la struttura vera resta
 * visibile. Si calcola prima di disegnare, visitando l'albero nello stesso
 * ordine in cui viene disegnato: il rendering non tiene stato, e in
 * StrictMode produce lo stesso albero.
 */
type Rimandi = ReadonlyMap<string, string>;

function percorsoDi(sopra: string, nome: string): string {
  return `${sopra}/${nome}`;
}

function chiaveStrutturale(forma: Forma): string | undefined {
  const interna = forma.tipo === 'elenco' ? forma.di : forma;
  return interna.tipo === 'oggetto' && interna.campi.length > 1 ? JSON.stringify(interna) : undefined;
}

/** L'oggetto che si apre sotto una forma, se ce n'è uno; le varianti di un'unione si aprono una per una. */
function sottoForma(forma: Forma): { oggetto: Oggetto } | { unione: Extract<Forma, { tipo: 'unione' }> } | undefined {
  const interna = forma.tipo === 'elenco' ? forma.di : forma;
  if (interna.tipo === 'oggetto') return { oggetto: interna };
  if (interna.tipo === 'unione') return { unione: interna };
  if (interna.tipo === 'alternativa') {
    const oggetto = interna.opzioni.find((o): o is Oggetto => o.tipo === 'oggetto');
    return oggetto ? { oggetto } : undefined;
  }
  return undefined;
}

function senzaChiave(unione: Extract<Forma, { tipo: 'unione' }>, variante: Oggetto): Oggetto {
  return { ...variante, campi: variante.campi.filter((c) => c.nome !== unione.chiave) };
}

function raccogliRimandi(radice: Forma): Rimandi {
  const visti = new Map<string, string>();
  const rimandi = new Map<string, string>();
  const visitaCampi = (oggetto: Oggetto, sopra: string) => {
    for (const c of oggetto.campi) {
      const percorso = percorsoDi(sopra, c.nome);
      const chiave = chiaveStrutturale(c.forma);
      if (chiave) {
        const gia = visti.get(chiave);
        if (gia) {
          rimandi.set(percorso, gia);
          continue;
        }
        visti.set(chiave, c.nome);
      }
      visitaSotto(c.forma, percorso);
    }
  };
  const visitaSotto = (forma: Forma, sopra: string) => {
    const sotto = sottoForma(forma);
    if (!sotto) return;
    if ('oggetto' in sotto) {
      visitaCampi(sotto.oggetto, sopra);
      return;
    }
    for (const v of sotto.unione.varianti) {
      if (v.forma.tipo === 'oggetto') visitaCampi(senzaChiave(sotto.unione, v.forma), percorsoDi(sopra, v.valore));
    }
  };
  if (radice.tipo === 'oggetto') visitaCampi(radice, '');
  return rimandi;
}

type PropsAlbero = { rimandi: Rimandi; sopra: string };

function Sotto({ forma, rimandi, sopra }: { forma: Forma } & PropsAlbero) {
  const sotto = sottoForma(forma);
  if (!sotto) return null;
  if ('oggetto' in sotto) return <Campi forma={sotto.oggetto} rimandi={rimandi} sopra={sopra} />;
  return (
    <ul className={styles.albero}>
      {sotto.unione.varianti.map((v) => (
        <li key={v.valore}>
          <details className={styles.variante}>
            <summary><code>{sotto.unione.chiave}: «{v.valore}»</code></summary>
            {v.forma.tipo === 'oggetto' ? <Campi forma={senzaChiave(sotto.unione, v.forma)} rimandi={rimandi} sopra={percorsoDi(sopra, v.valore)} /> : null}
          </details>
        </li>
      ))}
    </ul>
  );
}

function Campi({ forma, rimandi, sopra }: { forma: Oggetto } & PropsAlbero) {
  if (forma.campi.length === 0) return null;
  return (
    <ul className={styles.albero}>
      {forma.campi.map((c) => {
        const percorso = percorsoDi(sopra, c.nome);
        const gia = rimandi.get(percorso);
        return (
          <li key={c.nome}>
            <span className={styles.campo}>
              <code className={styles.nome}>{c.nome}</code>
              {c.facoltativo ? <span className={styles.facoltativo}>facoltativo</span> : null}
              <span className={styles.tipo}>{inParole(c.forma)}{gia ? `, come «${gia}» sopra` : ''}</span>
            </span>
            {gia ? null : <Sotto forma={c.forma} rimandi={rimandi} sopra={percorso} />}
          </li>
        );
      })}
    </ul>
  );
}

/** La forma di un documento, ad albero, con i rimandi già calcolati. */
function Albero({ forma }: { forma: Forma }) {
  const rimandi = useMemo(() => raccogliRimandi(forma), [forma]);
  return forma.tipo === 'oggetto' ? <Campi forma={forma} rimandi={rimandi} sopra="" /> : null;
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

      <div className={styles.intro}>
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
      </div>

      <section className={styles.card} aria-labelledby="titolo-forma-bando">
        <h2 id="titolo-forma-bando">La forma di un bando</h2>
        <p className={styles.tenue}>Generata dagli stessi controlli che leggono i file: quello che c'è scritto qui è quello che il controllo pretende.</p>
        <Albero forma={FORMA_BANDO} />
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
          <Albero forma={FORMA_FASCICOLI} />
        </details>
        {esempioFascicoli ? <a className={styles.link} href={esempioFascicoli.url} target="_blank" rel="noreferrer">Apri un esempio: {esempioFascicoli.documento}</a> : null}
      </section>
    </main>
  );
}
