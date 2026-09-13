// Date ISO `YYYY-MM-DD`, trattate come stringhe: il confronto lessicografico
// è corretto per costruzione. L'aritmetica passa da `Date.UTC` con valori
// espliciti — mai dall'orologio di sistema.

import type { DataISO } from '../domain';

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

type Componenti = { anno: number; mese: number; giorno: number };

function scomponi(data: string): Componenti | undefined {
  const m = FORMATO.exec(data);
  if (!m) return undefined;
  return { anno: Number(m[1]), mese: Number(m[2]), giorno: Number(m[3]) };
}

function ricomponi({ anno, mese, giorno }: Componenti): DataISO {
  const aaaa = String(anno).padStart(4, '0');
  const mm = String(mese).padStart(2, '0');
  const gg = String(giorno).padStart(2, '0');
  return `${aaaa}-${mm}-${gg}`;
}

function daUtc(ms: number): Componenti {
  const d = new Date(ms);
  return { anno: d.getUTCFullYear(), mese: d.getUTCMonth() + 1, giorno: d.getUTCDate() };
}

/** Formato corretto E data esistente nel calendario (niente 31 febbraio). */
export function dataValida(data: string): boolean {
  const c = scomponi(data);
  if (!c) return false;
  const rientro = daUtc(Date.UTC(c.anno, c.mese - 1, c.giorno));
  return rientro.anno === c.anno && rientro.mese === c.mese && rientro.giorno === c.giorno;
}

/** Presuppone date valide. */
export function confrontaDate(a: DataISO, b: DataISO): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function annoDi(data: DataISO): number {
  const c = scomponi(data);
  if (!c) throw new Error(`Data malformata: ${data}`);
  return c.anno;
}

export function aggiungiGiorni(data: DataISO, giorni: number): DataISO {
  const c = scomponi(data);
  if (!c) throw new Error(`Data malformata: ${data}`);
  return ricomponi(daUtc(Date.UTC(c.anno, c.mese - 1, c.giorno + giorni)));
}

/** Stesso giorno e mese; il 29 febbraio scivola al 28 se l'anno non è bisestile. */
export function sottraiAnni(data: DataISO, anni: number): DataISO {
  const c = scomponi(data);
  if (!c) throw new Error(`Data malformata: ${data}`);
  const anno = c.anno - anni;
  const tentativo = daUtc(Date.UTC(anno, c.mese - 1, c.giorno));
  if (tentativo.mese === c.mese) return ricomponi(tentativo);
  return ricomponi(daUtc(Date.UTC(anno, c.mese, 0)));
}

/** Estremi inclusi; un estremo assente non limita. */
export function entroFinestra(data: DataISO, da?: DataISO, a?: DataISO): boolean {
  if (da !== undefined && data < da) return false;
  if (a !== undefined && data > a) return false;
  return true;
}

export type Periodo = { da: DataISO; a: DataISO };

/** Sovrapposizione anche di un solo giorno. */
export function siSovrappongono(p: Periodo, q: Periodo): boolean {
  return p.da <= q.a && q.da <= p.a;
}
