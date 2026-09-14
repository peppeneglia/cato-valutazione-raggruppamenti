// I quattro operatori di composizione. Quattro funzioni, non un framework.
// Lavorano su valori già calcolati per soggetto (in unità interne) e non
// sanno né quale criterio li ha prodotti né a quale famiglia appartiene
// il requisito.
//
// Il quinto caso non è un operatore: la regola NON DICHIARATA dal
// disciplinare (ASL Roma 6, §6.4 p. 14, muto su tre requisiti su sei)
// non compone niente. Conta tutti i membri, non misura, ed esce da
// verificare. Nessun default "in mancanza si assume che…".

import { assertNever } from '../assertNever';
import type {
  MinimoRuolo,
  Misurazione,
  Prestazione,
  PrestazioneId,
  RegolaComposizione,
  RuoloEsecutore,
  SoggettoId,
  StatoRequisito,
  ValoreContributo,
} from '../domain';
import { quotaPositiva, quotaSu } from './quote';

/** Un membro esecutore con il valore che la regola deve comporre. */
export type Partecipante = {
  soggettoId: SoggettoId;
  ruolo: RuoloEsecutore;
  quote: Record<PrestazioneId, number>;
  valore: ValoreContributo;
};

export type Conteggio = { soggettoId: SoggettoId; conteggiato: boolean; nota?: string };

export type MisurazioneGrezza = Omit<Misurazione, 'unita'>;

export type EsitoOperatore = {
  stato: StatoRequisito;
  conteggi: Conteggio[];
  /** Assente quando non c'è una regola che misuri: nessun numero è meglio di un numero inventato. */
  misurazione?: MisurazioneGrezza;
};

// ─── Copertura di un singolo valore ──────────────────────────

type Copertura = { certo: number; massimo: number };

function coperturaDi(valore: ValoreContributo): Copertura {
  switch (valore.tipo) {
    case 'possesso':
      switch (valore.esito) {
        case 'posseduto':
          return { certo: 1, massimo: 1 };
        case 'da_verificare':
          return { certo: 0, massimo: 1 };
        case 'assente':
          return { certo: 0, massimo: 0 };
        default:
          return assertNever(valore.esito);
      }
    case 'misura':
      return { certo: valore.certo, massimo: valore.certo + valore.incerto };
    default:
      return assertNever(valore);
  }
}

/** Scoperto se nemmeno il massimo raggiunge la soglia; coperto se bastano i certi. */
function statoDi(copertura: Copertura, soglia: number): StatoRequisito {
  if (copertura.certo >= soglia) return 'coperto';
  if (copertura.massimo >= soglia) return 'da_verificare';
  return 'scoperto';
}

const PESO: Record<StatoRequisito, number> = { coperto: 0, da_verificare: 1, scoperto: 2 };

function peggiore(stati: StatoRequisito[]): StatoRequisito {
  return stati.reduce<StatoRequisito>((acc, s) => (PESO[s] > PESO[acc] ? s : acc), 'coperto');
}

/** "Almeno la frazione della soglia": si arrotonda per eccesso, mai per difetto. */
export function frazioneMinima(soglia: number, frazione: number): number {
  return Math.ceil(soglia * frazione - 1e-9);
}

function misurazione(raggiunto: number, massimo: number, soglia: number, minimiRuolo: MinimoRuolo[] = []): MisurazioneGrezza {
  return { soglia, raggiunto, massimo, delta: Math.max(0, soglia - raggiunto), minimiRuolo };
}

function tuttiConteggiati(partecipanti: Partecipante[]): Conteggio[] {
  return partecipanti.map((p) => ({ soggettoId: p.soggettoId, conteggiato: true }));
}

// ─── Operatori ───────────────────────────────────────────────

/** Ogni membro deve raggiungere la soglia da solo. Il peggiore decide. */
function ciascunMembro(partecipanti: Partecipante[], soglia: number): EsitoOperatore {
  const coperture = partecipanti.map((p) => coperturaDi(p.valore));
  if (coperture.length === 0) {
    return { stato: 'scoperto', conteggi: [], misurazione: misurazione(0, 0, soglia) };
  }
  return {
    stato: peggiore(coperture.map((c) => statoDi(c, soglia))),
    conteggi: tuttiConteggiati(partecipanti),
    misurazione: misurazione(
      Math.min(...coperture.map((c) => c.certo)),
      Math.min(...coperture.map((c) => c.massimo)),
      soglia,
    ),
  };
}

