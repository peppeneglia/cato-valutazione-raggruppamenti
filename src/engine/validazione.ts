// Validazione strutturale: gli errori nei dati sono dati, non eccezioni.
// Produce anomalie con gravità e messaggio; non decide nulla sul merito.

import { assertNever } from '../assertNever';
import type {
  Anomalia,
  Bando,
  DettaglioAnomalia,
  GravitaAnomalia,
  Lotto,
  LottoId,
  ParametriValutazione,
  Requisito,
  Soggetto,
  VoceFascicolo,
} from '../domain';
import { formattaData, formattaPercentuale } from '../formato';
import { confrontaDate, dataValida } from './date';
import { indicizza, trovaLotto } from './indici';
import { ausiliarieDi, esecutoriDi, mandatarieDi } from './membri';
import { quotaAlmeno, quotaValida, quoteAzzerate, quoteTotalizzano, sommaQuote } from './quote';
import { descriviVoce, fattoDiVoce } from './voci';

function gravitaDi(dettaglio: DettaglioAnomalia): GravitaAnomalia {
  switch (dettaglio.codice) {
    case 'mandataria_assente':
    case 'mandataria_multipla':
    case 'membro_duplicato':
    case 'quota_fuori_intervallo':
    case 'quote_non_totali':
    case 'prestazione_senza_esecutore':
    case 'riferimento_inesistente':
    case 'identificativo_duplicato':
    case 'regola_somma_su_criterio_di_possesso':
    case 'parametro_requisito_non_valido':
    case 'avvalimento_su_requisito_non_avvalibile':
    case 'vincolo_senza_prestazione_principale':
    case 'vincolo_prestazione_principale_violato':
      return 'bloccante';
    case 'data_malformata':
      return dettaglio.origine === 'fascicolo' ? 'segnalazione' : 'bloccante';
    case 'membro_senza_quote':
    case 'periodo_invertito':
    case 'termine_presentazione_decorso':
      return 'segnalazione';
    default:
      return assertNever(dettaglio);
  }
}

function messaggioDi(dettaglio: DettaglioAnomalia): string {
  switch (dettaglio.codice) {
    case 'mandataria_assente':
      return 'Il raggruppamento non ha una mandataria.';
    case 'mandataria_multipla':
      return `Il raggruppamento ha più di una mandataria: ${dettaglio.soggettiIds.join(', ')}.`;
    case 'membro_duplicato':
      return `Il soggetto ${dettaglio.soggettoId} compare più di una volta tra i membri.`;
    case 'membro_senza_quote':
      return `Il membro ${dettaglio.soggettoId} non esegue prestazioni nel lotto ${dettaglio.lottoId} (tutte le quote a zero).`;
    case 'identificativo_duplicato':
      return `L'identificativo di ${dettaglio.entita} «${dettaglio.id}» compare più volte nel bando (${dettaglio.lottiIds.join(', ')}): le quote e i riferimenti si mescolerebbero in silenzio.`;
    case 'quota_fuori_intervallo':
      return `La quota di ${dettaglio.soggettoId} sulla prestazione ${dettaglio.prestazioneId} non è tra 0 e 1: ${String(dettaglio.quota)}.`;
    case 'quote_non_totali':
      return `Le quote sulla prestazione ${dettaglio.prestazioneId} totalizzano ${formattaPercentuale(dettaglio.totale)} invece del 100 %.`;
    case 'prestazione_senza_esecutore':
      return `Nessun membro esegue la prestazione ${dettaglio.prestazioneId}.`;
    case 'riferimento_inesistente':
      return `Riferimento a ${dettaglio.entita} inesistente: ${dettaglio.id}.`;
    case 'regola_somma_su_criterio_di_possesso':
      return `Il requisito ${dettaglio.requisitoId} ha una regola di somma ma un criterio di possesso, che non ha una soglia.`;
    case 'parametro_requisito_non_valido':
      return `Il requisito ${dettaglio.requisitoId} ha un parametro non valido: ${dettaglio.parametro} = ${String(dettaglio.valore)}.`;
    case 'avvalimento_su_requisito_non_avvalibile':
      return `${dettaglio.soggettoId} è indicata come ausiliaria per il requisito ${dettaglio.requisitoId}, che il disciplinare non dichiara avvalibile.`;
    case 'data_malformata':
      return `Data malformata in ${dettaglio.dove}: «${dettaglio.valore}» (atteso AAAA-MM-GG).`;
    case 'periodo_invertito':
      return `Periodo con inizio successivo alla fine in ${dettaglio.dove} (${dettaglio.soggettoId}).`;
    case 'termine_presentazione_decorso':
      return `Il termine di presentazione (${formattaData(dettaglio.terminePresentazione)}) è già decorso alla data di riferimento.`;
    case 'vincolo_senza_prestazione_principale':
      return 'Il lotto dichiara un vincolo di esecuzione della prestazione principale ma nessuna prestazione è principale.';
    case 'vincolo_prestazione_principale_violato':
      return `La prestazione principale ${dettaglio.prestazioneId} richiede al ruolo «${dettaglio.esecutore}» almeno ${formattaPercentuale(dettaglio.quotaMinima)}; eseguita al ${formattaPercentuale(dettaglio.quotaEffettiva)}.`;
    default:
      return assertNever(dettaglio);
  }
}

