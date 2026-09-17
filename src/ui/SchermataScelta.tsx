// La schermata iniziale: un input, non un esito. Dice in breve cosa fa lo
// strumento e cosa non fa, poi chiede cosa valutare — quale gara, quali
// imprese, chi è la mandataria — e da lì si entra nell'esito.
//
// Il caricamento da disco sta sotto le gare disponibili, nella stessa card:
// è ciò che rende lo strumento capace di valutare un bando qualunque, non
// solo quelli che ha già.

import { useId } from 'react';
import type { Caricato } from '../documenti/carica';
import { contaErrori } from '../documenti/messaggi';
import { fraseDataRiferimento } from '../descrizioni';
import { formattaData } from '../formato';
import {
  cosaManca,
  impreseDisponibili,
  includiImpresa,
  scegliMandataria,
  type EsitoCaricamento,
  type Scelta,
  type VoceBando,
  type VoceFascicoli,
} from '../scelta';
import { ErroreDocumento } from './ErroreDocumento';
import styles from './SchermataScelta.module.css';

type NonValido = Extract<Caricato<unknown>, { stato: 'non_valido' }>;

type Props = {
  bandi: VoceBando[];
  fascicoli: VoceFascicoli[];
  /** Documenti del server che non sono né bandi né fascicoli: l'indice, se è rotto. */
  altri: Caricato<unknown>[];
  scelta: Scelta;
  onScelta: (scelta: Scelta) => void;
  ultimoCaricamento: EsitoCaricamento | undefined;
  onFile: (file: File) => void;
  /** L'indirizzo della pagina del formato: un link vero, che si apre anche in un'altra scheda. */
  indirizzoFormato: string;
  onFormato: () => void;
  /** Oggi, per dichiarare da quando parte la valutazione di un bando senza data proposta. */
  oggi: string;
  onValuta: () => void;
};

function nonValido(c: Caricato<unknown>): c is NonValido {
  return c.stato === 'non_valido';
}

function Gara({ voce, scelta, onScelta, oggi }: { voce: VoceBando; scelta: Scelta; onScelta: Props['onScelta']; oggi: string }) {
  if (voce.caricato.stato !== 'valido') return null;
  const { bando, provenienza } = voce.caricato.documento;
  const requisiti = bando.lotti.reduce((n, l) => n + l.requisiti.length, 0);
  const selezionata = scelta.bando === voce.chiave;
  return (
    <li className={`${styles.gara} ${selezionata ? styles.garaScelta : ''}`}>
      <label className={styles.garaEtichetta}>
        <input type="radio" name="gara" className={styles.radio} checked={selezionata} onChange={() => onScelta({ ...scelta, bando: voce.chiave })} />
        <span className={styles.garaTesto}>
          <span className={styles.garaOggetto}>{bando.oggetto}</span>
          <span className={styles.garaDati}>
            <span>{bando.stazioneAppaltante}</span>
            <span>{bando.lotti.length === 1 ? '1 lotto' : `${bando.lotti.length} lotti`}</span>
            <span>{requisiti === 1 ? '1 requisito' : `${requisiti} requisiti`}</span>
            <span>offerte entro il {formattaData(bando.terminePresentazione)}</span>
          </span>
          <span className={styles.garaProvenienza}>
            {provenienza.natura === 'reale' ? 'Bando reale' : 'Bando di esempio'}
            {voce.origine === 'disco' ? ` · dal tuo computer: ${voce.caricato.file}` : ''}
          </span>
          <span className={styles.garaData}>
            {voce.dataRiferimentoProposta !== undefined
              ? fraseDataRiferimento(voce.dataRiferimentoProposta, { motivo: voce.motivoDataProposta })
              : fraseDataRiferimento(oggi, undefined)}
          </span>
        </span>
      </label>
    </li>
  );
}

