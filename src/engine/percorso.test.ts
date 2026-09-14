import { describe, expect, it } from 'vitest';
import type { Lotto, ParametriValutazione, PercorsoMinimo, Requisito } from '../domain';
import { chiaveStato, percorsoMinimo } from './percorso';
import { bando, certificazione, dichiarazione, esecutore, lotto, parametri, prestazione, raggruppamento, requisito, soggetto } from './prova';
import { creaMemo, valutazione } from './valutazione';
import { bando as bandoFixture, DATA_RIFERIMENTO, ORIZZONTE_SCADENZE_GIORNI, raggruppamento as raggruppamentoFixture, soggetti as soggettiFixture } from '../fixture';

const ISO = { tipo: 'certificazione', norme: ['ISO 9001'] } as const;
const ISO_SCOPE = { tipo: 'certificazione', norme: ['ISO 9001'], scope: 'giusto' } as const;
const FATTURATO = { tipo: 'fatturato', ambito: { tipo: 'globale' }, periodo: { tipo: 'a_ritroso', esercizi: 3, ancoraggio: 'riferimento' }, soglia: 1_000_000 } as const;
const DICHIARAZIONE = { tipo: 'dichiarazione', oggetto: 'x' } as const;

function cerca(requisiti: Requisito[], extra: Partial<ParametriValutazione>, lottoExtra: Partial<Lotto> = {}): PercorsoMinimo {
  const l = lotto({ prestazioni: [prestazione('p-1'), prestazione('p-2')], requisiti, ...lottoExtra });
  const p = parametri({ bando: bando([l]), ...extra });
  return percorsoMinimo(p, l, valutazione(p).esito);
}

const alfaBeta = raggruppamento([esecutore('s-alfa', 'mandataria', { 'p-1': 1 }), esecutore('s-beta', 'mandante', { 'p-2': 1 })]);

