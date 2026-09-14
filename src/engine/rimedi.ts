// Rimedi. Un rimedio viene proposto solo se, applicato a una copia
// dell'input, la rivalutazione completa lo conferma. Mai perché sembra
// giusto: spostare la manutenzione su chi ha lo scope sbagliato era
// formalmente corretto e sbagliato nel merito.
//
// Le mosse candidate sono finite e in ordine di invasività:
// riassegnazione di quota, uscita, ingresso, avvalimento; a parità,
// ordine alfabetico degli identificativi.
//
// Quando il documento non decide, il rimedio è chiederglielo: la
// richiesta di chiarimenti non si verifica per rivalutazione, perché non
// cambia i dati; dice però se il termine per chiederli è già decorso.

import { assertNever } from '../assertNever';
import type {
  Bando,
  EsitoRequisito,
  Indeterminatezza,
  Lotto,
  Membro,
  ParametriValutazione,
  Raggruppamento,
  Requisito,
  RequisitoId,
  Rimedio,
  RimedioApplicabile,
  Soggetto,
  SoggettoId,
  StatoRequisito,
  VoceFascicolo,
} from '../domain';
import { confrontaDate } from './date';
import { indicizza } from './indici';
import { ausiliarieDi, esecutoriDi, type MembroEsecutore } from './membri';
import { quotaPositiva, quotaSu } from './quote';
import { contributoDi, type FattoScadutoDi } from './requisito';
import { eBloccante } from './validazione';
import { valutaBase, type EsitoBase, type Memo } from './valutazione';
import { variantiDi } from './varianti';
import { fattoDiVoce } from './voci';

export type Mossa = RimedioApplicabile;

// ─── Ordinamento ─────────────────────────────────────────────

