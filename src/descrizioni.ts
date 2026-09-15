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
  EsitoRequisito,
  EsitoVariante,
  FamigliaRequisito,
  GravitaAnomalia,
  Indeterminatezza,
  Lotto,
  LottoId,
  PercorsoMinimo,
  PrestazioneId,
  Requisito,
  RequisitoId,
  Rimedio,
  RimedioApplicabile,
  Ruolo,
  Soggetto,
  SoggettoId,
  StatoRequisito,
  Verdetto,
} from './domain';
import type { Provenienza } from './documenti/formato';
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
    bloccanti: esito.anomalie.filter((a) => a.gravita === 'bloccante').map((a) => descriviAnomalia(a, contesto)),
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

// ─── La riga del requisito ───────────────────────────────────
// In riga restano quattro cose: stato, nome breve, quanto manca, e una
// frase sola che dice perché — al massimo quindici parole, un verbo
// attivo, nessun identificativo. Nasce dai dati dell'esito, non dal
// taglio della motivazione lunga: un troncamento produce frasi mutilate.

/** "chiarimenti" se la stazione appaltante può sciogliere il dubbio, "da valutare" se resta al concorrente. */
export function azioneRichiesta(esito: EsitoRequisito, richiedeChiarimenti: (i: Indeterminatezza) => boolean): 'chiarimenti' | 'da valutare' | undefined {
  if (esito.indeterminatezze.some(richiedeChiarimenti)) return 'chiarimenti';
  if (esito.indeterminatezze.length > 0) return 'da valutare';
  return undefined;
}

function conteggiati(esito: EsitoRequisito, filtro: (c: EsitoRequisito['contributi'][number]) => boolean): SoggettoId[] {
  return esito.contributi.filter((c) => c.conteggiato && filtro(c)).map((c) => c.soggettoId);
}

/** Quanto manca, in tre parole: "mancano 100.000 €", "manca a Beta", "da verificare". */
export function quantoManca(esito: EsitoRequisito, contesto: ContestoDescrizioni): string {
  if (esito.stato === 'coperto') return '';
  const m = esito.misurazione;
  // Su un requisito da verificare il delta è della lettura peggiore: è un massimo, non un fatto.
  const fino = esito.stato === 'da_verificare' ? 'fino a ' : '';
  if (m && m.delta > 0) return `${m.unita.tipo === 'conteggio' && m.delta === 1 && fino === '' ? 'manca' : 'mancano'} ${fino}${formattaConUnita(m.delta, m.unita)}`;
  if (esito.stato === 'scoperto') {
    const assenti = conteggiati(esito, (c) => c.valore.tipo === 'possesso' && c.valore.esito === 'assente');
    if (assenti.length > 0) return `manca a ${assenti.map((id) => nomeParlato(id, contesto)).join(', ')}`;
    return 'scoperto';
  }
  // La colonna dice quanto manca, non lo stato: senza un numero resta vuota.
  return '';
}

function statiIn(esiti: EsitoVariante[], femminile: boolean): string {
  const conta = (stato: StatoRequisito) => esiti.filter((e) => e.stato === stato).length;
  const parti: string[] = [];
  for (const stato of ['coperto', 'da_verificare', 'scoperto'] as const) {
    const n = conta(stato);
    if (n > 0) parti.push(`${etichettaStato(stato).toLowerCase()} con ${inParole(n, femminile)}`);
  }
  return parti.join(', ');
}

/** Il giudizio in poche parole: cosa non coincide. */
function cosaNonCoincide(oggetto: string): string {
  if (oggetto.includes('(iscrizione')) return "l'attività iscritta non coincide con quella richiesta";
  if (oggetto.includes('(certificazione')) return 'lo scope della certificazione non coincide con il settore richiesto';
  if (oggetto.startsWith('analogia del CPV')) return 'il CPV della fornitura non coincide con quello di gara';
  return oggetto;
}

