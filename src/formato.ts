// Formattazione italiana, senza dipendere dall'ICU del runtime.
// Usata dal motore per le motivazioni e dalla UI per le celle.

import type { DataISO, Unita } from './domain';

const SEPARATORE_MIGLIAIA = '.';
const SEPARATORE_DECIMALI = ',';
const SPAZIO_STRETTO = ' ';

function raggruppaMigliaia(interi: string): string {
  return interi.replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATORE_MIGLIAIA);
}

/**
 * `decimali` fissa le cifre dopo la virgola; se omesso, ne mostra al più
 * due, senza zeri finali: 1,2 e non 1,20.
 */
export function formattaNumero(valore: number, decimali?: number): string {
  const negativo = valore < 0;
  const assoluto = Math.abs(valore);
  const fissato = decimali === undefined ? assoluto.toFixed(2).replace(/\.?0+$/, '') : assoluto.toFixed(decimali);
  const [interi, frazione] = fissato.split('.');
  const corpo = raggruppaMigliaia(interi ?? '0') + (frazione ? SEPARATORE_DECIMALI + frazione : '');
  return negativo ? `-${corpo}` : corpo;
}

/** Cifre intere senza decimali; altrimenti sempre i centesimi: 0,50 €. */
export function formattaEuro(euro: number): string {
  const decimali = Number.isInteger(Number(euro.toFixed(2))) ? 0 : 2;
  return `${formattaNumero(euro, decimali)}${SPAZIO_STRETTO}€`;
}

/** Da frazione: 0.6 → "60 %", 0.125 → "12,5 %". */
export function formattaPercentuale(frazione: number): string {
  const percento = Number((frazione * 100).toFixed(4));
  const decimali = Number.isInteger(percento) ? 0 : Math.min(2, String(percento).split('.')[1]?.length ?? 0);
  return `${formattaNumero(percento, decimali)}${SPAZIO_STRETTO}%`;
}

/** ISO → gg/mm/aaaa. Una data malformata torna com'è: non viene nascosta. */
export function formattaData(data: DataISO): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) return data;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** "3.000.000 €", "1 referenza", "3 referenze": il sostantivo è quello del disciplinare. */
export function formattaConUnita(valore: number, unita: Unita): string {
  switch (unita.tipo) {
    case 'euro':
      return formattaEuro(valore);
    case 'conteggio':
      return `${formattaNumero(valore)} ${valore === 1 ? unita.sostantivo.singolare : unita.sostantivo.plurale}`;
  }
}

/** La data di oggi nel fuso di chi usa la pagina, in formato ISO. */
export function oggiISO(): DataISO {
  const oggi = new Date();
  const due = (n: number) => String(n).padStart(2, '0');
  return `${oggi.getFullYear()}-${due(oggi.getMonth() + 1)}-${due(oggi.getDate())}`;
}
