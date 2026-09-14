// Testo dagli identificativi: nomi reali di soggetti, prestazioni e
// requisiti al posto degli id. Funzioni pure, senza JSX, testate.
// Nessun calcolo: solo traduzione di ciò che il motore ha già deciso.

import { assertNever } from './assertNever';
import type {
  Anomalia,
  Bando,
  CodiceAssunzione,
  Criterio,
  FamigliaRequisito,
  GravitaAnomalia,
  PrestazioneId,
  RequisitoId,
  Rimedio,
  RimedioApplicabile,
  Ruolo,
  Soggetto,
  SoggettoId,
  StatoRequisito,
  Verdetto,
} from './domain';
import { formattaConUnita, formattaData, formattaEuro, formattaPercentuale } from './formato';

export type ContestoDescrizioni = { bando: Bando; soggetti: Soggetto[] };

// ─── Nomi ────────────────────────────────────────────────────

/** Il nome del soggetto, o l'id se non esiste: un id sconosciuto è un'anomalia, non un crash. */
export function nomeSoggetto(id: SoggettoId, contesto: ContestoDescrizioni): string {
  return contesto.soggetti.find((s) => s.id === id)?.denominazione ?? id;
}

export function nomePrestazione(id: PrestazioneId, contesto: ContestoDescrizioni): string {
  return contesto.bando.lotti.flatMap((l) => l.prestazioni).find((p) => p.id === id)?.descrizione ?? id;
}

export function nomeRequisito(id: RequisitoId, contesto: ContestoDescrizioni): string {
  return contesto.bando.lotti.flatMap((l) => l.requisiti).find((r) => r.id === id)?.descrizione ?? id;
}

// ─── Etichette ───────────────────────────────────────────────

export function etichettaStato(stato: StatoRequisito): string {
  switch (stato) {
    case 'coperto':
      return 'Coperto';
    case 'scoperto':
      return 'Scoperto';
    case 'da_verificare':
      return 'Da verificare';
    default:
      return assertNever(stato);
  }
}

export function etichettaVerdetto(verdetto: Verdetto): string {
  switch (verdetto) {
    case 'ammissibile':
      return 'Ammissibile';
    case 'ammissibile_con_riserva':
      return 'Ammissibile con riserva';
    case 'non_ammissibile':
      return 'Non ammissibile';
    default:
      return assertNever(verdetto);
  }
}

export function etichettaRuolo(ruolo: Ruolo): string {
  switch (ruolo) {
    case 'mandataria':
      return 'Mandataria';
    case 'mandante':
      return 'Mandante';
    case 'consorziata_esecutrice':
      return 'Consorziata esecutrice';
    case 'ausiliaria':
      return 'Ausiliaria (avvalimento)';
    default:
      return assertNever(ruolo);
  }
}

/** La famiglia è descrittiva: serve solo a raggruppare le righe a video. */
export function etichettaFamiglia(famiglia: FamigliaRequisito): string {
  switch (famiglia) {
    case 'generale':
      return 'Requisiti generali';
    case 'economico':
      return 'Capacità economico-finanziaria';
    case 'certificazione':
      return 'Certificazioni';
    case 'referenza':
      return 'Referenze';
    case 'iscrizione':
      return 'Iscrizioni';
    default:
      return assertNever(famiglia);
  }
}

export function etichettaAssunzione(codice: CodiceAssunzione): string {
  switch (codice) {
    case 'arrotondamento_minimi':
      return 'Arrotondamento per eccesso dei minimi per ruolo';
    case 'classe_cpv':
      return 'Esclusione dei servizi per classe CPV';
    default:
      return assertNever(codice);
  }
}

export function etichettaGravita(gravita: GravitaAnomalia): string {
  switch (gravita) {
    case 'bloccante':
      return 'Bloccante';
    case 'segnalazione':
      return 'Segnalazione';
    default:
      return assertNever(gravita);
  }
}

// ─── Criteri ─────────────────────────────────────────────────

/** Il profilo che manca, in parole: usato dal rimedio `profilo_mancante`. */
export function descriviCriterio(criterio: Criterio): string {
  switch (criterio.tipo) {
    case 'dichiarazione':
      return `dichiarazione «${criterio.oggetto}»`;
    case 'certificazione':
      return criterio.scope === undefined ? `certificazione ${criterio.norma}` : `certificazione ${criterio.norma} con scope «${criterio.scope}»`;
    case 'iscrizione':
      return criterio.attivita === undefined ? `iscrizione ${criterio.registro}` : `iscrizione ${criterio.registro} per «${criterio.attivita}»`;
    case 'fatturato': {
      const ambito = criterio.ambito.tipo === 'globale' ? 'fatturato globale' : `fatturato nel settore «${criterio.ambito.settore}»`;
      return `${ambito} di almeno ${formattaEuro(criterio.soglia)} negli ultimi ${criterio.esercizi} esercizi`;
    }
    case 'servizi':
      return `almeno ${formattaConUnita(criterio.numeroMinimo, { tipo: 'conteggio', sostantivo: criterio.sostantivo })} con CPV ${criterio.cpv} negli ultimi ${criterio.anni} anni${criterio.importoMinimoUnitario === undefined ? '' : `, ciascuna da almeno ${formattaEuro(criterio.importoMinimoUnitario)}`}`;
    case 'servizi_importo':
      return `servizi con CPV ${criterio.cpv} negli ultimi ${criterio.anni} anni per almeno ${formattaEuro(criterio.soglia)} complessivi`;
    default:
      return assertNever(criterio);
  }
}