/** La frase in riga: perché non è coperto. Undefined se è coperto. */
export function ragioneBreve(esito: EsitoRequisito, requisito: Requisito, contesto: ContestoDescrizioni): string | undefined {
  if (esito.stato === 'coperto') return undefined;
  const per = (tipo: Indeterminatezza['tipo']) => esito.indeterminatezze.find((i) => i.tipo === tipo);
  // Prima il più grave: se non si sa cosa soddisfi il requisito, chi debba possederlo viene dopo.
  if (per('criterio_non_determinato')) return "Il disciplinare non nomina il registro, l'albo o il documento richiesto.";
  if (per('regola_non_dichiarata')) return 'Il disciplinare non dice chi debba possederlo nel raggruppamento.';
  const valore = per('valore_contraddittorio');
  // Il nome del valore sta nell'espansione: in riga non ci sta, e il requisito lo dice già.
  if (valore?.tipo === 'valore_contraddittorio') return `Il bando dà ${inParole(valore.esiti.length)} valori: ${statiIn(valore.esiti, false)}.`;
  const letture = per('letture_discordanti');
  if (letture?.tipo === 'letture_discordanti') return `Il documento ammette ${inParole(letture.esiti.length, true)} letture: ${statiIn(letture.esiti, true)}.`;
  const giudizio = per('giudizio_richiesto');
  if (giudizio?.tipo === 'giudizio_richiesto') return `Per ${nomeParlato(giudizio.soggettoId, contesto)} ${cosaNonCoincide(giudizio.oggetto)}.`;

  const m = esito.misurazione;
  switch (requisito.regola.tipo) {
    case 'somma_membri':
      return m && m.minimiRuolo.some((r) => r.delta > 0)
        ? `${nomeParlato(m.minimiRuolo.find((r) => r.delta > 0)?.soggettoId ?? '', contesto)} resta sotto il minimo del suo ruolo.`
        : 'La somma dei membri non raggiunge la soglia.';
    case 'almeno_un_membro':
      return m && m.raggiunto > 0 ? 'Nessun membro raggiunge la soglia da solo.' : 'Nessun membro lo possiede.';
    case 'ciascun_membro':
    case 'esecutore_prestazione': {
      const assenti = conteggiati(esito, (c) => (c.valore.tipo === 'possesso' ? c.valore.esito === 'assente' : m !== undefined && c.valore.certo < m.soglia));
      const scaduto = esito.contributi.find((c) => assenti.includes(c.soggettoId) && c.nota?.includes('scaduto il'))?.nota?.match(/scaduto il (\S+)/)?.[1];
      const chi = assenti.map((id) => nomeParlato(id, contesto)).join(', ');
      if (assenti.length === 0) return 'Nessun membro esegue la prestazione.';
      return scaduto ? `Manca a ${chi}: il documento è scaduto il ${scaduto}.` : `Manca a ${chi}${requisito.regola.tipo === 'esecutore_prestazione' ? ', che esegue la prestazione' : ''}.`;
    }
    case 'non_dichiarata':
      return 'Il disciplinare non dice chi debba possederlo nel raggruppamento.';
    default:
      return assertNever(requisito.regola);
  }
}

// ─── Le note del motore ──────────────────────────────────────

/** "Note del motore — 1 scadenza in arrivo, 2 segnalazioni, 2 assunzioni": conta cosa c'è dentro. */
export function titoloNote(p: { scadenze: number; segnalazioni: number; assunzioni: number }): string {
  const parti: string[] = [];
  if (p.scadenze > 0) parti.push(`${p.scadenze} ${plurale(p.scadenze, 'scadenza in arrivo', 'scadenze in arrivo')}`);
  if (p.segnalazioni > 0) parti.push(`${p.segnalazioni} ${plurale(p.segnalazioni, 'segnalazione', 'segnalazioni')}`);
  if (p.assunzioni > 0) parti.push(`${p.assunzioni} ${plurale(p.assunzioni, 'assunzione', 'assunzioni')}`);
  parti.push('cosa non valuta');
  return `Note del motore — ${parti.join(', ')}`;
}

