import { describe, expect, it } from 'vitest';
import type { Anomalia, CodiceAnomalia } from '../domain';
import {
  ausiliaria,
  bando,
  certificazione,
  esecutore,
  lotto,
  parametri,
  prestazione,
  raggruppamento,
  requisito,
  servizio,
  soggetto,
} from './prova';
import { anomalieStrutturali, creaAnomalia, eBloccante } from './validazione';

function codici(anomalie: Anomalia[]): CodiceAnomalia[] {
  return anomalie.map((a) => a.codice);
}

function trova<C extends CodiceAnomalia>(anomalie: Anomalia[], codice: C): Extract<Anomalia, { codice: C }> {
  const trovata = anomalie.find((a): a is Extract<Anomalia, { codice: C }> => a.codice === codice);
  if (!trovata) throw new Error(`Anomalia ${codice} non trovata tra: ${codici(anomalie).join(', ')}`);
  return trovata;
}

describe('anomalieStrutturali — input corretto', () => {
  it('non produce anomalie su un raggruppamento ben formato', () => {
    expect(anomalieStrutturali(parametri())).toEqual([]);
  });
});

describe('anomalieStrutturali — date', () => {
  it('segnala come bloccante la data di riferimento malformata', () => {
    const a = trova(anomalieStrutturali(parametri({ dataRiferimento: '14/09/2026' })), 'data_malformata');
    expect(a.origine).toBe('parametri');
    expect(a.gravita).toBe('bloccante');
  });
  it('segnala come bloccante la data di pubblicazione malformata', () => {
    const a = trova(anomalieStrutturali(parametri({ bando: bando([lotto()], { dataPubblicazione: '2026-13-01' }) })), 'data_malformata');
    expect(a.dove).toBe('dataPubblicazione');
    expect(a.gravita).toBe('bloccante');
  });
  it('segnala come bloccante il termine di presentazione malformato', () => {
    const a = trova(anomalieStrutturali(parametri({ bando: bando([lotto()], { terminePresentazione: '' }) })), 'data_malformata');
    expect(a.dove).toBe('terminePresentazione');
  });
  it('segnala il termine di presentazione già decorso', () => {
    const a = trova(anomalieStrutturali(parametri({ dataRiferimento: '2026-11-15' })), 'termine_presentazione_decorso');
    expect(a.gravita).toBe('segnalazione');
  });
  it('non segnala il termine decorso il giorno stesso del termine', () => {
    expect(codici(anomalieStrutturali(parametri({ dataRiferimento: '2026-11-14' })))).not.toContain('termine_presentazione_decorso');
  });
});

describe('anomalieStrutturali — lotto e riferimenti', () => {
  it('segnala il lotto inesistente e salta i controlli che ne dipendono', () => {
    const anomalie = anomalieStrutturali(parametri({ lottoId: 'l-99' }));
    expect(trova(anomalie, 'riferimento_inesistente')).toMatchObject({ entita: 'lotto', id: 'l-99', gravita: 'bloccante' });
    expect(codici(anomalie)).not.toContain('prestazione_senza_esecutore');
  });
  it('segnala un membro che non è tra i soggetti', () => {
    const p = parametri({ raggruppamento: raggruppamento([esecutore('s-ignoto', 'mandataria', { 'p-1': 1 })]) });
    expect(trova(anomalieStrutturali(p), 'riferimento_inesistente')).toMatchObject({ entita: 'soggetto', id: 's-ignoto' });
  });
  it('segnala una quota su una prestazione che il lotto non ha', () => {
    const p = parametri({ raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1, 'p-9': 0 })]) });
    expect(trova(anomalieStrutturali(p), 'riferimento_inesistente')).toMatchObject({ entita: 'prestazione', id: 'p-9' });
  });
  it('segnala un’ausiliaria che indica un requisito inesistente', () => {
    const p = parametri({
      soggetti: [soggetto('s-a'), soggetto('s-x')],
      raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1 }), ausiliaria('s-x', 's-a', ['r-99'])]),
    });
    expect(trova(anomalieStrutturali(p), 'riferimento_inesistente')).toMatchObject({ entita: 'requisito', id: 'r-99' });
  });
  it('segnala un’ausiliaria la cui ausiliata non è un membro esecutore', () => {
    const p = parametri({
      soggetti: [soggetto('s-a'), soggetto('s-x')],
      raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1 }), ausiliaria('s-x', 's-b', [])]),
    });
    expect(trova(anomalieStrutturali(p), 'riferimento_inesistente')).toMatchObject({ entita: 'ausiliata', id: 's-b' });
  });
  it('segnala una regola di esecutore su una prestazione inesistente', () => {
    const l = lotto({ requisiti: [requisito('r-1', { tipo: 'certificazione', norma: 'ISO 9001' }, { tipo: 'esecutore_prestazione', prestazioneId: 'p-9' })] });
    expect(trova(anomalieStrutturali(parametri({ bando: bando([l]) })), 'riferimento_inesistente')).toMatchObject({ entita: 'prestazione', id: 'p-9' });
  });
});