// ─── Rimedi ──────────────────────────────────────────────────

export function descriviMossa(mossa: RimedioApplicabile, contesto: ContestoDescrizioni): string {
  switch (mossa.tipo) {
    case 'riassegna_quota':
      return `Riassegna il ${formattaPercentuale(mossa.quota)} di «${nomePrestazione(mossa.prestazioneId, contesto)}» da ${nomeSoggetto(mossa.daSoggettoId, contesto)} a ${nomeSoggetto(mossa.aSoggettoId, contesto)}`;
    case 'uscita_soggetto':
      return `Uscita di ${nomeSoggetto(mossa.soggettoId, contesto)} dal raggruppamento`;
    case 'ingresso_soggetto': {
      const chi = `Ingresso di ${nomeSoggetto(mossa.soggettoId, contesto)} come ${etichettaRuolo(mossa.ruolo).toLowerCase()}`;
      const quote = Object.entries(mossa.quote).filter(([, q]) => q > 0);
      if (quote.length === 0) return `${chi}, senza quote di esecuzione`;
      const dettaglio = quote.map(([p, q]) => `${formattaPercentuale(q)} di «${nomePrestazione(p, contesto)}»`).join(', ');
      return mossa.rilevateDa === undefined ? `${chi} con ${dettaglio}` : `${chi}, rilevando ${dettaglio} da ${nomeSoggetto(mossa.rilevateDa, contesto)}`;
    }
    case 'avvalimento':
      return `Avvalimento di ${nomeSoggetto(mossa.ausiliariaId, contesto)} a favore di ${nomeSoggetto(mossa.ausiliataId, contesto)} per «${nomeRequisito(mossa.requisitoId, contesto)}»`;
    default:
      return assertNever(mossa);
  }
}

export function descriviRimedio(rimedio: Rimedio, contesto: ContestoDescrizioni): string {
  switch (rimedio.tipo) {
    case 'riassegna_quota':
    case 'uscita_soggetto':
    case 'ingresso_soggetto':
    case 'avvalimento':
      return descriviMossa(rimedio, contesto);
    case 'profilo_mancante':
      return `Nessun soggetto disponibile copre questo requisito: serve ${descriviCriterio(rimedio.criterio)}`;
    case 'rinnovo_documento':
      return `Rinnovo di «${rimedio.fonte.riferimento}» di ${nomeSoggetto(rimedio.soggettoId, contesto)}, scaduto il ${formattaData(rimedio.scadutoIl)}`;
    default:
      return assertNever(rimedio);
  }
}

export function eApplicabile(rimedio: Rimedio): rimedio is RimedioApplicabile {
  switch (rimedio.tipo) {
    case 'riassegna_quota':
    case 'uscita_soggetto':
    case 'ingresso_soggetto':
    case 'avvalimento':
      return true;
    case 'profilo_mancante':
    case 'rinnovo_documento':
      return false;
    default:
      return assertNever(rimedio);
  }
}

// ─── Anomalie ────────────────────────────────────────────────

export type BersaglioAnomalia =
  | { tipo: 'membro'; id: SoggettoId }
  | { tipo: 'prestazione'; id: PrestazioneId }
  | { tipo: 'requisito'; id: RequisitoId };

/** L'oggetto in pagina che causa l'anomalia, se ce n'è uno da raggiungere. */
export function bersaglioAnomalia(anomalia: Anomalia): BersaglioAnomalia | undefined {
  switch (anomalia.codice) {
    case 'mandataria_multipla':
      return anomalia.soggettiIds[0] === undefined ? undefined : { tipo: 'membro', id: anomalia.soggettiIds[0] };
    case 'membro_duplicato':
    case 'membro_senza_quote':
    case 'avvalimento_su_requisito_non_avvalibile':
    case 'periodo_invertito':
      return { tipo: 'membro', id: anomalia.soggettoId };
    case 'quota_fuori_intervallo':
      return { tipo: 'membro', id: anomalia.soggettoId };
    case 'quote_non_totali':
    case 'prestazione_senza_esecutore':
    case 'vincolo_prestazione_principale_violato':
      return { tipo: 'prestazione', id: anomalia.prestazioneId };
    case 'regola_somma_su_criterio_di_possesso':
    case 'parametro_requisito_non_valido':
      return { tipo: 'requisito', id: anomalia.requisitoId };
    case 'riferimento_inesistente':
      return anomalia.entita === 'prestazione' ? { tipo: 'prestazione', id: anomalia.id } : anomalia.entita === 'requisito' ? { tipo: 'requisito', id: anomalia.id } : undefined;
    case 'identificativo_duplicato':
      return anomalia.entita === 'prestazione' ? { tipo: 'prestazione', id: anomalia.id } : { tipo: 'requisito', id: anomalia.id };
    case 'mandataria_assente':
    case 'data_malformata':
    case 'termine_presentazione_decorso':
    case 'vincolo_senza_prestazione_principale':
      return undefined;
    default:
      return assertNever(anomalia);
  }
}
