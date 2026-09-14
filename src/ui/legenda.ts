// Legenda delle assunzioni: un numero per codice nell'ordine di prima
// comparsa, i testi distinti sotto ciascuno. Funzione pura, senza JSX.

import type { CodiceAssunzione, EsitoRequisito } from '../domain';

export type Legenda = { codice: CodiceAssunzione; numero: number; testi: string[] }[];

export function legendaAssunzioni(requisiti: EsitoRequisito[]): Legenda {
  const legenda: Legenda = [];
  for (const r of requisiti) {
    for (const a of r.assunzioni) {
      let voce = legenda.find((v) => v.codice === a.codice);
      if (!voce) {
        voce = { codice: a.codice, numero: legenda.length + 1, testi: [] };
        legenda.push(voce);
      }
      if (!voce.testi.includes(a.testo)) voce.testi.push(a.testo);
    }
  }
  return legenda;
}

export function siglaAssunzione(numero: number): string {
  return `A${numero}`;
}