describe('percorsoMinimo', () => {
  it('è già ammissibile quando non manca nulla', () => {
    const esito = cerca([requisito('r', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' })], {
      soggetti: [soggetto('s-alfa'), soggetto('s-beta', [certificazione('ISO 9001', 'x')])],
      raggruppamento: alfaBeta,
    });
    expect(esito).toEqual({ esito: 'gia_ammissibile', verdetto: 'ammissibile', residui: [], miglioramenti: [] });
  });
  it('è bloccato dalle anomalie bloccanti', () => {
    const esito = cerca([], { raggruppamento: raggruppamento([esecutore('s-a', 'mandante', { 'p-1': 1, 'p-2': 1 })]) });
    expect(esito).toEqual({ esito: 'bloccato_da_anomalie' });
  });
  it('trova il percorso a una mossa, preferendo la riassegnazione all’ingresso', () => {
    const esito = cerca([requisito('r', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' })], {
      soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'x')]), soggetto('s-beta'), soggetto('s-x', [certificazione('ISO 9001', 'x')])],
      raggruppamento: alfaBeta,
    });
    expect(esito).toEqual({
      esito: 'trovato',
      mosse: [{ tipo: 'riassegna_quota', prestazioneId: 'p-2', daSoggettoId: 's-beta', aSoggettoId: 's-alfa', quota: 1 }],
      verdettoRaggiunto: 'ammissibile',
      residui: [],
      segnalazioni: 1,
    });
  });
  it('a parità di lunghezza preferisce il percorso con meno segnalazioni', () => {
    // Riassegnare p-2 ad Alfa lascia Beta a quote zero (1 segnalazione);
    // l'ingresso di X che rileva p-2 lascia Beta a zero comunque. L'uscita
    // di Beta dopo la riassegnazione costerebbe una mossa in più.
    // Qui invece Alfa non possiede la ISO: la sola mossa da uno è l'ingresso.
    const esito = cerca([requisito('r', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' })], {
      soggetti: [soggetto('s-alfa'), soggetto('s-beta'), soggetto('s-x', [certificazione('ISO 9001', 'x')])],
      raggruppamento: alfaBeta,
    });
    expect(esito).toMatchObject({
      esito: 'trovato',
      mosse: [{ tipo: 'ingresso_soggetto', soggettoId: 's-x', quote: { 'p-2': 1 }, rilevateDa: 's-beta' }],
      segnalazioni: 1,
    });
  });
  it('trova il percorso a due mosse quando le scoperture sono indipendenti', () => {
    const esito = cerca(
      [
        requisito('r-iso', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' }),
        requisito('r-fat', FATTURATO, { tipo: 'somma_membri' }, { avvalibile: true }),
      ],
      {
        soggetti: [
          soggetto('s-alfa', [certificazione('ISO 9001', 'x')]),
          soggetto('s-beta'),
          soggetto('s-x', [{ tipo: 'fatturato', esercizio: 2025, ambito: { tipo: 'globale' }, importo: { valore: 1_000_000, fonte: { documento: 'd', riferimento: 'r' } } }]),
        ],
        raggruppamento: alfaBeta,
      },
    );
    // A parità di segnalazioni (Beta resta a quote zero in entrambi i casi)
    // l'ingresso precede l'avvalimento nell'ordine di invasività.
    expect(esito).toEqual({
      esito: 'trovato',
      verdettoRaggiunto: 'ammissibile',
      residui: [],
      segnalazioni: 1,
      mosse: [
        { tipo: 'riassegna_quota', prestazioneId: 'p-2', daSoggettoId: 's-beta', aSoggettoId: 's-alfa', quota: 1 },
        { tipo: 'ingresso_soggetto', soggettoId: 's-x', ruolo: 'mandante', quote: { 'p-1': 1 }, rilevateDa: 's-alfa' },
      ],
    });
  });
  it('una sola mossa che chiude due scoperture batte due mosse separate', () => {
    const esito = cerca(
      [
        requisito('r-iso', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' }),
        requisito('r-fat', FATTURATO, { tipo: 'somma_membri' }, { avvalibile: true }),
      ],
      {
        soggetti: [
          soggetto('s-alfa'),
          soggetto('s-beta'),
          soggetto('s-x', [certificazione('ISO 9001', 'x'), { tipo: 'fatturato', esercizio: 2025, ambito: { tipo: 'globale' }, importo: { valore: 1_000_000, fonte: { documento: 'd', riferimento: 'r' } } }]),
        ],
        raggruppamento: alfaBeta,
      },
    );
    expect(esito).toMatchObject({ esito: 'trovato', mosse: [{ tipo: 'ingresso_soggetto', soggettoId: 's-x', quote: { 'p-2': 1 } }] });
  });
  it('è inesistente quando nessuna sequenza esce da non ammissibile, e dice cosa resta scoperto', () => {
    const esito = cerca([requisito('r', ISO, { tipo: 'ciascun_membro' })], {
      soggetti: [soggetto('s-alfa'), soggetto('s-beta'), soggetto('s-x')],
      raggruppamento: alfaBeta,
    });
    expect(esito).toEqual({ esito: 'inesistente', restanoScoperti: ['r'] });
  });
  it('quando ammissibile è irraggiungibile in teoria, trova il percorso a con riserva e dichiara i residui', () => {
    // Nessuno ha lo scope giusto: r-scope resta da verificare per sempre. r-iso si chiude.
    const esito = cerca(
      [
        requisito('r-scope', ISO_SCOPE, { tipo: 'esecutore_prestazione', prestazioneId: 'p-1' }),
        requisito('r-iso', { tipo: 'certificazione', norme: ['ISO 13485'] }, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' }),
      ],
      {
        soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'altro'), certificazione('ISO 13485', 'x')]), soggetto('s-beta'), soggetto('s-x')],
        raggruppamento: alfaBeta,
      },
    );
    expect(esito).toMatchObject({ esito: 'trovato', verdettoRaggiunto: 'ammissibile_con_riserva', residui: ['r-scope'] });
  });
  it('partendo da con riserva senza via ad ammissibile, dichiara di essere già ammissibile con riserva', () => {
    const esito = cerca([requisito('r-scope', ISO_SCOPE, { tipo: 'esecutore_prestazione', prestazioneId: 'p-1' })], {
      soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'altro')]), soggetto('s-beta'), soggetto('s-x')],
      raggruppamento: alfaBeta,
    });
    expect(esito).toEqual({ esito: 'gia_ammissibile', verdetto: 'ammissibile_con_riserva', residui: ['r-scope'], miglioramenti: [] });
  });
  it('partendo da con riserva, se una mossa porta ad ammissibile la propone', () => {
    const esito = cerca([requisito('r-scope', ISO_SCOPE, { tipo: 'esecutore_prestazione', prestazioneId: 'p-1' })], {
      soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'altro')]), soggetto('s-beta', [certificazione('ISO 9001', 'giusto')]), soggetto('s-x')],
      raggruppamento: alfaBeta,
    });
    expect(esito).toMatchObject({ esito: 'trovato', verdettoRaggiunto: 'ammissibile', mosse: [{ tipo: 'riassegna_quota', prestazioneId: 'p-1', daSoggettoId: 's-alfa', aSoggettoId: 's-beta' }] });
  });
  it('uno scoperto non vincolante non impedisce la riserva ma impedisce l’ammissibilità piena', () => {
    const esito = cerca(
      [
        requisito('r-dich', DICHIARAZIONE, { tipo: 'ciascun_membro' }, { vincolante: false }),
        requisito('r-iso', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' }),
      ],
      {
        soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'x'), dichiarazione('x')]), soggetto('s-beta'), soggetto('s-x')],
        raggruppamento: alfaBeta,
      },
    );
    // Beta non ha la dichiarazione e nessuna mossa la crea: ammissibile pieno solo senza Beta.
    expect(esito).toMatchObject({ esito: 'trovato', verdettoRaggiunto: 'ammissibile' });
    if (esito.esito !== 'trovato') throw new Error('atteso trovato');
    expect(esito.mosse.some((m) => m.tipo === 'uscita_soggetto')).toBe(true);
  });
});

