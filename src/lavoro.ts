// Il foglio di lavoro: l'unico stato mutabile dell'applicazione e le sue
// modifiche, come funzioni pure. Il raggruppamento è ciò che l'utente
// costruisce; la storia è la pila degli snapshot precedenti, così ogni
// modifica — manuale o prova di un rimedio — è annullabile nell'ordine vero.
// Niente logica di dominio: chi copre cosa lo dice il motore.

import { assertNever } from './assertNever';
import { descriviMossa, nomePrestazione, nomeSoggetto, type ContestoDescrizioni } from './descrizioni';
import type {
  Bando,
  LottoId,
  Membro,
  PrestazioneId,
  Raggruppamento,
  RequisitoId,
  RimedioApplicabile,
  RuoloEsecutore,
  SoggettoId,
} from './domain';
import { applicaMossa } from './engine';
import { formattaPercentuale } from './formato';

export type Passo = {
  etichetta: string;
  genere: 'modifica' | 'prova';
  /** Lo stato PRIMA del passo: annullare significa tornare qui. */
  raggruppamento: Raggruppamento;
};

export type Lavoro = {
  lottoId: LottoId;
  /** Il testo dell'input: se è malformato lo dice un'anomalia del motore. */
  dataRiferimento: string;
  raggruppamento: Raggruppamento;
  storia: Passo[];
};

export type Azione =
  | { tipo: 'seleziona_lotto'; lottoId: LottoId }
  | { tipo: 'imposta_data'; valore: string }
  | { tipo: 'imposta_quota'; soggettoId: SoggettoId; prestazioneId: PrestazioneId; quota: number }
  | { tipo: 'imposta_ruolo'; soggettoId: SoggettoId; ruolo: RuoloEsecutore }
  | { tipo: 'aggiungi_membro'; soggettoId: SoggettoId; ruolo: RuoloEsecutore }
  | { tipo: 'aggiungi_ausiliaria'; soggettoId: SoggettoId; ausiliataId: SoggettoId; requisitiIds: RequisitoId[] }
  | { tipo: 'rimuovi_membro'; soggettoId: SoggettoId }
  | { tipo: 'prova_rimedio'; mossa: RimedioApplicabile }
  | { tipo: 'annulla' };

/** Una quota valida è una frazione tra 0 e 1: la validazione sta alla fonte. */
export function quotaValida(quota: number): boolean {
  return Number.isFinite(quota) && quota >= 0 && quota <= 1;
}

/** Da testo in percento ("60", "12,5") a frazione; undefined se non è un numero valido. */
export function interpretaQuotaPercento(testo: string): number | undefined {
  const normalizzato = testo.trim().replace(',', '.');
  if (normalizzato === '' || !/^\d+(\.\d+)?$/.test(normalizzato)) return undefined;
  const quota = Number(normalizzato) / 100;
  return quotaValida(quota) ? quota : undefined;
}

/**
 * La composizione di partenza quando l'utente sceglie le imprese: la mandataria
 * per prima, e su ogni prestazione del bando quote in parti uguali in punti
 * percentuali interi, con l'arrotondamento alla mandataria (34/33/33). È la
 * scelta neutra: nessuna ripartizione pensata per produrre un esito.
 */
export function raggruppamentoInPartiUguali(bando: Bando, soggettiIds: SoggettoId[], mandatariaId: SoggettoId): Raggruppamento {
  const ordinati = [mandatariaId, ...soggettiIds.filter((id) => id !== mandatariaId)];
  const parte = Math.floor(100 / ordinati.length);
  const resto = 100 - parte * ordinati.length;
  const prestazioni = bando.lotti.flatMap((l) => l.prestazioni.map((p) => p.id));
  return {
    tipo: 'orizzontale',
    membri: ordinati.map((soggettoId, i) => {
      const percento = i === 0 ? parte + resto : parte;
      return {
        ruolo: i === 0 ? 'mandataria' : 'mandante',
        soggettoId,
        quote: Object.fromEntries(prestazioni.map((p) => [p, percento / 100])),
      };
    }),
  };
}

function conPasso(lavoro: Lavoro, etichetta: string, genere: Passo['genere'], raggruppamento: Raggruppamento): Lavoro {
  return {
    ...lavoro,
    raggruppamento,
    storia: [...lavoro.storia, { etichetta, genere, raggruppamento: lavoro.raggruppamento }],
  };
}

function esecutore(raggruppamento: Raggruppamento, soggettoId: SoggettoId) {
  const m = raggruppamento.membri.find((x) => x.soggettoId === soggettoId);
  return m && m.ruolo !== 'ausiliaria' ? m : undefined;
}

