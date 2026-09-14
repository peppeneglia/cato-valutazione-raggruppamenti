// La composizione del raggruppamento, come pannello da manipolare: un
// blocco per membro con nome, ruolo e quote impilati, così sta in una
// colonna laterale e sotto il corpo a schermo stretto con lo stesso
// layout. Nessuna somma: se le quote non tornano lo dice un'anomalia del
// motore. I moduli di aggiunta stanno chiusi: si aprono quando servono.

import type { Azione } from '../lavoro';
import { etichettaRuolo, nomeRequisito, nomeSoggetto, type ContestoDescrizioni } from '../descrizioni';
import type { Lotto, Membro, Raggruppamento, RuoloEsecutore, Soggetto } from '../domain';
import { AggiungiAusiliaria } from './AggiungiAusiliaria';
import { AggiungiMembro } from './AggiungiMembro';
import { InputQuota } from './InputQuota';
import styles from './Composizione.module.css';

const RUOLI_ESECUTORI: RuoloEsecutore[] = ['mandataria', 'mandante', 'consorziata_esecutrice'];

type Props = {
  lotto: Lotto | undefined;
  raggruppamento: Raggruppamento;
  soggetti: Soggetto[];
  contesto: ContestoDescrizioni;
  dispatch: (azione: Azione) => void;
};

function BloccoEsecutore({ membro, lotto, contesto, dispatch }: { membro: Extract<Membro, { ruolo: RuoloEsecutore }>; lotto: Lotto; contesto: ContestoDescrizioni; dispatch: Props['dispatch'] }) {
  const nome = nomeSoggetto(membro.soggettoId, contesto);
  const unica = lotto.prestazioni.length === 1;
  return (
    <li id={`membro-${membro.soggettoId}`} className={styles.membro}>
      <div className={styles.testata}>
        <h3 className={styles.nome}>{nome}</h3>
        <button type="button" className={styles.rimuovi} onClick={() => dispatch({ tipo: 'rimuovi_membro', soggettoId: membro.soggettoId })}>
          Rimuovi
        </button>
      </div>
      <div className={styles.campi}>
        <select
          aria-label={`Ruolo di ${nome}`}
          value={membro.ruolo}
          className={styles.select}
          onChange={(e) => dispatch({ tipo: 'imposta_ruolo', soggettoId: membro.soggettoId, ruolo: e.target.value as RuoloEsecutore })}
        >
          {RUOLI_ESECUTORI.map((r) => (
            <option key={r} value={r}>{etichettaRuolo(r)}</option>
          ))}
        </select>
        {lotto.prestazioni.map((p) => (
          <label key={p.id} className={styles.quota}>
            {/* Con una prestazione sola il nome è già detto dal lotto: resta per chi usa un lettore di schermo. */}
            <span className={unica ? styles.nascosto : styles.prestazione}>{p.descrizione}</span>
            {unica ? <span className={styles.prestazione} aria-hidden="true">Quota</span> : null}
            <InputQuota
              etichetta={`Quota di ${nome} su ${p.descrizione}`}
              quota={membro.quote[p.id] ?? 0}
              onQuota={(quota) => dispatch({ tipo: 'imposta_quota', soggettoId: membro.soggettoId, prestazioneId: p.id, quota })}
            />
          </label>
        ))}
      </div>
    </li>
  );
}

function BloccoAusiliaria({ membro, contesto, dispatch }: { membro: Extract<Membro, { ruolo: 'ausiliaria' }>; contesto: ContestoDescrizioni; dispatch: Props['dispatch'] }) {
  return (
    <li id={`membro-${membro.soggettoId}`} className={`${styles.membro} ${styles.ausiliaria}`}>
      <div className={styles.testata}>
        <h3 className={styles.nome}>{nomeSoggetto(membro.soggettoId, contesto)}</h3>
        <button type="button" className={styles.rimuovi} onClick={() => dispatch({ tipo: 'rimuovi_membro', soggettoId: membro.soggettoId })}>
          Rimuovi
        </button>
      </div>
      <p className={styles.dettaglioAusiliaria}>
        {etichettaRuolo('ausiliaria')}. A favore di {nomeSoggetto(membro.ausiliataId, contesto)} per: {membro.requisitiIds.length === 0 ? 'nessun requisito indicato' : membro.requisitiIds.map((id) => nomeRequisito(id, contesto)).join('; ')}
      </p>
    </li>
  );
}

export function Composizione({ lotto, raggruppamento, soggetti, contesto, dispatch }: Props) {
  return (
    <section aria-labelledby="titolo-composizione" className={styles.sezione}>
      <h2 id="titolo-composizione">Composizione del raggruppamento</h2>
      {lotto && lotto.prestazioni.length === 1 && lotto.prestazioni[0]?.natura === 'indivisibile' ? (
        <p className={styles.didascalia}>Fornitura indivisibile: le quote sono la percentuale che ciascun membro esegue.</p>
      ) : (
        <p className={styles.didascalia}>Quote di esecuzione in percento per ogni prestazione del lotto.</p>
      )}
      {lotto && raggruppamento.membri.length > 0 ? (
        <ul className={styles.membri}>
          {raggruppamento.membri.map((m) =>
            m.ruolo === 'ausiliaria'
              ? <BloccoAusiliaria key={m.soggettoId} membro={m} contesto={contesto} dispatch={dispatch} />
              : <BloccoEsecutore key={m.soggettoId} membro={m} lotto={lotto} contesto={contesto} dispatch={dispatch} />,
          )}
        </ul>
      ) : null}
      {raggruppamento.membri.length === 0 ? <p className={styles.vuoto}>Aggiungi una mandataria per iniziare.</p> : null}
      <details className={styles.modulo}>
        <summary>Aggiungi un membro</summary>
        <AggiungiMembro raggruppamento={raggruppamento} soggetti={soggetti} dispatch={dispatch} />
      </details>
      {lotto ? (
        <details className={styles.modulo}>
          <summary>Aggiungi un'ausiliaria</summary>
          <AggiungiAusiliaria lotto={lotto} raggruppamento={raggruppamento} soggetti={soggetti} contesto={contesto} dispatch={dispatch} />
        </details>
      ) : null}
    </section>
  );
}
