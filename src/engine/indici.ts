import type { Bando, Lotto, LottoId } from '../domain';

export function trovaLotto(bando: Bando, lottoId: LottoId): Lotto | undefined {
  return bando.lotti.find((l) => l.id === lottoId);
}

export function indicizza<T extends { id: string }>(elementi: readonly T[]): Map<string, T> {
  return new Map(elementi.map((e) => [e.id, e]));
}