export function creaAnomalia(dettaglio: DettaglioAnomalia): Anomalia {
  return { ...dettaglio, gravita: gravitaDi(dettaglio), messaggio: messaggioDi(dettaglio) };
}

export function eBloccante(anomalia: Anomalia): boolean {
  return anomalia.gravita === 'bloccante';
}

// ─── Controlli ───────────────────────────────────────────────

function anomalieDate(parametri: ParametriValutazione): Anomalia[] {
  const { bando, dataRiferimento } = parametri;
  const anomalie: Anomalia[] = [];
  if (!dataValida(dataRiferimento)) {
    anomalie.push(creaAnomalia({ codice: 'data_malformata', origine: 'parametri', dove: 'dataRiferimento', valore: dataRiferimento }));
  }
  if (!dataValida(bando.dataPubblicazione)) {
    anomalie.push(creaAnomalia({ codice: 'data_malformata', origine: 'bando', dove: 'dataPubblicazione', valore: bando.dataPubblicazione }));
  }
  if (!dataValida(bando.terminePresentazione)) {
    anomalie.push(creaAnomalia({ codice: 'data_malformata', origine: 'bando', dove: 'terminePresentazione', valore: bando.terminePresentazione }));
  }
  if (anomalie.length === 0 && confrontaDate(dataRiferimento, bando.terminePresentazione) > 0) {
    anomalie.push(creaAnomalia({ codice: 'termine_presentazione_decorso', terminePresentazione: bando.terminePresentazione }));
  }
  return anomalie;
}

function anomalieMembri(parametri: ParametriValutazione): Anomalia[] {
  const { raggruppamento, soggetti } = parametri;
  const noti = indicizza(soggetti);
  const visti = new Set<string>();
  const anomalie: Anomalia[] = [];

  for (const membro of raggruppamento.membri) {
    if (!noti.has(membro.soggettoId)) {
      anomalie.push(creaAnomalia({ codice: 'riferimento_inesistente', entita: 'soggetto', id: membro.soggettoId }));
    }
    if (visti.has(membro.soggettoId)) {
      anomalie.push(creaAnomalia({ codice: 'membro_duplicato', soggettoId: membro.soggettoId }));
    }
    visti.add(membro.soggettoId);
  }

  const mandatarie = mandatarieDi(raggruppamento);
  if (mandatarie.length === 0) {
    anomalie.push(creaAnomalia({ codice: 'mandataria_assente' }));
  } else if (mandatarie.length > 1) {
    anomalie.push(creaAnomalia({ codice: 'mandataria_multipla', soggettiIds: mandatarie.map((m) => m.soggettoId) }));
  }

  const esecutori = new Set(esecutoriDi(raggruppamento).map((m) => m.soggettoId));
  for (const ausiliaria of ausiliarieDi(raggruppamento)) {
    if (!esecutori.has(ausiliaria.ausiliataId)) {
      anomalie.push(creaAnomalia({ codice: 'riferimento_inesistente', entita: 'ausiliata', id: ausiliaria.ausiliataId }));
    }
  }
  return anomalie;
}

