import { assertNever } from '../assertNever';
import type { Anomalia, StatoRequisito, Verdetto } from '../domain';
import { eBloccante } from './validazione';

type RigaVerdetto = { stato: StatoRequisito; vincolante: boolean };

/**
 * Uno scoperto su requisito vincolante, o un'anomalia bloccante → non
 * ammissibile. Nessuno scoperto vincolante ma almeno un da verificare o
 * uno scoperto non vincolante → ammissibile con riserva. Altrimenti
 * ammissibile.
 */
export function calcolaVerdetto(righe: RigaVerdetto[], anomalie: Anomalia[]): Verdetto {
  if (anomalie.some(eBloccante)) return 'non_ammissibile';
  let riserva = false;
  for (const riga of righe) {
    switch (riga.stato) {
      case 'scoperto':
        if (riga.vincolante) return 'non_ammissibile';
        riserva = true;
        break;
      case 'da_verificare':
        riserva = true;
        break;
      case 'coperto':
        break;
      default:
        assertNever(riga.stato);
    }
  }
  return riserva ? 'ammissibile_con_riserva' : 'ammissibile';
}
