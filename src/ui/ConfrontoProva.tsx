// Dopo una prova, la domanda è una: conviene di più così o com'era? Il
// confronto tra la composizione attuale e quella prima dell'ultima prova
// arriva dal motore sul canale differito. Senza prove, non compare.

import { assertNever } from '../assertNever';
import type { PercorsoMinimo, VoceConfronto } from '../domain';
import { VerdettoBadge } from './StatoRequisito';
import type { ValutazioneDifferita } from './useValutazioneDifferita';
import styles from './ConfrontoProva.module.css';

function mosse(percorso: PercorsoMinimo): string {
  switch (percorso.esito) {
    case 'gia_ammissibile':
      return '0';
    case 'trovato':
      return String(percorso.mosse.length);
    case 'inesistente':
      return 'nessun percorso';
    case 'bloccato_da_anomalie':
      return 'bloccato';
    default:
      return assertNever(percorso);
  }
}

export function ConfrontoProva({ differita, haProve }: { differita: ValutazioneDifferita; haProve: boolean }) {
  if (!haProve) return null;
  return (
    <section aria-labelledby="titolo-confronto" className={styles.sezione} aria-busy={differita.stato === 'in_calcolo'}>
      <h3 id="titolo-confronto">Conviene di più così o com'era?</h3>
      {differita.stato === 'in_calcolo' || differita.confrontoProva === undefined ? (
        <p className={styles.attesa} role="status">Confronto in calcolo…</p>
      ) : (
        <table className={styles.tabella}>
          <thead>
            <tr>
              <th scope="col">Pos.</th>
              <th scope="col">Composizione</th>
              <th scope="col">Verdetto</th>
              <th scope="col" className={styles.cifra}>Mosse</th>
              <th scope="col" className={styles.cifra}>Scoperti</th>
            </tr>
          </thead>
          <tbody>
            {differita.confrontoProva.map((voce: VoceConfronto<string>) => (
              <tr key={voce.chiave}>
                <td className={styles.cifra}>{voce.posizione}{voce.pariMerito ? ' (pari merito)' : ''}</td>
                <td>{voce.chiave}</td>
                <td><VerdettoBadge verdetto={voce.esito.verdetto} /></td>
                <td className={styles.cifra}>{mosse(voce.esito.percorsoMinimo)}</td>
                <td className={styles.cifra}>{voce.esito.requisiti.filter((r) => r.stato === 'scoperto').length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
