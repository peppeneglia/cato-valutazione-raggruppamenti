// Il foglio di lavoro: l'unico stato mutabile dell'applicazione e le sue
// modifiche, come funzioni pure. Il raggruppamento è ciò che l'utente
// costruisce; la storia è la pila degli snapshot precedenti, così ogni
// modifica — manuale o prova di un rimedio — è annullabile nell'ordine vero.
// Niente logica di dominio: chi copre cosa lo dice il motore.

import { assertNever } from './assertNever';
import { descriviMossa, nomePrestazione, nomeSoggetto, type ContestoDescrizioni } from './descrizioni';
import type {
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

/** La composizione prima dell'ultima prova, se esiste: è con quella che ha senso confrontarsi. */
export function composizionePrimaDellUltimaProva(lavoro: Lavoro): Passo | undefined {
  for (let i = lavoro.storia.length - 1; i >= 0; i--) {
    const passo = lavoro.storia[i];
    if (passo?.genere === 'prova') return passo;
  }
  return undefined;
}