describe('anomalieStrutturali — membri e mandataria', () => {
  it('segnala la mandataria assente', () => {
    const p = parametri({ raggruppamento: raggruppamento([esecutore('s-a', 'mandante', { 'p-1': 1 })]) });
    expect(trova(anomalieStrutturali(p), 'mandataria_assente').gravita).toBe('bloccante');
  });
  it('segnala la mandataria multipla con gli id coinvolti', () => {
    const p = parametri({
      soggetti: [soggetto('s-a'), soggetto('s-b')],
      raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 0.5 }), esecutore('s-b', 'mandataria', { 'p-1': 0.5 })]),
    });
    expect(trova(anomalieStrutturali(p), 'mandataria_multipla').soggettiIds).toEqual(['s-a', 's-b']);
  });
  it('segnala un soggetto che compare due volte, anche come ausiliaria di sé stesso', () => {
    const p = parametri({
      raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1 }), ausiliaria('s-a', 's-a', [])]),
    });
    expect(trova(anomalieStrutturali(p), 'membro_duplicato').soggettoId).toBe('s-a');
  });
  it('segnala, senza bloccare, un esecutore con tutte le quote a zero', () => {
    const p = parametri({
      soggetti: [soggetto('s-a'), soggetto('s-b')],
      raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1 }), esecutore('s-b', 'mandante', { 'p-1': 0 })]),
    });
    const a = trova(anomalieStrutturali(p), 'membro_senza_quote');
    expect(a.soggettoId).toBe('s-b');
    expect(eBloccante(a)).toBe(false);
  });
});

describe('anomalieStrutturali — quote', () => {
  it('segnala una quota fuori dall’intervallo 0–1', () => {
    const p = parametri({ raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1.5 })]) });
    expect(trova(anomalieStrutturali(p), 'quota_fuori_intervallo')).toMatchObject({ soggettoId: 's-a', prestazioneId: 'p-1', quota: 1.5 });
  });
  it('segnala le quote che non totalizzano il 100 %', () => {
    const p = parametri({ raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 0.8 })]) });
    expect(trova(anomalieStrutturali(p), 'quote_non_totali')).toMatchObject({ prestazioneId: 'p-1', totale: 0.8 });
  });
  it('accetta un totale che è 100 % a meno dell’errore binario', () => {
    const p = parametri({
      soggetti: [soggetto('s-a'), soggetto('s-b'), soggetto('s-c')],
      raggruppamento: raggruppamento([
        esecutore('s-a', 'mandataria', { 'p-1': 0.1 }),
        esecutore('s-b', 'mandante', { 'p-1': 0.2 }),
        esecutore('s-c', 'mandante', { 'p-1': 0.7 }),
      ]),
    });
    expect(anomalieStrutturali(p)).toEqual([]);
  });
  it('distingue la prestazione senza esecutore dalle quote non totali', () => {
    const l = lotto({ prestazioni: [prestazione('p-1'), prestazione('p-2')] });
    const p = parametri({ bando: bando([l]), raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1 })]) });
    const anomalie = anomalieStrutturali(p);
    expect(trova(anomalie, 'prestazione_senza_esecutore').prestazioneId).toBe('p-2');
    expect(codici(anomalie)).not.toContain('quote_non_totali');
  });
});