// ─── Anomalie ────────────────────────────────────────────────

/**
 * Il messaggio dell'anomalia con i nomi al posto degli identificativi.
 * Il motore produce dati e un messaggio tecnico; la presentazione è
 * compito di chi mostra la pagina, ed è qui che deve stare.
 */
export function descriviAnomalia(a: Anomalia, contesto: ContestoDescrizioni): string {
  const soggetto = (id: SoggettoId) => nomeSoggetto(id, contesto);
  const prestazione = (id: PrestazioneId) => `«${nomePrestazione(id, contesto)}»`;
  const requisito = (id: RequisitoId) => `«${nomeBreveRequisito(id, contesto)}»`;
  const lotto = (id: LottoId) => (contesto.bando.lotti.some((l) => l.id === id) ? nomeLotto(contesto.bando, id).toLowerCase() : id);
  switch (a.codice) {
    case 'mandataria_assente':
      return 'Il raggruppamento non ha una mandataria.';
    case 'mandataria_multipla':
      return `Il raggruppamento ha più di una mandataria: ${a.soggettiIds.map(soggetto).join(', ')}.`;
    case 'membro_duplicato':
      return `${soggetto(a.soggettoId)} compare più di una volta tra i membri.`;
    case 'membro_senza_quote':
      return `${soggetto(a.soggettoId)} non esegue niente nel ${lotto(a.lottoId)}: tutte le sue quote sono a zero.`;
    case 'identificativo_duplicato':
      return `Il bando usa lo stesso identificativo per più ${a.entita === 'prestazione' ? 'prestazioni' : 'requisiti'}: quote e riferimenti si mescolerebbero.`;
    case 'quota_fuori_intervallo':
      return `La quota di ${soggetto(a.soggettoId)} su ${prestazione(a.prestazioneId)} non è tra 0 e 100 %.`;
    case 'quote_non_totali':
      return `Le quote su ${prestazione(a.prestazioneId)} totalizzano ${formattaPercentuale(a.totale)} invece del 100 %.`;
    case 'prestazione_senza_esecutore':
      return `Nessun membro esegue ${prestazione(a.prestazioneId)}.`;
    case 'riferimento_inesistente': {
      const entita = a.entita;
      switch (entita) {
        case 'soggetto':
        case 'ausiliata':
          return `Un membro rinvia a un soggetto che non esiste nei fascicoli (${a.id}).`;
        case 'lotto':
          return `Il lotto selezionato non esiste nel bando (${a.id}).`;
        case 'prestazione':
          return `Una quota o una regola rinvia a una prestazione che il bando non ha (${a.id}).`;
        case 'requisito':
          return `Un'ausiliaria è indicata per un requisito che il lotto non ha (${a.id}).`;
        default:
          return assertNever(entita);
      }
    }
    case 'regola_somma_su_criterio_di_possesso':
      return `${requisito(a.requisitoId)} somma i membri, ma si possiede o no: non ha una soglia da sommare.`;
    case 'parametro_requisito_non_valido':
      return `${requisito(a.requisitoId)} ha un parametro non valido nei dati del bando (${a.parametro} = ${String(a.valore)}).`;
    case 'avvalimento_su_requisito_non_avvalibile':
      return `${soggetto(a.soggettoId)} è indicata come ausiliaria per ${requisito(a.requisitoId)}, che il disciplinare non dichiara avvalibile.`;
    case 'data_malformata':
      return a.origine === 'parametri' ? 'La data di riferimento non è una data valida.' : `Una data non è valida in ${a.dove}: «${a.valore}».`;
    case 'periodo_invertito':
      return `Nel fascicolo di ${soggetto(a.soggettoId)} un periodo finisce prima di iniziare.`;
    case 'termine_presentazione_decorso':
      return `Il termine di presentazione è decorso il ${formattaData(a.terminePresentazione)}.`;
    case 'vincolo_senza_prestazione_principale':
      return 'Il lotto vincola la prestazione principale ma non ne dichiara nessuna.';
    case 'vincolo_prestazione_principale_violato':
      return `${prestazione(a.prestazioneId)} va eseguita dalla ${etichettaRuolo(a.esecutore).toLowerCase()} per almeno il ${formattaPercentuale(a.quotaMinima)}; ora è al ${formattaPercentuale(a.quotaEffettiva)}.`;
    case 'rinvio_a_valore_inesistente':
      return `${requisito(a.requisitoId)} rinvia a «${a.nome}», che il bando non riporta.`;
    case 'valore_bando_senza_candidati':
      return `Il bando nomina «${a.nome}» senza dargli un valore.`;
    case 'ancoraggio_a_pubblicazione_senza_data':
      return `${requisito(a.requisitoId)} conta dalla pubblicazione del bando, che il documento non data.`;
    case 'prestazione_indivisibile_non_unica':
      return `${prestazione(a.prestazioneId)} è indivisibile ma il lotto ne dichiara altre.`;
    case 'requisito_senza_letture':
      return `${requisito(a.requisitoId)} non ha nessun criterio da valutare.`;
    default:
      return assertNever(a);
  }
}

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

