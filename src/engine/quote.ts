// Le quote sono frazioni in virgola mobile: 0.1 + 0.2 ≠ 0.3.
// Ogni confronto passa da qui.

import type { PrestazioneId } from '../domain';

const TOLLERANZA_QUOTA = 1e-9;
const DECIMALI_CANONICI = 6;

export function quotaValida(quota: number): boolean {
  return Number.isFinite(quota) && quota >= 0 && quota <= 1;
}

export function quotaPositiva(quota: number): boolean {
  return quota > TOLLERANZA_QUOTA;
}

export function sommaQuote(quote: number[]): number {
  return quote.reduce((somma, q) => somma + q, 0);
}

export function quoteTotalizzano(totale: number): boolean {
  return Math.abs(totale - 1) <= TOLLERANZA_QUOTA;
}

export function quoteAzzerate(totale: number): boolean {
  return Math.abs(totale) <= TOLLERANZA_QUOTA;
}

/** `a >= b` a meno della tolleranza. */
export function quotaAlmeno(a: number, b: number): boolean {
  return a + TOLLERANZA_QUOTA >= b;
}

/** Rappresentazione stabile per le chiavi degli stati visitati. */
export function quotaCanonica(quota: number): number {
  return Number(quota.toFixed(DECIMALI_CANONICI));
}

/** Quota di un membro su una prestazione; chiave assente = zero. */
export function quotaSu(quote: Record<PrestazioneId, number>, prestazioneId: PrestazioneId): number {
  return quote[prestazioneId] ?? 0;
}