function Caricamento({ ultimo, onFile, indirizzoFormato, onFormato }: { ultimo: EsitoCaricamento | undefined; onFile: Props['onFile']; indirizzoFormato: string; onFormato: () => void }) {
  const idSpiegazione = useId();
  return (
    <section className={styles.carica} aria-labelledby={`${idSpiegazione}-titolo`}>
      <div className={styles.caricaTesto}>
        <h3 id={`${idSpiegazione}-titolo`} className={styles.caricaTitolo}>Valuta un altro bando</h3>
        <p id={idSpiegazione} className={styles.caricaSpiegazione}>
          Carica un file JSON con i requisiti strutturati di un bando, oppure con i fascicoli delle tue imprese.
          Il file si legge nel tuo browser e non viene inviato a nessuno.
        </p>
      </div>
      <div className={styles.caricaAzioni}>
        {/* Prima del bottone: chi arriva deve vedere che lo strumento legge un formato, non una gara. */}
        <a
          className={styles.formato}
          href={indirizzoFormato}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            onFormato();
          }}
        >
          <span className={styles.formatoTitolo}>Il formato che il motore si aspetta</span>
          <span className={styles.formatoTesto}>
            I requisiti strutturati di un bando: la forma dei campi, un estratto vero con le note che citano articolo e pagina, e il file completo.
          </span>
        </a>
        <label className={styles.bottoneFile}>
          Scegli un file JSON
          <input
            type="file"
            accept=".json,application/json"
            className="nascosto"
            aria-describedby={idSpiegazione}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>
      <div aria-live="polite" className={styles.caricaEsito}>
        {ultimo?.tipo === 'bando' ? (
          <p className={styles.caricato}>Bando caricato da {ultimo.file} e scelto: «{ultimo.oggetto}».</p>
        ) : null}
        {ultimo?.tipo === 'fascicoli' ? (
          <p className={styles.caricato}>Fascicoli caricati da {ultimo.file}: {ultimo.imprese === 1 ? '1 impresa aggiunta' : `${ultimo.imprese} imprese aggiunte`} all'elenco.</p>
        ) : null}
      </div>
    </section>
  );
}

function DocumentoNonUtilizzabile({ documento }: { documento: NonValido }) {
  return (
    <li className={styles.nonUtilizzabile}>
      <details>
        <summary>
          <span className={styles.file}>{documento.file}</span> non è utilizzabile: {contaErrori(documento.errori.length)}
        </summary>
        <ErroreDocumento documento={documento} />
      </details>
    </li>
  );
}