// ─── Perimetro dei dati ──────────────────────────────────────

/**
 * Cosa sono i dati sulla pagina, detto dai documenti stessi: la natura la
 * dichiara l'intestazione di ciascuno, qui non si scrive a mano.
 */
export function dichiarazioneDati(bando: Provenienza, fascicoli: Provenienza[]): string {
  const frase = bando.natura === 'reale' ? `Bando reale: ${bando.documento}.` : `Bando di esempio, inventato: ${bando.documento}.`;
  const tutteEsempio = fascicoli.length > 0 && fascicoli.every((f) => f.natura === 'esempio');
  const tutteReali = fascicoli.length > 0 && fascicoli.every((f) => f.natura === 'reale');
  const imprese = tutteEsempio
    ? 'Le imprese e i loro fascicoli sono di esempio, inventati.'
    : tutteReali
      ? 'Le imprese e i loro fascicoli sono reali.'
      : 'Tra le imprese alcune sono reali e altre di esempio: lo dice la fonte di ogni fascicolo.';
  return `${frase} ${imprese}`;
}

// ─── Quote ───────────────────────────────────────────────────

/**
 * Perché spostare una quota può non cambiare l'esito, detto dai dati del
 * lotto: senza questa frase un campo che non incide sembra rotto. `rilevanti`
 * lo decide il motore (`quoteRilevanti`); qui si dice solo il perché.
 */
export function effettoDelleQuote(lotto: Lotto, rilevanti: boolean): string | undefined {
  if (rilevanti) return undefined;
  const indivisibile = lotto.prestazioni.length === 1 && lotto.prestazioni[0]?.natura === 'indivisibile';
  const perche = indivisibile
    ? 'la prestazione è indivisibile e nessun requisito di questo lotto guarda chi la esegue'
    : 'nessun requisito di questo lotto guarda chi esegue le prestazioni';
  return `Qui le quote non cambiano chi copre cosa: ${perche}. Contano per i totali, che devono fare 100 %, e chi è a zero non esegue niente.`;
}

// ─── Data di riferimento ─────────────────────────────────────

/**
 * Da dove viene la data da cui parte la valutazione. Sposta gli esiti — un
 * certificato scaduto, un termine decorso — quindi si dichiara sempre: la
 * data proposta con il bando e il suo motivo, oppure oggi in mancanza di
 * indicazione.
 */
export function fraseDataRiferimento(data: string, proposta: { motivo?: string } | undefined): string {
  if (!proposta) return `In mancanza di indicazione, la valutazione parte da oggi (${formattaData(data)}).`;
  return proposta.motivo
    ? `La valutazione parte dal ${formattaData(data)}: ${proposta.motivo}.`
    : `La valutazione parte dal ${formattaData(data)}, la data proposta con il bando.`;
}
