// Motivazioni in italiano. Il testo è il prodotto quanto il verdetto:
// nomina tutti i membri sotto soglia, mostra i numeri da cui escono i
// minimi, dichiara ciò che è un'assunzione del motore.

import { assertNever } from '../assertNever';
import type { Assunzione, RegolaComposizione, RuoloEsecutore, SoggettoId, StatoRequisito, Unita, ValoreContributo } from '../domain';
import { formattaConUnita, formattaNumero, formattaPercentuale } from '../formato';
import { inEuro } from './importi';
import { frazioneMinima, type MisurazioneGrezza } from './operatori';

/** Un membro come lo vede la motivazione. Valori in unità interne. */
export type RigaMotivazione = {
  soggettoId: SoggettoId;
  denominazione: string;
  ruolo: RuoloEsecutore;
  conteggiato: boolean;
  /** Quota sulla prestazione della regola, se la regola è dell'esecutore. */
  quota?: number;
  /** Il valore composto con le eventuali ausiliarie: quello che la regola ha visto. */
  composto: ValoreContributo;
  note: string[];
  ausiliarie: string[];
};

export type DatiMotivazione = {
  regola: RegolaComposizione;
  stato: StatoRequisito;
  unita: Unita | undefined;
  soglia: number;
  righe: RigaMotivazione[];
  misurazione: MisurazioneGrezza;
  descrizionePrestazione?: string;
};

const GIUDIZIO = 'Il confronto che manca è un giudizio semantico: decide una persona, non il motore.';

// ─── Formattazione ───────────────────────────────────────────

/** Valori interni → testo: gli euro sono in centesimi, i conteggi hanno un nome. */
function formattaValore(valore: number, unita: Unita | undefined): string {
  if (unita === undefined) return formattaNumero(valore);
  switch (unita.tipo) {
    case 'euro':
      return formattaConUnita(inEuro(valore), unita);
    case 'conteggio':
      return formattaConUnita(valore, unita);
    default:
      return assertNever(unita);
  }
}

function nome(riga: RigaMotivazione): string {
  if (riga.ausiliarie.length === 0) return riga.denominazione;
  return `${riga.denominazione} (con l'ausiliaria ${riga.ausiliarie.join(' e ')})`;
}

function conNote(testo: string, note: string[]): string {
  return note.length === 0 ? testo : `${testo} (${note.join('; ')})`;
}

function elenco(voci: string[]): string {
  return voci.join('; ');
}

// ─── Possesso ────────────────────────────────────────────────

type EsitoPossesso = 'posseduto' | 'da_verificare' | 'assente';

function esitoPossesso(valore: ValoreContributo): EsitoPossesso {
  switch (valore.tipo) {
    case 'possesso':
      return valore.esito;
    case 'misura':
      return valore.certo > 0 ? 'posseduto' : valore.incerto > 0 ? 'da_verificare' : 'assente';
    default:
      return assertNever(valore);
  }
}

/** Ogni membro conteggiato deve possederlo. */
function possessoPerCiascuno(righe: RigaMotivazione[]): string {
  const conteggiate = righe.filter((r) => r.conteggiato);
  const assenti = conteggiate.filter((r) => esitoPossesso(r.composto) === 'assente');
  const riserva = conteggiate.filter((r) => esitoPossesso(r.composto) === 'da_verificare');
  const frasi: string[] = [];

  if (assenti.length > 0) {
    frasi.push(`manca a ${elenco(assenti.map((r) => conNote(nome(r), r.note)))}`);
  }
  if (riserva.length > 0) {
    frasi.push(`${elenco(riserva.map((r) => conNote(nome(r), r.note)))} ${riserva.length === 1 ? 'lo possiede' : 'lo possiedono'} con riserva`);
  }
  if (assenti.length === 0 && riserva.length === 0) {
    frasi.push(conteggiate.length === 1
      ? `${nome(conteggiate[0] as RigaMotivazione)} lo possiede`
      : `tutti e ${conteggiate.length} i membri lo possiedono`);
  }
  return frasi.join('; ');
}

/** Basta un membro. */
function possessoAlmenoUno(righe: RigaMotivazione[]): string {
  const possessori = righe.filter((r) => esitoPossesso(r.composto) === 'posseduto');
  if (possessori.length > 0) {
    return `${possessori.length === 1 ? 'lo possiede' : 'lo possiedono'} ${possessori.map(nome).join(', ')}`;
  }
  const riserva = righe.filter((r) => esitoPossesso(r.composto) === 'da_verificare');
  if (riserva.length > 0) {
    return `nessuno lo possiede con certezza; ${elenco(riserva.map((r) => conNote(nome(r), r.note)))} con riserva`;
  }
  return `nessun membro lo possiede (${elenco(righe.map((r) => conNote(nome(r), r.note)))})`;
}

// ─── Misura ──────────────────────────────────────────────────

function certoDi(valore: ValoreContributo): number {
  return valore.tipo === 'misura' ? valore.certo : esitoPossesso(valore) === 'posseduto' ? 1 : 0;
}

