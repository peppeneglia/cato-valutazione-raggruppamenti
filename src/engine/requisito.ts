// Valutazione di un requisito: per ogni variante (lettura × candidati),
// criterio per ogni membro, fusione delle ausiliarie con le rispettive
// ausiliate, operatore di composizione, conversione in unità di uscita,
// motivazione. Poi la fusione delle varianti in un esito solo: se
// concordano l'esito vale e si mostra la lettura peggiore; se
// discordano è il documento che non decide, e lo si dice.

import { assertNever } from '../assertNever';
import type {
  Assunzione,
  Contributo,
  EsitoRequisito,
  EsitoVariante,
  EsitoVarianteCompleto,
  Indeterminatezza,
  MinimoRuolo,
  Misurazione,
  Prestazione,
  PrestazioneId,
  Raggruppamento,
  Requisito,
  RequisitoId,
  Soggetto,
  SoggettoId,
  StatoRequisito,
  Unita,
  ValoreContributo,
} from '../domain';
import { formattaConUnita } from '../formato';
import { sogliaInterna, unitaDi, valutaCriterio, type ContestoCriterio, type ContributoGrezzo, type FattoScaduto, type FattoUsato } from './criteri';
import { inEuro } from './importi';
import { eAusiliaria, eEsecutore, type MembroAusiliaria, type MembroEsecutore } from './membri';
import { assunzioniArrotondamento, componiMotivazione, type DatiMotivazione, type RigaMotivazione } from './motivazione';
import { componi, type MisurazioneGrezza, type Partecipante } from './operatori';
import { quotaSu } from './quote';
import { descriviCandidato, type Variante } from './varianti';

/**
 * Il contributo di un soggetto a un criterio non dipende dal raggruppamento:
 * nella ricerca dei rimedi si ricalcola per ogni stato, quindi si memorizza.
 * Chiave: variante (requisito, lettura, minimo unitario) e soggetto — la
 * soglia non entra. Vive dentro una sola chiamata di `valuta`.
 */
export type MemoCriteri = Map<string, ContributoGrezzo>;

export type ContestoValutazione = {
  prestazioni: ReadonlyMap<PrestazioneId, Prestazione>;
  soggetti: ReadonlyMap<SoggettoId, Soggetto>;
  raggruppamento: Raggruppamento;
  criterio: ContestoCriterio;
  memo?: MemoCriteri;
};

/** Undefined per un criterio non determinato: non c'è niente contro cui calcolare. */
export function contributoDi(variante: Variante, soggetto: Soggetto, contesto: Pick<ContestoValutazione, 'criterio' | 'memo'>): ContributoGrezzo | undefined {
  const { criterio } = variante;
  if (criterio.tipo === 'non_determinato') return undefined;
  const chiave = `${variante.chiaveMemo} ${soggetto.id}`;
  const memorizzato = contesto.memo?.get(chiave);
  if (memorizzato) return memorizzato;
  const grezzo = valutaCriterio(criterio, soggetto.fascicolo, contesto.criterio);
  contesto.memo?.set(chiave, grezzo);
  return grezzo;
}

/** Un fatto usato da un soggetto per un requisito: serve agli avvisi di scadenza. */
export type FattoUsatoDa = { soggettoId: SoggettoId; requisitoId: RequisitoId; fatto: FattoUsato };

/** Un fatto scaduto di un membro conteggiato: candidato al rimedio di rinnovo. */
export type FattoScadutoDi = { soggettoId: SoggettoId; fatto: FattoScaduto };

