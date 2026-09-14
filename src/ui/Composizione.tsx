// La composizione del raggruppamento: membri × prestazioni del lotto,
// ruoli e quote editabili, ingresso e uscita. Nessuna somma: se le quote
// non tornano lo dice un'anomalia del motore, con il link alla prestazione.

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

function RigaEsecutore({ membro, lotto, contesto, dispatch }: { membro: Extract<Membro, { ruolo: RuoloEsecutore }>; lotto: Lotto; contesto: ContestoDescrizioni; dispatch: Props['dispatch'] }) {
  const nome = nomeSoggetto(membro.soggettoId, contesto);
  return (
    <tr id={`membro-${membro.soggettoId}`}>
      <th scope="row" className={styles.nome}>{nome}</th>
      <td>
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
      </td>
      {lotto.prestazioni.map((p) => (
        <td key={p.id} className={styles.quota}>
          <InputQuota
            etichetta={`Quota di ${nome} su ${p.descrizione}`}
            quota={membro.quote[p.id] ?? 0}
            onQuota={(quota) => dispatch({ tipo: 'imposta_quota', soggettoId: membro.soggettoId, prestazioneId: p.id, quota })}
          />
        </td>
      ))}
      <td>
        <button type="button" className={styles.azione} onClick={() => dispatch({ tipo: 'rimuovi_membro', soggettoId: membro.soggettoId })}>
          Rimuovi
        </button>
      </td>
    </tr>
  );
}

function RigaAusiliaria({ membro, lotto, contesto, dispatch }: { membro: Extract<Membro, { ruolo: 'ausiliaria' }>; lotto: Lotto; contesto: ContestoDescrizioni; dispatch: Props['dispatch'] }) {
  const nome = nomeSoggetto(membro.soggettoId, contesto);
  return (
    <tr id={`membro-${membro.soggettoId}`} className={styles.ausiliaria}>
      <th scope="row" className={styles.nome}>{nome}</th>
      <td>{etichettaRuolo('ausiliaria')}</td>
      <td colSpan={lotto.prestazioni.length} className={styles.dettaglioAusiliaria}>
        A favore di {nomeSoggetto(membro.ausiliataId, contesto)} per: {membro.requisitiIds.length === 0 ? 'nessun requisito indicato' : membro.requisitiIds.map((id) => nomeRequisito(id, contesto)).join('; ')}
      </td>
      <td>
        <button type="button" className={styles.azione} onClick={() => dispatch({ tipo: 'rimuovi_membro', soggettoId: membro.soggettoId })}>
          Rimuovi
        </button>
      </td>
    </tr>
  );
}

export function Composizione({ lotto, raggruppamento, soggetti, contesto, dispatch }: Props) {
  return (
    <section aria-labelledby="titolo-composizione" className={styles.sezione}>
      <h2 id="titolo-composizione">Composizione del raggruppamento</h2>
      {lotto ? (
        <table className={styles.tabella}>
          <caption className={styles.didascalia}>
            Quote di esecuzione in percento per ogni prestazione del lotto. Le quote su altri lotti non compaiono qui e non contano qui.
          </caption>
          <thead>
            <tr>
              <th scope="col">Soggetto</th>
              <th scope="col">Ruolo</th>
              {lotto.prestazioni.map((p) => (
                <th scope="col" key={p.id} className={styles.quota}>{p.descrizione}</th>
              ))}
              <th scope="col"><span className={styles.nascosto}>Azioni</span></th>
            </tr>
          </thead>
          <tbody>
            {raggruppamento.membri.map((m) =>
              m.ruolo === 'ausiliaria'
                ? <RigaAusiliaria key={m.soggettoId} membro={m} lotto={lotto} contesto={contesto} dispatch={dispatch} />
                : <RigaEsecutore key={m.soggettoId} membro={m} lotto={lotto} contesto={contesto} dispatch={dispatch} />,
            )}
          </tbody>
        </table>
      ) : null}
      {raggruppamento.membri.length === 0 ? <p className={styles.vuoto}>Il raggruppamento è vuoto: aggiungi almeno una mandataria.</p> : null}
      <AggiungiMembro raggruppamento={raggruppamento} soggetti={soggetti} dispatch={dispatch} />
      {lotto ? <AggiungiAusiliaria lotto={lotto} raggruppamento={raggruppamento} soggetti={soggetti} contesto={contesto} dispatch={dispatch} /> : null}
    </section>
  );
}
