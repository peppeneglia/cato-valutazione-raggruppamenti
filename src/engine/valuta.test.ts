import { describe, expect, it } from 'vitest';
import { bando, certificazione, dichiarazione, esecutore, lotto, parametri, prestazione, raggruppamento, requisito, soggetto } from './prova';
import { valuta } from './valuta';
import { valutaBase } from './valutazione';

const DICHIARAZIONE = { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione' } as const;
const ISO = { tipo: 'certificazione', norma: 'ISO 9001' } as const;

describe('valutaBase', () => {
  it('valuta ogni requisito del lotto e produce il verdetto', () => {
    const l = lotto({ requisiti: [requisito('r-1', DICHIARAZIONE, { tipo: 'ciascun_membro' }), requisito('r-2', ISO, { tipo: 'almeno_un_membro' })] });
    const esito = valutaBase(parametri({ bando: bando([l]), soggetti: [soggetto('s-a', [dichiarazione('Assenza cause di esclusione'), certificazione('ISO 9001', 'x')])] }));
    expect(esito.verdetto).toBe('ammissibile');
    expect(esito.requisiti.map((r) => [r.requisitoId, r.stato])).toEqual([['r-1', 'coperto'], ['r-2', 'coperto']]);
    expect(esito.lottoId).toBe('l-1');
    expect(esito.valutatoAl).toBe('2026-09-14');
    expect(esito.anomalie).toEqual([]);
  });
  it('senza il lotto non valuta nulla e il verdetto è non ammissibile', () => {
    const esito = valutaBase(parametri({ lottoId: 'l-99' }));
    expect(esito.requisiti).toEqual([]);
    expect(esito.verdetto).toBe('non_ammissibile');
    expect(esito.anomalie[0]?.codice).toBe('riferimento_inesistente');
  });
  it('con la data di riferimento malformata non valuta nulla', () => {
    const l = lotto({ requisiti: [requisito('r-1', DICHIARAZIONE, { tipo: 'ciascun_membro' })] });
    const esito = valutaBase(parametri({ bando: bando([l]), dataRiferimento: 'ieri' }));
    expect(esito.requisiti).toEqual([]);
    expect(esito.verdetto).toBe('non_ammissibile');
  });
  it('con un’anomalia bloccante valuta comunque i requisiti ma forza non ammissibile', () => {
    const l = lotto({ requisiti: [requisito('r-1', DICHIARAZIONE, { tipo: 'ciascun_membro' })] });
    const esito = valutaBase(parametri({
      bando: bando([l]),
      soggetti: [soggetto('s-a', [dichiarazione('Assenza cause di esclusione')])],
      raggruppamento: raggruppamento([esecutore('s-a', 'mandante', { 'p-1': 1 })]),
    }));
    expect(esito.requisiti[0]?.stato).toBe('coperto');
    expect(esito.verdetto).toBe('non_ammissibile');
    expect(esito.anomalie.map((a) => a.codice)).toEqual(['mandataria_assente']);
  });
  it('lo stesso raggruppamento può essere ammissibile su un lotto e non su un altro', () => {
    const l1 = lotto({ id: 'l-1', prestazioni: [prestazione('p-1')], requisiti: [requisito('r-1', DICHIARAZIONE, { tipo: 'ciascun_membro' })] });
    const l2 = lotto({ id: 'l-2', prestazioni: [prestazione('p-2')], requisiti: [requisito('r-2', ISO, { tipo: 'ciascun_membro' })] });
    const p = parametri({
      bando: bando([l1, l2]),
      soggetti: [soggetto('s-a', [dichiarazione('Assenza cause di esclusione')])],
      raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1, 'p-2': 1 })]),
    });
    expect(valutaBase({ ...p, lottoId: 'l-1' }).verdetto).toBe('ammissibile');
    expect(valutaBase({ ...p, lottoId: 'l-2' }).verdetto).toBe('non_ammissibile');
  });
  it('produce gli avvisi di scadenza sui fatti usati', () => {
    const l = lotto({ requisiti: [requisito('r-1', ISO, { tipo: 'ciascun_membro' })] });
    const esito = valutaBase(parametri({ bando: bando([l]), soggetti: [soggetto('s-a', [certificazione('ISO 9001', 'x', '2026-10-31')])] }));
    expect(esito.avvisiScadenza).toHaveLength(1);
    expect(esito.avvisiScadenza[0]).toMatchObject({ soggettoId: 's-a', scadeIl: '2026-10-31', primaDelTermine: true, requisitiIds: ['r-1'] });
  });
  it('lo stesso input a due date di riferimento dà verdetti diversi', () => {
    const l = lotto({ requisiti: [requisito('r-1', ISO, { tipo: 'ciascun_membro' })] });
    const p = parametri({ bando: bando([l]), soggetti: [soggetto('s-a', [certificazione('ISO 9001', 'x', '2026-09-30')])] });
    expect(valutaBase({ ...p, dataRiferimento: '2026-09-30' }).verdetto).toBe('ammissibile');
    expect(valutaBase({ ...p, dataRiferimento: '2026-10-01' }).verdetto).toBe('non_ammissibile');
  });
  it('non muta gli input', () => {
    const p = parametri();
    const copia = JSON.stringify(p);
    valutaBase(p);
    expect(JSON.stringify(p)).toBe(copia);
  });
});

