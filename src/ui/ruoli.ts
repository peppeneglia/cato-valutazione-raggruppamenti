// I ruoli che un membro può avere quando esegue, nell'ordine in cui si
// scelgono: prima chi guida. Una lista sola, per la tendina di chi entra e
// per quella di chi cambia ruolo.

import type { RuoloEsecutore } from '../domain';

export const RUOLI_ESECUTORI: readonly RuoloEsecutore[] = ['mandataria', 'mandante', 'consorziata_esecutrice'];
