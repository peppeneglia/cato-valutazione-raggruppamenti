import type { Membro, Raggruppamento, RuoloEsecutore } from '../domain';

export type MembroEsecutore = Extract<Membro, { ruolo: RuoloEsecutore }>;
export type MembroAusiliaria = Extract<Membro, { ruolo: 'ausiliaria' }>;

export function eEsecutore(membro: Membro): membro is MembroEsecutore {
  return membro.ruolo !== 'ausiliaria';
}

export function eAusiliaria(membro: Membro): membro is MembroAusiliaria {
  return membro.ruolo === 'ausiliaria';
}

export function esecutoriDi(raggruppamento: Raggruppamento): MembroEsecutore[] {
  return raggruppamento.membri.filter(eEsecutore);
}

export function ausiliarieDi(raggruppamento: Raggruppamento): MembroAusiliaria[] {
  return raggruppamento.membri.filter(eAusiliaria);
}

export function mandatarieDi(raggruppamento: Raggruppamento): MembroEsecutore[] {
  return esecutoriDi(raggruppamento).filter((m) => m.ruolo === 'mandataria');
}
