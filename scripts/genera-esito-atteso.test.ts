// Rigenera src/engine/esito-atteso-asl-roma-6.json dall'output del motore
// sui documenti veri. Non è un test di comportamento: è uno strumento,
// eseguito con `npm run esito:atteso`. Dopo averlo eseguito, leggere il diff
// riga per riga e capire chi ha ragione prima di committare.

import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { bando, DATA_RIFERIMENTO, raggruppamento, soggetti } from '../src/documenti/documentiDiProva';
import { valuta } from '../src/engine';
import { ORIZZONTE_SCADENZE_GIORNI } from '../src/parametri';

const PERCORSO = new URL('../src/engine/esito-atteso-asl-roma-6.json', import.meta.url);

it('scrive l’esito atteso del lotto unico', () => {
  const esito = valuta({ bando, lottoId: 'lotto-unico', soggetti, raggruppamento, dataRiferimento: DATA_RIFERIMENTO, orizzonteScadenzeGiorni: ORIZZONTE_SCADENZE_GIORNI });
  writeFileSync(PERCORSO, `${JSON.stringify(esito, null, 2)}\n`, 'utf8');
});