/**
 * Gli id di prestazione e di requisito sono globali sul bando: le quote
 * del raggruppamento li citano senza dire il lotto. Un duplicato tra lotti
 * (o nello stesso lotto) mescolerebbe le quote in silenzio.
 */
function anomalieIdentificativi(bando: Bando): Anomalia[] {
  const anomalie: Anomalia[] = [];
  const controlla = (entita: 'prestazione' | 'requisito', elementi: (lotto: Lotto) => { id: string }[]) => {
    const lottiPerId = new Map<string, LottoId[]>();
    for (const lotto of bando.lotti) {
      for (const { id } of elementi(lotto)) lottiPerId.set(id, [...(lottiPerId.get(id) ?? []), lotto.id]);
    }
    for (const [id, lottiIds] of lottiPerId) {
      if (lottiIds.length > 1) anomalie.push(creaAnomalia({ codice: 'identificativo_duplicato', entita, id, lottiIds }));
    }
  };
  controlla('prestazione', (l) => l.prestazioni);
  controlla('requisito', (l) => l.requisiti);
  return anomalie;
}

/**
 * Le quote sono una proprietà del raggruppamento sull'intera gara: una
 * quota su una prestazione di un altro lotto è irrilevante qui, non un
 * errore. È inesistente solo se non appartiene a nessun lotto del bando.
 */
function anomalieQuote(parametri: ParametriValutazione, lotto: Lotto): Anomalia[] {
  const { raggruppamento, bando } = parametri;
  const prestazioniDelBando = indicizza(bando.lotti.flatMap((l) => l.prestazioni));
  const anomalie: Anomalia[] = [];

  for (const membro of esecutoriDi(raggruppamento)) {
    for (const [prestazioneId, quota] of Object.entries(membro.quote)) {
      if (!prestazioniDelBando.has(prestazioneId)) {
        anomalie.push(creaAnomalia({ codice: 'riferimento_inesistente', entita: 'prestazione', id: prestazioneId }));
      }
      if (!quotaValida(quota)) {
        anomalie.push(creaAnomalia({ codice: 'quota_fuori_intervallo', soggettoId: membro.soggettoId, prestazioneId, quota }));
      }
    }
  }

  for (const prestazione of lotto.prestazioni) {
    const totale = sommaQuote(esecutoriDi(raggruppamento).map((m) => m.quote[prestazione.id] ?? 0));
    if (quoteAzzerate(totale)) {
      anomalie.push(creaAnomalia({ codice: 'prestazione_senza_esecutore', prestazioneId: prestazione.id }));
    } else if (!quoteTotalizzano(totale)) {
      anomalie.push(creaAnomalia({ codice: 'quote_non_totali', prestazioneId: prestazione.id, totale }));
    }
  }

  for (const membro of esecutoriDi(raggruppamento)) {
    const totale = sommaQuote(lotto.prestazioni.map((p) => membro.quote[p.id] ?? 0));
    if (quoteAzzerate(totale)) {
      anomalie.push(creaAnomalia({ codice: 'membro_senza_quote', soggettoId: membro.soggettoId, lottoId: lotto.id }));
    }
  }
  return anomalie;
}

function anomalieAvvalimenti(parametri: ParametriValutazione, lotto: Lotto): Anomalia[] {
  const requisiti = indicizza(lotto.requisiti);
  const anomalie: Anomalia[] = [];
  for (const ausiliaria of ausiliarieDi(parametri.raggruppamento)) {
    for (const requisitoId of ausiliaria.requisitiIds) {
      const requisito = requisiti.get(requisitoId);
      if (!requisito) {
        anomalie.push(creaAnomalia({ codice: 'riferimento_inesistente', entita: 'requisito', id: requisitoId }));
      } else if (!requisito.avvalibile) {
        anomalie.push(creaAnomalia({ codice: 'avvalimento_su_requisito_non_avvalibile', soggettoId: ausiliaria.soggettoId, requisitoId }));
      }
    }
  }
  return anomalie;
}

