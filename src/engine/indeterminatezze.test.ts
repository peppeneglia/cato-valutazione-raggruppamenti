// Quando il documento non decide. Ogni test qui è un caso del disciplinare
// ASL Roma 6 (gara 9445747) ridotto all'osso: regola non dichiarata,
// criterio non determinato, soglia per rinvio con candidati contraddittori,
// letture alternative, ancoraggio non dichiarato, richiesta di chiarimenti.

import { describe, expect, it } from 'vitest';
import type { Criterio, EsitoRequisito, Indeterminatezza, Rimedio, ValoreBando } from '../domain';
import { formattaEuro } from '../formato';
import { valuta } from './index';
import { anomalieStrutturali } from './validazione';
import { creaMemo, valutazione } from './valutazione';
import {
  bando,
  certificazione,
  esecutore,
  fatturatoGlobale,
  FONTE,
  iscrizione,
  lettura,
  lotto,
  parametri,
  prestazione,
  raggruppamento,
  requisito,
  servizio,
  soggetto,
} from './prova';

const F = (riferimento: string, pagina: number) => ({ documento: 'Disciplinare', riferimento, pagina });

const VALORE_STIMATO: ValoreBando = {
  nome: 'valore stimato',
  candidati: [
    { valore: 750_000, fonte: F('art. 3', 9) },
    { valore: 966_144.5, fonte: F('art. 3.2, testo', 10) },
    { valore: 1_025_000, fonte: F('art. 3.2, tabella', 10) },
  ],
};
const BASE_ASTA: ValoreBando = { nome: 'base d\'asta', candidati: [{ valore: 750_000, fonte: F('art. 3', 9) }] };
const FORNITURE = { singolare: 'fornitura', plurale: 'forniture' };

const FATTURATO: Criterio = { tipo: 'fatturato', ambito: { tipo: 'globale' }, periodo: { tipo: 'esercizi', anni: [2020, 2021, 2022] }, soglia: { rinvio: 'valore stimato' } };
const CONTRATTO_SINGOLO: Criterio = { tipo: 'servizi', cpv: '33190000', anni: 3, ancoraggio: 'non_dichiarato', importoMinimoUnitario: { rinvio: 'base d\'asta' }, numeroMinimo: 1, sostantivo: FORNITURE };
const SOMMA_CONTRATTI: Criterio = { tipo: 'servizi_importo', cpv: '33190000', anni: 3, ancoraggio: 'non_dichiarato', soglia: { rinvio: 'base d\'asta' } };
const ISO: Criterio = { tipo: 'certificazione', norme: ['ISO 9001', 'ISO 13485'], scope: 'settore oggetto dell\'appalto' };

const TERMINE_CHIARIMENTI = { data: '2023-12-27', ora: '12:00', fonte: F('art. 2.2', 7) };

// Le etichette dei candidati passano dal formato italiano: lo spazio prima di € è quello stretto.
const E = formattaEuro;
const CANDIDATO_BASE = `valore stimato = ${E(750_000)} (art. 3, p. 9)`;
const CANDIDATO_TESTO = `valore stimato = ${E(966_144.5)} (art. 3.2, testo, p. 10)`;
const CANDIDATO_TABELLA = `valore stimato = ${E(1_025_000)} (art. 3.2, tabella, p. 10)`;

function esitoDi(requisitoId: string, requisiti: EsitoRequisito[]): EsitoRequisito {
  const e = requisiti.find((r) => r.requisitoId === requisitoId);
  if (!e) throw new Error(`esito ${requisitoId} assente`);
  return e;
}

function tipi(indeterminatezze: Indeterminatezza[]): string[] {
  return indeterminatezze.map((i) => i.tipo);
}

function chiarimenti(rimedi: Rimedio[]): Extract<Rimedio, { tipo: 'richiesta_chiarimenti' }> | undefined {
  return rimedi.find((r): r is Extract<Rimedio, { tipo: 'richiesta_chiarimenti' }> => r.tipo === 'richiesta_chiarimenti');
}

