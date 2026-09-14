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
import { coincidono, normalizza } from './testo';
import { descriviVoce } from './voci';

export type ContestoCriterio = {
  dataRiferimento: DataISO;
  dataPubblicazione: DataISO;
};

/** Un fatto che ha contato, con la sua fonte e, se può scadere, la scadenza. */
export type FattoUsato = {
  descrizione: string;
  fonte: Fonte;
  scadeIl?: DataISO;
};

/** Un fatto pertinente ma scaduto alla data di riferimento: candidato al rinnovo. */
export type FattoScaduto = {
  descrizione: string;
  fonte: Fonte;
  scadutoIl: DataISO;
};

/** Valore, fatti usati, fatti scaduti e note che spiegano cosa non ha contato. */
export type ContributoGrezzo = {
  valore: ValoreContributo;
  usati: FattoUsato[];
  scaduti: FattoScaduto[];
  note: string[];
};

// ─── Proprietà del criterio ──────────────────────────────────

export function unitaDi(criterio: Criterio): Unita | undefined {
  switch (criterio.tipo) {
    case 'fatturato':
    case 'servizi_importo':
      return { tipo: 'euro' };
    case 'servizi':
      return { tipo: 'conteggio', sostantivo: criterio.sostantivo };
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

/** Una voce di possesso: la validità è già stata verificata, o non esiste. */
type VocePossesso = { voce: VoceFascicolo; usato: FattoUsato; attributo?: string };

type VociPerValidita = { valide: VocePossesso[]; scaduti: FattoScaduto[]; noteNonValide: string[] };

/**
 * Possesso con attributo opzionale (scope, attività): posseduto se coincide,
 * da verificare se diverso, assente se nessuna voce valida.
 */
function componiPossesso(
  { valide, scaduti, noteNonValide }: VociPerValidita,
  attributoRichiesto: string | undefined,
  descrizioneRichiesta: string,
): ContributoGrezzo {
  if (valide.length === 0) {
    const note = noteNonValide.length === 0 ? [`nessuna ${descrizioneRichiesta} nel fascicolo`] : noteNonValide;
    return { valore: ASSENTE, usati: [], scaduti, note };
  }

  if (attributoRichiesto === undefined) {
    return { valore: { tipo: 'possesso', esito: 'posseduto' }, usati: valide.map((p) => p.usato), scaduti, note: [] };
  }

  const coincidenti = valide.filter((p) => p.attributo !== undefined && coincidono(p.attributo, attributoRichiesto));
  if (coincidenti.length > 0) {
    return { valore: { tipo: 'possesso', esito: 'posseduto' }, usati: coincidenti.map((p) => p.usato), scaduti, note: [] };
  }

  return {
    valore: { tipo: 'possesso', esito: 'da_verificare' },
    usati: valide.map((p) => p.usato),
    scaduti,
    note: valide.map((p) => `${descrizioneRichiesta} con «${p.attributo ?? ''}» invece di «${attributoRichiesto}»: equivalenza da valutare`),
  };
}

/** Separa le voci valide alla data da quelle scadute o non ancora valide. */
function separaPerValidita(
  voci: { voce: VoceFascicolo; fatto: Fatto<true>; attributo?: string }[],
  data: DataISO,
): VociPerValidita {
  const valide: VocePossesso[] = [];
  const scaduti: FattoScaduto[] = [];
  const noteNonValide: string[] = [];
  for (const { voce, fatto, attributo } of voci) {
    if (fattoValido(fatto, data)) {
      valide.push({ voce, usato: { descrizione: descriviVoce(voce), fonte: fatto.fonte, scadeIl: fatto.validoA }, attributo });
      continue;
    }
    noteNonValide.push(`${descriviVoce(voce)}: ${motivoNonValido(fatto, data)}`);
    if (fatto.validoA !== undefined && data > fatto.validoA) {
      scaduti.push({ descrizione: descriviVoce(voce), fonte: fatto.fonte, scadutoIl: fatto.validoA });
    }
  }
  return { valide, scaduti, noteNonValide };
}

/** Una dichiarazione non ha validità: o è resa, o non c'è. */
function valutaDichiarazione(oggetto: string, fascicolo: VoceFascicolo[]): ContributoGrezzo {
  const rese: VocePossesso[] = [];
  for (const voce of fascicolo) {
    if (voce.tipo === 'dichiarazione' && coincidono(voce.oggetto, oggetto)) rese.push({ voce, usato: { descrizione: descriviVoce(voce), fonte: voce.resa.fonte } });
  }
  return componiPossesso({ valide: rese, scaduti: [], noteNonValide: [] }, undefined, `dichiarazione «${oggetto}»`);
}

function valutaCertificazione(norma: string, scope: string | undefined, fascicolo: VoceFascicolo[], data: DataISO): ContributoGrezzo {
  const pertinenti = [];
  for (const voce of fascicolo) {
    if (voce.tipo === 'certificazione' && coincidono(voce.norma, norma)) pertinenti.push({ voce, fatto: voce.possesso, attributo: voce.scope });
  }
  return componiPossesso(separaPerValidita(pertinenti, data), scope, `certificazione ${norma}`);
}

function valutaIscrizione(registro: string, attivita: string | undefined, fascicolo: VoceFascicolo[], data: DataISO): ContributoGrezzo {
  const pertinenti = [];
  for (const voce of fascicolo) {
    if (voce.tipo === 'iscrizione' && coincidono(voce.registro, registro)) pertinenti.push({ voce, fatto: voce.possesso, attributo: voce.attivita });
  }
  return componiPossesso(separaPerValidita(pertinenti, data), attivita, `iscrizione ${registro}`);
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
  const usati: FattoUsato[] = [];
  const note: string[] = [];
  const coperti = new Set<number>();

  for (const voce of fascicolo) {
    if (voce.tipo !== 'fatturato' || !ambitiCoincidono(criterio.ambito, voce.ambito)) continue;
    if (voce.esercizio < annoInizio || voce.esercizio > annoFine) continue;
    certo += inCentesimi(voce.importo.valore);
    usati.push({ descrizione: descriviVoce(voce), fonte: voce.importo.fonte });
    coperti.add(voce.esercizio);
  }

  const mancanti = esercizi.filter((e) => !coperti.has(e));
  if (mancanti.length === esercizi.length) {
    note.push(`nessun fatturato nell'ambito ${descriviAmbito(criterio.ambito)} per gli esercizi ${annoInizio}–${annoFine}`);
  } else if (mancanti.length > 0) {
    note.push(`nessun fatturato nell'ambito ${descriviAmbito(criterio.ambito)} per ${mancanti.length === 1 ? "l'esercizio" : 'gli esercizi'} ${mancanti.join(', ')}`);
  }

  return { valore: { tipo: 'misura', certo, incerto: 0 }, usati, scaduti: [], note };
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

/**
 * Come un CPV si colloca rispetto a quello di gara:
 * uguale o dichiarato equivalente → certo; stessa divisione (prime
 * `cifreCpvComuni` cifre) o nessuna soglia dichiarata → da verificare;
 * divisione diversa → non analogo, non conta.
 */
type EsitoCpv = 'certo' | 'da_verificare' | 'non_analogo';

function classificaCpv(cpv: string, criterio: CriterioServizi): EsitoCpv {
  const ammessi = [criterio.cpv, ...(criterio.cpvEquivalenti ?? [])];
  if (ammessi.some((a) => coincidono(a, cpv))) return 'certo';
  if (criterio.cifreCpvComuni === undefined) return 'da_verificare';
  const prefisso = (c: string) => normalizza(c).slice(0, criterio.cifreCpvComuni);
  return ammessi.some((a) => prefisso(a) === prefisso(cpv)) ? 'da_verificare' : 'non_analogo';
}

const ASSUNZIONE_CPV = 'regola del motore sulla struttura del CPV, non del disciplinare';

function valutaServizi(criterio: CriterioServizi, fascicolo: VoceFascicolo[], contesto: ContestoCriterio): ContributoGrezzo {
  const fine = dataAncoraggio(criterio.ancoraggio, contesto);
  const finestra: Periodo = { da: sottraiAnni(fine, criterio.anni), a: fine };
  const minimo = criterio.importoMinimoUnitario === undefined ? undefined : inCentesimi(criterio.importoMinimoUnitario);

  let certo = 0;
  let incerto = 0;
  const usati: FattoUsato[] = [];
  const note: string[] = [];
  const fuoriFinestra: string[] = [];
  const nonAnaloghi: string[] = [];

  for (const voce of fascicolo) {
    if (voce.tipo !== 'servizio') continue;
    if (!siSovrappongono(voce.periodo.valore, finestra)) {
      fuoriFinestra.push(`«${voce.oggetto}» (${formattaData(voce.periodo.valore.da)} – ${formattaData(voce.periodo.valore.a)})`);
      continue;
    }
    if (minimo !== undefined && inCentesimi(voce.importo) < minimo) {
      note.push(`${descriviVoce(voce)}: importo ${formattaEuro(voce.importo)} sotto il minimo unitario di ${formattaEuro(criterio.importoMinimoUnitario ?? 0)}`);
      continue;
    }
    const classe = classificaCpv(voce.cpv, criterio);
    switch (classe) {
      case 'certo':
        usati.push({ descrizione: descriviVoce(voce), fonte: voce.periodo.fonte });
        certo += pesoServizio(criterio, voce.importo);
        break;
      case 'da_verificare':
        usati.push({ descrizione: descriviVoce(voce), fonte: voce.periodo.fonte });
        incerto += pesoServizio(criterio, voce.importo);
        note.push(`${descriviVoce(voce)}: CPV ${voce.cpv} diverso da quello di gara ${criterio.cpv}, analogia da valutare`);
        break;
      case 'non_analogo':
        nonAnaloghi.push(`«${voce.oggetto}» (CPV ${voce.cpv})`);
        break;
      default:
        assertNever(classe);
    }
  }

  if (nonAnaloghi.length > 0) {
    note.push(`non analoghi perché non condividono le prime ${criterio.cifreCpvComuni ?? 0} cifre del CPV ${criterio.cpv} (${ASSUNZIONE_CPV}): ${nonAnaloghi.join(', ')}`);
  }
  if (fuoriFinestra.length > 0) {
    note.push(`fuori dalla finestra ${formattaData(finestra.da)} – ${formattaData(finestra.a)}: ${fuoriFinestra.join(', ')}`);
  }
  if (certo === 0 && incerto === 0 && usati.length === 0 && note.length === 0) {
    note.push('nessun servizio nel fascicolo');
  }

  return { valore: { tipo: 'misura', certo, incerto }, usati, scaduti: [], note };
}

// ─── Ingresso ────────────────────────────────────────────────

export function valutaCriterio(criterio: Criterio, fascicolo: VoceFascicolo[], contesto: ContestoCriterio): ContributoGrezzo {
  switch (criterio.tipo) {
    case 'dichiarazione':
      return valutaDichiarazione(criterio.oggetto, fascicolo);
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