function incertoDi(valore: ValoreContributo): number {
  return valore.tipo === 'misura' ? valore.incerto : esitoPossesso(valore) === 'da_verificare' ? 1 : 0;
}

/** "Alfa raggiunge 2.100.000 €" / "Beta 200.000 €, mancano 100.000 €". */
function misuraControSoglia(riga: RigaMotivazione, soglia: number, unita: Unita | undefined): string {
  const certo = certoDi(riga.composto);
  const incerto = incertoDi(riga.composto);
  const fmt = (v: number) => formattaValore(v, unita);

  if (certo >= soglia) return conNote(`${nome(riga)} raggiunge ${fmt(certo)}`, riga.note);
  if (certo + incerto >= soglia) {
    return conNote(`${nome(riga)} ${fmt(certo)} più ${fmt(incerto)} da verificare: raggiunge la soglia solo con la parte da verificare`, riga.note);
  }
  const mancano = soglia - certo - incerto;
  const testo = incerto > 0
    ? `${nome(riga)} ${fmt(certo)} più ${fmt(incerto)} da verificare, mancano ${fmt(mancano)} anche contandoli`
    : `${nome(riga)} ${fmt(certo)}, mancano ${fmt(soglia - certo)}`;
  return conNote(testo, riga.note);
}

function misuraPerCiascuno(righe: RigaMotivazione[], soglia: number, unita: Unita | undefined): string {
  const conteggiate = righe.filter((r) => r.conteggiato);
  return elenco(conteggiate.map((r) => misuraControSoglia(r, soglia, unita)));
}

function contributoDi(riga: RigaMotivazione, unita: Unita | undefined): string {
  const certo = certoDi(riga.composto);
  const incerto = incertoDi(riga.composto);
  const base = incerto > 0
    ? `${nome(riga)} ${formattaValore(certo, unita)} più ${formattaValore(incerto, unita)} da verificare`
    : `${nome(riga)} ${formattaValore(certo, unita)}`;
  return conNote(base, riga.note);
}

/** "Minimo della mandataria: 40 % di 3 = 1,2, quindi almeno 2 (…); Alfa raggiunge 2." */
function minimoDiRuolo(
  frazione: number,
  perMandataria: boolean,
  righe: RigaMotivazione[],
  misurazione: MisurazioneGrezza,
  soglia: number,
  unita: Unita | undefined,
): string | undefined {
  const minimi = misurazione.minimiRuolo.filter((m) => (m.ruolo === 'mandataria') === perMandataria);
  if (minimi.length === 0) return undefined;

  const fmt = (v: number) => formattaValore(v, unita);
  const grezzo = soglia * frazione;
  const richiesto = frazioneMinima(soglia, frazione);
  const arrotondato = Math.abs(grezzo - richiesto) > 1e-9;
  const calcolo = arrotondato
    ? `${formattaPercentuale(frazione)} di ${fmt(soglia)} = ${fmt(grezzo)}, quindi almeno ${fmt(richiesto)} (arrotondato per eccesso)`
    : `${formattaPercentuale(frazione)} di ${fmt(soglia)} = ${fmt(richiesto)}`;

  const raggiunti = minimi.map((m) => {
    const riga = righe.find((r) => r.soggettoId === m.soggettoId);
    const chi = riga ? nome(riga) : m.soggettoId;
    return m.delta > 0 ? `${chi} raggiunge ${fmt(m.raggiunto)}, mancano ${fmt(m.delta)}` : `${chi} raggiunge ${fmt(m.raggiunto)}`;
  });

  const intestazione = perMandataria ? 'Minimo della mandataria' : 'Minimo di ciascuna mandante';
  return `${intestazione}: ${calcolo}; ${elenco(raggiunti)}.`;
}

function somma(dati: DatiMotivazione): string {
  const { misurazione, soglia, unita, righe, regola } = dati;
  const fmt = (v: number) => formattaValore(v, unita);
  const frasi: string[] = [];

  let totale = `Somma dei contributi certi: ${fmt(misurazione.raggiunto)} su una soglia di ${fmt(soglia)}`;
  totale += misurazione.delta > 0 ? `: mancano ${fmt(misurazione.delta)}.` : ': soglia raggiunta.';
  frasi.push(totale);

  const incerto = misurazione.massimo - misurazione.raggiunto;
  if (incerto > 0) {
    frasi.push(misurazione.massimo >= soglia
      ? `Altri ${fmt(incerto)} dipendono da fatti da verificare: se reggono, la soglia è raggiunta.`
      : `Altri ${fmt(incerto)} dipendono da fatti da verificare: anche contandoli mancano ${fmt(soglia - misurazione.massimo)}.`);
  }

  frasi.push(`Contributi: ${elenco(righe.map((r) => contributoDi(r, unita)))}.`);

  if (regola.tipo === 'somma_membri') {
    const mandataria = regola.minimoMandataria === undefined ? undefined : minimoDiRuolo(regola.minimoMandataria, true, righe, misurazione, soglia, unita);
    const mandante = regola.minimoMandante === undefined ? undefined : minimoDiRuolo(regola.minimoMandante, false, righe, misurazione, soglia, unita);
    if (mandataria) frasi.push(mandataria);
    if (mandante) frasi.push(mandante);
  }
  return frasi.join(' ');
}

