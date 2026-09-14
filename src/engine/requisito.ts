// Valutazione di un requisito: criterio per ogni membro, fusione delle
// ausiliarie con le rispettive ausiliate, operatore di composizione,
// conversione in unità di uscita, motivazione.

import { assertNever } from '../assertNever';
import type {
  Contributo,
  EsitoRequisito,
  MinimoRuolo,
  Misurazione,
  Prestazione,
  PrestazioneId,
  Raggruppamento,
  Requisito,
  RequisitoId,
  Soggetto,
  SoggettoId,
  Unita,
  ValoreContributo,
} from '../domain';
import { sogliaInterna, unitaDi, valutaCriterio, type ContestoCriterio, type ContributoGrezzo, type FattoUsato } from './criteri';
import { inEuro } from './importi';
import { eAusiliaria, eEsecutore, type MembroAusiliaria, type MembroEsecutore } from './membri';
import { componiMotivazione, type RigaMotivazione } from './motivazione';
import { componi, type MisurazioneGrezza, type Partecipante } from './operatori';
import { quotaSu } from './quote';

export type ContestoValutazione = {
  prestazioni: ReadonlyMap<PrestazioneId, Prestazione>;
  soggetti: ReadonlyMap<SoggettoId, Soggetto>;
  raggruppamento: Raggruppamento;
  criterio: ContestoCriterio;
};

/** Un fatto usato da un soggetto per un requisito: serve agli avvisi di scadenza. */
export type FattoUsatoDa = { soggettoId: SoggettoId; requisitoId: RequisitoId; fatto: FattoUsato };

export type RequisitoValutato = {
  /** Con `rimedi` vuoti: i rimedi si calcolano dopo, rivalutando. */
  esito: EsitoRequisito;
  usati: FattoUsatoDa[];
};

type EsecutoreValutato = { membro: MembroEsecutore; soggetto: Soggetto; grezzo: ContributoGrezzo };
type AusiliariaValutata = { membro: MembroAusiliaria; soggetto: Soggetto; grezzo: ContributoGrezzo };

// ─── Fusione ausiliaria → ausiliata ──────────────────────────

const RANGO_POSSESSO = { assente: 0, da_verificare: 1, posseduto: 2 } as const;

/** Il valore che la regola vede: il fascicolo del membro più quelli delle sue ausiliarie. */
function fondi(base: ValoreContributo, integrazioni: ValoreContributo[]): ValoreContributo {
  switch (base.tipo) {
    case 'possesso': {
      let migliore = base.esito;
      for (const i of integrazioni) {
        if (i.tipo === 'possesso' && RANGO_POSSESSO[i.esito] > RANGO_POSSESSO[migliore]) migliore = i.esito;
      }
      return { tipo: 'possesso', esito: migliore };
    }
    case 'misura': {
      let certo = base.certo;
      let incerto = base.incerto;
      for (const i of integrazioni) {
        if (i.tipo === 'misura') {
          certo += i.certo;
          incerto += i.incerto;
        }
      }
      return { tipo: 'misura', certo, incerto };
    }
    default:
      return assertNever(base);
  }
}

// ─── Unità di uscita ─────────────────────────────────────────

function inUscita(valore: number, unita: Unita | undefined): number {
  if (unita === undefined) return valore;
  switch (unita.tipo) {
    case 'euro':
      return inEuro(valore);
    case 'conteggio':
      return valore;
    default:
      return assertNever(unita);
  }
}

function valoreInUscita(valore: ValoreContributo, unita: Unita | undefined): ValoreContributo {
  switch (valore.tipo) {
    case 'possesso':
      return valore;
    case 'misura':
      return { tipo: 'misura', certo: inUscita(valore.certo, unita), incerto: inUscita(valore.incerto, unita) };
    default:
      return assertNever(valore);
  }
}

function misurazioneInUscita(m: MisurazioneGrezza, unita: Unita): Misurazione {
  const minimiRuolo: MinimoRuolo[] = m.minimiRuolo.map((r) => ({
    ...r,
    richiesto: inUscita(r.richiesto, unita),
    raggiunto: inUscita(r.raggiunto, unita),
    delta: inUscita(r.delta, unita),
  }));
  return {
    unita,
    soglia: inUscita(m.soglia, unita),
    raggiunto: inUscita(m.raggiunto, unita),
    massimo: inUscita(m.massimo, unita),
    delta: inUscita(m.delta, unita),
    minimiRuolo,
  };
}

// ─── Valutazione ─────────────────────────────────────────────

function unisciNote(note: string[]): string | undefined {
  return note.length === 0 ? undefined : note.join('; ');
}