/** Un lotto con una prestazione indivisibile, due membri al 50 %, un bando con i valori della gara reale. */
function scenario(requisiti: ReturnType<typeof requisito>[], soggetti: ReturnType<typeof soggetto>[], extra: Partial<ReturnType<typeof parametri>> = {}) {
  const l = lotto({ prestazioni: [prestazione('p-1', { natura: 'indivisibile' })], requisiti });
  return parametri({
    bando: bando([l], { dataPubblicazione: undefined, terminePresentazione: '2024-01-15', termineChiarimenti: TERMINE_CHIARIMENTI, valori: [VALORE_STIMATO, BASE_ASTA] }),
    lottoId: l.id,
    soggetti,
    raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 0.5 }), esecutore('s-b', 'mandante', { 'p-1': 0.5 })]),
    dataRiferimento: '2024-01-05',
    ...extra,
  });
}

// ─── 1. Regola non dichiarata ────────────────────────────────

describe('regola di composizione non dichiarata (§6.4 muto su tre requisiti)', () => {
  const r = requisito('r-iso', ISO, { tipo: 'non_dichiarata' });

  it('valuta ogni membro, conta tutti, non misura, esce da verificare e lo dice', () => {
    const p = scenario([r], [soggetto('s-a', [certificazione('ISO 9001', 'settore oggetto dell\'appalto')]), soggetto('s-b', [])]);
    const e = esitoDi('r-iso', valuta(p).requisiti);
    expect(e.stato).toBe('da_verificare');
    expect(e.contributi.map((c) => [c.soggettoId, c.conteggiato, c.valore])).toEqual([
      ['s-a', true, { tipo: 'possesso', esito: 'posseduto' }],
      ['s-b', true, { tipo: 'possesso', esito: 'assente' }],
    ]);
    expect(e.misurazione).toBeUndefined();
    expect(tipi(e.indeterminatezze)).toEqual(['regola_non_dichiarata']);
    expect(e.motivazione).toBe('Il disciplinare non dice come il requisito si componga nel raggruppamento: nessuna regola è stata applicata. Per membro: Soggetto s-a lo possiede; Soggetto s-b non lo possiede (nessuna certificazione ISO 9001 o ISO 13485 nel fascicolo).');
  });
  it('resta da verificare anche se tutti lo possiedono: senza regola il motore non decide', () => {
    const p = scenario([r], [soggetto('s-a', [certificazione('ISO 13485', 'settore oggetto dell\'appalto')]), soggetto('s-b', [certificazione('ISO 9001', 'settore oggetto dell\'appalto')])]);
    expect(esitoDi('r-iso', valuta(p).requisiti).stato).toBe('da_verificare');
  });
  it('le due famiglie convivono: regola non dichiarata E scope da giudicare per un membro', () => {
    const p = scenario([r], [
      soggetto('s-a', [certificazione('ISO 9001', 'settore oggetto dell\'appalto')]),
      soggetto('s-b', [certificazione('ISO 9001', 'logistica generica')]),
    ]);
    const e = esitoDi('r-iso', valuta(p).requisiti);
    expect(e.indeterminatezze).toEqual([
      { tipo: 'regola_non_dichiarata' },
      { tipo: 'giudizio_richiesto', soggettoId: 's-b', oggetto: 'equivalenza tra «logistica generica» e «settore oggetto dell\'appalto» (certificazione ISO 9001 o ISO 13485)' },
    ]);
    expect(e.motivazione).toContain('lo possiede con riserva');
    expect(e.motivazione).toContain('decide una persona, non il motore');
  });
  it('propone la richiesta di chiarimenti con il quesito sulla composizione, e nessun profilo mancante', () => {
    const p = scenario([r], [soggetto('s-a', []), soggetto('s-b', [])]);
    const e = esitoDi('r-iso', valuta(p).requisiti);
    const c = chiarimenti(e.rimedi);
    expect(c?.quesiti).toEqual(['In caso di raggruppamento temporaneo, da chi deve essere posseduto il requisito «Requisito r-iso»: da ciascun componente, dalla sola mandataria o dal raggruppamento nel complesso?']);
    expect(e.rimedi.some((x) => x.tipo === 'profilo_mancante')).toBe(false);
  });
});