describe('valuta', () => {
  it('riempie i rimedi per requisito e il percorso minimo', () => {
    const l = lotto({
      prestazioni: [prestazione('p-1'), prestazione('p-2')],
      requisiti: [requisito('r-iso', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' })],
    });
    const esito = valuta(parametri({
      bando: bando([l]),
      soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'x')]), soggetto('s-beta')],
      raggruppamento: raggruppamento([esecutore('s-alfa', 'mandataria', { 'p-1': 1 }), esecutore('s-beta', 'mandante', { 'p-2': 1 })]),
    }));
    expect(esito.verdetto).toBe('non_ammissibile');
    expect(esito.requisiti[0]?.rimedi.map((r) => r.tipo)).toEqual(['riassegna_quota']);
    expect(esito.percorsoMinimo).toMatchObject({ esito: 'trovato', verdettoRaggiunto: 'ammissibile' });
  });
  it('con anomalie bloccanti non calcola rimedi e il percorso è bloccato', () => {
    const esito = valuta(parametri({ raggruppamento: raggruppamento([esecutore('s-a', 'mandante', { 'p-1': 1 })]) }));
    expect(esito.percorsoMinimo).toEqual({ esito: 'bloccato_da_anomalie' });
    expect(esito.requisiti.every((r) => r.rimedi.length === 0)).toBe(true);
  });
  it('è deterministica: due chiamate sullo stesso input danno lo stesso esito', () => {
    const l = lotto({ prestazioni: [prestazione('p-1'), prestazione('p-2')], requisiti: [requisito('r-iso', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' })] });
    const p = parametri({
      bando: bando([l]),
      soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'x')]), soggetto('s-beta'), soggetto('s-x', [certificazione('ISO 9001', 'x')])],
      raggruppamento: raggruppamento([esecutore('s-alfa', 'mandataria', { 'p-1': 1 }), esecutore('s-beta', 'mandante', { 'p-2': 1 })]),
    });
    expect(valuta(p)).toEqual(valuta(p));
  });
  it('non muta gli input nemmeno durante la ricerca', () => {
    const l = lotto({ prestazioni: [prestazione('p-1'), prestazione('p-2')], requisiti: [requisito('r-iso', ISO, { tipo: 'esecutore_prestazione', prestazioneId: 'p-2' })] });
    const p = parametri({
      bando: bando([l]),
      soggetti: [soggetto('s-alfa', [certificazione('ISO 9001', 'x')]), soggetto('s-beta'), soggetto('s-x', [certificazione('ISO 9001', 'x')])],
      raggruppamento: raggruppamento([esecutore('s-alfa', 'mandataria', { 'p-1': 1 }), esecutore('s-beta', 'mandante', { 'p-2': 1 })]),
    });
    const copia = JSON.stringify(p);
    valuta(p);
    expect(JSON.stringify(p)).toBe(copia);
  });
});
