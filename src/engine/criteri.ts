// Criteri: quali fatti del fascicolo soddisfano un requisito.
// Un solo soggetto alla volta; la composizione tra soggetti sta altrove.
// Lavora su criteri RISOLTI: ogni rinvio è già un numero.
//
// Le misure in euro sono in CENTESIMI in tutto questo modulo: la
// conversione in euro avviene una volta sola, costruendo l'esito.

import { assertNever } from '../assertNever';
import type {
  AmbitoFatturato,
  Ancoraggio,
  Assunzione,
  CriterioRisolto,
  DataISO,
  Fatto,
  Fonte,
  Unita,
  ValoreContributo,
  VoceFascicolo,
} from '../domain';
import { formattaData, formattaEuro } from '../formato';
import { annoDi, giorniTra, siSovrappongono, sottraiAnni, type Periodo } from './date';
import { inCentesimi, type Centesimi } from './importi';
import { coincidono, normalizza } from './testo';
import { descriviVoce } from './voci';

export type ContestoCriterio = {
  dataRiferimento: DataISO;
  /** Assente quando il documento non la scrive: un criterio che la richiede è un'anomalia a monte. */
  dataPubblicazione?: DataISO;
  /** L'unica data certa del bando: l'ancoraggio quando il documento non ne dichiara uno. */
  terminePresentazione: DataISO;
};

/** Il criterio su cui si calcola un contributo: un criterio non determinato non ha contributi. */
export type CriterioValutabile = Exclude<CriterioRisolto, { tipo: 'non_determinato' }>;

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

/**
 * Valore, fatti usati, fatti scaduti, note che spiegano cosa non ha
 * contato, assunzioni del motore, e i giudizi che servirebbero: ciò che
 * il motore non può confrontare e che rende il valore incerto.
 */
export type ContributoGrezzo = {
  valore: ValoreContributo;
  usati: FattoUsato[];
  scaduti: FattoScaduto[];
  note: string[];
  /** Regole del motore, non del disciplinare, che hanno inciso: dichiarate a chi legge. */
  assunzioni: Assunzione[];
  /** L'oggetto di ogni giudizio semantico richiesto: "equivalenza tra «x» e «y»". */
  giudizi: string[];
};

// ─── Proprietà del criterio ──────────────────────────────────

export function unitaDi(criterio: CriterioRisolto): Unita | undefined {
  switch (criterio.tipo) {
    case 'fatturato':
    case 'servizi_importo':
      return { tipo: 'euro' };
    case 'servizi':
      return { tipo: 'conteggio', sostantivo: criterio.sostantivo };
    case 'dichiarazione':
    case 'certificazione':
    case 'iscrizione':
    case 'non_determinato':
      return undefined;
    default:
      return assertNever(criterio);
  }
}

/** Soglia in unità interne. Per i criteri di possesso vale 1: "lo possiede". */
export function sogliaInterna(criterio: CriterioRisolto): number {
  switch (criterio.tipo) {
    case 'fatturato':
    case 'servizi_importo':
      return inCentesimi(criterio.soglia);
    case 'servizi':
      return criterio.numeroMinimo;
    case 'dichiarazione':
    case 'certificazione':
    case 'iscrizione':
    case 'non_determinato':
      return 1;
    default:
      return assertNever(criterio);
  }
}

export type DataAncorata = { data: DataISO; assunzione?: Assunzione };

/**
 * La data da cui parte una finestra a ritroso. Se il disciplinare non
 * dichiara l'ancoraggio, vale il termine di presentazione, dichiarato come
 * assunzione. L'ancoraggio alla pubblicazione senza data è un'anomalia a
 * monte: qui è un'invariante violata, non un caso da gestire in silenzio.
 */
export function dataAncoraggio(ancoraggio: Ancoraggio, contesto: ContestoCriterio, finestra: string): DataAncorata {
  switch (ancoraggio) {
    case 'pubblicazione':
      if (contesto.dataPubblicazione === undefined) {
        throw new Error('Ancoraggio alla pubblicazione senza data di pubblicazione: la validazione avrebbe dovuto fermarsi prima.');
      }
      return { data: contesto.dataPubblicazione };
    case 'riferimento':
      return { data: contesto.dataRiferimento };
    case 'non_dichiarato':
      return {
        data: contesto.terminePresentazione,
        assunzione: {
          codice: 'ancoraggio_termine_presentazione',
          testo: `La finestra «${finestra}» non ha un ancoraggio dichiarato nel disciplinare: è stata ancorata al termine di presentazione (${formattaData(contesto.terminePresentazione)}), l'unica data certa del bando. È un'assunzione del motore, non del disciplinare.`,
        },
      };
    default:
      return assertNever(ancoraggio);
  }
}

// ─── Validità dei fatti ──────────────────────────────────────