export type RequisitoValutato = {
  /** Con `rimedi` vuoti: i rimedi si calcolano dopo, rivalutando. */
  esito: EsitoRequisito;
  usati: FattoUsatoDa[];
  scaduti: FattoScadutoDi[];
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

function incerto(valore: ValoreContributo): boolean {
  switch (valore.tipo) {
    case 'possesso':
      return valore.esito === 'da_verificare';
    case 'misura':
      return valore.incerto > 0;
    default:
      return assertNever(valore);
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

// ─── Utilità ─────────────────────────────────────────────────

function unisciNote(note: string[]): string | undefined {
  return note.length === 0 ? undefined : note.join('; ');
}

function senzaDuplicati<T>(elementi: T[]): T[] {
  const viste = new Set<string>();
  return elementi.filter((e) => {
    const chiave = JSON.stringify(e);
    if (viste.has(chiave)) return false;
    viste.add(chiave);
    return true;
  });
}

// ─── Una variante ────────────────────────────────────────────

type VarianteValutata = { variante: Variante } & RequisitoValutato;

function valutaVariante(requisito: Requisito, variante: Variante, contesto: ContestoValutazione): VarianteValutata {
  const { criterio } = variante;
  const regolaNonDichiarata: Indeterminatezza[] = requisito.regola.tipo === 'non_dichiarata' ? [{ tipo: 'regola_non_dichiarata' }] : [];

  if (criterio.tipo === 'non_determinato') {
    return {
      variante,
      esito: {
        requisitoId: requisito.id,
        stato: 'da_verificare',
        contributi: [],
        motivazione: `Il disciplinare non dice cosa soddisfi il requisito: lo formula come «${criterio.testo}» senza nominare un registro, una norma o un documento. Nessun fascicolo si può confrontare.`,
        assunzioni: [],
        indeterminatezze: [{ tipo: 'criterio_non_determinato', testo: criterio.testo }, ...regolaNonDichiarata],
        rimedi: [],
      },
      usati: [],
      scaduti: [],
    };
  }

  const unita = unitaDi(criterio);
  const soglia = sogliaInterna(criterio);
  const grezzoDi = (soggetto: Soggetto) => valutaCriterio(criterio, soggetto.fascicolo, contesto.criterio);
  const contributoMemo = (soggetto: Soggetto) => contributoDi(variante, soggetto, contesto) ?? grezzoDi(soggetto);

  const esecutori: EsecutoreValutato[] = [];
  const ausiliarie: AusiliariaValutata[] = [];
  for (const membro of contesto.raggruppamento.membri) {
    const soggetto = contesto.soggetti.get(membro.soggettoId);
    if (!soggetto) continue; // riferimento inesistente: già un'anomalia bloccante
    if (eEsecutore(membro)) {
      esecutori.push({ membro, soggetto, grezzo: contributoMemo(soggetto) });
    } else if (eAusiliaria(membro) && requisito.avvalibile && membro.requisitiIds.includes(requisito.id)) {
      ausiliarie.push({ membro, soggetto, grezzo: contributoMemo(soggetto) });
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
  const scaduti: FattoScadutoDi[] = [];
  const giudizi: Indeterminatezza[] = [];

  for (const membro of contesto.raggruppamento.membri) {
    const esecutore = esecutori.find((e) => e.membro === membro);
    if (esecutore) {
      const conteggio = conteggi.get(membro.soggettoId);
      const conteggiato = conteggio?.conteggiato ?? false;
      const integrazioni = ausiliarieDi(membro.soggettoId);
      const composto = partecipanti.find((p) => p.soggettoId === membro.soggettoId)?.valore ?? esecutore.grezzo.valore;
      const noteAusiliarie = integrazioni.map((a) => `integrato dall'ausiliaria ${a.soggetto.denominazione}`);
      const note = [...(conteggio?.nota ? [conteggio.nota] : []), ...esecutore.grezzo.note, ...noteAusiliarie];
      contributi.push({
        soggettoId: membro.soggettoId,
        valore: valoreInUscita(esecutore.grezzo.valore, unita),
        conteggiato,
        fonti: esecutore.grezzo.usati.map((u) => u.fonte),
        nota: unisciNote(note),
        ...(esecutore.grezzo.dettagli.length > 0 ? { dettagli: esecutore.grezzo.dettagli } : {}),
      });
      righe.push({
        soggettoId: membro.soggettoId,
        denominazione: esecutore.soggetto.denominazione,
        ruolo: esecutore.membro.ruolo,
        conteggiato,
        quota: prestazioneRegola === undefined ? undefined : quotaSu(esecutore.membro.quote, prestazioneRegola),
        composto,
        note: esecutore.grezzo.note,
        ausiliarie: integrazioni.map((a) => a.soggetto.denominazione),
      });
      // Solo i fatti di chi concorre al requisito: un avviso su un fatto che non conta è rumore.
      if (conteggiato) {
        usati.push(...esecutore.grezzo.usati.map((fatto) => ({ soggettoId: membro.soggettoId, requisitoId: requisito.id, fatto })));
        scaduti.push(...esecutore.grezzo.scaduti.map((fatto) => ({ soggettoId: membro.soggettoId, fatto })));
        // Il giudizio conta solo se il valore composto è ancora incerto: un'ausiliaria certa lo rende superfluo.
        if (incerto(composto)) giudizi.push(...esecutore.grezzo.giudizi.map((g) => ({ tipo: 'giudizio_richiesto' as const, soggettoId: membro.soggettoId, ...g })));
      }
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
        ...(ausiliaria.grezzo.dettagli.length > 0 ? { dettagli: ausiliaria.grezzo.dettagli } : {}),
      });
      if (conteggiato) {
        usati.push(...ausiliaria.grezzo.usati.map((fatto) => ({ soggettoId: membro.soggettoId, requisitoId: requisito.id, fatto })));
        giudizi.push(...ausiliaria.grezzo.giudizi.map((g) => ({ tipo: 'giudizio_richiesto' as const, soggettoId: membro.soggettoId, ...g })));
      }
    }
  }

  const datiMotivazione: DatiMotivazione = {
    regola: requisito.regola,
    stato: composizione.stato,
    unita,
    soglia,
    righe,
    misurazione: composizione.misurazione,
    descrizionePrestazione: prestazioneRegola === undefined ? undefined : contesto.prestazioni.get(prestazioneRegola)?.descrizione,
  };

  // Dichiarate una volta per requisito, anche se hanno inciso su più membri.
  const assunzioni = senzaDuplicati([
    ...esecutori.flatMap((e) => e.grezzo.assunzioni),
    ...ausiliarie.flatMap((a) => a.grezzo.assunzioni),
    ...assunzioniArrotondamento(datiMotivazione),
  ]);

  // Un giudizio è un'indeterminatezza solo se lo stato ne dipende.
  const indeterminatezze: Indeterminatezza[] = [
    ...regolaNonDichiarata,
    ...(composizione.stato === 'da_verificare' ? senzaDuplicati(giudizi) : []),
  ];

  const esito: EsitoRequisito = {
    requisitoId: requisito.id,
    stato: composizione.stato,
    contributi,
    motivazione: componiMotivazione(datiMotivazione),
    assunzioni,
    indeterminatezze,
    rimedi: [],
  };
  if (unita !== undefined && composizione.misurazione) esito.misurazione = misurazioneInUscita(composizione.misurazione, unita);

  return { variante, esito, usati, scaduti };
}

// ─── Fusione delle varianti ──────────────────────────────────

const PESO: Record<StatoRequisito, number> = { coperto: 0, da_verificare: 1, scoperto: 2 };

function stessaUnita(a: Misurazione | undefined, b: Misurazione | undefined): boolean {
  return a !== undefined && b !== undefined && JSON.stringify(a.unita) === JSON.stringify(b.unita);
}

/**
 * La variante peggiore: stato peggiore, poi — solo tra misure della stessa
 * unità, perché forniture ed euro non si confrontano — delta maggiore e
 * soglia maggiore; altrimenti l'ordine del documento.
 */
function peggiore(valutate: VarianteValutata[]): VarianteValutata {
  return valutate.reduce((acc, v) => {
    const pa = PESO[acc.esito.stato];
    const pv = PESO[v.esito.stato];
    if (pv !== pa) return pv > pa ? v : acc;
    if (!stessaUnita(acc.esito.misurazione, v.esito.misurazione)) return acc;
    const da = acc.esito.misurazione?.delta ?? 0;
    const dv = v.esito.misurazione?.delta ?? 0;
    if (dv !== da) return dv > da ? v : acc;
    const sa = acc.esito.misurazione?.soglia ?? 0;
    const sv = v.esito.misurazione?.soglia ?? 0;
    return sv > sa ? v : acc;
  });
}

function descriviUnita(unita: Unita): string {
  switch (unita.tipo) {
    case 'euro':
      return 'euro';
    case 'conteggio':
      return unita.sostantivo.plurale;
    default:
      return assertNever(unita);
  }
}

function etichettaStato(stato: StatoRequisito): string {
  switch (stato) {
    case 'coperto':
      return 'coperto';
    case 'scoperto':
      return 'scoperto';
    case 'da_verificare':
      return 'da verificare';
    default:
      return assertNever(stato);
  }
}

function fmtMisura(valore: number, unita: Unita | undefined): string {
  return unita === undefined ? String(valore) : formattaConUnita(valore, unita);
}

/** Vero se le due varianti hanno scelto lo stesso candidato per ogni valore che hanno in comune. */
function stessiCandidati(a: Variante, b: Variante, escludi?: string): boolean {
  return a.candidati.every((c) => {
    if (c.nome === escludi) return true;
    const altro = b.candidati.find((x) => x.nome === c.nome);
    return altro === undefined || altro.indice === c.indice;
  });
}

/** A quale coordinata si deve la discordanza: alle letture, a un valore contraddittorio, o a entrambe. */
function attribuisci(valutate: VarianteValutata[], peggio: VarianteValutata, requisito: Requisito): Indeterminatezza[] {
  const risultato: Indeterminatezza[] = [];
  const stati = (voci: EsitoVariante[]) => new Set(voci.map((v) => v.stato)).size > 1;

  if (requisito.letture.length > 1) {
    const perLettura = valutate.filter((v) => stessiCandidati(v.variante, peggio.variante));
    const esiti: EsitoVariante[] = perLettura.map((v) => ({ etichetta: v.variante.testoLettura ?? `lettura ${v.variante.lettura + 1}`, stato: v.esito.stato }));
    if (stati(esiti)) risultato.push({ tipo: 'letture_discordanti', esiti });
  }
  for (const scelto of peggio.variante.candidati) {
    const perNome = valutate.filter((v) => v.variante.lettura === peggio.variante.lettura && stessiCandidati(v.variante, peggio.variante, scelto.nome));
    const esiti: EsitoVariante[] = perNome.flatMap((v) => {
      const c = v.variante.candidati.find((x) => x.nome === scelto.nome);
      return c ? [{ etichetta: descriviCandidato(c, false), stato: v.esito.stato }] : [];
    });
    if (stati(esiti)) risultato.push({ tipo: 'valore_contraddittorio', nome: scelto.nome, esiti });
  }
  if (risultato.length === 0) {
    // Discordanza solo cambiando più coordinate insieme: si dichiara sulle letture per intero.
    risultato.push({ tipo: 'letture_discordanti', esiti: valutate.map((v) => ({ etichetta: v.variante.etichetta, stato: v.esito.stato })) });
  }
  return risultato;
}

function fondiVarianti(requisito: Requisito, valutate: VarianteValutata[]): RequisitoValutato {
  const prima = valutate[0];
  if (!prima) throw new Error(`Il requisito ${requisito.id} non ha varianti: la validazione avrebbe dovuto fermarsi prima.`);
  if (valutate.length === 1) return { esito: prima.esito, usati: prima.usati, scaduti: prima.scaduti };

  const peggio = peggiore(valutate);
  const etichette = valutate.map((v) => v.variante.etichetta);
  const varianti: EsitoVarianteCompleto[] = valutate.map((v) => ({
    etichetta: v.variante.etichetta,
    stato: v.esito.stato,
    ...(v.esito.misurazione ? { misurazione: v.esito.misurazione } : {}),
    motivazione: v.esito.motivazione,
  }));
  const usati = senzaDuplicati(valutate.flatMap((v) => v.usati));
  const scaduti = senzaDuplicati(valutate.flatMap((v) => v.scaduti));
  const assunzioni: Assunzione[] = senzaDuplicati(valutate.flatMap((v) => v.esito.assunzioni));
  const giudizi = senzaDuplicati(valutate.flatMap((v) => v.esito.indeterminatezze.filter((i) => i.tipo === 'giudizio_richiesto')));
  const concordanti = new Set(valutate.map((v) => v.esito.stato)).size === 1;

  if (concordanti) {
    const misurazioni = valutate.flatMap((v) => (v.esito.misurazione ? [v.esito.misurazione] : []));
    const riferimento = misurazioni[0];
    const unitaUguali = misurazioni.every((m) => stessaUnita(m, riferimento));
    const divergono = riferimento !== undefined && misurazioni.some((m) => m.soglia !== riferimento.soglia || m.raggiunto !== riferimento.raggiunto || m.delta !== riferimento.delta);
    let motivazione = peggio.esito.motivazione;
    if (riferimento && !unitaUguali) {
      // Forniture ed euro non si confrontano: si dice solo che l'esito coincide.
      const unita = [...new Set(misurazioni.map((m) => descriviUnita(m.unita)))].join(', ');
      motivazione += ` Le letture misurano cose diverse (${unita}) e l'esito coincide sotto tutte.`;
    } else if (divergono && riferimento) {
      const unita = riferimento.unita;
      const delte = misurazioni.map((m) => m.delta);
      const soglie = misurazioni.map((m) => m.soglia);
      motivazione += peggio.esito.stato === 'coperto'
        ? ` La soglia va da ${fmtMisura(Math.min(...soglie), unita)} a ${fmtMisura(Math.max(...soglie), unita)} a seconda della lettura, ed è raggiunta sotto tutte.`
        : ` A seconda della lettura mancano tra ${fmtMisura(Math.min(...delte), unita)} e ${fmtMisura(Math.max(...delte), unita)}: si mostra la peggiore.`;
    }
    const numeri = !unitaUguali ? '' : divergono ? ' Dove i numeri differiscono si mostra la lettura peggiore.' : '';
    assunzioni.push({
      codice: 'esito_concordante',
      testo: `Il documento ammette più letture del requisito (${etichette.join('; ')}). L'esito è lo stesso sotto ciascuna, e vale anche se il documento è ambiguo.${numeri} È un'assunzione del motore, non del disciplinare.`,
    });
    return {
      esito: { ...peggio.esito, motivazione, assunzioni, indeterminatezze: [...peggio.esito.indeterminatezze.filter((i) => i.tipo !== 'giudizio_richiesto'), ...giudizi], varianti },
      usati,
      scaduti,
    };
  }

  const descrizioni = valutate.map((v) => {
    const m = v.esito.misurazione;
    const mancano = m && m.delta > 0 ? ` (mancano ${fmtMisura(m.delta, m.unita)})` : '';
    return `sotto «${v.variante.etichetta}» ${etichettaStato(v.esito.stato)}${mancano}`;
  });
  const motivazione = `Il documento ammette ${valutate.length} letture con esiti diversi: ${descrizioni.join('; ')}. Fino a un chiarimento non si può decidere; i numeri mostrati sono della lettura peggiore.`;
  const indeterminatezze: Indeterminatezza[] = [
    ...peggio.esito.indeterminatezze.filter((i) => i.tipo !== 'giudizio_richiesto'),
    ...attribuisci(valutate, peggio, requisito),
    ...giudizi,
  ];
  return {
    esito: { ...peggio.esito, stato: 'da_verificare', motivazione, assunzioni, indeterminatezze, varianti },
    usati,
    scaduti,
  };
}

// ─── Ingresso ────────────────────────────────────────────────

export function valutaRequisito(requisito: Requisito, varianti: Variante[], contesto: ContestoValutazione): RequisitoValutato {
  return fondiVarianti(requisito, varianti.map((v) => valutaVariante(requisito, v, contesto)));
}