// ─── 2. Criterio non determinato ─────────────────────────────

describe('criterio non determinato (§6.1 b: registri o albi «se prescritti», senza nominarli)', () => {
  const r = requisito('r-albi', { tipo: 'non_determinato', testo: 'iscrizione in registri o albi se prescritta dalla legislazione vigente' }, { tipo: 'non_dichiarata' });

  it('nessun contributo si calcola, esce da verificare con entrambe le indeterminatezze del documento', () => {
    const p = scenario([r], [soggetto('s-a', [iscrizione('Albo grossisti', 'farmaci')]), soggetto('s-b', [])]);
    const e = esitoDi('r-albi', valuta(p).requisiti);
    expect(e.stato).toBe('da_verificare');
    expect(e.contributi).toEqual([]);
    expect(tipi(e.indeterminatezze)).toEqual(['criterio_non_determinato', 'regola_non_dichiarata']);
    expect(e.motivazione).toContain('Il disciplinare non dice cosa soddisfi il requisito');
    expect(chiarimenti(e.rimedi)?.quesiti).toHaveLength(2);
  });
  it('nessun avvalimento e nessun ingresso lo copre: non c’è niente contro cui calcolare', () => {
    const p = scenario([{ ...r, avvalibile: true }], [soggetto('s-a', []), soggetto('s-b', []), soggetto('s-x', [iscrizione('Albo grossisti', 'farmaci')])]);
    const e = esitoDi('r-albi', valuta(p).requisiti);
    expect(e.rimedi.map((x) => x.tipo)).toEqual(['richiesta_chiarimenti']);
  });
});

// ─── 3. Soglia per rinvio, candidati contraddittori ──────────