describe('anomalieStrutturali — requisiti e avvalimenti', () => {
  it('segnala una regola di somma su un criterio di possesso', () => {
    const l = lotto({ requisiti: [requisito('r-1', { tipo: 'certificazione', norma: 'ISO 9001' }, { tipo: 'somma_membri' })] });
    expect(trova(anomalieStrutturali(parametri({ bando: bando([l]) })), 'regola_somma_su_criterio_di_possesso').requisitoId).toBe('r-1');
  });
  it('accetta una regola di somma su un criterio misurato', () => {
    const criterio = { tipo: 'fatturato', ambito: { tipo: 'globale' }, esercizi: 3, ancoraggio: 'riferimento', soglia: 1 } as const;
    const l = lotto({ requisiti: [requisito('r-1', criterio, { tipo: 'somma_membri' })] });
    expect(anomalieStrutturali(parametri({ bando: bando([l]) }))).toEqual([]);
  });
  it('segnala come bloccante un avvalimento su un requisito non avvalibile', () => {
    const l = lotto({ requisiti: [requisito('r-1', { tipo: 'certificazione', norma: 'ISO 9001' }, { tipo: 'almeno_un_membro' }, { avvalibile: false })] });
    const p = parametri({
      bando: bando([l]),
      soggetti: [soggetto('s-a'), soggetto('s-x')],
      raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1 }), ausiliaria('s-x', 's-a', ['r-1'])]),
    });
    const a = trova(anomalieStrutturali(p), 'avvalimento_su_requisito_non_avvalibile');
    expect(a).toMatchObject({ soggettoId: 's-x', requisitoId: 'r-1' });
    expect(a.gravita).toBe('bloccante');
  });
  it('accetta un avvalimento su un requisito avvalibile', () => {
    const l = lotto({ requisiti: [requisito('r-1', { tipo: 'certificazione', norma: 'ISO 9001' }, { tipo: 'almeno_un_membro' }, { avvalibile: true })] });
    const p = parametri({
      bando: bando([l]),
      soggetti: [soggetto('s-a'), soggetto('s-x')],
      raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1 }), ausiliaria('s-x', 's-a', ['r-1'])]),
    });
    expect(anomalieStrutturali(p)).toEqual([]);
  });
});

describe('anomalieStrutturali — parametri del requisito', () => {
  const servizi = { tipo: 'servizi', cpv: '1', anni: 5, ancoraggio: 'riferimento', numeroMinimo: 3 } as const;
  const fatturato = { tipo: 'fatturato', ambito: { tipo: 'globale' }, esercizi: 3, ancoraggio: 'riferimento', soglia: 1 } as const;

  it('segnala come bloccante una soglia zero, nominando requisito e parametro', () => {
    const l = lotto({ requisiti: [requisito('r-1', { ...fatturato, soglia: 0 }, { tipo: 'somma_membri' })] });
    const a = trova(anomalieStrutturali(parametri({ bando: bando([l]) })), 'parametro_requisito_non_valido');
    expect(a).toMatchObject({ requisitoId: 'r-1', parametro: 'criterio.soglia', valore: 0, gravita: 'bloccante' });
    expect(a.messaggio).toBe('Il requisito r-1 ha un parametro non valido: criterio.soglia = 0.');
  });
  it('segnala esercizi e anni non positivi', () => {
    const l = lotto({ requisiti: [
      requisito('r-1', { ...fatturato, esercizi: 0 }, { tipo: 'somma_membri' }),
      requisito('r-2', { ...servizi, anni: -1 }, { tipo: 'somma_membri' }),
    ] });
    const anomalie = anomalieStrutturali(parametri({ bando: bando([l]) }));
    expect(anomalie.filter((a) => a.codice === 'parametro_requisito_non_valido').map((a) => a.codice === 'parametro_requisito_non_valido' && a.parametro))
      .toEqual(['criterio.esercizi', 'criterio.anni']);
  });
  it('segnala il numero minimo zero e l’importo minimo unitario negativo', () => {
    const l = lotto({ requisiti: [
      requisito('r-1', { ...servizi, numeroMinimo: 0 }, { tipo: 'somma_membri' }),
      requisito('r-2', { ...servizi, importoMinimoUnitario: -1 }, { tipo: 'somma_membri' }),
    ] });
    const anomalie = anomalieStrutturali(parametri({ bando: bando([l]) }));
    expect(codici(anomalie).filter((c) => c === 'parametro_requisito_non_valido')).toHaveLength(2);
  });
  it('accetta l’importo minimo unitario zero', () => {
    const l = lotto({ requisiti: [requisito('r-1', { ...servizi, importoMinimoUnitario: 0 }, { tipo: 'somma_membri' })] });
    expect(anomalieStrutturali(parametri({ bando: bando([l]) }))).toEqual([]);
  });
  it('segnala i minimi per ruolo fuori da 0–1', () => {
    const l = lotto({ requisiti: [requisito('r-1', fatturato, { tipo: 'somma_membri', minimoMandataria: 1.5, minimoMandante: -0.1 })] });
    const anomalie = anomalieStrutturali(parametri({ bando: bando([l]) }));
    expect(anomalie.map((a) => a.codice === 'parametro_requisito_non_valido' && a.parametro)).toEqual(['regola.minimoMandataria', 'regola.minimoMandante']);
  });
  it('accetta i minimi per ruolo agli estremi 0 e 1', () => {
    const l = lotto({ requisiti: [requisito('r-1', fatturato, { tipo: 'somma_membri', minimoMandataria: 1, minimoMandante: 0 })] });
    expect(anomalieStrutturali(parametri({ bando: bando([l]) }))).toEqual([]);
  });
});

