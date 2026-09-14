// Avvisi di scadenza: fatti usati per i requisiti del lotto, validi alla
// data di riferimento, che scadono prima del termine di presentazione o
// entro l'orizzonte richiesto.

import type { AvvisoScadenza, DataISO } from '../domain';
import { aggiungiGiorni, confrontaDate } from './date';
import type { FattoUsatoDa } from './requisito';

export type ParametriScadenze = {
  dataRiferimento: DataISO;
  terminePresentazione: DataISO;
  orizzonteGiorni: number;
};

function chiave(u: FattoUsatoDa, scadeIl: DataISO): string {
  return JSON.stringify([u.soggettoId, u.fatto.descrizione, u.fatto.fonte, scadeIl]);
}

export function avvisiScadenza(usati: FattoUsatoDa[], parametri: ParametriScadenze): AvvisoScadenza[] {
  const { dataRiferimento, terminePresentazione, orizzonteGiorni } = parametri;
  if (confrontaDate(dataRiferimento, terminePresentazione) > 0) return [];
  const limiteOrizzonte = aggiungiGiorni(dataRiferimento, orizzonteGiorni);

  const perFatto = new Map<string, AvvisoScadenza>();
  for (const u of usati) {
    const scadeIl = u.fatto.scadeIl;
    if (scadeIl === undefined || confrontaDate(scadeIl, dataRiferimento) < 0) continue;
    const primaDelTermine = confrontaDate(scadeIl, terminePresentazione) < 0;
    const entroOrizzonte = confrontaDate(scadeIl, limiteOrizzonte) <= 0;
    if (!primaDelTermine && !entroOrizzonte) continue;

    const k = chiave(u, scadeIl);
    const esistente = perFatto.get(k);
    if (esistente) {
      if (!esistente.requisitiIds.includes(u.requisitoId)) esistente.requisitiIds.push(u.requisitoId);
      continue;
    }
    perFatto.set(k, {
      soggettoId: u.soggettoId,
      descrizioneVoce: u.fatto.descrizione,
      scadeIl,
      fonte: u.fatto.fonte,
      requisitiIds: [u.requisitoId],
      primaDelTermine,
      entroOrizzonte,
    });
  }

  return [...perFatto.values()].sort((a, b) => confrontaDate(a.scadeIl, b.scadeIl) || a.soggettoId.localeCompare(b.soggettoId));
}