describe('soglia per rinvio a un valore scritto in tre modi (art. 3.2 p. 10)', () => {
  const r = requisito('r-fatt', FATTURATO, { tipo: 'somma_membri' }, { avvalibile: true });
  const conFatturato = (a: number, b: number) => [
    soggetto('s-a', [fatturatoGlobale(2020, a / 3), fatturatoGlobale(2021, a / 3), fatturatoGlobale(2022, a / 3)]),
    soggetto('s-b', [fatturatoGlobale(2020, b / 3), fatturatoGlobale(2021, b / 3), fatturatoGlobale(2022, b / 3)]),
  ];

  it('somma tra due candidati e sotto il terzo: da verificare, valore contraddittorio, numeri della lettura peggiore', () => {
    const p = scenario([r], conFatturato(600_000, 390_000)); // 990.000: sopra 750.000 e 966.144,50, sotto 1.025.000
    const e = esitoDi('r-fatt', valuta(p).requisiti);
    expect(e.stato).toBe('da_verificare');
    expect(e.misurazione).toMatchObject({ soglia: 1_025_000, raggiunto: 990_000, delta: 35_000 });
    expect(e.indeterminatezze).toEqual([{
      tipo: 'valore_contraddittorio',
      nome: 'valore stimato',
      esiti: [
        { etichetta: CANDIDATO_BASE, stato: 'coperto' },
        { etichetta: CANDIDATO_TESTO, stato: 'coperto' },
        { etichetta: CANDIDATO_TABELLA, stato: 'scoperto' },
      ],
    }]);
    expect(e.varianti?.map((v) => v.stato)).toEqual(['coperto', 'coperto', 'scoperto']);
    expect(e.motivazione).toBe(`Il documento ammette 3 letture con esiti diversi: sotto «${CANDIDATO_BASE}» coperto; sotto «${CANDIDATO_TESTO}» coperto; sotto «${CANDIDATO_TABELLA}» scoperto (mancano ${E(35_000)}). Fino a un chiarimento non si può decidere; i numeri mostrati sono della lettura peggiore.`);
    expect(chiarimenti(e.rimedi)?.quesiti).toEqual([`Quale valore di «valore stimato» vale per il requisito «Requisito r-fatt»: ${CANDIDATO_BASE} oppure ${CANDIDATO_TESTO} oppure ${CANDIDATO_TABELLA}?`]);
  });
  it('sopra tutti i candidati: coperto sotto ogni lettura, con l’assunzione esito_concordante e la soglia peggiore', () => {
    const p = scenario([r], conFatturato(900_000, 300_000));
    const e = esitoDi('r-fatt', valuta(p).requisiti);
    expect(e.stato).toBe('coperto');
    expect(e.misurazione).toMatchObject({ soglia: 1_025_000, delta: 0 });
    expect(e.indeterminatezze).toEqual([]);
    expect(e.assunzioni.map((a) => a.codice)).toEqual(['esito_concordante']);
    expect(e.motivazione).toContain(`La soglia va da ${E(750_000)} a ${E(1_025_000)} a seconda della lettura, ed è raggiunta sotto tutte.`);
    expect(e.varianti).toHaveLength(3);
  });
  it('sotto tutti i candidati: scoperto, e la motivazione dice l’intervallo di quanto manca', () => {
    const p = scenario([r], conFatturato(300_000, 300_000));
    const e = esitoDi('r-fatt', valuta(p).requisiti);
    expect(e.stato).toBe('scoperto');
    expect(e.misurazione).toMatchObject({ soglia: 1_025_000, delta: 425_000 });
    expect(e.motivazione).toContain(`A seconda della lettura mancano tra ${E(150_000)} e ${E(425_000)}: si mostra la peggiore.`);
  });
  it('un soggetto che porta la somma sopra tutti i candidati, per ingresso o avvalimento, è un rimedio verificato accanto ai chiarimenti', () => {
    const p = scenario([r], [...conFatturato(600_000, 390_000), soggetto('s-x', [fatturatoGlobale(2020, 100_000), fatturatoGlobale(2021, 100_000), fatturatoGlobale(2022, 100_000)])]);
    const e = esitoDi('r-fatt', valuta(p).requisiti);
    expect(e.rimedi.map((x) => x.tipo)).toEqual(['ingresso_soggetto', 'ingresso_soggetto', 'ingresso_soggetto', 'avvalimento', 'richiesta_chiarimenti']);
    expect(e.rimedi.some((x) => x.tipo === 'profilo_mancante')).toBe(false);
  });
});

// ─── 4. Letture alternative ──────────────────────────────────

describe('letture alternative: contratto singolo oppure somma (§6.3 b)', () => {
  const r = requisito('r-forn', CONTRATTO_SINGOLO, { tipo: 'somma_membri' }, {
    letture: [lettura('un solo contratto non inferiore alla base d\'asta', CONTRATTO_SINGOLO), lettura('la somma dei contratti non inferiore alla base d\'asta', SOMMA_CONTRATTI)],
  });

  it('un contratto singolo sopra soglia: le due letture concordano, l’esito vale con l’assunzione dichiarata', () => {
    const p = scenario([r], [soggetto('s-a', [servizio('33190000', '2022-01-01', '2023-06-30', 800_000)]), soggetto('s-b', [])]);
    const e = esitoDi('r-forn', valuta(p).requisiti);
    expect(e.stato).toBe('coperto');
    expect(e.assunzioni.map((a) => a.codice)).toEqual(['ancoraggio_termine_presentazione', 'esito_concordante']);
    expect(e.varianti?.map((v) => v.etichetta)).toEqual(['un solo contratto non inferiore alla base d\'asta', 'la somma dei contratti non inferiore alla base d\'asta']);
  });
  it('solo contratti piccoli che sommano sopra soglia: le letture discordano, da verificare con letture_discordanti', () => {
    const p = scenario([r], [soggetto('s-a', [servizio('33190000', '2022-01-01', '2023-06-30', 400_000)]), soggetto('s-b', [servizio('33190000', '2022-01-01', '2023-06-30', 400_000)])]);
    const e = esitoDi('r-forn', valuta(p).requisiti);
    expect(e.stato).toBe('da_verificare');
    expect(e.indeterminatezze).toEqual([{
      tipo: 'letture_discordanti',
      esiti: [
        { etichetta: 'un solo contratto non inferiore alla base d\'asta', stato: 'scoperto' },
        { etichetta: 'la somma dei contratti non inferiore alla base d\'asta', stato: 'coperto' },
      ],
    }]);
    // I numeri mostrati sono della lettura peggiore: il conteggio dei contratti, non la somma.
    expect(e.misurazione?.unita).toEqual({ tipo: 'conteggio', sostantivo: FORNITURE });
    expect(chiarimenti(e.rimedi)?.quesiti).toEqual(['Per il requisito «Requisito r-forn», quale lettura vale: «un solo contratto non inferiore alla base d\'asta» oppure «la somma dei contratti non inferiore alla base d\'asta»?']);
  });
});

