// Rigenera `esitoAtteso` in src/fixture.ts dall'output del motore.
// Non è un test di comportamento: è uno strumento, eseguito con
// `npm run fixture:esito`. Dopo averlo eseguito, leggere il diff riga per
// riga e capire chi ha ragione prima di committare.

import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { valuta } from '../src/engine';
import { bando, DATA_RIFERIMENTO, ORIZZONTE_SCADENZE_GIORNI, raggruppamento, soggetti } from '../src/fixture';

const PERCORSO = new URL('../src/fixture.ts', import.meta.url);
const MARCATORE = '// ─── Esito atteso ─';

it('scrive esitoAtteso in src/fixture.ts', () => {
  const esiti = Object.fromEntries(
    bando.lotti.map((l) => [l.id, valuta({ bando, lottoId: l.id, soggetti, raggruppamento, dataRiferimento: DATA_RIFERIMENTO, orizzonteScadenzeGiorni: ORIZZONTE_SCADENZE_GIORNI })]),
  );
  const sorgente = readFileSync(PERCORSO, 'utf8');
  const inizio = sorgente.indexOf(MARCATORE);
  if (inizio < 0) throw new Error('Marcatore dell\'esito atteso non trovato in src/fixture.ts');
  const testa = sorgente.slice(0, inizio);
  const intestazione = [
    '// ─── Esito atteso ────────────────────────────────────────────',
    '// GENERATO dal motore (`valuta`) su questa fixture, alla data di riferimento',
    "// e con l'orizzonte qui sopra, e letto riga per riga prima di essere fissato.",
    '// Non è scritto a mano: dove il motore cambia, questo cambia con lui e il',
    '// test di integrazione lo dice. Per rigenerarlo: `npm run fixture:esito`.',
    '',
    'export const esitoAtteso: Record<LottoId, Esito> = ',
  ].join('\n');
  writeFileSync(PERCORSO, `${testa}${intestazione}${JSON.stringify(esiti, null, 2)};\n`, 'utf8');
});
