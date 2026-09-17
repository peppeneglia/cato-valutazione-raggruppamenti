import type { Bando, Lotto, LottoId } from '../domain';

export function trovaLotto(bando: Bando, lottoId: LottoId): Lotto | undefined {
  return bando.lotti.find((l) => l.id === lottoId);
}

export function indicizza<T extends { id: string }>(elementi: readonly T[]): Map<string, T> {
  return new Map(elementi.map((e) => [e.id, e]));
}

/** Elementi uguali per valore (confronto JSON) si tengono una volta, nell'ordine della prima occorrenza. */
export function senzaDuplicati<T>(elementi: readonly T[]): T[] {
  const viste = new Set<string>();
  return elementi.filter((e) => {
    const chiave = JSON.stringify(e);
    if (viste.has(chiave)) return false;
    viste.add(chiave);
    return true;
  });
}