export function SchermataScelta({ bandi, fascicoli, altri, scelta, onScelta, ultimoCaricamento, onFile, indirizzoFormato, onFormato, oggi, onValuta }: Props) {
  const imprese = impreseDisponibili(fascicoli);
  const manca = cosaManca(scelta, bandi, imprese);
  const idManca = useId();
  const bandiValidi = bandi.filter((b) => b.caricato.stato === 'valido');
  const guasti = [...altri, ...bandi.map((b) => b.caricato)].filter(nonValido);
  const fascicoliGuasti = fascicoli.map((f) => f.caricato).filter(nonValido);

  return (
    <main className={styles.pagina}>
      <div className={styles.intro}>
        <h1 className={styles.titolo}>Il raggruppamento può partecipare alla gara?</h1>
        <div className={styles.cosaFa}>
          <div>
            <h2 className={styles.etichetta}>Cosa fa</h2>
            <p>
              Dati i requisiti di un bando e i fascicoli delle imprese, dice chi copre cosa, quanto manca,
              cosa chiedere alla stazione appaltante e quali mosse rendono il raggruppamento ammissibile.
              Ogni valore porta la sua fonte.
            </p>
          </div>
          <div>
            <h2 className={styles.etichetta}>Cosa non fa</h2>
            <p>
              Non legge il documento di gara: riceve i requisiti già strutturati. Non verifica che i fascicoli
              siano veri e non sostituisce la lettura del disciplinare.
            </p>
          </div>
        </div>
      </div>

      <section className={styles.card} aria-labelledby="titolo-scelta-gara">
        <h2 id="titolo-scelta-gara" className={styles.passo}><span className={styles.numero} aria-hidden="true">1</span>Gara</h2>
        <div className={styles.gare}>
          {bandiValidi.length > 0 ? (
            <ul className={styles.elenco} aria-label="Gare disponibili">
              {bandiValidi.map((v) => <Gara key={v.chiave} voce={v} scelta={scelta} onScelta={onScelta} oggi={oggi} />)}
            </ul>
          ) : (
            <p className={styles.vuoto}>Nessuna gara disponibile: caricane una dal tuo computer.</p>
          )}
          {guasti.length > 0 ? (
            <ul className={styles.elenco} aria-label="Documenti non utilizzabili">
              {guasti.map((d) => <DocumentoNonUtilizzabile key={d.file} documento={d} />)}
            </ul>
          ) : null}
        </div>
        <Caricamento ultimo={ultimoCaricamento} onFile={onFile} indirizzoFormato={indirizzoFormato} onFormato={onFormato} />
        {/* Gli errori di un file caricato stanno a tutta larghezza: sono da leggere, non da intravedere. */}
        <div aria-live="polite">
          {ultimoCaricamento?.tipo === 'errori' ? (
            <div className={styles.erroriCaricamento}>
              <ErroreDocumento documento={ultimoCaricamento.caricato} />
            </div>
          ) : null}
        </div>
      </section>

      <section className={styles.card} aria-labelledby="titolo-scelta-imprese">
        <h2 id="titolo-scelta-imprese" className={styles.passo}><span className={styles.numero} aria-hidden="true">2</span>Raggruppamento</h2>
        {imprese.length > 0 ? (
          <fieldset className={styles.imprese}>
            <legend className={styles.legenda}>
              <span>Imprese</span>
              <span>Mandataria</span>
            </legend>
            <ul className={styles.elenco}>
              {imprese.map(({ soggetto, voce }) => {
                const inclusa = scelta.imprese.includes(soggetto.id);
                const natura = voce.caricato.documento.provenienza.natura;
                return (
                  <li key={soggetto.id} className={`${styles.impresa} ${inclusa ? styles.impresaInclusa : ''}`}>
                    <label className={styles.impresaEtichetta}>
                      <input type="checkbox" className={styles.spunta} checked={inclusa} onChange={(e) => onScelta(includiImpresa(scelta, soggetto.id, e.target.checked))} />
                      <span className={styles.impresaTesto}>
                        <span className={styles.impresaNome}>{soggetto.denominazione}</span>
                        <span className={styles.impresaDati}>
                          {soggetto.fascicolo.length === 1 ? '1 voce di fascicolo' : `${soggetto.fascicolo.length} voci di fascicolo`}
                          {natura === 'esempio' ? ', di esempio' : ''}
                          {voce.origine === 'disco' ? ` · dal tuo computer: ${voce.caricato.file}` : ''}
                        </span>
                      </span>
                    </label>
                    <label className={styles.mandataria}>
                      <input
                        type="radio"
                        name="mandataria"
                        className={styles.radio}
                        checked={scelta.mandataria === soggetto.id}
                        onChange={() => onScelta(scegliMandataria(scelta, soggetto.id))}
                      />
                      <span className="nascosto">Mandataria: {soggetto.denominazione}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : (
          <p className={styles.vuoto}>Nessuna impresa disponibile: carica i fascicoli dal tuo computer.</p>
        )}
        {fascicoliGuasti.length > 0 ? (
          <ul className={styles.elenco} aria-label="Fascicoli non utilizzabili">
            {fascicoliGuasti.map((d) => <DocumentoNonUtilizzabile key={d.file} documento={d} />)}
          </ul>
        ) : null}
        <p className={styles.nota}>
          Le quote partono in parti uguali, con l'arrotondamento alla mandataria. Si cambiano nell'esito.
        </p>
      </section>

      <div className={styles.azione}>
        <button type="button" className={styles.valuta} disabled={manca !== undefined} aria-describedby={manca ? idManca : undefined} onClick={onValuta}>
          Valuta il raggruppamento
        </button>
        {manca ? <p id={idManca} className={styles.manca}>{manca}</p> : null}
      </div>
    </main>
  );
}
