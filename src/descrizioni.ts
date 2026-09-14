// Testo dagli identificativi: nomi reali di soggetti, prestazioni e
// requisiti al posto degli id. Funzioni pure, senza JSX, testate.
// Nessun calcolo: solo traduzione di ciò che il motore ha già deciso.

import { assertNever } from './assertNever';
import type {
  Anomalia,
  Bando,
  CodiceAssunzione,
  CriterioRisolto,
  Esito,
  FamigliaRequisito,
  GravitaAnomalia,
  Indeterminatezza,
  LottoId,
  PercorsoMinimo,
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

/** "Lotto 1", "Lotto 2": la posizione nel bando, mai l'identificativo. Con un lotto solo, "Lotto unico". */
export function nomeLotto(bando: Bando, lottoId: LottoId): string {
  if (bando.lotti.length === 1) return 'Lotto unico';
  const posizione = bando.lotti.findIndex((l) => l.id === lottoId);
  return posizione < 0 ? 'Lotto' : `Lotto ${posizione + 1}`;
}

/** Il verdetto usa le forme dei requisiti: una sola grammatica visiva. */
export function formaDelVerdetto(verdetto: Verdetto): StatoRequisito {
  switch (verdetto) {
    case 'ammissibile':
      return 'coperto';
    case 'ammissibile_con_riserva':
      return 'da_verificare';
    case 'non_ammissibile':
      return 'scoperto';
    default:
      return assertNever(verdetto);
  }
}

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
    case 'ancoraggio_termine_presentazione':
      return 'Finestra ancorata al termine di presentazione';
    case 'esito_concordante':
      return 'Esito valido con letture concordanti del documento';
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
export function descriviCriterio(criterio: CriterioRisolto): string {
  switch (criterio.tipo) {
    case 'dichiarazione':
      return `dichiarazione «${criterio.oggetto}»`;
    case 'certificazione': {
      const norme = criterio.norme.join(' o ');
      return criterio.scope === undefined ? `certificazione ${norme}` : `certificazione ${norme} con scope «${criterio.scope}»`;
    }
    case 'iscrizione':
      return criterio.attivita === undefined ? `iscrizione ${criterio.registro}` : `iscrizione ${criterio.registro} per «${criterio.attivita}»`;
    case 'fatturato': {
      const ambito = criterio.ambito.tipo === 'globale' ? 'fatturato globale' : `fatturato nel settore «${criterio.ambito.settore}»`;
      const periodo = criterio.periodo.tipo === 'a_ritroso' ? `negli ultimi ${criterio.periodo.esercizi} esercizi` : `negli esercizi ${criterio.periodo.anni.join(', ')}`;
      return `${ambito} di almeno ${formattaEuro(criterio.soglia)} ${periodo}`;
    }
    case 'servizi':
      return `almeno ${formattaConUnita(criterio.numeroMinimo, { tipo: 'conteggio', sostantivo: criterio.sostantivo })} con CPV ${criterio.cpv} negli ultimi ${criterio.anni} anni${criterio.importoMinimoUnitario === undefined ? '' : `, ciascuna da almeno ${formattaEuro(criterio.importoMinimoUnitario)}`}`;
    case 'servizi_importo':
      return `servizi con CPV ${criterio.cpv} negli ultimi ${criterio.anni} anni per almeno ${formattaEuro(criterio.soglia)} complessivi`;
    case 'non_determinato':
      return `«${criterio.testo}», che il disciplinare non determina`;
    default:
      return assertNever(criterio);
  }
}

// ─── Indeterminatezze ────────────────────────────────────────

/** Perché il motore non decide, in una frase per chi legge la riga. */
export function descriviIndeterminatezza(i: Indeterminatezza, contesto: ContestoDescrizioni): string {
  switch (i.tipo) {
    case 'regola_non_dichiarata':
      return 'Il disciplinare non dice chi debba possederlo nel raggruppamento.';
    case 'criterio_non_determinato':
      return `Il disciplinare non dice cosa lo soddisfi: «${i.testo}».`;
    case 'letture_discordanti':
      return `Il documento ammette più letture con esiti diversi: ${i.esiti.map((e) => `«${e.etichetta}» ${etichettaStato(e.stato).toLowerCase()}`).join('; ')}.`;
    case 'valore_contraddittorio':
      return `Il bando scrive «${i.nome}» in più modi, con esiti diversi: ${i.esiti.map((e) => `${e.etichetta} → ${etichettaStato(e.stato).toLowerCase()}`).join('; ')}.`;
    case 'giudizio_richiesto':
      switch (i.interpella) {
        case 'stazione_appaltante':
          return `Per ${nomeSoggetto(i.soggettoId, contesto)} si chiede alla stazione appaltante: ${i.oggetto}.`;
        case 'concorrente':
          return `Per ${nomeSoggetto(i.soggettoId, contesto)} decide il concorrente: ${i.oggetto}.`;
        default:
          return assertNever(i.interpella);
      }
    default:
      return assertNever(i);
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

/** "entro le 12:00 del 27/12/2023" / "entro il 27/12/2023". */
export function descriviTermine(termine: { data: string; ora?: string }): string {
  return termine.ora === undefined ? `entro il ${formattaData(termine.data)}` : `entro le ${termine.ora} del ${formattaData(termine.data)}`;
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
    case 'richiesta_chiarimenti': {
      const quesiti = rimedio.quesiti.join(' ');
      if (rimedio.termine !== undefined && rimedio.decorso) {
        return `Il termine per i chiarimenti (${descriviTermine(rimedio.termine).replace(/^entro /, '')}) è decorso: l'ambiguità resta a rischio del concorrente. Il quesito che andava posto: ${quesiti}`;
      }
      const entro = rimedio.termine === undefined ? '' : ` ${descriviTermine(rimedio.termine)}`;
      return `Chiedi chiarimenti alla stazione appaltante${entro}: ${quesiti}`;
    }
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
    case 'richiesta_chiarimenti':
      return false;
    default:
      return assertNever(rimedio);
  }
}

// ─── La frase del verdetto ───────────────────────────────────
// Il verdetto è una conclusione, e le conclusioni si scrivono: una frase
// che una persona leggerebbe ad alta voce a un collega. Tre forme di pari
// rango: esiste una mossa; nessuna mossa e si chiedono chiarimenti entro
// il termine; il termine è decorso e l'ambiguità resta a rischio.

const IN_PAROLE = ['nessuno', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'];

/** "cinque", "una": i numeri piccoli si scrivono, nelle frasi. */
export function inParole(n: number, femminile = false): string {
  const parola = IN_PAROLE[n];
  if (parola === undefined) return String(n);
  return femminile && n === 1 ? 'una' : femminile && n === 0 ? 'nessuna' : parola;
}

function maiuscola(testo: string): string {
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

/** Il nome senza la forma giuridica, solo dove si parla: "Grossfarma Centro-Sud". */
export function nomeParlato(id: SoggettoId, contesto: ContestoDescrizioni): string {
  return nomeSoggetto(id, contesto).replace(/\s+(S\.p\.A\.|S\.r\.l\.|S\.n\.c\.|S\.a\.s\.|S\.c\.a\.?\s?r\.l\.|S\.c\.r\.l\.|S\.r\.l\.s\.|SpA|Srl)\s*$/i, '');
}

function nomeBreveRequisito(id: RequisitoId, contesto: ContestoDescrizioni): string {
  return contesto.bando.lotti.flatMap((l) => l.requisiti).find((r) => r.id === id)?.nomeBreve ?? id;
}

/** Vero se la prestazione è l'unica del suo lotto: nominarla non aggiunge niente. */
function prestazioneUnica(id: PrestazioneId, contesto: ContestoDescrizioni): boolean {
  const lotto = contesto.bando.lotti.find((l) => l.prestazioni.some((p) => p.id === id));
  return lotto !== undefined && lotto.prestazioni.length === 1;
}

/** La mossa come la direbbe una persona: "far entrare Grossfarma al posto di Farmadistribuzione". */
export function fraseMossa(mossa: RimedioApplicabile, contesto: ContestoDescrizioni): string {
  switch (mossa.tipo) {
    case 'riassegna_quota': {
      const dove = prestazioneUnica(mossa.prestazioneId, contesto) ? '' : ` di «${nomePrestazione(mossa.prestazioneId, contesto)}»`;
      return `spostare il ${formattaPercentuale(mossa.quota)}${dove} da ${nomeParlato(mossa.daSoggettoId, contesto)} a ${nomeParlato(mossa.aSoggettoId, contesto)}`;
    }
    case 'uscita_soggetto':
      return `far uscire ${nomeParlato(mossa.soggettoId, contesto)}`;
    case 'ingresso_soggetto': {
      const quote = Object.entries(mossa.quote).filter(([, q]) => q > 0);
      const chi = `far entrare ${nomeParlato(mossa.soggettoId, contesto)}`;
      if (quote.length === 0) return `${chi} senza quote di esecuzione`;
      const su = quote.every(([p]) => prestazioneUnica(p, contesto)) ? '' : ` su ${quote.map(([p]) => `«${nomePrestazione(p, contesto)}»`).join(' e ')}`;
      const alPosto = mossa.rilevateDa === undefined ? '' : ` al posto di ${nomeParlato(mossa.rilevateDa, contesto)}`;
      return `${chi}${su}${alPosto}`;
    }
    case 'avvalimento':
      return `l'avvalimento di ${nomeParlato(mossa.ausiliariaId, contesto)} a favore di ${nomeParlato(mossa.ausiliataId, contesto)} su «${nomeBreveRequisito(mossa.requisitoId, contesto)}»`;
    default:
      return assertNever(mossa);
  }
}

export type MossaProposta = { testo: string; mossa: RimedioApplicabile };

export type FraseVerdetto = {
  /** "Ammissibile con riserva." — la parola dello stato, e il lotto se ce n'è più d'uno. */
  stato: string;
  lotto?: string;
  /** Quanti requisiti e perché: "Cinque requisiti su sei restano da verificare: su tre…". */
  situazione?: string;
  /** Il termine per i chiarimenti, quando è la cosa più urgente: aperto o decorso. */
  scadenza?: { testo: string; decorsa: boolean };
  /** La mossa (o le mosse) da provare, introdotte da una frase. */
  azione?: string;
  mosse: MossaProposta[];
  residui?: string;
  bloccanti: string[];
  inCalcolo: boolean;
};

type Percorso = PercorsoMinimo | 'in_calcolo';

function plurale(n: number, singolare: string, plurale: string): string {
  return n === 1 ? singolare : plurale;
}

/** "Un requisito", "Cinque requisiti": l'apocope davanti al nome, la cifra in parole altrove. */
function quanti(n: number, singolare: string, plurali: string): string {
  return n === 1 ? `Un ${singolare}` : `${maiuscola(inParole(n))} ${plurali}`;
}

function situazioneDi(esito: Pick<Esito, 'requisiti'>, totale: number): string | undefined {
  const scoperti = esito.requisiti.filter((r) => r.stato === 'scoperto');
  const daVerificare = esito.requisiti.filter((r) => r.stato === 'da_verificare');
  const frasi: string[] = [];
  if (scoperti.length > 0) {
    frasi.push(`${quanti(scoperti.length, 'requisito', 'requisiti')} su ${inParole(totale)} ${plurale(scoperti.length, 'è scoperto', 'sono scoperti')}.`);
  }
  if (daVerificare.length > 0) {
    const regola = daVerificare.filter((r) => r.indeterminatezze.some((i) => i.tipo === 'regola_non_dichiarata')).length;
    const documento = daVerificare.filter((r) => !r.indeterminatezze.some((i) => i.tipo === 'regola_non_dichiarata') && r.indeterminatezze.some((i) => i.tipo === 'criterio_non_determinato' || i.tipo === 'letture_discordanti' || i.tipo === 'valore_contraddittorio')).length;
    const giudizio = daVerificare.length - regola - documento;
    const perche: string[] = [];
    if (regola > 0) perche.push(`su ${inParole(regola)} il disciplinare non dice chi debba ${plurale(regola, 'possederlo', 'possederli')} nel raggruppamento`);
    if (documento > 0) perche.push(`su ${inParole(documento)} il documento ammette più letture`);
    if (giudizio > 0) perche.push(`su ${inParole(giudizio)} serve un giudizio`);
    const testa = `${quanti(daVerificare.length, 'requisito', 'requisiti')} su ${inParole(totale)} ${plurale(daVerificare.length, 'resta', 'restano')} da verificare`;
    frasi.push(perche.length > 0 ? `${testa}: ${perche.join(', ')}.` : `${testa}.`);
  }
  if (frasi.length === 0 && totale > 0) frasi.push('Tutti i requisiti sono coperti.');
  return frasi.length === 0 ? undefined : frasi.join(' ');
}

function scadenzaDi(esito: Pick<Esito, 'requisiti'>, bando: Bando, dataRiferimento: string, richiedeChiarimenti: (i: Indeterminatezza) => boolean): FraseVerdetto['scadenza'] {
  const daChiedere = esito.requisiti.filter((r) => r.indeterminatezze.some(richiedeChiarimenti)).length;
  if (daChiedere === 0) return undefined;
  const su = `su ${inParole(daChiedere)} ${plurale(daChiedere, 'requisito', 'requisiti')}`;
  const termine = bando.termineChiarimenti;
  if (!termine) return { testo: `Il bando non fissa un termine per i chiarimenti: chiedili alla stazione appaltante ${su}.`, decorsa: false };
  if (dataRiferimento > termine.data) {
    return { testo: `Il termine per i chiarimenti è decorso il ${formattaData(termine.data)}: le ambiguità restano a rischio del concorrente.`, decorsa: true };
  }
  const fino = termine.ora === undefined ? `al ${formattaData(termine.data)}` : `alle ${termine.ora} del ${formattaData(termine.data)}`;
  return { testo: `Hai tempo fino ${fino} per chiedere chiarimenti ${su}.`, decorsa: false };
}

function elencoBrevi(ids: RequisitoId[], contesto: ContestoDescrizioni): string {
  return ids.map((id) => `«${nomeBreveRequisito(id, contesto)}»`).join(', ');
}

export function fraseVerdetto(p: {
  bando: Bando;
  lottoId: LottoId;
  esito: Pick<Esito, 'verdetto' | 'requisiti' | 'anomalie'>;
  percorso: Percorso;
  dataRiferimento: string;
  contesto: ContestoDescrizioni;
  richiedeChiarimenti: (i: Indeterminatezza) => boolean;
}): FraseVerdetto {
  const { bando, lottoId, esito, percorso, dataRiferimento, contesto, richiedeChiarimenti } = p;
  const lotto = bando.lotti.find((l) => l.id === lottoId);
  const base: FraseVerdetto = {
    stato: etichettaVerdetto(esito.verdetto),
    lotto: bando.lotti.length > 1 ? `sul ${nomeLotto(bando, lottoId)}` : undefined,
    mosse: [],
    bloccanti: esito.anomalie.filter((a) => a.gravita === 'bloccante').map((a) => a.messaggio),
    inCalcolo: false,
  };
  if (base.bloccanti.length > 0) {
    const n = base.bloccanti.length;
    return { ...base, situazione: `Prima sistema i dati: ${n} ${plurale(n, 'anomalia bloccante', 'anomalie bloccanti')}.` };
  }
  const totale = lotto?.requisiti.length ?? esito.requisiti.length;
  const situazione = situazioneDi(esito, totale);
  const scadenza = scadenzaDi(esito, bando, dataRiferimento, richiedeChiarimenti);

  if (percorso === 'in_calcolo') return { ...base, situazione, scadenza, inCalcolo: true };

  switch (percorso.esito) {
    case 'bloccato_da_anomalie':
      return { ...base, situazione };
    case 'trovato': {
      const n = percorso.mosse.length;
      const dove = percorso.verdettoRaggiunto === 'ammissibile' ? 'dentro' : 'ad ammissibile con riserva';
      const azione = n === 1 ? `Una mossa ti porta ${dove}:` : `${maiuscola(inParole(n))} mosse ti portano ${dove}:`;
      const residui = percorso.residui.length === 0 ? undefined : `Resta da verificare a mano: ${elencoBrevi(percorso.residui, contesto)}.`;
      return { ...base, situazione, scadenza, azione, mosse: percorso.mosse.map((mossa) => ({ testo: maiuscola(fraseMossa(mossa, contesto)), mossa })), residui };
    }
    case 'gia_ammissibile': {
      const { miglioramenti } = percorso;
      if (miglioramenti.length === 0) return { ...base, situazione, scadenza };
      const risolti = [...new Set(miglioramenti.flatMap((m) => m.requisitiRisolti))];
      const n = miglioramenti.length;
      const azione = `${n === 1 ? 'Una mossa toglierebbe' : `${maiuscola(inParole(n))} mosse toglierebbero`} anche l'incertezza su ${elencoBrevi(risolti, contesto)}:`;
      return { ...base, situazione, scadenza, azione, mosse: miglioramenti.map((m) => ({ testo: maiuscola(fraseMossa(m.mossa, contesto)), mossa: m.mossa })) };
    }
    case 'inesistente':
      return { ...base, situazione, scadenza, azione: `Nessuna mossa con i soggetti disponibili ti porta dentro. Restano scoperti: ${elencoBrevi(percorso.restanoScoperti, contesto)}.` };
    default:
      return assertNever(percorso);
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
    case 'prestazione_indivisibile_non_unica':
      return { tipo: 'prestazione', id: anomalia.prestazioneId };
    case 'regola_somma_su_criterio_di_possesso':
    case 'parametro_requisito_non_valido':
    case 'rinvio_a_valore_inesistente':
    case 'ancoraggio_a_pubblicazione_senza_data':
    case 'requisito_senza_letture':
      return { tipo: 'requisito', id: anomalia.requisitoId };
    case 'riferimento_inesistente':
      return anomalia.entita === 'prestazione' ? { tipo: 'prestazione', id: anomalia.id } : anomalia.entita === 'requisito' ? { tipo: 'requisito', id: anomalia.id } : undefined;
    case 'identificativo_duplicato':
      return anomalia.entita === 'prestazione' ? { tipo: 'prestazione', id: anomalia.id } : { tipo: 'requisito', id: anomalia.id };
    case 'mandataria_assente':
    case 'data_malformata':
    case 'termine_presentazione_decorso':
    case 'vincolo_senza_prestazione_principale':
    case 'valore_bando_senza_candidati':
      return undefined;
    default:
      return assertNever(anomalia);
  }
}
