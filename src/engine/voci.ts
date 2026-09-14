// Accesso uniforme alle voci di fascicolo, in un posto solo.

import { assertNever } from '../assertNever';
import type { Dato, Fatto, VoceFascicolo } from '../domain';
import { formattaEuro } from '../formato';

/** Il dato con provenienza che ogni voce porta. */
export function datoDiVoce(voce: VoceFascicolo): Dato<unknown> {
  switch (voce.tipo) {
    case 'fatturato':
      return voce.importo;
    case 'certificazione':
      return voce.possesso;
    case 'servizio':
      return voce.periodo;
    case 'iscrizione':
      return voce.possesso;
    case 'dichiarazione':
      return voce.resa;
    default:
      return assertNever(voce);
  }
}

/** Il fatto con validità, solo per le voci che possono scadere. */
export function fattoDiVoce(voce: VoceFascicolo): Fatto<unknown> | undefined {
  switch (voce.tipo) {
    case 'certificazione':
    case 'iscrizione':
      return voce.possesso;
    case 'fatturato':
    case 'servizio':
    case 'dichiarazione':
      return undefined;
    default:
      return assertNever(voce);
  }
}

/** Descrizione breve per note, avvisi e anomalie. */
export function descriviVoce(voce: VoceFascicolo): string {
  switch (voce.tipo) {
    case 'fatturato':
      return `fatturato ${voce.esercizio} (${formattaEuro(voce.importo.valore)})`;
    case 'certificazione':
      return `certificazione ${voce.norma} — ${voce.scope}`;
    case 'servizio':
      return `servizio «${voce.oggetto}» per ${voce.committente}`;
    case 'iscrizione':
      return `iscrizione ${voce.registro} — ${voce.attivita}`;
    case 'dichiarazione':
      return `dichiarazione «${voce.oggetto}»`;
    default:
      return assertNever(voce);
  }
}
