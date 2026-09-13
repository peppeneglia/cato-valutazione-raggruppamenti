// Tutto il calcolo sugli importi avviene in centesimi interi.
// Si torna in euro solo in uscita: "99999.99999" in un documento di gara
// è un errore, non un dettaglio.

export type Centesimi = number;

export function inCentesimi(euro: number): Centesimi {
  return Math.round(euro * 100);
}

export function inEuro(centesimi: Centesimi): number {
  return centesimi / 100;
}

/** Frazione di un importo (es. il 40% della soglia), arrotondata al centesimo. */
export function frazioneDi(centesimi: Centesimi, frazione: number): Centesimi {
  return Math.round(centesimi * frazione);
}
