// Criteri: quali fatti del fascicolo soddisfano un requisito.
// Un solo soggetto alla volta; la composizione tra soggetti sta altrove.
//
// Le misure in euro sono in CENTESIMI in tutto questo modulo: la
// conversione in euro avviene una volta sola, costruendo l'esito.

import { assertNever } from '../assertNever';
import type {
  AmbitoFatturato,
  Ancoraggio,
  Criterio,
  DataISO,
  Fatto,
  Fonte,
  Unita,
  ValoreContributo,
  VoceFascicolo,
} from '../domain';
import { formattaData, formattaEuro } from '../formato';
import { annoDi, entroFinestra, siSovrappongono, sottraiAnni, type Periodo } from './date';
import { inCentesimi, type Centesimi } from './importi';
import { coincidono } from './testo';
import { descriviVoce } from './voci';

export type ContestoCriterio = {
  dataRiferimento: DataISO;
  dataPubblicazione: DataISO;
};

/** Valore, fonti dei fatti usati e note che spiegano cosa non ha contato. */
export type ContributoGrezzo = {
  valore: ValoreContributo;
  fonti: Fonte[];
  note: string[];
};

// ─── Proprietà del criterio ──────────────────────────────────

export function unitaDi(criterio: Criterio): Unita | undefined {
  switch (criterio.tipo) {
    case 'fatturato':
    case 'servizi_importo':
      return 'euro';
    case 'servizi':
      return 'conteggio';
    case 'dichiarazione':
    case 'certificazione':
    case 'iscrizione':
      return undefined;
    default:
      return assertNever(criterio);
  }
}

/** Soglia in unità interne. Per i criteri di possesso vale 1: "lo possiede". */
export function sogliaInterna(criterio: Criterio): number {
  switch (criterio.tipo) {
    case 'fatturato':
    case 'servizi_importo':
      return inCentesimi(criterio.soglia);
    case 'servizi':
      return criterio.numeroMinimo;
    case 'dichiarazione':
    case 'certificazione':
    case 'iscrizione':
      return 1;
    default:
      return assertNever(criterio);
  }
}

export function dataAncoraggio(ancoraggio: Ancoraggio, contesto: ContestoCriterio): DataISO {
  switch (ancoraggio) {
    case 'pubblicazione':
      return contesto.dataPubblicazione;
    case 'riferimento':
      return contesto.dataRiferimento;
    default:
      return assertNever(ancoraggio);
  }
}

// ─── Validità dei fatti ──────────────────────────────────────

function fattoValido(fatto: Fatto<unknown>, data: DataISO): boolean {
  return entroFinestra(data, fatto.validoDa, fatto.validoA);
}

function motivoNonValido(fatto: Fatto<unknown>, data: DataISO): string {
  if (fatto.validoA !== undefined && data > fatto.validoA) return `scaduto il ${formattaData(fatto.validoA)}`;
  if (fatto.validoDa !== undefined && data < fatto.validoDa) return `valido solo dal ${formattaData(fatto.validoDa)}`;
  return 'non valido alla data di riferimento';
}

// ─── Possesso ────────────────────────────────────────────────

const ASSENTE: ValoreContributo = { tipo: 'possesso', esito: 'assente' };

type VocePossesso = { voce: VoceFascicolo; fatto: Fatto<true>; attributo?: string };

/**
 * Possesso con attributo opzionale (scope, attività): posseduto se coincide,
 * da verificare se diverso, assente se nessuna voce valida.
 */
function componiPossesso(
  pertinenti: VocePossesso[],
  attributoRichiesto: string | undefined,
  descrizioneRichiesta: string,
  data: DataISO,
): ContributoGrezzo {
  const valide = pertinenti.filter((p) => fattoValido(p.fatto, data));

  if (valide.length === 0) {
    const note = pertinenti.length === 0
      ? [`nessuna ${descrizioneRichiesta} nel fascicolo`]
      : pertinenti.map((p) => `${descriviVoce(p.voce)}: ${motivoNonValido(p.fatto, data)}`);
    return { valore: ASSENTE, fonti: [], note };
  }

  if (attributoRichiesto === undefined) {
    return { valore: { tipo: 'possesso', esito: 'posseduto' }, fonti: valide.map((p) => p.fatto.fonte), note: [] };
  }

  const coincidenti = valide.filter((p) => p.attributo !== undefined && coincidono(p.attributo, attributoRichiesto));
  if (coincidenti.length > 0) {
    return { valore: { tipo: 'possesso', esito: 'posseduto' }, fonti: coincidenti.map((p) => p.fatto.fonte), note: [] };
  }

  return {
    valore: { tipo: 'possesso', esito: 'da_verificare' },
    fonti: valide.map((p) => p.fatto.fonte),
    note: valide.map((p) => `${descriviVoce(p.voce)}: «${p.attributo ?? ''}» diverso da quello richiesto «${attributoRichiesto}», equivalenza da valutare`),
  };
}