function fattoValido(fatto: Fatto<unknown>, data: DataISO): boolean {
  if (fatto.validoDa !== undefined && data < fatto.validoDa) return false;
  if (fatto.validoA !== undefined && data > fatto.validoA) return false;
  return true;
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

function grezzo(parziale: Partial<ContributoGrezzo> & { valore: ValoreContributo }): ContributoGrezzo {
  return { usati: [], scaduti: [], note: [], assunzioni: [], giudizi: [], ...parziale };
}

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
    return grezzo({ valore: ASSENTE, scaduti, note });
  }

  if (attributoRichiesto === undefined) {
    return grezzo({ valore: { tipo: 'possesso', esito: 'posseduto' }, usati: valide.map((p) => p.usato), scaduti });
  }

  const coincidenti = valide.filter((p) => p.attributo !== undefined && coincidono(p.attributo, attributoRichiesto));
  if (coincidenti.length > 0) {
    return grezzo({ valore: { tipo: 'possesso', esito: 'posseduto' }, usati: coincidenti.map((p) => p.usato), scaduti });
  }

  return grezzo({
    valore: { tipo: 'possesso', esito: 'da_verificare' },
    usati: valide.map((p) => p.usato),
    scaduti,
    note: valide.map((p) => `${descrizioneRichiesta} con «${p.attributo ?? ''}» invece di «${attributoRichiesto}»: equivalenza da valutare`),
    giudizi: valide.map((p) => `equivalenza tra «${p.attributo ?? ''}» e «${attributoRichiesto}» (${descrizioneRichiesta})`),
  });
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