/** I contributi si sommano; i minimi per ruolo sono scoperture a sé. */
function sommaMembri(
  partecipanti: Partecipante[],
  soglia: number,
  minimoMandataria: number | undefined,
  minimoMandante: number | undefined,
): EsitoOperatore {
  const coperture = partecipanti.map((p) => coperturaDi(p.valore));
  const totale: Copertura = {
    certo: coperture.reduce((s, c) => s + c.certo, 0),
    massimo: coperture.reduce((s, c) => s + c.massimo, 0),
  };

  const minimiRuolo: MinimoRuolo[] = [];
  const statiMinimi: StatoRequisito[] = [];
  partecipanti.forEach((p, i) => {
    const frazione = p.ruolo === 'mandataria' ? minimoMandataria : minimoMandante;
    if (frazione === undefined) return;
    const richiesto = frazioneMinima(soglia, frazione);
    const copertura = coperture[i];
    if (!copertura) return;
    minimiRuolo.push({
      soggettoId: p.soggettoId,
      ruolo: p.ruolo,
      richiesto,
      raggiunto: copertura.certo,
      delta: Math.max(0, richiesto - copertura.certo),
    });
    statiMinimi.push(statoDi(copertura, richiesto));
  });

  return {
    stato: peggiore([statoDi(totale, soglia), ...statiMinimi]),
    conteggi: tuttiConteggiati(partecipanti),
    misurazione: misurazione(totale.certo, totale.massimo, soglia, minimiRuolo),
  };
}

/** Lo devono raggiungere tutti i membri con quota > 0 sulla prestazione. */
function esecutorePrestazione(
  partecipanti: Partecipante[],
  soglia: number,
  prestazioneId: PrestazioneId,
  descrizionePrestazione: string,
): EsitoOperatore {
  const esecutori = partecipanti.filter((p) => quotaPositiva(quotaSu(p.quote, prestazioneId)));
  const conteggi: Conteggio[] = partecipanti.map((p) =>
    esecutori.includes(p)
      ? { soggettoId: p.soggettoId, conteggiato: true }
      : { soggettoId: p.soggettoId, conteggiato: false, nota: `non esegue la prestazione «${descrizionePrestazione}»` },
  );
  const composizione = ciascunMembro(esecutori, soglia);
  return { stato: composizione.stato, conteggi, misurazione: composizione.misurazione };
}

/** Basta che un membro raggiunga la soglia. Il migliore decide. */
function almenoUnMembro(partecipanti: Partecipante[], soglia: number): EsitoOperatore {
  const coperture = partecipanti.map((p) => coperturaDi(p.valore));
  const migliore: Copertura = {
    certo: Math.max(0, ...coperture.map((c) => c.certo)),
    massimo: Math.max(0, ...coperture.map((c) => c.massimo)),
  };
  return {
    stato: statoDi(migliore, soglia),
    conteggi: tuttiConteggiati(partecipanti),
    misurazione: misurazione(migliore.certo, migliore.massimo, soglia),
  };
}

/** Nessuna regola: tutti contano, niente si misura, si chiede. */
function nonDichiarata(partecipanti: Partecipante[]): EsitoOperatore {
  return { stato: 'da_verificare', conteggi: tuttiConteggiati(partecipanti) };
}

// ─── Ingresso ────────────────────────────────────────────────

/**
 * Applica la regola di composizione. `prestazioni` serve solo alla regola
 * dell'esecutore, per descrivere la prestazione nelle note; una prestazione
 * inesistente è già un'anomalia bloccante e qui vale come "nessun esecutore".
 */
export function componi(
  regola: RegolaComposizione,
  partecipanti: Partecipante[],
  soglia: number,
  prestazioni: ReadonlyMap<PrestazioneId, Prestazione>,
): EsitoOperatore {
  switch (regola.tipo) {
    case 'ciascun_membro':
      return ciascunMembro(partecipanti, soglia);
    case 'somma_membri':
      return sommaMembri(partecipanti, soglia, regola.minimoMandataria, regola.minimoMandante);
    case 'esecutore_prestazione':
      return esecutorePrestazione(
        partecipanti,
        soglia,
        regola.prestazioneId,
        prestazioni.get(regola.prestazioneId)?.descrizione ?? regola.prestazioneId,
      );
    case 'almeno_un_membro':
      return almenoUnMembro(partecipanti, soglia);
    case 'non_dichiarata':
      return nonDichiarata(partecipanti);
    default:
      return assertNever(regola);
  }
}