describe('percorsoMinimo — limite teorico di copribilità', () => {
  // Senza limite la ricerca esplora l'intero spazio degli stati: è una prova
  // di equivalenza, non di velocità, e ha il suo timeout.
  it('con e senza limite l’esito è identico su ogni lotto della fixture', { timeout: 120_000 }, () => {
    for (const l of bandoFixture.lotti) {
      const p: ParametriValutazione = {
        bando: bandoFixture, lottoId: l.id, soggetti: soggettiFixture, raggruppamento: raggruppamentoFixture,
        dataRiferimento: DATA_RIFERIMENTO, orizzonteScadenzeGiorni: ORIZZONTE_SCADENZE_GIORNI,
      };
      const memo = creaMemo(p);
      const iniziale = valutazione(p, memo).esito;
      const conLimite = percorsoMinimo(p, l, iniziale, memo, { limiteTeorico: true });
      const senzaLimite = percorsoMinimo(p, l, iniziale, memo, { limiteTeorico: false });
      expect(conLimite).toEqual(senzaLimite);
    }
  });
});

describe('percorsoMinimo — pareggio', () => {
  it('a parità di lunghezza preferisce meno residui a meno segnalazioni', () => {
    // Riassegnare p-2 ad Alfa costa una mossa e lascia un residuo (scope da verificare);
    // l'ingresso di X che rileva p-2 costa una mossa e non lascia residui.
    // Entrambi lasciano Beta a quote zero: la segnalazione non decide.
    const esito = cerca([requisito('r', ISO_SCOPE, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' })], {
      soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'altro')]), soggetto('s-beta'), soggetto('s-x', [certificazione('ISO 9001', 'giusto')])],
      raggruppamento: alfaBeta,
    });
    expect(esito).toMatchObject({ esito: 'trovato', verdettoRaggiunto: 'ammissibile', residui: [], mosse: [{ tipo: 'ingresso_soggetto', soggettoId: 's-x' }] });
  });
});

describe('chiaveStato', () => {
  it('non dipende dall’ordine dei membri né dalle quote a zero', () => {
    const a = raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1, 'p-2': 0 }), esecutore('s-b', 'mandante', { 'p-2': 0.1 + 0.2 })]);
    const b = raggruppamento([esecutore('s-b', 'mandante', { 'p-2': 0.3 }), esecutore('s-a', 'mandataria', { 'p-1': 1 })]);
    expect(chiaveStato(a)).toBe(chiaveStato(b));
  });
  it('distingue quote e ruoli diversi', () => {
    const a = raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1 })]);
    const b = raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 0.5 })]);
    expect(chiaveStato(a)).not.toBe(chiaveStato(b));
  });
});