export function valutaRequisito(requisito: Requisito, contesto: ContestoValutazione): RequisitoValutato {
  const unita = unitaDi(requisito.criterio);
  const soglia = sogliaInterna(requisito.criterio);

  const esecutori: EsecutoreValutato[] = [];
  const ausiliarie: AusiliariaValutata[] = [];
  for (const membro of contesto.raggruppamento.membri) {
    const soggetto = contesto.soggetti.get(membro.soggettoId);
    if (!soggetto) continue; // riferimento inesistente: già un'anomalia bloccante
    if (eEsecutore(membro)) {
      esecutori.push({ membro, soggetto, grezzo: valutaCriterio(requisito.criterio, soggetto.fascicolo, contesto.criterio) });
    } else if (eAusiliaria(membro) && requisito.avvalibile && membro.requisitiIds.includes(requisito.id)) {
      ausiliarie.push({ membro, soggetto, grezzo: valutaCriterio(requisito.criterio, soggetto.fascicolo, contesto.criterio) });
    }
  }
  const ausiliarieDi = (soggettoId: SoggettoId) => ausiliarie.filter((a) => a.membro.ausiliataId === soggettoId);

  const partecipanti: Partecipante[] = esecutori.map((e) => ({
    soggettoId: e.membro.soggettoId,
    ruolo: e.membro.ruolo,
    quote: e.membro.quote,
    valore: fondi(e.grezzo.valore, ausiliarieDi(e.membro.soggettoId).map((a) => a.grezzo.valore)),
  }));

  const composizione = componi(requisito.regola, partecipanti, soglia, contesto.prestazioni);
  const conteggi = new Map(composizione.conteggi.map((c) => [c.soggettoId, c]));
  const prestazioneRegola = requisito.regola.tipo === 'esecutore_prestazione' ? requisito.regola.prestazioneId : undefined;

  const contributi: Contributo[] = [];
  const righe: RigaMotivazione[] = [];
  const usati: FattoUsatoDa[] = [];

  for (const membro of contesto.raggruppamento.membri) {
    const esecutore = esecutori.find((e) => e.membro === membro);
    if (esecutore) {
      const conteggio = conteggi.get(membro.soggettoId);
      const conteggiato = conteggio?.conteggiato ?? false;
      const integrazioni = ausiliarieDi(membro.soggettoId);
      const noteAusiliarie = integrazioni.map((a) => `integrato dall'ausiliaria ${a.soggetto.denominazione}`);
      const note = [...(conteggio?.nota ? [conteggio.nota] : []), ...esecutore.grezzo.note, ...noteAusiliarie];
      contributi.push({
        soggettoId: membro.soggettoId,
        valore: valoreInUscita(esecutore.grezzo.valore, unita),
        conteggiato,
        fonti: esecutore.grezzo.usati.map((u) => u.fonte),
        nota: unisciNote(note),
      });
      righe.push({
        soggettoId: membro.soggettoId,
        denominazione: esecutore.soggetto.denominazione,
        ruolo: esecutore.membro.ruolo,
        conteggiato,
        quota: prestazioneRegola === undefined ? undefined : quotaSu(esecutore.membro.quote, prestazioneRegola),
        composto: partecipanti.find((p) => p.soggettoId === membro.soggettoId)?.valore ?? esecutore.grezzo.valore,
        note: esecutore.grezzo.note,
        ausiliarie: integrazioni.map((a) => a.soggetto.denominazione),
      });
      // Solo i fatti di chi concorre al requisito: un avviso su un fatto che non conta è rumore.
      if (conteggiato) usati.push(...esecutore.grezzo.usati.map((fatto) => ({ soggettoId: membro.soggettoId, requisitoId: requisito.id, fatto })));
      continue;
    }
    const ausiliaria = ausiliarie.find((a) => a.membro === membro);
    if (ausiliaria) {
      const ausiliata = contesto.soggetti.get(ausiliaria.membro.ausiliataId);
      const conteggiato = conteggi.get(ausiliaria.membro.ausiliataId)?.conteggiato ?? false;
      contributi.push({
        soggettoId: membro.soggettoId,
        valore: valoreInUscita(ausiliaria.grezzo.valore, unita),
        conteggiato,
        fonti: ausiliaria.grezzo.usati.map((u) => u.fonte),
        nota: unisciNote([`in avvalimento a favore di ${ausiliata?.denominazione ?? ausiliaria.membro.ausiliataId}`, ...ausiliaria.grezzo.note]),
      });
      if (conteggiato) usati.push(...ausiliaria.grezzo.usati.map((fatto) => ({ soggettoId: membro.soggettoId, requisitoId: requisito.id, fatto })));
    }
  }

  const motivazione = componiMotivazione({
    regola: requisito.regola,
    stato: composizione.stato,
    unita,
    soglia,
    righe,
    misurazione: composizione.misurazione,
    descrizionePrestazione: prestazioneRegola === undefined ? undefined : contesto.prestazioni.get(prestazioneRegola)?.descrizione,
  });

  const esito: EsitoRequisito = {
    requisitoId: requisito.id,
    stato: composizione.stato,
    contributi,
    motivazione,
    rimedi: [],
  };
  if (unita !== undefined) esito.misurazione = misurazioneInUscita(composizione.misurazione, unita);

  return { esito, usati };
}
