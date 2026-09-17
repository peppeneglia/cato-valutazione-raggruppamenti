// I lotti come unità di navigazione: la domanda dell'ufficio gare è "su
// quali lotti siamo dentro". La classifica arriva dal motore sul canale
// differito; finché calcola, le celle lo dicono.

import { assertNever } from '../assertNever';
import { formattaEuro } from '../formato';
import type { Bando, LottoId, PercorsoMinimo, VoceConfronto } from '../domain';
import { VerdettoBadge } from './StatoRequisito';
import type { ValutazioneDifferita } from './useValutazioneDifferita';
import styles from './ConfrontoLotti.module.css';

function descriviPercorso(percorso: PercorsoMinimo): string {
  switch (percorso.esito) {
    case 'gia_ammissibile':
      return 'Nessuna mossa necessaria';
    case 'trovato':
      return `${percorso.mosse.length} ${percorso.mosse.length === 1 ? 'mossa' : 'mosse'}`;
    case 'inesistente':
      return 'Nessun percorso';
    case 'bloccato_da_anomalie':
      return 'Bloccato da anomalie';
    default:
      return assertNever(percorso);
  }
}

type Props = {
  bando: Bando;
  lottoId: LottoId;
  differita: ValutazioneDifferita;
  onSeleziona: (lottoId: LottoId) => void;
};

export function ConfrontoLotti({ bando, lottoId, differita, onSeleziona }: Props) {
  const classifica = new Map<LottoId, VoceConfronto<LottoId>>(differita.stato === 'pronto' ? differita.lotti.map((v) => [v.chiave, v]) : []);
  const inCalcolo = differita.stato === 'in_calcolo';

  // L'id del titolo è suo: nella vista del confronto la barra dei lotti, con il suo h2 «Lotti», sta nello stesso DOM.
  if (bando.lotti.length === 0) {
    return (
      <section aria-labelledby="titolo-confronto-lotti-tabella">
        <h2 id="titolo-confronto-lotti-tabella">Lotti</h2>
        <p className={styles.vuoto}>Il bando non ha lotti: non c'è niente da valutare.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="titolo-confronto-lotti-tabella">
      <h2 id="titolo-confronto-lotti-tabella">Lotti</h2>
      <table className={styles.tabella}>
        <caption className={styles.didascalia}>
          Lo stesso raggruppamento valutato su ogni lotto del bando, in ordine: verdetto, mosse del percorso minimo, requisiti scoperti.
          {inCalcolo ? ' Classifica in calcolo…' : ''}
        </caption>
        <thead>
          <tr>
            <th scope="col">Pos.</th>
            <th scope="col">Lotto</th>
            <th scope="col" className={styles.cifra}>Importo</th>
            <th scope="col">Verdetto</th>
            <th scope="col">Percorso minimo</th>
            <th scope="col" className={styles.cifra}>Scoperti</th>
          </tr>
        </thead>
        <tbody>
          {bando.lotti.map((lotto) => {
            const voce = classifica.get(lotto.id);
            const selezionato = lotto.id === lottoId;
            return (
              <tr key={lotto.id} className={selezionato ? styles.selezionato : undefined} aria-current={selezionato ? 'true' : undefined}>
                <td className={styles.cifra} data-etichetta="Posizione">{voce ? `${voce.posizione}${voce.pariMerito ? ' (pari merito)' : ''}` : '…'}</td>
                <td className={styles.lotto}>
                  <button type="button" className={styles.scelta} onClick={() => onSeleziona(lotto.id)} aria-pressed={selezionato}>
                    <span className={styles.idLotto}>{lotto.id}</span> {lotto.oggetto}
                  </button>
                </td>
                <td className={styles.cifra} data-etichetta="Importo">{formattaEuro(lotto.importo)}</td>
                <td data-etichetta="Verdetto">{voce ? <VerdettoBadge verdetto={voce.esito.verdetto} /> : <span className={styles.attesa}>Calcolo in corso…</span>}</td>
                <td data-etichetta="Percorso minimo">{voce ? descriviPercorso(voce.esito.percorsoMinimo) : <span className={styles.attesa}>…</span>}</td>
                <td className={styles.cifra} data-etichetta="Scoperti">{voce ? voce.esito.requisiti.filter((r) => r.stato === 'scoperto').length : '…'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
