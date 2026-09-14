// Gli errori di un documento in parole, per chi deve correggere il file.
// Tre parti sempre separate — dove, cosa ci voleva, cosa c'è — perché la
// pagina le impagini come tali e non come una frase da decifrare.

import { assertNever } from '../assertNever';
import type { ErroreDocumento } from './carica';
import { formattaPercorso } from './struttura';

export type MessaggioErrore = {
  dove: string;
  atteso?: string;
  trovato?: string;
};

export function descriviErroreDocumento(errore: ErroreDocumento): MessaggioErrore {
  switch (errore.tipo) {
    case 'lettura':
      return { dove: 'Il file', trovato: errore.motivo };
    case 'sintassi':
      return {
        dove: errore.riga !== undefined ? `Riga ${errore.riga}, colonna ${errore.colonna}` : 'Il file',
        atteso: 'JSON valido: virgolette doppie attorno ai nomi e ai testi, virgole tra gli elementi, nessuna virgola dopo l\'ultimo',
        trovato: errore.riga !== undefined ? 'un errore di sintassi in questo punto' : 'un errore di sintassi',
      };
    case 'struttura':
      return { dove: formattaPercorso(errore.percorso), atteso: errore.atteso, trovato: errore.trovato };
    default:
      return assertNever(errore);
  }
}

export function contaErrori(n: number): string {
  return n === 1 ? '1 errore' : `${n} errori`;
}