// ─── 5. Ancoraggio non dichiarato ────────────────────────────

describe('ancoraggio non dichiarato: "nell’ultimo triennio" senza dire da quando', () => {
  const r = requisito('r-forn', SOMMA_CONTRATTI, { tipo: 'somma_membri' });

  it('ancora al termine di presentazione, lo dichiara come assunzione, e dice di quanto potrebbe arretrare', () => {
    const p = scenario([r], [
      soggetto('s-a', [servizio('33190000', '2021-03-01', '2021-12-31', 500_000), servizio('33190000', '2020-01-01', '2020-12-31', 300_000)]),
      soggetto('s-b', []),
    ]);
    const e = esitoDi('r-forn', valuta(p).requisiti);
    // Finestra: 2021-01-15 – 2024-01-15. Il primo contratto conta (inizia 1.415 giorni prima del termine), il secondo è fuori di 15 giorni.
    expect(e.assunzioni).toEqual([{
      codice: 'ancoraggio_termine_presentazione',
      testo: 'La finestra «ultimi 3 anni» non ha un ancoraggio dichiarato nel disciplinare: è stata ancorata al termine di presentazione (15/01/2024), l\'unica data certa del bando. È un\'assunzione del motore, non del disciplinare.',
    }]);
    const nota = e.contributi[0]?.nota ?? '';
    expect(nota).toContain('«Servizio 33190000» resta nella finestra finché l\'ancoraggio non arretra di più di 1050 giorni');
    expect(nota).toContain('«Servizio 33190000» conterebbe con un ancoraggio anteriore di almeno 15 giorni');
  });
  it('la data di pubblicazione assente non è un’anomalia finché nessun criterio la chiede', () => {
    const p = scenario([r], [soggetto('s-a', []), soggetto('s-b', [])]);
    expect(anomalieStrutturali(p)).toEqual([]);
  });
  it('un criterio ancorato alla pubblicazione senza data è un’anomalia bloccante e il requisito non si valuta', () => {
    const p = scenario([requisito('r-pub', { ...SOMMA_CONTRATTI, ancoraggio: 'pubblicazione' }, { tipo: 'somma_membri' })], [soggetto('s-a', []), soggetto('s-b', [])]);
    const esito = valuta(p);
    expect(esito.anomalie.map((a) => [a.codice, a.gravita])).toEqual([['ancoraggio_a_pubblicazione_senza_data', 'bloccante']]);
    expect(esito.requisiti).toEqual([]);
    expect(esito.verdetto).toBe('non_ammissibile');
  });
});

// ─── 6. Norme alternative ed esercizi espliciti ──────────────

