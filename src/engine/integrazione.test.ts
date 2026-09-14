// Test di integrazione sulla fixture completa. L'esito atteso è generato dal
// motore e fissato dopo lettura: se il motore diverge, qui si scopre, e chi
// ha ragione va capito prima di riallineare (`npm run fixture:esito`).

import { describe, expect, it } from 'vitest';
import type { ParametriValutazione } from '../domain';
import { bando, DATA_RIFERIMENTO, esitoAtteso, ORIZZONTE_SCADENZE_GIORNI, raggruppamento, soggetti } from '../fixture';
import { confrontaLotti, valuta } from './index';

function parametri(lottoId: string): ParametriValutazione {
  return { bando, lottoId, soggetti, raggruppamento, dataRiferimento: DATA_RIFERIMENTO, orizzonteScadenzeGiorni: ORIZZONTE_SCADENZE_GIORNI };
}

describe('fixture — esito completo', () => {
  for (const lotto of bando.lotti) {
    it(`il motore produce esattamente l'esito atteso sul ${lotto.id}`, () => {
      expect(valuta(parametri(lotto.id))).toEqual(esitoAtteso[lotto.id]);
    });
  }
});

describe('fixture — fatti verificati a mano, indipendenti dall’esito generato', () => {
  const lotto1 = valuta(parametri('lotto-1'));
  const lotto2 = valuta(parametri('lotto-2'));
  const stato = (id: string) => lotto1.requisiti.find((r) => r.requisitoId === id)?.stato;

  it('lotto 1: non ammissibile per fatturato, ISO 9001 scaduta e referenze; scope di Gamma da verificare', () => {
    expect(lotto1.verdetto).toBe('non_ammissibile');
    expect(stato('l1-fatturato')).toBe('scoperto');
    expect(stato('l1-iso-9001-manutenzione')).toBe('scoperto');
    expect(stato('l1-referenze')).toBe('scoperto');
    expect(stato('l1-iso-9001-formazione')).toBe('da_verificare');
    expect(stato('l1-generale')).toBe('coperto');
    expect(stato('l1-cciaa')).toBe('coperto');
    expect(stato('l1-iso-13485')).toBe('coperto');
  });
  it('lotto 1: il fatturato manca di 100.000 € e il minimo della mandataria è rispettato', () => {
    const m = lotto1.requisiti.find((r) => r.requisitoId === 'l1-fatturato')?.misurazione;
    expect(m).toMatchObject({ raggiunto: 2_900_000, soglia: 3_000_000, delta: 100_000 });
    expect(m?.minimiRuolo).toEqual([{ soggettoId: 's-alfa', ruolo: 'mandataria', richiesto: 1_200_000, raggiunto: 2_100_000, delta: 0 }]);
  });
  it('lotto 1: Gamma possiede la ISO 9001 ma non è conteggiata per la manutenzione', () => {
    const gamma = lotto1.requisiti.find((r) => r.requisitoId === 'l1-iso-9001-manutenzione')?.contributi.find((c) => c.soggettoId === 's-gamma');
    expect(gamma).toMatchObject({ valore: { tipo: 'possesso', esito: 'da_verificare' }, conteggiato: false });
  });
  it('lotto 1: il percorso minimo è di due mosse e raggiunge con riserva sul solo scope di Gamma', () => {
    expect(lotto1.percorsoMinimo).toMatchObject({
      esito: 'trovato',
      verdettoRaggiunto: 'ammissibile_con_riserva',
      residui: ['l1-iso-9001-formazione'],
      mosse: [
        { tipo: 'ingresso_soggetto', soggettoId: 's-delta', quote: { 'l1-manutenzione': 1 }, rilevateDa: 's-beta' },
        { tipo: 'avvalimento', requisitoId: 'l1-referenze', ausiliariaId: 's-epsilon', ausiliataId: 's-alfa' },
      ],
    });
  });
  it('lotto 1: la ISO 13485 di Alfa scade prima del termine di presentazione', () => {
    expect(lotto1.avvisiScadenza).toEqual([expect.objectContaining({ soggettoId: 's-alfa', scadeIl: '2026-10-31', primaDelTermine: true, entroOrizzonte: true, requisitiIds: ['l1-iso-13485'] })]);
  });
  it('lotto 1: le assunzioni del motore sono dichiarate sulle referenze e da nessun’altra parte', () => {
    expect(lotto1.requisiti.filter((r) => r.assunzioni.length > 0).map((r) => r.requisitoId)).toEqual(['l1-referenze']);
  });
  it('lotto 2: ammissibile, già senza mosse, con la ISO 9001 di Alfa in scadenza entro l’orizzonte', () => {
    expect(lotto2.verdetto).toBe('ammissibile');
    expect(lotto2.percorsoMinimo).toEqual({ esito: 'gia_ammissibile', verdetto: 'ammissibile', residui: [] });
    expect(lotto2.avvisiScadenza).toEqual([expect.objectContaining({ soggettoId: 's-alfa', scadeIl: '2026-11-30', primaDelTermine: false, entroOrizzonte: true })]);
  });
  it('lotto 2: il servizio di punta scarta la formazione da 80.000 € e trova gli arredi da 450.000 €', () => {
    const punta = lotto2.requisiti.find((r) => r.requisitoId === 'l2-punta');
    expect(punta?.stato).toBe('coperto');
    expect(punta?.contributi.find((c) => c.soggettoId === 's-gamma')?.nota).toContain('sotto il minimo unitario');
  });
  it('nessuna anomalia in nessun lotto', () => {
    expect(lotto1.anomalie).toEqual([]);
    expect(lotto2.anomalie).toEqual([]);
  });
  it('il confronto tra lotti mette il lotto 2 davanti al lotto 1', () => {
    const classifica = confrontaLotti({ bando, soggetti, raggruppamento, dataRiferimento: DATA_RIFERIMENTO, orizzonteScadenzeGiorni: ORIZZONTE_SCADENZE_GIORNI });
    expect(classifica.map((v) => [v.chiave, v.posizione])).toEqual([['lotto-2', 1], ['lotto-1', 2]]);
  });
});