function sostituisci(raggruppamento: Raggruppamento, nuovo: Membro): Raggruppamento {
  return { ...raggruppamento, membri: raggruppamento.membri.map((m) => (m.soggettoId === nuovo.soggettoId ? nuovo : m)) };
}

/**
 * Riduce il foglio di lavoro. Le azioni impossibili (membro inesistente,
 * quota fuori intervallo, storia vuota) restituiscono lo stesso oggetto:
 * niente snapshot, niente re-render.
 */
export function riduci(lavoro: Lavoro, azione: Azione, contesto: ContestoDescrizioni): Lavoro {
  switch (azione.tipo) {
    case 'seleziona_lotto':
      return azione.lottoId === lavoro.lottoId ? lavoro : { ...lavoro, lottoId: azione.lottoId };

    case 'imposta_data':
      return azione.valore === lavoro.dataRiferimento ? lavoro : { ...lavoro, dataRiferimento: azione.valore };

    case 'imposta_quota': {
      const membro = esecutore(lavoro.raggruppamento, azione.soggettoId);
      if (!membro || !quotaValida(azione.quota)) return lavoro;
      const attuale = membro.quote[azione.prestazioneId] ?? 0;
      if (attuale === azione.quota) return lavoro;
      const etichetta = `Quota di ${nomeSoggetto(azione.soggettoId, contesto)} su «${nomePrestazione(azione.prestazioneId, contesto)}»: ${formattaPercentuale(attuale)} → ${formattaPercentuale(azione.quota)}`;
      return conPasso(lavoro, etichetta, 'modifica', sostituisci(lavoro.raggruppamento, { ...membro, quote: { ...membro.quote, [azione.prestazioneId]: azione.quota } }));
    }

    case 'imposta_ruolo': {
      const membro = esecutore(lavoro.raggruppamento, azione.soggettoId);
      if (!membro || membro.ruolo === azione.ruolo) return lavoro;
      const etichetta = `Ruolo di ${nomeSoggetto(azione.soggettoId, contesto)}: ${membro.ruolo} → ${azione.ruolo}`;
      return conPasso(lavoro, etichetta, 'modifica', sostituisci(lavoro.raggruppamento, { ...membro, ruolo: azione.ruolo }));
    }

    case 'aggiungi_membro': {
      if (lavoro.raggruppamento.membri.some((m) => m.soggettoId === azione.soggettoId)) return lavoro;
      const nuovo: Membro = { ruolo: azione.ruolo, soggettoId: azione.soggettoId, quote: {} };
      const etichetta = `Ingresso di ${nomeSoggetto(azione.soggettoId, contesto)} come ${azione.ruolo}`;
      return conPasso(lavoro, etichetta, 'modifica', { ...lavoro.raggruppamento, membri: [...lavoro.raggruppamento.membri, nuovo] });
    }

    case 'aggiungi_ausiliaria': {
      if (lavoro.raggruppamento.membri.some((m) => m.soggettoId === azione.soggettoId)) return lavoro;
      if (!esecutore(lavoro.raggruppamento, azione.ausiliataId)) return lavoro;
      const nuova: Membro = { ruolo: 'ausiliaria', soggettoId: azione.soggettoId, ausiliataId: azione.ausiliataId, requisitiIds: [...azione.requisitiIds] };
      const etichetta = `Avvalimento di ${nomeSoggetto(azione.soggettoId, contesto)} a favore di ${nomeSoggetto(azione.ausiliataId, contesto)}`;
      return conPasso(lavoro, etichetta, 'modifica', { ...lavoro.raggruppamento, membri: [...lavoro.raggruppamento.membri, nuova] });
    }

    case 'rimuovi_membro': {
      if (!lavoro.raggruppamento.membri.some((m) => m.soggettoId === azione.soggettoId)) return lavoro;
      // Le ausiliarie di chi esce escono con lui: resterebbero senza ausiliata.
      const membri = lavoro.raggruppamento.membri.filter(
        (m) => m.soggettoId !== azione.soggettoId && !(m.ruolo === 'ausiliaria' && m.ausiliataId === azione.soggettoId),
      );
      const etichetta = `Uscita di ${nomeSoggetto(azione.soggettoId, contesto)}`;
      return conPasso(lavoro, etichetta, 'modifica', { ...lavoro.raggruppamento, membri });
    }

    case 'prova_rimedio':
      return conPasso(lavoro, `Prova: ${descriviMossa(azione.mossa, contesto)}`, 'prova', applicaMossa(lavoro.raggruppamento, azione.mossa));

    case 'annulla': {
      const ultimo = lavoro.storia[lavoro.storia.length - 1];
      if (!ultimo) return lavoro;
      return { ...lavoro, raggruppamento: ultimo.raggruppamento, storia: lavoro.storia.slice(0, -1) };
    }

    default:
      return assertNever(azione);
  }
}

