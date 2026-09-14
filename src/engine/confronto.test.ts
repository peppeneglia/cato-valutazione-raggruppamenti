import { describe, expect, it } from 'vitest';
import type { Esito, PercorsoMinimo } from '../domain';
import { classifica, confrontaLotti, confrontaRaggruppamenti } from './confronto';
import { bando, certificazione, esecutore, lotto, parametri, prestazione, raggruppamento, requisito, soggetto } from './prova';

const ISO = { tipo: 'certificazione', norma: 'ISO 9001' } as const;

function esito(verdetto: Esito['verdetto'], percorso: Esito['percorsoMinimo'], scoperti = 0): Esito {
  const requisiti = Array.from({ length: scoperti }, (_, i) => ({ requisitoId: `r-${i}`, stato: 'scoperto' as const, contributi: [], motivazione: '', assunzioni: [], rimedi: [] }));
  return { lottoId: 'l', valutatoAl: '2026-09-14', verdetto, requisiti, anomalie: [], avvisiScadenza: [], percorsoMinimo: percorso };
}

const GIA: PercorsoMinimo = { esito: 'gia_ammissibile', verdetto: 'ammissibile', residui: [] };
const UNA_MOSSA: PercorsoMinimo = { esito: 'trovato', mosse: [{ tipo: 'uscita_soggetto', soggettoId: 's' }], verdettoRaggiunto: 'ammissibile', residui: [], segnalazioni: 0 };
const DUE_MOSSE: PercorsoMinimo = { esito: 'trovato', mosse: [{ tipo: 'uscita_soggetto', soggettoId: 's' }, { tipo: 'uscita_soggetto', soggettoId: 't' }], verdettoRaggiunto: 'ammissibile', residui: [], segnalazioni: 0 };
const INESISTENTE: PercorsoMinimo = { esito: 'inesistente', restanoScoperti: ['r'] };

describe('classifica', () => {
  it('ordina per verdetto, poi per lunghezza del percorso, poi per requisiti scoperti', () => {
    const voci = classifica([
      { chiave: 'c', esito: esito('non_ammissibile', DUE_MOSSE, 2) },
      { chiave: 'a', esito: esito('ammissibile', GIA) },
      { chiave: 'd', esito: esito('non_ammissibile', DUE_MOSSE, 1) },
      { chiave: 'b', esito: esito('ammissibile_con_riserva', GIA) },
      { chiave: 'e', esito: esito('non_ammissibile', UNA_MOSSA, 3) },
    ]);
    expect(voci.map((v) => [v.chiave, v.posizione, v.pariMerito])).toEqual([
      ['a', 1, false], ['b', 2, false], ['e', 3, false], ['d', 4, false], ['c', 5, false],
    ]);
  });
  it('dichiara il pareggio e condivide la posizione, senza inventare un quarto criterio', () => {
    const voci = classifica([
      { chiave: 'x', esito: esito('non_ammissibile', UNA_MOSSA, 1) },
      { chiave: 'y', esito: esito('non_ammissibile', UNA_MOSSA, 1) },
      { chiave: 'z', esito: esito('non_ammissibile', INESISTENTE, 1) },
    ]);
    expect(voci.map((v) => [v.chiave, v.posizione, v.pariMerito])).toEqual([['x', 1, true], ['y', 1, true], ['z', 3, false]]);
  });
  it('un percorso inesistente o bloccato vale infinito', () => {
    const voci = classifica([
      { chiave: 'bloccato', esito: esito('non_ammissibile', { esito: 'bloccato_da_anomalie' }) },
      { chiave: 'lungo', esito: esito('non_ammissibile', DUE_MOSSE) },
    ]);
    expect(voci.map((v) => v.chiave)).toEqual(['lungo', 'bloccato']);
  });
  it('a parità mantiene l’ordine di ingresso', () => {
    const voci = classifica([{ chiave: 'primo', esito: esito('ammissibile', GIA) }, { chiave: 'secondo', esito: esito('ammissibile', GIA) }]);
    expect(voci.map((v) => v.chiave)).toEqual(['primo', 'secondo']);
  });
});

describe('confrontaRaggruppamenti', () => {
  it('valuta ogni alternativa sullo stesso lotto e la classifica', () => {
    const l = lotto({ prestazioni: [prestazione('p-1'), prestazione('p-2')], requisiti: [requisito('r', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' })] });
    const p = parametri({ bando: bando([l]), soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'x')]), soggetto('s-beta')] });
    const voci = confrontaRaggruppamenti({
      bando: p.bando, lottoId: p.lottoId, soggetti: p.soggetti, dataRiferimento: p.dataRiferimento, orizzonteScadenzeGiorni: p.orizzonteScadenzeGiorni,
      alternative: [
        { etichetta: 'Beta esegue', raggruppamento: raggruppamento([esecutore('s-alfa', 'mandataria', { 'p-1': 1 }), esecutore('s-beta', 'mandante', { 'p-2': 1 })]) },
        { etichetta: 'Alfa esegue', raggruppamento: raggruppamento([esecutore('s-alfa', 'mandataria', { 'p-1': 1, 'p-2': 1 })]) },
      ],
    });
    expect(voci.map((v) => [v.chiave, v.posizione, v.esito.verdetto])).toEqual([['Alfa esegue', 1, 'ammissibile'], ['Beta esegue', 2, 'non_ammissibile']]);
  });
});

describe('confrontaLotti', () => {
  it('valuta lo stesso raggruppamento su ogni lotto del bando e li classifica', () => {
    const l1 = lotto({ id: 'l-1', prestazioni: [prestazione('p-1')], requisiti: [requisito('r-1', ISO, { tipo: 'ciascun_membro' })] });
    const l2 = lotto({ id: 'l-2', prestazioni: [prestazione('p-2')], requisiti: [] });
    const p = parametri({
      bando: bando([l1, l2]),
      soggetti: [soggetto('s-a')],
      raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1, 'p-2': 1 })]),
    });
    const voci = confrontaLotti({ bando: p.bando, soggetti: p.soggetti, raggruppamento: p.raggruppamento, dataRiferimento: p.dataRiferimento, orizzonteScadenzeGiorni: p.orizzonteScadenzeGiorni });
    expect(voci.map((v) => [v.chiave, v.posizione, v.esito.verdetto])).toEqual([['l-2', 1, 'ammissibile'], ['l-1', 2, 'non_ammissibile']]);
  });
});
