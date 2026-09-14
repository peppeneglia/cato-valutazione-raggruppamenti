// Costruttori per i test: ogni test dichiara ciò che varia, qui ci sono
// solo i valori che non contano per il comportamento sotto esame.

import type {
  Bando,
  Criterio,
  Fonte,
  Lettura,
  Lotto,
  Membro,
  ParametriValutazione,
  Prestazione,
  Raggruppamento,
  RegolaComposizione,
  Requisito,
  Soggetto,
  Sostantivo,
  Unita,
  VoceFascicolo,
} from '../domain';

export const FONTE: Fonte = { documento: 'Documento di prova', riferimento: 'rif.' };

export const REFERENZE: Sostantivo = { singolare: 'referenza', plurale: 'referenze' };
export const EURO: Unita = { tipo: 'euro' };
export const CONTEGGIO_REFERENZE: Unita = { tipo: 'conteggio', sostantivo: REFERENZE };

export const DATA_RIFERIMENTO = '2026-09-14';
export const DATA_PUBBLICAZIONE = '2026-09-01';
export const TERMINE_PRESENTAZIONE = '2026-11-14';

export function prestazione(id: string, extra: Partial<Prestazione> = {}): Prestazione {
  return { id, descrizione: `Prestazione ${id}`, importo: 100_000, natura: 'scorporabile', fonte: FONTE, ...extra };
}

/** Un requisito con una lettura sola: il caso comune. Più letture passano da `extra.letture`. */
export function requisito(
  id: string,
  criterio: Criterio,
  regola: RegolaComposizione,
  extra: Partial<Requisito> = {},
): Requisito {
  return { id, famiglia: 'generale', descrizione: `Requisito ${id}`, letture: [{ criterio }], regola, avvalibile: false, vincolante: true, fonte: FONTE, ...extra };
}

export function lettura(testo: string, criterio: Criterio): Lettura {
  return { testo, criterio };
}

export function lotto(extra: Partial<Lotto> = {}): Lotto {
  return { id: 'l-1', oggetto: 'Lotto di prova', importo: 100_000, prestazioni: [prestazione('p-1')], requisiti: [], ...extra };
}

export function bando(lotti: Lotto[], extra: Partial<Bando> = {}): Bando {
  return {
    id: 'b-1',
    oggetto: 'Bando di prova',
    stazioneAppaltante: 'Stazione di prova',
    dataPubblicazione: DATA_PUBBLICAZIONE,
    terminePresentazione: TERMINE_PRESENTAZIONE,
    baseAsta: 100_000,
    valori: [],
    fonte: FONTE,
    lotti,
    ...extra,
  };
}

export function soggetto(id: string, fascicolo: VoceFascicolo[] = []): Soggetto {
  return { id, denominazione: `Soggetto ${id}`, fascicolo };
}

export function esecutore(
  soggettoId: string,
  ruolo: 'mandataria' | 'mandante' | 'consorziata_esecutrice',
  quote: Record<string, number>,
): Membro {
  return { ruolo, soggettoId, quote };
}

export function ausiliaria(soggettoId: string, ausiliataId: string, requisitiIds: string[]): Membro {
  return { ruolo: 'ausiliaria', soggettoId, ausiliataId, requisitiIds };
}

export function raggruppamento(membri: Membro[], extra: Partial<Raggruppamento> = {}): Raggruppamento {
  return { tipo: 'orizzontale', membri, ...extra };
}

/** Un lotto, una prestazione, una mandataria che la esegue al 100 %. */
export function parametri(extra: Partial<ParametriValutazione> = {}): ParametriValutazione {
  const l = lotto();
  return {
    bando: bando([l]),
    lottoId: l.id,
    soggetti: [soggetto('s-a')],
    raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1 })]),
    dataRiferimento: DATA_RIFERIMENTO,
    orizzonteScadenzeGiorni: 90,
    ...extra,
  };
}

// ─── Voci di fascicolo ───────────────────────────────────────

export function dichiarazione(oggetto: string): VoceFascicolo {
  return { tipo: 'dichiarazione', oggetto, resa: { valore: true, fonte: FONTE } };
}

export function certificazione(norma: string, scope: string, validoA?: string): VoceFascicolo {
  return { tipo: 'certificazione', norma, scope, possesso: { valore: true, fonte: FONTE, validoA } };
}

export function iscrizione(registro: string, attivita: string, validoA?: string): VoceFascicolo {
  return { tipo: 'iscrizione', registro, attivita, possesso: { valore: true, fonte: FONTE, validoA } };
}

export function fatturato(esercizio: number, settore: string, importo: number): VoceFascicolo {
  return { tipo: 'fatturato', esercizio, ambito: { tipo: 'specifico', settore }, importo: { valore: importo, fonte: FONTE } };
}

export function fatturatoGlobale(esercizio: number, importo: number): VoceFascicolo {
  return { tipo: 'fatturato', esercizio, ambito: { tipo: 'globale' }, importo: { valore: importo, fonte: FONTE } };
}

export function servizio(cpv: string, da: string, a: string, importo = 100_000): VoceFascicolo {
  return { tipo: 'servizio', oggetto: `Servizio ${cpv}`, cpv, committente: 'Committente', importo, periodo: { valore: { da, a }, fonte: FONTE } };
}