/** Più norme in alternativa: ne basta una (ASL Roma 6, §6.3 a: "ISO 9001:2015 … e/o ISO 13485"). */
function valutaCertificazione(norme: readonly string[], scope: string | undefined, fascicolo: VoceFascicolo[], data: DataISO): ContributoGrezzo {
  const pertinenti = [];
  for (const voce of fascicolo) {
    if (voce.tipo === 'certificazione' && norme.some((n) => coincidono(voce.norma, n))) pertinenti.push({ voce, fatto: voce.possesso, attributo: voce.scope });
  }
  return componiPossesso(separaPerValidita(pertinenti, data), scope, `certificazione ${norme.join(' o ')}`);
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

/** "2020–2022" se contigui, altrimenti l'elenco. */
export function descriviEsercizi(anni: number[]): string {
  const ordinati = [...anni].sort((a, b) => a - b);
  const primo = ordinati[0];
  const ultimo = ordinati[ordinati.length - 1];
  if (primo === undefined || ultimo === undefined) return '';
  const contigui = ordinati.every((a, i) => a === primo + i);
  return contigui && ordinati.length > 1 ? `${primo}–${ultimo}` : ordinati.join(', ');
}

/** Gli esercizi che il criterio considera, e l'eventuale assunzione sull'ancoraggio. */
function eserciziDi(criterio: Extract<CriterioRisolto, { tipo: 'fatturato' }>, contesto: ContestoCriterio): { anni: number[]; assunzione?: Assunzione } {
  const { periodo } = criterio;
  switch (periodo.tipo) {
    case 'esercizi':
      return { anni: [...periodo.anni].sort((a, b) => a - b) };
    case 'a_ritroso': {
      const ancorata = dataAncoraggio(periodo.ancoraggio, contesto, `ultimi ${periodo.esercizi} esercizi`);
      const annoFine = annoDi(ancorata.data) - 1;
      const annoInizio = annoFine - periodo.esercizi + 1;
      return { anni: Array.from({ length: periodo.esercizi }, (_, i) => annoInizio + i), assunzione: ancorata.assunzione };
    }
    default:
      return assertNever(periodo);
  }
}

function valutaFatturato(
  criterio: Extract<CriterioRisolto, { tipo: 'fatturato' }>,
  fascicolo: VoceFascicolo[],
  contesto: ContestoCriterio,
): ContributoGrezzo {
  const { anni, assunzione } = eserciziDi(criterio, contesto);
  const richiesti = new Set(anni);

  let certo: Centesimi = 0;
  const usati: FattoUsato[] = [];
  const note: string[] = [];
  const coperti = new Set<number>();

  for (const voce of fascicolo) {
    if (voce.tipo !== 'fatturato' || !ambitiCoincidono(criterio.ambito, voce.ambito)) continue;
    if (!richiesti.has(voce.esercizio)) continue;
    certo += inCentesimi(voce.importo.valore);
    usati.push({ descrizione: descriviVoce(voce), fonte: voce.importo.fonte });
    coperti.add(voce.esercizio);
  }

  const mancanti = anni.filter((e) => !coperti.has(e));
  if (mancanti.length === anni.length) {
    note.push(`nessun fatturato nell'ambito ${descriviAmbito(criterio.ambito)} per gli esercizi ${descriviEsercizi(anni)}`);
  } else if (mancanti.length > 0) {
    note.push(`nessun fatturato nell'ambito ${descriviAmbito(criterio.ambito)} per ${mancanti.length === 1 ? "l'esercizio" : 'gli esercizi'} ${mancanti.join(', ')}`);
  }

  return grezzo({ valore: { tipo: 'misura', certo, incerto: 0 }, usati, note, assunzioni: assunzione ? [assunzione] : [] });
}

// ─── Servizi ─────────────────────────────────────────────────

type CriterioServizi = Extract<CriterioRisolto, { tipo: 'servizi' | 'servizi_importo' }>;

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

function valutaServizi(criterio: CriterioServizi, fascicolo: VoceFascicolo[], contesto: ContestoCriterio): ContributoGrezzo {
  const ancorata = dataAncoraggio(criterio.ancoraggio, contesto, `ultimi ${criterio.anni} anni`);
  const fine = ancorata.data;
  const finestra: Periodo = { da: sottraiAnni(fine, criterio.anni), a: fine };
  const minimo = criterio.importoMinimoUnitario === undefined ? undefined : inCentesimi(criterio.importoMinimoUnitario);
  const ancoraggioAssunto = criterio.ancoraggio === 'non_dichiarato';

  let certo = 0;
  let incerto = 0;
  const usati: FattoUsato[] = [];
  const note: string[] = [];
  const giudizi: string[] = [];
  const fuoriFinestra: string[] = [];
  const nonAnaloghi: string[] = [];
  /**
   * Con ancoraggio assunto: di quanto potrebbe arretrare senza cambiare chi
   * conta (il margine più stretto tra le voci contate) e di quanto dovrebbe
   * arretrare perché entri la prima esclusa. Numeri dai dati, non tolleranze.
   */
  let margineContate: { giorni: number; oggetto: string } | undefined;
  let primaEsclusa: { giorni: number; oggetto: string } | undefined;

  for (const voce of fascicolo) {
    if (voce.tipo !== 'servizio') continue;
    const periodo = voce.periodo.valore;
    if (!siSovrappongono(periodo, finestra)) {
      fuoriFinestra.push(`«${voce.oggetto}» (${formattaData(periodo.da)} – ${formattaData(periodo.a)})`);
      if (ancoraggioAssunto && periodo.a < finestra.da) {
        const giorni = giorniTra(periodo.a, finestra.da);
        if (!primaEsclusa || giorni < primaEsclusa.giorni) primaEsclusa = { giorni, oggetto: voce.oggetto };
      }
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
        giudizi.push(`analogia del CPV ${voce.cpv} con ${criterio.cpv} per «${voce.oggetto}»`);
        break;
      case 'non_analogo':
        nonAnaloghi.push(`«${voce.oggetto}» (CPV ${voce.cpv})`);
        break;
      default:
        assertNever(classe);
    }
    if (ancoraggioAssunto && classe !== 'non_analogo') {
      const giorni = giorniTra(periodo.da, fine);
      if (!margineContate || giorni < margineContate.giorni) margineContate = { giorni, oggetto: voce.oggetto };
    }
  }

  const assunzioni: Assunzione[] = ancorata.assunzione ? [ancorata.assunzione] : [];
  if (nonAnaloghi.length > 0) {
    note.push(`non analoghi per classe CPV, non contati: ${nonAnaloghi.join(', ')}`);
    const ammessi = [criterio.cpv, ...(criterio.cpvEquivalenti ?? [])].join(' o ');
    assunzioni.push({
      codice: 'classe_cpv',
      testo: `I servizi il cui CPV non condivide le prime ${criterio.cifreCpvComuni ?? 0} cifre con ${ammessi} sono stati esclusi come non analoghi: il numero di cifre è un dato del criterio, la regola sulla struttura del CPV è del motore, non del disciplinare.`,
    });
  }
  if (fuoriFinestra.length > 0) {
    note.push(`fuori dalla finestra ${formattaData(finestra.da)} – ${formattaData(finestra.a)}: ${fuoriFinestra.join(', ')}`);
  }
  if (margineContate || primaEsclusa) {
    const parti: string[] = [];
    if (margineContate) parti.push(`quelle contate restano nella finestra fino a un arretramento di ${margineContate.giorni} giorni (la più esposta è «${margineContate.oggetto}»)`);
    if (primaEsclusa) parti.push(`con un arretramento di almeno ${primaEsclusa.giorni} giorni conterebbe anche «${primaEsclusa.oggetto}»`);
    note.push(`ancoraggio assunto al termine di presentazione: ${parti.join('; ')}`);
  }
  if (certo === 0 && incerto === 0 && usati.length === 0 && note.length === 0) {
    note.push('nessun servizio nel fascicolo');
  }

  return grezzo({ valore: { tipo: 'misura', certo, incerto }, usati, note, assunzioni, giudizi });
}

// ─── Ingresso ────────────────────────────────────────────────

export function valutaCriterio(criterio: CriterioValutabile, fascicolo: VoceFascicolo[], contesto: ContestoCriterio): ContributoGrezzo {
  switch (criterio.tipo) {
    case 'dichiarazione':
      return valutaDichiarazione(criterio.oggetto, fascicolo);
    case 'certificazione':
      return valutaCertificazione(criterio.norme, criterio.scope, fascicolo, contesto.dataRiferimento);
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
