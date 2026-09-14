import { describe, expect, it } from 'vitest';
import type { FattoUsatoDa } from './requisito';
import { avvisiScadenza } from './scadenze';

const FONTE = { documento: 'Fascicolo', riferimento: 'certificato' };
const PARAMETRI = { dataRiferimento: '2026-09-14', terminePresentazione: '2026-11-14', orizzonteGiorni: 90 };

function usato(soggettoId: string, requisitoId: string, scadeIl?: string, descrizione = 'certificazione ISO 9001'): FattoUsatoDa {
  return { soggettoId, requisitoId, fatto: { descrizione, fonte: FONTE, scadeIl } };
}

describe('avvisiScadenza', () => {
  it('avvisa di un fatto che scade prima del termine di presentazione', () => {
    const avvisi = avvisiScadenza([usato('s-a', 'r-1', '2026-10-31')], PARAMETRI);
    expect(avvisi).toEqual([{
      soggettoId: 's-a', descrizioneVoce: 'certificazione ISO 9001', scadeIl: '2026-10-31', fonte: FONTE,
      requisitiIds: ['r-1'], primaDelTermine: true, entroOrizzonte: true,
    }]);
  });
  it('avvisa di un fatto che scade dopo il termine ma entro l’orizzonte', () => {
    const avvisi = avvisiScadenza([usato('s-a', 'r-1', '2026-12-13')], PARAMETRI);
    expect(avvisi[0]).toMatchObject({ primaDelTermine: false, entroOrizzonte: true });
  });
  it('non avvisa di un fatto che scade oltre entrambi', () => {
    expect(avvisiScadenza([usato('s-a', 'r-1', '2026-12-14')], PARAMETRI)).toEqual([]);
  });
  it('non avvisa di fatti senza scadenza', () => {
    expect(avvisiScadenza([usato('s-a', 'r-1')], PARAMETRI)).toEqual([]);
  });
  it('il giorno del termine non è prima del termine', () => {
    const avvisi = avvisiScadenza([usato('s-a', 'r-1', '2026-11-14')], PARAMETRI);
    expect(avvisi[0]).toMatchObject({ primaDelTermine: false, entroOrizzonte: true });
  });
  it('raggruppa lo stesso fatto usato da più requisiti', () => {
    const avvisi = avvisiScadenza([usato('s-a', 'r-1', '2026-10-31'), usato('s-a', 'r-2', '2026-10-31')], PARAMETRI);
    expect(avvisi).toHaveLength(1);
    expect(avvisi[0]?.requisitiIds).toEqual(['r-1', 'r-2']);
  });
  it('tiene separati fatti diversi dello stesso soggetto', () => {
    const avvisi = avvisiScadenza([usato('s-a', 'r-1', '2026-10-31'), usato('s-a', 'r-2', '2026-10-31', 'iscrizione albo')], PARAMETRI);
    expect(avvisi).toHaveLength(2);
  });
  it('ordina per data di scadenza e poi per soggetto', () => {
    const avvisi = avvisiScadenza([usato('s-b', 'r-1', '2026-10-31'), usato('s-a', 'r-1', '2026-10-31'), usato('s-c', 'r-1', '2026-10-01')], PARAMETRI);
    expect(avvisi.map((a) => a.soggettoId)).toEqual(['s-c', 's-a', 's-b']);
  });
  it('non emette avvisi se il termine è già decorso', () => {
    expect(avvisiScadenza([usato('s-a', 'r-1', '2026-11-20')], { ...PARAMETRI, dataRiferimento: '2026-11-15' })).toEqual([]);
  });
});