function perId<T extends { id: string }>(elementi: readonly T[]): T[] {
  return [...elementi].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function perSoggettoId<T extends { soggettoId: string }>(elementi: readonly T[]): T[] {
  return [...elementi].sort((a, b) => (a.soggettoId < b.soggettoId ? -1 : a.soggettoId > b.soggettoId ? 1 : 0));
}

// ─── Mosse candidate ─────────────────────────────────────────

/** Soggetti che non fanno parte del raggruppamento in nessun ruolo. */
function candidatiEsterni(parametri: ParametriValutazione): Soggetto[] {
  const membri = new Set(parametri.raggruppamento.membri.map((m) => m.soggettoId));
  return perId(parametri.soggetti.filter((s) => !membri.has(s.id)));
}

function mosseRiassegnazione(lotto: Lotto, esecutori: MembroEsecutore[]): Mossa[] {
  const mosse: Mossa[] = [];
  for (const prestazione of perId(lotto.prestazioni)) {
    for (const da of esecutori) {
      const quota = quotaSu(da.quote, prestazione.id);
      if (!quotaPositiva(quota)) continue;
      for (const a of esecutori) {
        if (a === da) continue;
        mosse.push({ tipo: 'riassegna_quota', prestazioneId: prestazione.id, daSoggettoId: da.soggettoId, aSoggettoId: a.soggettoId, quota });
      }
    }
  }
  return mosse;
}

/** Uscita di un membro non mandataria: senza mandataria il raggruppamento non esiste. */
function mosseUscita(esecutori: MembroEsecutore[]): Mossa[] {
  return esecutori.filter((m) => m.ruolo !== 'mandataria').map((m) => ({ tipo: 'uscita_soggetto', soggettoId: m.soggettoId }));
}

/** Ingresso a quote zero, oppure rilevando per intero la quota di un esecutore su una prestazione. */
function mosseIngresso(lotto: Lotto, esecutori: MembroEsecutore[], esterni: Soggetto[]): Mossa[] {
  const mosse: Mossa[] = [];
  for (const candidato of esterni) {
    mosse.push({ tipo: 'ingresso_soggetto', soggettoId: candidato.id, ruolo: 'mandante', quote: {} });
    for (const prestazione of perId(lotto.prestazioni)) {
      for (const da of esecutori) {
        const quota = quotaSu(da.quote, prestazione.id);
        if (!quotaPositiva(quota)) continue;
        mosse.push({ tipo: 'ingresso_soggetto', soggettoId: candidato.id, ruolo: 'mandante', quote: { [prestazione.id]: quota }, rilevateDa: da.soggettoId });
      }
    }
  }
  return mosse;
}

/** Il candidato copre davvero il requisito nel proprio fascicolo, con certezza, sotto ogni variante. */
function copreDaSolo(candidato: Soggetto, requisito: Requisito, parametri: ParametriValutazione, memo: Memo | undefined): boolean {
  const { varianti } = variantiDi(requisito, parametri.bando, memo?.varianti);
  if (varianti.length === 0) return false;
  const contesto = {
    criterio: { dataRiferimento: parametri.dataRiferimento, dataPubblicazione: parametri.bando.dataPubblicazione, terminePresentazione: parametri.bando.terminePresentazione },
    memo: memo?.criteri,
  };
  return varianti.every((variante) => {
    const grezzo = contributoDi(variante, candidato, contesto);
    if (!grezzo) return false; // criterio non determinato: nessuno lo copre
    const { valore } = grezzo;
    switch (valore.tipo) {
      case 'possesso':
        return valore.esito === 'posseduto';
      case 'misura':
        return valore.certo > 0;
      default:
        return assertNever(valore);
    }
  });
}

/** A favore di chi va l'avvalimento: il membro la cui mancanza causa lo scoperto, altrimenti la mandataria. */
function ausiliateDi(requisito: Requisito, esitoRequisito: EsitoRequisito, esecutori: MembroEsecutore[]): SoggettoId[] {
  const mandataria = esecutori.find((m) => m.ruolo === 'mandataria');
  const predefinita = mandataria ? [mandataria.soggettoId] : [];
  switch (requisito.regola.tipo) {
    case 'ciascun_membro':
    case 'esecutore_prestazione': {
      const soglia = esitoRequisito.misurazione?.soglia ?? 1;
      const mancanti = esitoRequisito.contributi
        .filter((c) => c.conteggiato && esecutori.some((e) => e.soggettoId === c.soggettoId))
        .filter((c) => (c.valore.tipo === 'possesso' ? c.valore.esito !== 'posseduto' : c.valore.certo < soglia))
        .map((c) => c.soggettoId);
      return mancanti.length > 0 ? mancanti : predefinita;
    }
    case 'somma_membri': {
      const sottoMinimo = (esitoRequisito.misurazione?.minimiRuolo ?? []).filter((m) => m.delta > 0).map((m) => m.soggettoId);
      return sottoMinimo.length > 0 ? sottoMinimo : predefinita;
    }
    case 'almeno_un_membro':
    case 'non_dichiarata':
      return predefinita;
    default:
      return assertNever(requisito.regola);
  }
}

function mosseAvvalimento(parametri: ParametriValutazione, lotto: Lotto, esito: EsitoBase, esterni: Soggetto[], memo: Memo | undefined): Mossa[] {
  const esecutori = esecutoriDi(parametri.raggruppamento);
  const ausiliarie = ausiliarieDi(parametri.raggruppamento);
  const esiti = new Map(esito.requisiti.map((r) => [r.requisitoId, r]));
  const mosse: Mossa[] = [];

  for (const requisito of perId(lotto.requisiti)) {
    if (!requisito.avvalibile) continue;
    const esitoRequisito = esiti.get(requisito.id);
    if (!esitoRequisito || esitoRequisito.stato === 'coperto') continue;
    const ausiliate = ausiliateDi(requisito, esitoRequisito, esecutori);

    // Candidate: esterne, oppure già ausiliarie della stessa ausiliata per altri requisiti.
    const candidate: { soggetto: Soggetto; soloPer?: SoggettoId }[] = [
      ...esterni.map((soggetto) => ({ soggetto })),
      ...ausiliarie.flatMap((a) => {
        const soggetto = parametri.soggetti.find((s) => s.id === a.soggettoId);
        return soggetto && !a.requisitiIds.includes(requisito.id) ? [{ soggetto, soloPer: a.ausiliataId }] : [];
      }),
    ];

    for (const { soggetto, soloPer } of perId(candidate.map((c) => ({ id: c.soggetto.id, ...c })))) {
      if (!copreDaSolo(soggetto, requisito, parametri, memo)) continue;
      for (const ausiliataId of ausiliate) {
        if (soloPer !== undefined && soloPer !== ausiliataId) continue;
        mosse.push({ tipo: 'avvalimento', requisitoId: requisito.id, ausiliariaId: soggetto.id, ausiliataId });
      }
    }
  }
  return mosse;
}

/** Tutte le mosse applicabili allo stato attuale, nell'ordine di invasività. */
export function mosseCandidate(parametri: ParametriValutazione, lotto: Lotto, esito: EsitoBase, memo?: Memo): Mossa[] {
  const esecutori = perSoggettoId(esecutoriDi(parametri.raggruppamento));
  const esterni = candidatiEsterni(parametri);
  return [
    ...mosseRiassegnazione(lotto, esecutori),
    ...mosseUscita(esecutori),
    ...mosseIngresso(lotto, esecutori, esterni),
    ...mosseAvvalimento(parametri, lotto, esito, esterni, memo),
  ];
}

// ─── Applicazione ────────────────────────────────────────────

function conQuota(membro: MembroEsecutore, prestazioneId: string, delta: number): MembroEsecutore {
  return { ...membro, quote: { ...membro.quote, [prestazioneId]: quotaSu(membro.quote, prestazioneId) + delta } };
}

/** Restituisce un nuovo raggruppamento: gli input non vengono mai mutati. */
export function applicaMossa(raggruppamento: Raggruppamento, mossa: Mossa): Raggruppamento {
  const membri: Membro[] = raggruppamento.membri.map((m) => (m.ruolo === 'ausiliaria' ? { ...m, requisitiIds: [...m.requisitiIds] } : { ...m, quote: { ...m.quote } }));
  const esecutore = (id: SoggettoId) => {
    const m = membri.find((x) => x.soggettoId === id);
    return m && m.ruolo !== 'ausiliaria' ? m : undefined;
  };
  const sostituisci = (nuovo: Membro) => {
    const i = membri.findIndex((x) => x.soggettoId === nuovo.soggettoId);
    if (i >= 0) membri[i] = nuovo;
  };

  switch (mossa.tipo) {
    case 'riassegna_quota': {
      const da = esecutore(mossa.daSoggettoId);
      const a = esecutore(mossa.aSoggettoId);
      if (da) sostituisci(conQuota(da, mossa.prestazioneId, -mossa.quota));
      if (a) sostituisci(conQuota(a, mossa.prestazioneId, mossa.quota));
      return { ...raggruppamento, membri };
    }
    case 'uscita_soggetto':
      return {
        ...raggruppamento,
        membri: membri.filter((m) => m.soggettoId !== mossa.soggettoId && !(m.ruolo === 'ausiliaria' && m.ausiliataId === mossa.soggettoId)),
      };
    case 'ingresso_soggetto': {
      if (mossa.rilevateDa !== undefined) {
        const da = esecutore(mossa.rilevateDa);
        if (da) {
          let aggiornato = da;
          for (const [prestazioneId, quota] of Object.entries(mossa.quote)) aggiornato = conQuota(aggiornato, prestazioneId, -quota);
          sostituisci(aggiornato);
        }
      }
      membri.push({ ruolo: mossa.ruolo, soggettoId: mossa.soggettoId, quote: { ...mossa.quote } });
      return { ...raggruppamento, membri };
    }
    case 'avvalimento': {
      const esistente = membri.find((m) => m.soggettoId === mossa.ausiliariaId);
      if (esistente && esistente.ruolo === 'ausiliaria') {
        if (!esistente.requisitiIds.includes(mossa.requisitoId)) esistente.requisitiIds.push(mossa.requisitoId);
        return { ...raggruppamento, membri };
      }
      membri.push({ ruolo: 'ausiliaria', soggettoId: mossa.ausiliariaId, ausiliataId: mossa.ausiliataId, requisitiIds: [mossa.requisitoId] });
      return { ...raggruppamento, membri };
    }
    default:
      return assertNever(mossa);
  }
}

export function valutaDopo(parametri: ParametriValutazione, mossa: Mossa, memo?: Memo): EsitoBase {
  return valutaBase({ ...parametri, raggruppamento: applicaMossa(parametri.raggruppamento, mossa) }, memo);
}

// ─── Verifica ────────────────────────────────────────────────

const PESO: Record<StatoRequisito, number> = { coperto: 0, da_verificare: 1, scoperto: 2 };

function statoDi(esito: EsitoBase, requisitoId: RequisitoId): StatoRequisito | undefined {
  return esito.requisiti.find((r) => r.requisitoId === requisitoId)?.stato;
}

/** Una mossa peggiora se introduce un'anomalia bloccante o degrada un altro requisito. */
export function peggiora(prima: EsitoBase, dopo: EsitoBase): boolean {
  if (dopo.anomalie.some(eBloccante)) return true;
  return prima.requisiti.some((r) => {
    const nuovo = statoDi(dopo, r.requisitoId);
    return nuovo !== undefined && PESO[nuovo] > PESO[r.stato];
  });
}

// ─── Rinnovo (non applicabile, ma verificato) ────────────────

/** Copia dei soggetti in cui il fatto scaduto è tornato valido. */
function conFattoRinnovato(soggetti: Soggetto[], scaduto: FattoScadutoDi): Soggetto[] {
  return soggetti.map((s) => {
    if (s.id !== scaduto.soggettoId) return s;
    const fascicolo: VoceFascicolo[] = s.fascicolo.map((voce) => {
      const fatto = fattoDiVoce(voce);
      if (!fatto || fatto.validoA !== scaduto.fatto.scadutoIl) return voce;
      if (JSON.stringify(fatto.fonte) !== JSON.stringify(scaduto.fatto.fonte)) return voce;
      switch (voce.tipo) {
        case 'certificazione':
          return { ...voce, possesso: { valore: voce.possesso.valore, fonte: voce.possesso.fonte, validoDa: voce.possesso.validoDa } };
        case 'iscrizione':
          return { ...voce, possesso: { valore: voce.possesso.valore, fonte: voce.possesso.fonte, validoDa: voce.possesso.validoDa } };
        case 'fatturato':
        case 'servizio':
        case 'dichiarazione':
          return voce;
        default:
          return assertNever(voce);
      }
    });
    return { ...s, fascicolo };
  });
}

// ─── Chiarimenti (non applicabile: il documento non decide) ──

/** Le indeterminatezze che dipendono dal documento, non dal fascicolo. */
export function delDocumento(i: Indeterminatezza): boolean {
  switch (i.tipo) {
    case 'regola_non_dichiarata':
    case 'criterio_non_determinato':
    case 'letture_discordanti':
    case 'valore_contraddittorio':
      return true;
    case 'giudizio_richiesto':
      return false;
    default:
      return assertNever(i);
  }
}

/** Il quesito da porre alla stazione appaltante, in una frase. */
export function quesitoDi(requisito: Requisito, indeterminatezza: Indeterminatezza): string {
  const nome = `«${requisito.descrizione}»`;
  switch (indeterminatezza.tipo) {
    case 'regola_non_dichiarata':
      return `In caso di raggruppamento temporaneo, da chi deve essere posseduto il requisito ${nome}: da ciascun componente, dalla sola mandataria o dal raggruppamento nel complesso?`;
    case 'criterio_non_determinato':
      return `Quale registro, albo o documento soddisfa il requisito ${nome}? Il disciplinare non lo nomina.`;
    case 'letture_discordanti':
      return `Per il requisito ${nome}, quale lettura vale: ${indeterminatezza.esiti.map((e) => `«${e.etichetta}»`).join(' oppure ')}?`;
    case 'valore_contraddittorio':
      return `Quale valore di «${indeterminatezza.nome}» vale per il requisito ${nome}: ${indeterminatezza.esiti.map((e) => e.etichetta).join(' oppure ')}?`;
    case 'giudizio_richiesto':
      return `Per il requisito ${nome}, è ammessa l'${indeterminatezza.oggetto}?`;
    default:
      return assertNever(indeterminatezza);
  }
}

function richiestaChiarimenti(requisito: Requisito, esitoRequisito: EsitoRequisito, bando: Bando, dataRiferimento: string): Rimedio[] {
  const quesiti = esitoRequisito.indeterminatezze.filter(delDocumento).map((i) => quesitoDi(requisito, i));
  if (quesiti.length === 0) return [];
  const termine = bando.termineChiarimenti;
  return [{
    tipo: 'richiesta_chiarimenti',
    requisitoId: requisito.id,
    quesiti,
    ...(termine ? { termine: { data: termine.data, ...(termine.ora === undefined ? {} : { ora: termine.ora }) } } : {}),
    decorso: termine !== undefined && confrontaDate(dataRiferimento, termine.data) > 0,
  }];
}

// ─── Rimedi per requisito ────────────────────────────────────

export type ScadutiPerRequisito = ReadonlyMap<RequisitoId, FattoScadutoDi[]>;

/**
 * Per ogni requisito non coperto: le mosse che, applicate da sole, lo
 * rendono coperto senza peggiorare il resto; i rinnovi che, simulati,
 * lo coprirebbero; la richiesta di chiarimenti se il documento non
 * decide; il profilo mancante se è scoperto e nessuna mossa esiste.
 */
export function rimediPerRequisito(
  parametri: ParametriValutazione,
  lotto: Lotto,
  esito: EsitoBase,
  scaduti: ScadutiPerRequisito,
  memo?: Memo,
): Map<RequisitoId, Rimedio[]> {
  const requisiti = indicizza(lotto.requisiti);
  const risultato = new Map<RequisitoId, Rimedio[]>();
  const mosse = mosseCandidate(parametri, lotto, esito, memo);
  const esitiDopo = mosse.map((mossa) => ({ mossa, dopo: valutaDopo(parametri, mossa, memo) }));

  for (const esitoRequisito of esito.requisiti) {
    if (esitoRequisito.stato === 'coperto') continue;
    const requisito = requisiti.get(esitoRequisito.requisitoId);
    if (!requisito) continue;

    const applicabili: Rimedio[] = esitiDopo
      .filter(({ dopo }) => statoDi(dopo, requisito.id) === 'coperto' && !peggiora(esito, dopo))
      .map(({ mossa }) => mossa);

    const rinnovi: Rimedio[] = (scaduti.get(requisito.id) ?? [])
      .filter((scaduto) => {
        const dopo = valutaBase({ ...parametri, soggetti: conFattoRinnovato(parametri.soggetti, scaduto) });
        return statoDi(dopo, requisito.id) === 'coperto' && !peggiora(esito, dopo);
      })
      .map((scaduto) => ({
        tipo: 'rinnovo_documento',
        soggettoId: scaduto.soggettoId,
        requisitoId: requisito.id,
        fonte: scaduto.fatto.fonte,
        scadutoIl: scaduto.fatto.scadutoIl,
      }));

    const chiarimenti = richiestaChiarimenti(requisito, esitoRequisito, parametri.bando, parametri.dataRiferimento);

    // "Nessun soggetto disponibile copre questo requisito" ha senso solo se è scoperto: un
    // requisito da verificare aspetta un giudizio o un chiarimento, non un fascicolo.
    const criterio = variantiDi(requisito, parametri.bando, memo?.varianti).varianti[0]?.criterio;
    const profilo: Rimedio[] = esitoRequisito.stato === 'scoperto' && applicabili.length === 0 && criterio !== undefined
      ? [{ tipo: 'profilo_mancante', requisitoId: requisito.id, criterio, mancante: esitoRequisito.misurazione?.delta }]
      : [];

    risultato.set(requisito.id, [...applicabili, ...rinnovi, ...chiarimenti, ...profilo]);
  }
  return risultato;
}