/** Parametri numerici del criterio e della regola: positivi dove serve, frazioni dove serve. */
function anomalieParametri(requisito: Requisito): Anomalia[] {
  const { criterio, regola } = requisito;
  const controlli: { parametro: string; valore: number | undefined; valido: (v: number) => boolean }[] = [];
  const positivo = (v: number) => Number.isFinite(v) && v > 0;
  const nonNegativo = (v: number) => Number.isFinite(v) && v >= 0;
  const frazione = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;
  const interoPositivo = (v: number) => Number.isInteger(v) && v > 0;

  switch (criterio.tipo) {
    case 'fatturato':
      controlli.push({ parametro: 'criterio.esercizi', valore: criterio.esercizi, valido: positivo });
      controlli.push({ parametro: 'criterio.soglia', valore: criterio.soglia, valido: positivo });
      break;
    case 'servizi':
      controlli.push({ parametro: 'criterio.anni', valore: criterio.anni, valido: positivo });
      controlli.push({ parametro: 'criterio.numeroMinimo', valore: criterio.numeroMinimo, valido: positivo });
      controlli.push({ parametro: 'criterio.importoMinimoUnitario', valore: criterio.importoMinimoUnitario, valido: nonNegativo });
      controlli.push({ parametro: 'criterio.cifreCpvComuni', valore: criterio.cifreCpvComuni, valido: interoPositivo });
      break;
    case 'servizi_importo':
      controlli.push({ parametro: 'criterio.anni', valore: criterio.anni, valido: positivo });
      controlli.push({ parametro: 'criterio.soglia', valore: criterio.soglia, valido: positivo });
      controlli.push({ parametro: 'criterio.importoMinimoUnitario', valore: criterio.importoMinimoUnitario, valido: nonNegativo });
      controlli.push({ parametro: 'criterio.cifreCpvComuni', valore: criterio.cifreCpvComuni, valido: interoPositivo });
      break;
    case 'dichiarazione':
    case 'certificazione':
    case 'iscrizione':
      break;
    default:
      assertNever(criterio);
  }

  switch (regola.tipo) {
    case 'somma_membri':
      controlli.push({ parametro: 'regola.minimoMandataria', valore: regola.minimoMandataria, valido: frazione });
      controlli.push({ parametro: 'regola.minimoMandante', valore: regola.minimoMandante, valido: frazione });
      break;
    case 'ciascun_membro':
    case 'esecutore_prestazione':
    case 'almeno_un_membro':
      break;
    default:
      assertNever(regola);
  }

  return controlli
    .filter((c): c is { parametro: string; valore: number; valido: (v: number) => boolean } => c.valore !== undefined && !c.valido(c.valore))
    .map((c) => creaAnomalia({ codice: 'parametro_requisito_non_valido', requisitoId: requisito.id, parametro: c.parametro, valore: c.valore }));
}

function anomalieRequisiti(lotto: Lotto): Anomalia[] {
  const prestazioni = indicizza(lotto.prestazioni);
  const anomalie: Anomalia[] = [];
  for (const requisito of lotto.requisiti) {
    const { regola, criterio } = requisito;
    anomalie.push(...anomalieParametri(requisito));
    switch (regola.tipo) {
      case 'somma_membri':
        if (criterio.tipo === 'dichiarazione' || criterio.tipo === 'certificazione' || criterio.tipo === 'iscrizione') {
          anomalie.push(creaAnomalia({ codice: 'regola_somma_su_criterio_di_possesso', requisitoId: requisito.id }));
        }
        break;
      case 'esecutore_prestazione':
        if (!prestazioni.has(regola.prestazioneId)) {
          anomalie.push(creaAnomalia({ codice: 'riferimento_inesistente', entita: 'prestazione', id: regola.prestazioneId }));
        }
        break;
      case 'ciascun_membro':
      case 'almeno_un_membro':
        break;
      default:
        assertNever(regola);
    }
  }
  return anomalie;
}

function anomalieVincolo(parametri: ParametriValutazione, lotto: Lotto): Anomalia[] {
  const vincolo = lotto.vincoloPrestazionePrincipale;
  if (!vincolo) return [];
  const principali = lotto.prestazioni.filter((p) => p.natura === 'principale');
  if (principali.length === 0) {
    return [creaAnomalia({ codice: 'vincolo_senza_prestazione_principale' })];
  }
  const esecutoriDelRuolo = esecutoriDi(parametri.raggruppamento).filter((m) => m.ruolo === vincolo.esecutore);
  const anomalie: Anomalia[] = [];
  for (const prestazione of principali) {
    const quotaEffettiva = sommaQuote(esecutoriDelRuolo.map((m) => m.quote[prestazione.id] ?? 0));
    if (!quotaAlmeno(quotaEffettiva, vincolo.quotaMinima)) {
      anomalie.push(creaAnomalia({
        codice: 'vincolo_prestazione_principale_violato',
        prestazioneId: prestazione.id,
        esecutore: vincolo.esecutore,
        quotaMinima: vincolo.quotaMinima,
        quotaEffettiva,
      }));
    }
  }
  return anomalie;
}

