import { describe, expect, it } from 'vitest';
import type { Criterio } from '../domain';
import { dataAncoraggio, sogliaInterna, unitaDi, valutaCriterio, type ContestoCriterio } from './criteri';
import { certificazione, dichiarazione, fatturato, fatturatoGlobale, iscrizione, servizio } from './prova';

const CONTESTO: ContestoCriterio = { dataRiferimento: '2026-09-14', dataPubblicazione: '2026-09-01' };

describe('proprietà del criterio', () => {
  it('l’unità discende dal tipo', () => {
    expect(unitaDi({ tipo: 'fatturato', ambito: { tipo: 'globale' }, esercizi: 3, ancoraggio: 'riferimento', soglia: 1 })).toBe('euro');
    expect(unitaDi({ tipo: 'servizi', cpv: '1', anni: 5, ancoraggio: 'riferimento', numeroMinimo: 3 })).toBe('conteggio');
    expect(unitaDi({ tipo: 'servizi_importo', cpv: '1', anni: 5, ancoraggio: 'riferimento', soglia: 1 })).toBe('euro');
    expect(unitaDi({ tipo: 'certificazione', norma: 'ISO 9001' })).toBeUndefined();
  });
  it('la soglia interna è in centesimi per gli euro e 1 per il possesso', () => {
    expect(sogliaInterna({ tipo: 'fatturato', ambito: { tipo: 'globale' }, esercizi: 3, ancoraggio: 'riferimento', soglia: 3_000_000 })).toBe(300_000_000);
    expect(sogliaInterna({ tipo: 'servizi', cpv: '1', anni: 5, ancoraggio: 'riferimento', numeroMinimo: 3 })).toBe(3);
    expect(sogliaInterna({ tipo: 'dichiarazione', oggetto: 'x' })).toBe(1);
  });
  it('l’ancoraggio sceglie tra pubblicazione e riferimento', () => {
    expect(dataAncoraggio('pubblicazione', CONTESTO)).toBe('2026-09-01');
    expect(dataAncoraggio('riferimento', CONTESTO)).toBe('2026-09-14');
  });
});

describe('criterio dichiarazione', () => {
  const criterio: Criterio = { tipo: 'dichiarazione', oggetto: 'Assenza cause di esclusione' };

  it('è posseduto con la dichiarazione resa e valida, e ne cita la fonte', () => {
    const c = valutaCriterio(criterio, [dichiarazione('assenza cause di esclusione')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'possesso', esito: 'posseduto' });
    expect(c.usati).toHaveLength(1);
    expect(c.note).toEqual([]);
  });
  it('è assente senza dichiarazione, con la nota che lo dice', () => {
    const c = valutaCriterio(criterio, [dichiarazione('altro')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'possesso', esito: 'assente' });
    expect(c.usati).toEqual([]);
    expect(c.note[0]).toContain('nessuna dichiarazione');
  });
});

describe('criterio certificazione', () => {
  it('senza scope richiesto basta la norma valida', () => {
    const c = valutaCriterio({ tipo: 'certificazione', norma: 'ISO 9001' }, [certificazione('ISO 9001', 'qualsiasi')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'possesso', esito: 'posseduto' });
  });
  it('con scope coincidente è posseduto', () => {
    const c = valutaCriterio({ tipo: 'certificazione', norma: 'ISO 9001', scope: 'assistenza tecnica' }, [certificazione('ISO 9001', 'Assistenza  tecnica')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'possesso', esito: 'posseduto' });
  });
  it('con scope diverso è da verificare, non scoperto: è un giudizio', () => {
    const c = valutaCriterio({ tipo: 'certificazione', norma: 'ISO 9001', scope: 'assistenza tecnica' }, [certificazione('ISO 9001', 'erogazione formazione')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'possesso', esito: 'da_verificare' });
    expect(c.usati).toHaveLength(1);
    expect(c.note).toEqual(['certificazione ISO 9001 con «erogazione formazione» invece di «assistenza tecnica»: equivalenza da valutare']);
  });
  it('tra più certificazioni valide vince quella con lo scope coincidente', () => {
    const c = valutaCriterio({ tipo: 'certificazione', norma: 'ISO 9001', scope: 'produzione' }, [certificazione('ISO 9001', 'formazione'), certificazione('ISO 9001', 'produzione')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'possesso', esito: 'posseduto' });
    expect(c.usati).toHaveLength(1);
  });
  it('senza la norma è assente', () => {
    const c = valutaCriterio({ tipo: 'certificazione', norma: 'ISO 13485' }, [certificazione('ISO 9001', 'x')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'possesso', esito: 'assente' });
  });
  it('è assente se scaduta, con la data di scadenza nella nota', () => {
    const c = valutaCriterio({ tipo: 'certificazione', norma: 'ISO 9001' }, [certificazione('ISO 9001', 'x', '2026-09-13')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'possesso', esito: 'assente' });
    expect(c.usati).toEqual([]);
    expect(c.note[0]).toContain('scaduto il 13/09/2026');
  });
  it('vale il giorno stesso della scadenza', () => {
    const c = valutaCriterio({ tipo: 'certificazione', norma: 'ISO 9001' }, [certificazione('ISO 9001', 'x', '2026-09-14')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'possesso', esito: 'posseduto' });
  });
  it('non vale prima dell’inizio della validità', () => {
    const voce = certificazione('ISO 9001', 'x');
    if (voce.tipo === 'certificazione') voce.possesso.validoDa = '2026-10-01';
    const c = valutaCriterio({ tipo: 'certificazione', norma: 'ISO 9001' }, [voce], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'possesso', esito: 'assente' });
    expect(c.note[0]).toContain('valido solo dal 01/10/2026');
  });
  it('lo stesso fascicolo valutato a due date dà esiti diversi', () => {
    const fascicolo = [certificazione('ISO 9001', 'x', '2026-04-30')];
    const criterio: Criterio = { tipo: 'certificazione', norma: 'ISO 9001' };
    expect(valutaCriterio(criterio, fascicolo, { ...CONTESTO, dataRiferimento: '2026-04-30' }).valore).toEqual({ tipo: 'possesso', esito: 'posseduto' });
    expect(valutaCriterio(criterio, fascicolo, { ...CONTESTO, dataRiferimento: '2026-05-01' }).valore).toEqual({ tipo: 'possesso', esito: 'assente' });
  });
});