// ─── Rientrare nell'esito dalla scelta ───────────────────────

/** Con cosa si è entrati nell'esito: la gara, le imprese scelte, la mandataria. */
export type Ingresso = {
  bando: string;
  imprese: SoggettoId[];
  mandataria: SoggettoId;
};

/** Il lavoro legato all'ingresso da cui è nato: si conserva finché la gara è la stessa. */
export type Sessione = {
  ingresso: Ingresso;
  lavoro: Lavoro;
};

function stessoInsieme(a: SoggettoId[], b: SoggettoId[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Diecimila parti fanno il 100 %: si conta in parti intere per non accumulare errori di virgola mobile. */
const PARTI = 10_000;
/** Un punto percentuale, in parti. */
const PUNTO = PARTI / 100;

/**
 * Divide `parti` tra i pesi in proporzione, a punti percentuali interi per
 * difetto: nessun ufficio gare scrive 50,75 % in un'offerta. Quello che
 * avanza dall'arrotondamento va a `beneficiario`, come nelle quote iniziali
 * va alla mandataria. Pesi tutti nulli: parti uguali.
 */
function ripartisciAPunti(parti: number, pesi: number[], beneficiario: number): number[] {
  const totale = pesi.reduce((s, p) => s + p, 0);
  const aggiunte = pesi.map((p) => {
    const esatta = totale > 0 ? (parti * p) / totale : parti / pesi.length;
    return Math.floor(esatta / PUNTO) * PUNTO;
  });
  aggiunte[beneficiario]! += parti - aggiunte.reduce((s, a) => s + a, 0);
  return aggiunte;
}

function elencoNomi(nomi: string[]): string {
  return nomi.length <= 1 ? (nomi[0] ?? '') : `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
}

/**
 * Si torna alla scelta e si rientra con la stessa gara ma un insieme di
 * imprese diverso. Il lavoro fatto non si butta:
 * - chi resta tiene le sue quote, le prove e i ruoli;
 * - chi entra entra da mandante a quota zero su ogni prestazione: la sua
 *   parte la decide chi usa lo strumento;
 * - la quota di chi esce passa a chi resta ed era già presente, in
 *   proporzione alle quote che aveva (in parti uguali se erano tutte a zero),
 *   a punti interi, con l'avanzo alla mandataria: 34/33/33 senza la terza
 *   diventa 51/49, non 50,75/49,25;
 * - se la mandataria scelta è cambiata, cambia il ruolo, e la precedente
 *   diventa mandante.
 * Tutto in un passo solo della storia, con un'etichetta che dice cosa è
 * successo alle quote: si annulla come ogni altra modifica. Le quote che non
 * tornavano già prima restano come erano: le dice il motore, non si
 * correggono in silenzio.
 */
export function riprendiLavoro(lavoro: Lavoro, prima: Ingresso, dopo: Ingresso, bando: Bando, contesto: ContestoDescrizioni): Lavoro {
  const entrate = dopo.imprese.filter((id) => !prima.imprese.includes(id));
  const uscite = prima.imprese.filter((id) => !dopo.imprese.includes(id));
  const raggruppamento = lavoro.raggruppamento;
  const presenti = new Set(raggruppamento.membri.map((m) => m.soggettoId));
  const usciteDavvero = uscite.filter((id) => presenti.has(id));
  const entrateDavvero = entrate.filter((id) => !presenti.has(id));
  const prestazioni = bando.lotti.flatMap((l) => l.prestazioni);

  // Chi esce, e le ausiliarie che integravano chi esce.
  let membri = raggruppamento.membri.filter(
    (m) => !usciteDavvero.includes(m.soggettoId) && !(m.ruolo === 'ausiliaria' && usciteDavvero.includes(m.ausiliataId)),
  );
  const uscenti = raggruppamento.membri.filter((m): m is Extract<Membro, { ruolo: RuoloEsecutore }> => m.ruolo !== 'ausiliaria' && usciteDavvero.includes(m.soggettoId));

  // La quota di chi esce passa a chi resta, prestazione per prestazione.
  const redistribuite: string[] = [];
  for (const p of prestazioni) {
    const residuo = Math.round(uscenti.reduce((s, m) => s + (m.quote[p.id] ?? 0), 0) * PARTI);
    const restanti = membri.filter((m): m is Extract<Membro, { ruolo: RuoloEsecutore }> => m.ruolo !== 'ausiliaria');
    if (residuo <= 0 || restanti.length === 0) continue;
    // L'avanzo va alla mandataria scelta; se non è tra chi resta, a chi ha la quota più alta.
    const mandataria = restanti.findIndex((m) => m.soggettoId === dopo.mandataria);
    const piuAlta = restanti.reduce((j, m, i) => ((m.quote[p.id] ?? 0) > (restanti[j]!.quote[p.id] ?? 0) ? i : j), 0);
    const aggiunte = ripartisciAPunti(residuo, restanti.map((m) => m.quote[p.id] ?? 0), mandataria >= 0 ? mandataria : piuAlta);
    membri = membri.map((m) => {
      const i = restanti.indexOf(m as Extract<Membro, { ruolo: RuoloEsecutore }>);
      if (i < 0 || m.ruolo === 'ausiliaria') return m;
      const nuova = (Math.round((m.quote[p.id] ?? 0) * PARTI) + aggiunte[i]!) / PARTI;
      return { ...m, quote: { ...m.quote, [p.id]: nuova } };
    });
    redistribuite.push(p.id);
  }

  for (const id of entrateDavvero) {
    membri = [...membri, { ruolo: 'mandante', soggettoId: id, quote: Object.fromEntries(prestazioni.map((p) => [p.id, 0])) }];
  }

  const mandatariaCambiata = dopo.mandataria !== prima.mandataria;
  if (mandatariaCambiata) {
    membri = membri.map((m) => {
      if (m.ruolo === 'ausiliaria') return m;
      if (m.soggettoId === dopo.mandataria) return { ...m, ruolo: 'mandataria' };
      return m.ruolo === 'mandataria' ? { ...m, ruolo: 'mandante' } : m;
    });
  }

  const parti: string[] = [];
  const nome = (id: SoggettoId) => nomeSoggetto(id, contesto);
  if (entrateDavvero.length > 0) {
    parti.push(`${entrateDavvero.length === 1 ? 'entra' : 'entrano'} ${elencoNomi(entrateDavvero.map(nome))} a quota zero`);
  }
  if (uscenti.length > 0) {
    const restanti = membri.filter((m) => m.ruolo !== 'ausiliaria' && !entrateDavvero.includes(m.soggettoId)).map((m) => nome(m.soggettoId));
    const unica = prestazioni.length === 1 ? prestazioni[0] : undefined;
    const quanto = unica ? ` (${formattaPercentuale(uscenti.reduce((s, m) => s + (m.quote[unica.id] ?? 0), 0))})` : '';
    const dove = redistribuite.length > 0 && restanti.length > 0 ? `, e la quota${quanto} passa a ${elencoNomi(restanti)} in proporzione alle loro` : '';
    parti.push(`${uscenti.length === 1 ? 'esce' : 'escono'} ${elencoNomi(uscenti.map((m) => nome(m.soggettoId)))}${dove}`);
  }
  if (mandatariaCambiata && membri.some((m) => m.soggettoId === dopo.mandataria)) {
    parti.push(`mandataria: ${nome(prima.mandataria)} → ${nome(dopo.mandataria)}`);
  }
  if (parti.length === 0) return lavoro;
  const frase = `Dalla scelta delle imprese: ${parti.join('; ')}`;
  // Un nome che finisce con il punto (S.r.l.) chiude già la frase.
  return conPasso(lavoro, frase.endsWith('.') ? frase : `${frase}.`, 'modifica', { ...raggruppamento, membri });
}

/**
 * La sessione con cui si entra nell'esito. Stessa gara e stesse imprese: il
 * lavoro resta com'era, prove comprese. Gara diversa, o nessuna sessione:
 * si riparte da capo, in parti uguali. Stessa gara con imprese diverse: il
 * lavoro si riprende (`riprendiLavoro`).
 */
export function sessioneAllIngresso(
  precedente: Sessione | undefined,
  ingresso: Ingresso,
  p: { bando: Bando; contesto: ContestoDescrizioni; dataRiferimento: string },
): Sessione {
  if (!precedente || precedente.ingresso.bando !== ingresso.bando) {
    return {
      ingresso,
      lavoro: {
        lottoId: p.bando.lotti[0]?.id ?? '',
        dataRiferimento: p.dataRiferimento,
        raggruppamento: raggruppamentoInPartiUguali(p.bando, ingresso.imprese, ingresso.mandataria),
        storia: [],
      },
    };
  }
  const { ingresso: prima } = precedente;
  if (stessoInsieme(prima.imprese, ingresso.imprese) && prima.mandataria === ingresso.mandataria) return precedente;
  return { ingresso, lavoro: riprendiLavoro(precedente.lavoro, prima, ingresso, p.bando, p.contesto) };
}

/** La composizione prima dell'ultima prova, se esiste: è con quella che ha senso confrontarsi. */
export function composizionePrimaDellUltimaProva(lavoro: Lavoro): Passo | undefined {
  for (let i = lavoro.storia.length - 1; i >= 0; i--) {
    const passo = lavoro.storia[i];
    if (passo?.genere === 'prova') return passo;
  }
  return undefined;
}