function valutaDichiarazione(oggetto: string, fascicolo: VoceFascicolo[], data: DataISO): ContributoGrezzo {
  const pertinenti: VocePossesso[] = [];
  for (const voce of fascicolo) {
    if (voce.tipo === 'dichiarazione' && coincidono(voce.oggetto, oggetto)) pertinenti.push({ voce, fatto: voce.resa });
  }
  return componiPossesso(pertinenti, undefined, `dichiarazione «${oggetto}»`, data);
}

function valutaCertificazione(norma: string, scope: string | undefined, fascicolo: VoceFascicolo[], data: DataISO): ContributoGrezzo {
  const pertinenti: VocePossesso[] = [];
  for (const voce of fascicolo) {
    if (voce.tipo === 'certificazione' && coincidono(voce.norma, norma)) pertinenti.push({ voce, fatto: voce.possesso, attributo: voce.scope });
  }
  return componiPossesso(pertinenti, scope, `certificazione ${norma}`, data);
}

function valutaIscrizione(registro: string, attivita: string | undefined, fascicolo: VoceFascicolo[], data: DataISO): ContributoGrezzo {
  const pertinenti: VocePossesso[] = [];
  for (const voce of fascicolo) {
    if (voce.tipo === 'iscrizione' && coincidono(voce.registro, registro)) pertinenti.push({ voce, fatto: voce.possesso, attributo: voce.attivita });
  }
  return componiPossesso(pertinenti, attivita, `iscrizione ${registro}`, data);
}

// ─── Fatturato ───────────────────────────────────────────────

function ambitiCoincidono(richiesto: AmbitoFatturato, dichiarato: AmbitoFatturato): boolean {
  switch (richiesto.tipo) {
    case 'globale':
      return dichiarato.tipo === 'globale';
    case 'specifico':
      return dichiarato.tipo === 'specifico' && coincidono(dichiarato.settore, richiesto.settore);
    default:
      return assertNever(richiesto);
  }
}

function descriviAmbito(ambito: AmbitoFatturato): string {
  switch (ambito.tipo) {
    case 'globale':
      return 'globale';
    case 'specifico':
      return `«${ambito.settore}»`;
    default:
      return assertNever(ambito);
  }
}

function valutaFatturato(
  criterio: Extract<Criterio, { tipo: 'fatturato' }>,
  fascicolo: VoceFascicolo[],
  contesto: ContestoCriterio,
): ContributoGrezzo {
  const annoFine = annoDi(dataAncoraggio(criterio.ancoraggio, contesto)) - 1;
  const annoInizio = annoFine - criterio.esercizi + 1;
  const esercizi = Array.from({ length: criterio.esercizi }, (_, i) => annoInizio + i);

  let certo: Centesimi = 0;
  const fonti: Fonte[] = [];
  const note: string[] = [];
  const coperti = new Set<number>();

  for (const voce of fascicolo) {
    if (voce.tipo !== 'fatturato' || !ambitiCoincidono(criterio.ambito, voce.ambito)) continue;
    if (voce.esercizio < annoInizio || voce.esercizio > annoFine) continue;
    if (!fattoValido(voce.importo, contesto.dataRiferimento)) {
      note.push(`${descriviVoce(voce)}: ${motivoNonValido(voce.importo, contesto.dataRiferimento)}`);
      continue;
    }
    certo += inCentesimi(voce.importo.valore);
    fonti.push(voce.importo.fonte);
    coperti.add(voce.esercizio);
  }

  const mancanti = esercizi.filter((e) => !coperti.has(e));
  if (mancanti.length === esercizi.length) {
    note.push(`nessun fatturato nell'ambito ${descriviAmbito(criterio.ambito)} per gli esercizi ${annoInizio}–${annoFine}`);
  } else if (mancanti.length > 0) {
    note.push(`nessun fatturato nell'ambito ${descriviAmbito(criterio.ambito)} per ${mancanti.length === 1 ? "l'esercizio" : 'gli esercizi'} ${mancanti.join(', ')}`);
  }

  return { valore: { tipo: 'misura', certo, incerto: 0 }, fonti, note };
}