describe('criterio iscrizione', () => {
  it('con attività coincidente è posseduto', () => {
    const c = valutaCriterio({ tipo: 'iscrizione', registro: 'CCIAA', attivita: 'commercio dispositivi medici' }, [iscrizione('CCIAA', 'commercio dispositivi medici')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'possesso', esito: 'posseduto' });
  });
  it('con attività diversa è da verificare, come lo scope', () => {
    const c = valutaCriterio({ tipo: 'iscrizione', registro: 'CCIAA', attivita: 'commercio dispositivi medici' }, [iscrizione('CCIAA', 'formazione professionale')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'possesso', esito: 'da_verificare' });
  });
  it('senza attività richiesta basta il registro', () => {
    const c = valutaCriterio({ tipo: 'iscrizione', registro: 'CCIAA' }, [iscrizione('CCIAA', 'qualsiasi')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'possesso', esito: 'posseduto' });
  });
});

describe('criterio fatturato', () => {
  const specifico: Criterio = { tipo: 'fatturato', ambito: { tipo: 'specifico', settore: 'dispositivi medici' }, esercizi: 3, ancoraggio: 'riferimento', soglia: 3_000_000 };

  it('somma in centesimi gli esercizi nella finestra, con una fonte per esercizio', () => {
    const c = valutaCriterio(specifico, [fatturato(2023, 'dispositivi medici', 1_000_000.5), fatturato(2024, 'dispositivi medici', 0.25), fatturato(2025, 'dispositivi medici', 0.25)], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'misura', certo: 100_000_100, incerto: 0 });
    expect(c.usati).toHaveLength(3);
    expect(c.note).toEqual([]);
  });
  it('esclude l’anno di ancoraggio e gli esercizi più vecchi della finestra', () => {
    const c = valutaCriterio(specifico, [fatturato(2026, 'dispositivi medici', 100), fatturato(2022, 'dispositivi medici', 100), fatturato(2023, 'dispositivi medici', 1)], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'misura', certo: 100, incerto: 0 });
  });
  it('elenca gli esercizi senza fatturato', () => {
    const c = valutaCriterio(specifico, [fatturato(2025, 'dispositivi medici', 1)], CONTESTO);
    expect(c.note).toEqual(['nessun fatturato nell\'ambito «dispositivi medici» per gli esercizi 2023, 2024']);
  });
  it('senza alcun fatturato pertinente lo dice per l’intera finestra', () => {
    const c = valutaCriterio(specifico, [fatturato(2025, 'formazione', 1)], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'misura', certo: 0, incerto: 0 });
    expect(c.note).toEqual(['nessun fatturato nell\'ambito «dispositivi medici» per gli esercizi 2023–2025']);
  });
  it('l’ambito globale non si soddisfa con un fatturato specifico, e viceversa', () => {
    const globale: Criterio = { ...specifico, ambito: { tipo: 'globale' } };
    expect(valutaCriterio(globale, [fatturato(2025, 'dispositivi medici', 1)], CONTESTO).valore).toEqual({ tipo: 'misura', certo: 0, incerto: 0 });
    expect(valutaCriterio(globale, [fatturatoGlobale(2025, 1)], CONTESTO).valore).toEqual({ tipo: 'misura', certo: 100, incerto: 0 });
    expect(valutaCriterio(specifico, [fatturatoGlobale(2025, 1)], CONTESTO).valore).toEqual({ tipo: 'misura', certo: 0, incerto: 0 });
  });
  it('con ancoraggio alla pubblicazione la finestra parte da quell’anno', () => {
    const contesto: ContestoCriterio = { dataRiferimento: '2027-01-10', dataPubblicazione: '2026-12-20' };
    const c = valutaCriterio({ ...specifico, ancoraggio: 'pubblicazione', esercizi: 1 }, [fatturato(2025, 'dispositivi medici', 1), fatturato(2026, 'dispositivi medici', 2)], contesto);
    expect(c.valore).toEqual({ tipo: 'misura', certo: 100, incerto: 0 });
  });
});