describe('norme alternative ed esercizi espliciti', () => {
  it('ISO 9001 e/o ISO 13485: ne basta una', () => {
    const r = requisito('r-iso', { tipo: 'certificazione', norme: ['ISO 9001', 'ISO 13485'] }, { tipo: 'ciascun_membro' });
    const p = scenario([r], [soggetto('s-a', [certificazione('ISO 13485', 'dispositivi')]), soggetto('s-b', [certificazione('ISO 9001', 'x')])]);
    expect(esitoDi('r-iso', valuta(p).requisiti).stato).toBe('coperto');
  });
  it('il triennio 2020/2021/2022 conta quegli anni e non altri, qualunque sia la data', () => {
    const r = requisito('r-fatt', { ...FATTURATO, soglia: 300_000 }, { tipo: 'somma_membri' });
    const p = scenario([r], [soggetto('s-a', [fatturatoGlobale(2019, 900_000), fatturatoGlobale(2021, 200_000), fatturatoGlobale(2023, 900_000)]), soggetto('s-b', [fatturatoGlobale(2022, 100_000)])]);
    const e = esitoDi('r-fatt', valuta(p).requisiti);
    expect(e.stato).toBe('coperto');
    expect(e.misurazione).toMatchObject({ raggiunto: 300_000 });
    expect(e.contributi[0]?.nota).toBe("nessun fatturato nell'ambito globale per gli esercizi 2020, 2022");
  });
});

// ─── 7. Termine dei chiarimenti ──────────────────────────────

describe('richiesta di chiarimenti e il suo termine (§2.2 p. 7)', () => {
  const r = requisito('r-iso', ISO, { tipo: 'non_dichiarata' });
  const soggetti = [soggetto('s-a', []), soggetto('s-b', [])];

  it('prima del termine: il rimedio riporta il termine con l’ora e non è decorso', () => {
    const p = scenario([r], soggetti, { dataRiferimento: '2023-12-20' });
    expect(chiarimenti(esitoDi('r-iso', valuta(p).requisiti).rimedi)).toMatchObject({ termine: { data: '2023-12-27', ora: '12:00' }, decorso: false });
  });
  it('il giorno stesso non è decorso: le date sono giornaliere, l’ora si mostra', () => {
    const p = scenario([r], soggetti, { dataRiferimento: '2023-12-27' });
    expect(chiarimenti(esitoDi('r-iso', valuta(p).requisiti).rimedi)?.decorso).toBe(false);
  });
  it('dopo il termine: decorso, e il requisito resta da verificare', () => {
    const p = scenario([r], soggetti, { dataRiferimento: '2024-01-05' });
    const e = esitoDi('r-iso', valuta(p).requisiti);
    expect(chiarimenti(e.rimedi)?.decorso).toBe(true);
    expect(e.stato).toBe('da_verificare');
  });
  it('senza termine nel bando: nessun termine e non decorso', () => {
    const p = scenario([r], soggetti);
    p.bando = { ...p.bando, termineChiarimenti: undefined };
    const c = chiarimenti(esitoDi('r-iso', valuta(p).requisiti).rimedi);
    expect(c?.termine).toBeUndefined();
    expect(c?.decorso).toBe(false);
  });
});

// ─── 8. Percorso: miglioramenti e limite di copribilità ──────