// ─── Servizi ─────────────────────────────────────────────────

type CriterioServizi = Extract<Criterio, { tipo: 'servizi' | 'servizi_importo' }>;

/** Quanto vale un servizio che conta: 1 per il conteggio, l'importo per la somma. */
function pesoServizio(criterio: CriterioServizi, importo: number): number {
  switch (criterio.tipo) {
    case 'servizi':
      return 1;
    case 'servizi_importo':
      return inCentesimi(importo);
    default:
      return assertNever(criterio);
  }
}

function valutaServizi(criterio: CriterioServizi, fascicolo: VoceFascicolo[], contesto: ContestoCriterio): ContributoGrezzo {
  const fine = dataAncoraggio(criterio.ancoraggio, contesto);
  const finestra: Periodo = { da: sottraiAnni(fine, criterio.anni), a: fine };
  const minimo = criterio.importoMinimoUnitario === undefined ? undefined : inCentesimi(criterio.importoMinimoUnitario);

  let certo = 0;
  let incerto = 0;
  const fonti: Fonte[] = [];
  const note: string[] = [];
  const fuoriFinestra: string[] = [];

  for (const voce of fascicolo) {
    if (voce.tipo !== 'servizio') continue;
    if (!fattoValido(voce.periodo, contesto.dataRiferimento)) {
      note.push(`${descriviVoce(voce)}: ${motivoNonValido(voce.periodo, contesto.dataRiferimento)}`);
      continue;
    }
    if (!siSovrappongono(voce.periodo.valore, finestra)) {
      fuoriFinestra.push(`«${voce.oggetto}» (${formattaData(voce.periodo.valore.da)} – ${formattaData(voce.periodo.valore.a)})`);
      continue;
    }
    if (minimo !== undefined && inCentesimi(voce.importo) < minimo) {
      note.push(`${descriviVoce(voce)}: importo ${formattaEuro(voce.importo)} sotto il minimo unitario di ${formattaEuro(criterio.importoMinimoUnitario ?? 0)}`);
      continue;
    }
    fonti.push(voce.periodo.fonte);
    if (coincidono(voce.cpv, criterio.cpv)) {
      certo += pesoServizio(criterio, voce.importo);
    } else {
      incerto += pesoServizio(criterio, voce.importo);
      note.push(`${descriviVoce(voce)}: CPV ${voce.cpv} diverso da quello di gara ${criterio.cpv}, analogia da valutare`);
    }
  }

  if (fuoriFinestra.length > 0) {
    note.push(`fuori dalla finestra ${formattaData(finestra.da)} – ${formattaData(finestra.a)}: ${fuoriFinestra.join(', ')}`);
  }
  if (certo === 0 && incerto === 0 && fonti.length === 0 && note.length === 0) {
    note.push('nessun servizio nel fascicolo');
  }

  return { valore: { tipo: 'misura', certo, incerto }, fonti, note };
}

// ─── Ingresso ────────────────────────────────────────────────

export function valutaCriterio(criterio: Criterio, fascicolo: VoceFascicolo[], contesto: ContestoCriterio): ContributoGrezzo {
  switch (criterio.tipo) {
    case 'dichiarazione':
      return valutaDichiarazione(criterio.oggetto, fascicolo, contesto.dataRiferimento);
    case 'certificazione':
      return valutaCertificazione(criterio.norma, criterio.scope, fascicolo, contesto.dataRiferimento);
    case 'iscrizione':
      return valutaIscrizione(criterio.registro, criterio.attivita, fascicolo, contesto.dataRiferimento);
    case 'fatturato':
      return valutaFatturato(criterio, fascicolo, contesto);
    case 'servizi':
    case 'servizi_importo':
      return valutaServizi(criterio, fascicolo, contesto);
    default:
      return assertNever(criterio);
  }
}
