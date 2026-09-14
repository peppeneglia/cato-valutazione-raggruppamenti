import { describe, expect, it } from 'vitest';
import type { Criterio, ValoreBando } from '../domain';
import { formattaEuro } from '../formato';
import { bando, FONTE, lettura, requisito } from './prova';
import { rinviiDi, varianti } from './varianti';

// Le etichette passano dal formato italiano: lo spazio prima di € è quello stretto.
const TESTO = `valore stimato = ${formattaEuro(966_144.5)} (art. 3.2, testo, p. 10)`;
const TABELLA = `valore stimato = ${formattaEuro(1_025_000)} (art. 3.2, tabella, p. 10)`;

const F = (riferimento: string, pagina: number) => ({ documento: 'Disciplinare', riferimento, pagina });

const VALORE_STIMATO: ValoreBando = {
  nome: 'valore stimato',
  candidati: [
    { valore: 966_144.5, fonte: F('art. 3.2, testo', 10) },
    { valore: 1_025_000, fonte: F('art. 3.2, tabella', 10) },
  ],
};
const BASE_ASTA: ValoreBando = { nome: 'base d\'asta', candidati: [{ valore: 750_000, fonte: F('art. 3', 9) }] };

const FATTURATO_RINVIO: Criterio = { tipo: 'fatturato', ambito: { tipo: 'globale' }, periodo: { tipo: 'esercizi', anni: [2020, 2021, 2022] }, soglia: { rinvio: 'valore stimato' } };
const SINGOLO: Criterio = { tipo: 'servizi', cpv: '33190000', anni: 3, ancoraggio: 'non_dichiarato', importoMinimoUnitario: { rinvio: 'base d\'asta' }, numeroMinimo: 1, sostantivo: { singolare: 'fornitura', plurale: 'forniture' } };
const SOMMA: Criterio = { tipo: 'servizi_importo', cpv: '33190000', anni: 3, ancoraggio: 'non_dichiarato', soglia: { rinvio: 'base d\'asta' } };

describe('rinviiDi', () => {
  it('raccoglie i nomi dei valori a cui il criterio rinvia, una volta sola', () => {
    expect(rinviiDi(FATTURATO_RINVIO)).toEqual(['valore stimato']);
    expect(rinviiDi({ ...SOMMA, importoMinimoUnitario: { rinvio: 'base d\'asta' } })).toEqual(['base d\'asta']);
    expect(rinviiDi({ tipo: 'fatturato', ambito: { tipo: 'globale' }, periodo: { tipo: 'esercizi', anni: [2022] }, soglia: 1 })).toEqual([]);
    expect(rinviiDi({ tipo: 'non_determinato', testo: 'x' })).toEqual([]);
  });
});