describe('anomalieStrutturali — vincolo della prestazione principale', () => {
  const vincolo = { esecutore: 'mandataria', quotaMinima: 0.6, fonte: { documento: 'Disciplinare', riferimento: 'rif.' } } as const;

  it('segnala un vincolo dichiarato senza prestazione principale', () => {
    const l = lotto({ vincoloPrestazionePrincipale: vincolo });
    expect(trova(anomalieStrutturali(parametri({ bando: bando([l]) })), 'vincolo_senza_prestazione_principale').gravita).toBe('bloccante');
  });
  it('segnala il vincolo violato con la quota effettiva del ruolo', () => {
    const l = lotto({ prestazioni: [prestazione('p-1', { natura: 'principale' })], vincoloPrestazionePrincipale: vincolo });
    const p = parametri({
      bando: bando([l]),
      soggetti: [soggetto('s-a'), soggetto('s-b')],
      raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 0.5 }), esecutore('s-b', 'mandante', { 'p-1': 0.5 })]),
    });
    expect(trova(anomalieStrutturali(p), 'vincolo_prestazione_principale_violato')).toMatchObject({
      prestazioneId: 'p-1', esecutore: 'mandataria', quotaMinima: 0.6, quotaEffettiva: 0.5,
    });
  });
  it('accetta il vincolo rispettato esattamente al minimo', () => {
    const l = lotto({ prestazioni: [prestazione('p-1', { natura: 'principale' })], vincoloPrestazionePrincipale: vincolo });
    const p = parametri({
      bando: bando([l]),
      soggetti: [soggetto('s-a'), soggetto('s-b')],
      raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 0.6 }), esecutore('s-b', 'mandante', { 'p-1': 0.4 })]),
    });
    expect(anomalieStrutturali(p)).toEqual([]);
  });
  it('senza vincolo dichiarato non controlla nulla', () => {
    const l = lotto({ prestazioni: [prestazione('p-1', { natura: 'principale' })] });
    const p = parametri({
      bando: bando([l]),
      soggetti: [soggetto('s-a'), soggetto('s-b')],
      raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 0.1 }), esecutore('s-b', 'mandante', { 'p-1': 0.9 })]),
    });
    expect(anomalieStrutturali(p)).toEqual([]);
  });
});

describe('anomalieStrutturali — fascicoli', () => {
  it('segnala, senza bloccare, una data di validità malformata in un fascicolo', () => {
    const p = parametri({ soggetti: [soggetto('s-a', [certificazione('ISO 9001', 'x', '30/04/2026')])] });
    const a = trova(anomalieStrutturali(p), 'data_malformata');
    expect(a.origine).toBe('fascicolo');
    expect(a.gravita).toBe('segnalazione');
    expect(a.dove).toContain('ISO 9001');
  });
  it('controlla anche i fascicoli dei soggetti non membri', () => {
    const p = parametri({ soggetti: [soggetto('s-a'), soggetto('s-x', [servizio('1', '2024-01-01', '2024-31-12')])] });
    expect(trova(anomalieStrutturali(p), 'data_malformata').dove).toContain('periodo.a');
  });
  it('segnala un periodo di servizio con inizio dopo la fine', () => {
    const p = parametri({ soggetti: [soggetto('s-a', [servizio('1', '2024-12-31', '2024-01-01')])] });
    expect(trova(anomalieStrutturali(p), 'periodo_invertito').soggettoId).toBe('s-a');
  });
  it('segnala una finestra di validità invertita', () => {
    const voce = certificazione('ISO 9001', 'x', '2020-01-01');
    if (voce.tipo === 'certificazione') voce.possesso.validoDa = '2021-01-01';
    const p = parametri({ soggetti: [soggetto('s-a', [voce])] });
    expect(trova(anomalieStrutturali(p), 'periodo_invertito').dove).toContain('validità');
  });
});

describe('creaAnomalia', () => {
  it('produce un messaggio leggibile con i numeri in formato italiano', () => {
    const a = creaAnomalia({ codice: 'quote_non_totali', prestazioneId: 'p-1', totale: 0.8 });
    expect(a.messaggio).toBe('Le quote sulla prestazione p-1 totalizzano 80 % invece del 100 %.');
  });
});
