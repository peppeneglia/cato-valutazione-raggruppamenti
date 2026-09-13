// Validazione strutturale: gli errori nei dati sono dati, non eccezioni.
// Produce anomalie con gravità e messaggio; non decide nulla sul merito.

import { assertNever } from '../assertNever';
import type {
  Anomalia,
  DettaglioAnomalia,
  GravitaAnomalia,
  Lotto,
  ParametriValutazione,
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
    case 'regola_somma_su_criterio_di_possesso':
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
      return `Il membro ${dettaglio.soggettoId} non esegue alcuna prestazione (tutte le quote a zero).`;
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

function anomalieQuote(parametri: ParametriValutazione, lotto: Lotto): Anomalia[] {
  const { raggruppamento } = parametri;
  const prestazioni = indicizza(lotto.prestazioni);
  const anomalie: Anomalia[] = [];

  for (const membro of esecutoriDi(raggruppamento)) {
    for (const [prestazioneId, quota] of Object.entries(membro.quote)) {
      if (!prestazioni.has(prestazioneId)) {
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
      anomalie.push(creaAnomalia({ codice: 'membro_senza_quote', soggettoId: membro.soggettoId }));
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

function anomalieRequisiti(lotto: Lotto): Anomalia[] {
  const prestazioni = indicizza(lotto.prestazioni);
  const anomalie: Anomalia[] = [];
  for (const requisito of lotto.requisiti) {
    const { regola, criterio } = requisito;
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
  if (fatto.validoDa !== undefined && !dataValida(fatto.validoDa)) anomalie.push(malformata('validoDa', fatto.validoDa));
  if (fatto.validoA !== undefined && !dataValida(fatto.validoA)) anomalie.push(malformata('validoA', fatto.validoA));
  if (
    fatto.validoDa !== undefined && fatto.validoA !== undefined &&
    dataValida(fatto.validoDa) && dataValida(fatto.validoA) &&
    confrontaDate(fatto.validoDa, fatto.validoA) > 0
  ) {
    anomalie.push(creaAnomalia({ codice: 'periodo_invertito', soggettoId: soggetto.id, dove: `${dove} · validità` }));
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

function anomalieFascicoli(soggetti: Soggetto[]): Anomalia[] {
  return soggetti.flatMap((s) => s.fascicolo.flatMap((v) => anomalieVoce(s, v)));
}

/**
 * Tutte le anomalie strutturali dell'input. I controlli che dipendono dal
 * lotto vengono saltati se il lotto non esiste: quella è già un'anomalia.
 */
export function anomalieStrutturali(parametri: ParametriValutazione): Anomalia[] {
  const lotto = trovaLotto(parametri.bando, parametri.lottoId);
  const anomalie = [
    ...anomalieDate(parametri),
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
  anomalie.push(...anomalieFascicoli(parametri.soggetti));
  return anomalie;
}