describe('percorso con requisiti che nessuna mossa può coprire', () => {
  const iso = requisito('r-iso', ISO, { tipo: 'non_dichiarata' });
  const fatt = requisito('r-fatt', FATTURATO, { tipo: 'somma_membri' }, { avvalibile: true });
  const soggetti = [
    soggetto('s-a', [certificazione('ISO 9001', 'settore oggetto dell\'appalto'), fatturatoGlobale(2020, 200_000), fatturatoGlobale(2021, 200_000), fatturatoGlobale(2022, 200_000)]),
    soggetto('s-b', [fatturatoGlobale(2020, 130_000), fatturatoGlobale(2021, 130_000), fatturatoGlobale(2022, 130_000)]),
    soggetto('s-x', [fatturatoGlobale(2020, 100_000), fatturatoGlobale(2021, 100_000), fatturatoGlobale(2022, 100_000)]),
  ];

  it('già con riserva, ammissibile irraggiungibile: il percorso lo dice e nomina la mossa che toglie un’incertezza', () => {
    const esito = valuta(scenario([iso, fatt], soggetti));
    expect(esito.verdetto).toBe('ammissibile_con_riserva');
    expect(esito.percorsoMinimo).toMatchObject({ esito: 'gia_ammissibile', verdetto: 'ammissibile_con_riserva', residui: ['r-iso', 'r-fatt'] });
    if (esito.percorsoMinimo.esito !== 'gia_ammissibile') throw new Error('atteso gia_ammissibile');
    const { miglioramenti } = esito.percorsoMinimo;
    // Tre ingressi di s-x (a quote zero, o rilevando la metà di uno dei due) e un avvalimento: tutti risolvono solo il fatturato.
    expect(miglioramenti.map((m) => m.mossa.tipo)).toEqual(['ingresso_soggetto', 'ingresso_soggetto', 'ingresso_soggetto', 'avvalimento']);
    expect(miglioramenti.every((m) => m.requisitiRisolti.length === 1 && m.requisitiRisolti[0] === 'r-fatt')).toBe(true);
    expect(miglioramenti[3]?.mossa).toEqual({ tipo: 'avvalimento', requisitoId: 'r-fatt', ausiliariaId: 's-x', ausiliataId: 's-a' });
  });
  it('senza mosse utili, i miglioramenti sono vuoti', () => {
    const esito = valuta(scenario([iso], soggetti.slice(0, 2)));
    expect(esito.percorsoMinimo).toEqual({ esito: 'gia_ammissibile', verdetto: 'ammissibile_con_riserva', residui: ['r-iso'], miglioramenti: [] });
  });
});

// ─── 9. Costo: il memo per lettura, non per candidato ────────

describe('costo delle varianti', () => {
  it('tre candidati sulla soglia: una scansione di fascicolo per soggetto, non tre', () => {
    const r = requisito('r-fatt', FATTURATO, { tipo: 'somma_membri' });
    const p = scenario([r], [soggetto('s-a', [fatturatoGlobale(2021, 1)]), soggetto('s-b', [fatturatoGlobale(2021, 1)])]);
    const memo = creaMemo(p);
    const { esito } = valutazione(p, memo);
    expect(esito.requisiti[0]?.varianti).toHaveLength(3);
    expect(memo.criteri.size).toBe(2);
  });
  it('due letture con criteri diversi: una scansione per lettura e per soggetto', () => {
    const r = requisito('r-forn', CONTRATTO_SINGOLO, { tipo: 'somma_membri' }, { letture: [lettura('A', CONTRATTO_SINGOLO), lettura('B', SOMMA_CONTRATTI)] });
    const p = scenario([r], [soggetto('s-a', []), soggetto('s-b', [])]);
    const memo = creaMemo(p);
    valutazione(p, memo);
    expect(memo.criteri.size).toBe(4);
  });
});

// ─── 10. Prestazione indivisibile ────────────────────────────

describe('prestazione indivisibile (§15.4)', () => {
  it('è l’unica del lotto: con altre è un’anomalia bloccante', () => {
    const l = lotto({ prestazioni: [prestazione('p-1', { natura: 'indivisibile' }), prestazione('p-2')] });
    const p = parametri({ bando: bando([l]), raggruppamento: raggruppamento([esecutore('s-a', 'mandataria', { 'p-1': 1, 'p-2': 1 })]) });
    expect(anomalieStrutturali(p).map((a) => [a.codice, a.gravita])).toEqual([['prestazione_indivisibile_non_unica', 'bloccante']]);
  });
  it('da sola, le quote dei membri sono la percentuale del documento e tutto è regolare', () => {
    const p = scenario([], [soggetto('s-a', []), soggetto('s-b', [])]);
    expect(anomalieStrutturali(p)).toEqual([]);
    expect(valuta(p).verdetto).toBe('ammissibile');
  });
});

// Un helper non usato dai test sopra ma utile per chi li estende: la fonte di prova.
void FONTE;