function misuraAlmenoUno(righe: RigaMotivazione[], soglia: number, unita: Unita | undefined): string {
  const fmt = (v: number) => formattaValore(v, unita);
  const migliore = righe.reduce<RigaMotivazione | undefined>((acc, r) => {
    if (!acc) return r;
    const ca = certoDi(acc.composto) + incertoDi(acc.composto);
    const cr = certoDi(r.composto) + incertoDi(r.composto);
    return certoDi(r.composto) > certoDi(acc.composto) || (certoDi(r.composto) === certoDi(acc.composto) && cr > ca) ? r : acc;
  }, undefined);
  if (!migliore) return 'nessun membro';
  const certo = certoDi(migliore.composto);
  const incerto = incertoDi(migliore.composto);
  if (certo >= soglia) return `il migliore è ${nome(migliore)} con ${fmt(certo)}`;
  if (certo + incerto >= soglia) return `il migliore è ${nome(migliore)} con ${fmt(certo)} più ${fmt(incerto)} da verificare: raggiunge la soglia solo con la parte da verificare`;
  return conNote(`il migliore è ${nome(migliore)} con ${fmt(certo)}, mancano ${fmt(soglia - certo)}`, migliore.note);
}

// ─── Ingresso ────────────────────────────────────────────────

function corpo(dati: DatiMotivazione): string {
  const { regola, righe, soglia, unita } = dati;
  const misurato = unita !== undefined;
  switch (regola.tipo) {
    case 'ciascun_membro': {
      const testo = misurato ? misuraPerCiascuno(righe, soglia, unita) : possessoPerCiascuno(righe);
      const intestazione = misurato ? `Richiesto a ciascun membro, con soglia ${formattaValore(soglia, unita)} per ciascuno` : 'Richiesto a ciascun membro';
      return `${intestazione}: ${testo}.`;
    }
    case 'esecutore_prestazione': {
      const esecutori = righe.filter((r) => r.conteggiato);
      const prestazione = `«${dati.descrizionePrestazione ?? regola.prestazioneId}»`;
      if (esecutori.length === 0) return `Richiesto a chi esegue ${prestazione}: nessun membro la esegue.`;
      const chi = esecutori.map((r) => `${nome(r)} (${formattaPercentuale(r.quota ?? 0)})`).join(', ');
      const testo = misurato ? misuraPerCiascuno(righe, soglia, unita) : possessoPerCiascuno(righe);
      const frasi = [`Richiesto a chi esegue ${prestazione}, cioè ${chi}: ${testo}.`];
      const nonEsecutoriInPossesso = righe.filter((r) => !r.conteggiato && certoDi(r.composto) >= soglia);
      if (nonEsecutoriInPossesso.length > 0) {
        frasi.push(`${nonEsecutoriInPossesso.map(nome).join(', ')} lo ${nonEsecutoriInPossesso.length === 1 ? 'possiede' : 'possiedono'} ma non esegue la prestazione.`);
      }
      return frasi.join(' ');
    }
    case 'somma_membri':
      return somma(dati);
    case 'almeno_un_membro': {
      const testo = misurato ? misuraAlmenoUno(righe, soglia, unita) : possessoAlmenoUno(righe);
      const intestazione = misurato ? `Basta un membro con almeno ${formattaValore(soglia, unita)}` : 'Basta un membro';
      return `${intestazione}: ${testo}.`;
    }
    default:
      return assertNever(regola);
  }
}

export function componiMotivazione(dati: DatiMotivazione): string {
  const testo = corpo(dati);
  return dati.stato === 'da_verificare' ? `${testo} ${GIUDIZIO}` : testo;
}

/** L'arrotondamento per eccesso dei minimi per ruolo è una regola del motore: va dichiarata. */
export function assunzioniArrotondamento(dati: DatiMotivazione): Assunzione[] {
  const { regola, soglia, unita } = dati;
  if (regola.tipo !== 'somma_membri') return [];
  const fmt = (v: number) => formattaValore(v, unita);
  const assunzioni: Assunzione[] = [];
  const dichiara = (frazione: number | undefined, ruolo: string) => {
    if (frazione === undefined) return;
    const grezzo = soglia * frazione;
    const richiesto = frazioneMinima(soglia, frazione);
    if (Math.abs(grezzo - richiesto) <= 1e-9) return;
    assunzioni.push({
      codice: 'arrotondamento_minimi',
      testo: `Il minimo ${ruolo} (${formattaPercentuale(frazione)} di ${fmt(soglia)} = ${fmt(grezzo)}) è stato arrotondato per eccesso a ${fmt(richiesto)}: in uno strumento di verifica si sbaglia dalla parte che costa meno. È un'assunzione del motore, non del disciplinare.`,
    });
  };
  dichiara(regola.minimoMandataria, 'della mandataria');
  dichiara(regola.minimoMandante, 'di ciascuna mandante');
  return assunzioni;
}