function anomalieVoce(soggetto: Soggetto, voce: VoceFascicolo): Anomalia[] {
  const dove = `${soggetto.denominazione} · ${descriviVoce(voce)}`;
  const anomalie: Anomalia[] = [];
  const malformata = (campo: string, valore: string) =>
    creaAnomalia({ codice: 'data_malformata', origine: 'fascicolo', dove: `${dove} · ${campo}`, valore });

  const fatto = fattoDiVoce(voce);
  if (fatto) {
    if (fatto.validoDa !== undefined && !dataValida(fatto.validoDa)) anomalie.push(malformata('validoDa', fatto.validoDa));
    if (fatto.validoA !== undefined && !dataValida(fatto.validoA)) anomalie.push(malformata('validoA', fatto.validoA));
    if (
      fatto.validoDa !== undefined && fatto.validoA !== undefined &&
      dataValida(fatto.validoDa) && dataValida(fatto.validoA) &&
      confrontaDate(fatto.validoDa, fatto.validoA) > 0
    ) {
      anomalie.push(creaAnomalia({ codice: 'periodo_invertito', soggettoId: soggetto.id, dove: `${dove} · validità` }));
    }
  }

  if (voce.tipo === 'servizio') {
    const { da, a } = voce.periodo.valore;
    if (!dataValida(da)) anomalie.push(malformata('periodo.da', da));
    if (!dataValida(a)) anomalie.push(malformata('periodo.a', a));
    if (dataValida(da) && dataValida(a) && confrontaDate(da, a) > 0) {
      anomalie.push(creaAnomalia({ codice: 'periodo_invertito', soggettoId: soggetto.id, dove: `${dove} · periodo` }));
    }
  }
  return anomalie;
}

/** Non dipende dal raggruppamento: la ricerca dei rimedi la calcola una volta sola. */
export function anomalieFascicoli(soggetti: Soggetto[]): Anomalia[] {
  return soggetti.flatMap((s) => s.fascicolo.flatMap((v) => anomalieVoce(s, v)));
}

/** La stessa anomalia rilevata da più punti (es. per ogni membro) si riporta una volta. */
function senzaDuplicati(anomalie: Anomalia[]): Anomalia[] {
  const viste = new Set<string>();
  return anomalie.filter((a) => {
    const chiave = JSON.stringify(a);
    if (viste.has(chiave)) return false;
    viste.add(chiave);
    return true;
  });
}

/**
 * Tutte le anomalie strutturali dell'input. I controlli che dipendono dal
 * lotto vengono saltati se il lotto non esiste: quella è già un'anomalia.
 */
export function anomalieStrutturali(parametri: ParametriValutazione, fascicoliPrecalcolate?: Anomalia[]): Anomalia[] {
  return senzaDuplicati(raccogliAnomalie(parametri, fascicoliPrecalcolate ?? anomalieFascicoli(parametri.soggetti)));
}

function raccogliAnomalie(parametri: ParametriValutazione, anomalieDeiFascicoli: Anomalia[]): Anomalia[] {
  const lotto = trovaLotto(parametri.bando, parametri.lottoId);
  const anomalie = [
    ...anomalieDate(parametri),
    ...anomalieIdentificativi(parametri.bando),
    ...(lotto ? [] : [creaAnomalia({ codice: 'riferimento_inesistente', entita: 'lotto', id: parametri.lottoId })]),
    ...anomalieMembri(parametri),
  ];
  if (lotto) {
    anomalie.push(
      ...anomalieQuote(parametri, lotto),
      ...anomalieAvvalimenti(parametri, lotto),
      ...anomalieRequisiti(lotto),
      ...anomalieVincolo(parametri, lotto),
    );
  }
  anomalie.push(...anomalieDeiFascicoli);
  return anomalie;
}