describe('varianti', () => {
  it('una lettura senza rinvii dà una variante sola, senza etichetta', () => {
    const r = requisito('r', { tipo: 'dichiarazione', oggetto: 'x' }, { tipo: 'ciascun_membro' });
    const { varianti: v, anomalie } = varianti(r, bando([]));
    expect(anomalie).toEqual([]);
    expect(v).toHaveLength(1);
    expect(v[0]?.etichetta).toBe('');
    expect(v[0]?.criterio).toEqual({ tipo: 'dichiarazione', oggetto: 'x' });
  });
  it('un rinvio a un valore con due candidati dà due varianti, etichettate con valore e fonte', () => {
    const r = requisito('r', FATTURATO_RINVIO, { tipo: 'somma_membri' });
    const { varianti: v } = varianti(r, bando([], { valori: [VALORE_STIMATO] }));
    expect(v.map((x) => x.criterio.tipo === 'fatturato' && x.criterio.soglia)).toEqual([966_144.5, 1_025_000]);
    expect(v.map((x) => x.etichetta)).toEqual([TESTO, TABELLA]);
  });
  it('un candidato solo non compare nell’etichetta: non c’è una scelta da dichiarare', () => {
    const r = requisito('r', SOMMA, { tipo: 'somma_membri' });
    const { varianti: v } = varianti(r, bando([], { valori: [BASE_ASTA] }));
    expect(v).toHaveLength(1);
    expect(v[0]?.etichetta).toBe('');
    expect(v[0]?.criterio).toMatchObject({ soglia: 750_000 });
  });
  it('due letture per un candidato danno due varianti etichettate con il testo della lettura', () => {
    const r = requisito('r', SINGOLO, { tipo: 'somma_membri' }, { letture: [lettura('un solo contratto sopra soglia', SINGOLO), lettura('la somma dei contratti', SOMMA)] });
    const { varianti: v } = varianti(r, bando([], { valori: [BASE_ASTA] }));
    expect(v.map((x) => x.etichetta)).toEqual(['un solo contratto sopra soglia', 'la somma dei contratti']);
    expect(v.map((x) => x.lettura)).toEqual([0, 1]);
  });
  it('letture × candidati: il prodotto, nell’ordine del documento', () => {
    const r = requisito('r', FATTURATO_RINVIO, { tipo: 'somma_membri' }, {
      letture: [lettura('A', FATTURATO_RINVIO), lettura('B', { ...FATTURATO_RINVIO, ambito: { tipo: 'specifico', settore: 's' } })],
    });
    const { varianti: v } = varianti(r, bando([], { valori: [VALORE_STIMATO] }));
    expect(v.map((x) => x.etichetta)).toEqual([`A · ${TESTO}`, `A · ${TABELLA}`, `B · ${TESTO}`, `B · ${TABELLA}`]);
  });
  it('la chiave del memo non contiene la soglia: tre candidati, una chiave', () => {
    const r = requisito('r', FATTURATO_RINVIO, { tipo: 'somma_membri' });
    const { varianti: v } = varianti(r, bando([], { valori: [VALORE_STIMATO] }));
    expect(new Set(v.map((x) => x.chiaveMemo)).size).toBe(1);
  });
  it('il minimo unitario risolto entra nella chiave del memo, perché filtra i fatti', () => {
    const due: ValoreBando = { nome: 'base d\'asta', candidati: [{ valore: 700_000, fonte: FONTE }, { valore: 750_000, fonte: FONTE }] };
    const r = requisito('r', SINGOLO, { tipo: 'somma_membri' });
    const { varianti: v } = varianti(r, bando([], { valori: [due] }));
    expect(new Set(v.map((x) => x.chiaveMemo)).size).toBe(2);
  });

  describe('anomalie', () => {
    it('rinvio a un valore che il bando non nomina', () => {
      const r = requisito('r', FATTURATO_RINVIO, { tipo: 'somma_membri' });
      const { varianti: v, anomalie } = varianti(r, bando([]));
      expect(v).toEqual([]);
      expect(anomalie).toEqual([{ codice: 'rinvio_a_valore_inesistente', requisitoId: 'r', nome: 'valore stimato' }]);
    });
    it('valore nominato senza candidati', () => {
      const r = requisito('r', FATTURATO_RINVIO, { tipo: 'somma_membri' });
      const { anomalie } = varianti(r, bando([], { valori: [{ nome: 'valore stimato', candidati: [] }] }));
      expect(anomalie).toEqual([{ codice: 'valore_bando_senza_candidati', nome: 'valore stimato' }]);
    });
    it('ancoraggio alla pubblicazione con un bando che non ne scrive la data', () => {
      const r = requisito('r', { ...SOMMA, ancoraggio: 'pubblicazione', soglia: 1 }, { tipo: 'somma_membri' });
      const { anomalie } = varianti(r, bando([], { dataPubblicazione: undefined }));
      expect(anomalie).toEqual([{ codice: 'ancoraggio_a_pubblicazione_senza_data', requisitoId: 'r' }]);
    });
    it('il fatturato a ritroso dalla pubblicazione senza data è la stessa anomalia', () => {
      const r = requisito('r', { tipo: 'fatturato', ambito: { tipo: 'globale' }, periodo: { tipo: 'a_ritroso', esercizi: 3, ancoraggio: 'pubblicazione' }, soglia: 1 }, { tipo: 'somma_membri' });
      const { anomalie } = varianti(r, bando([], { dataPubblicazione: undefined }));
      expect(anomalie.map((a) => a.codice)).toEqual(['ancoraggio_a_pubblicazione_senza_data']);
    });
    it('requisito senza letture', () => {
      const r = requisito('r', { tipo: 'dichiarazione', oggetto: 'x' }, { tipo: 'ciascun_membro' }, { letture: [] });
      expect(varianti(r, bando([])).anomalie).toEqual([{ codice: 'requisito_senza_letture', requisitoId: 'r' }]);
    });
  });
});