describe('criterio servizi', () => {
  const criterio: Criterio = { tipo: 'servizi', cpv: '33100000', anni: 5, ancoraggio: 'riferimento', numeroMinimo: 3 };

  it('conta i servizi con CPV di gara come certi', () => {
    const c = valutaCriterio(criterio, [servizio('33100000', '2023-01-01', '2024-12-31'), servizio('33100000', '2024-03-01', '2025-06-30')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'misura', certo: 2, incerto: 0 });
    expect(c.usati).toHaveLength(2);
  });
  it('conta un CPV diverso come incerto, con la nota sull’analogia', () => {
    const c = valutaCriterio(criterio, [servizio('33100000', '2023-01-01', '2024-12-31'), servizio('50421000', '2023-06-01', '2025-05-31')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'misura', certo: 1, incerto: 1 });
    expect(c.note[0]).toContain('CPV 50421000 diverso da quello di gara 33100000');
  });
  it('conta un servizio che si sovrappone alla finestra anche di un giorno', () => {
    const c = valutaCriterio(criterio, [servizio('33100000', '2020-01-01', '2021-09-14')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'misura', certo: 1, incerto: 0 });
  });
  it('esclude un servizio concluso prima della finestra e lo dice', () => {
    const c = valutaCriterio(criterio, [servizio('33100000', '2020-01-01', '2021-09-13')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'misura', certo: 0, incerto: 0 });
    expect(c.note[0]).toContain('fuori dalla finestra 14/09/2021 – 14/09/2026');
  });
  it('filtra i servizi sotto l’importo minimo unitario prima di contare', () => {
    const c = valutaCriterio({ ...criterio, importoMinimoUnitario: 200_000 }, [servizio('33100000', '2024-01-01', '2024-12-31', 199_999.99), servizio('33100000', '2024-01-01', '2024-12-31', 200_000)], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'misura', certo: 1, incerto: 0 });
    expect(c.note[0]).toContain('sotto il minimo unitario');
  });
  it('ancorato alla pubblicazione, un servizio iniziato dopo non conta', () => {
    const c = valutaCriterio({ ...criterio, ancoraggio: 'pubblicazione' }, [servizio('33100000', '2026-09-05', '2026-09-10')], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'misura', certo: 0, incerto: 0 });
  });
  it('senza servizi lo dice', () => {
    expect(valutaCriterio(criterio, [], CONTESTO).note).toEqual(['nessun servizio nel fascicolo']);
  });
});

describe('criterio servizi_importo', () => {
  const criterio: Criterio = { tipo: 'servizi_importo', cpv: '33100000', anni: 5, ancoraggio: 'riferimento', soglia: 1_000_000 };

  it('somma gli importi in centesimi, separando certi e incerti per CPV', () => {
    const c = valutaCriterio(criterio, [servizio('33100000', '2024-01-01', '2024-12-31', 900_000), servizio('50421000', '2024-01-01', '2024-12-31', 300_000.5)], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'misura', certo: 90_000_000, incerto: 30_000_050 });
  });
  it('applica gli stessi filtri di finestra e importo minimo', () => {
    const c = valutaCriterio({ ...criterio, importoMinimoUnitario: 500_000 }, [servizio('33100000', '2024-01-01', '2024-12-31', 400_000), servizio('33100000', '2010-01-01', '2010-12-31', 900_000)], CONTESTO);
    expect(c.valore).toEqual({ tipo: 'misura', certo: 0, incerto: 0 });
    expect(c.note).toHaveLength(2);
  });
});
