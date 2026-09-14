import { describe, expect, it } from 'vitest';
import type { RuoloEsecutore, ValoreContributo } from '../domain';
import { componiMotivazione, type DatiMotivazione, type RigaMotivazione } from './motivazione';
import { CONTEGGIO_REFERENZE, EURO } from './prova';

const POSSEDUTO: ValoreContributo = { tipo: 'possesso', esito: 'posseduto' };
const DA_VERIFICARE: ValoreContributo = { tipo: 'possesso', esito: 'da_verificare' };
const ASSENTE: ValoreContributo = { tipo: 'possesso', esito: 'assente' };

function riga(nome: string, ruolo: RuoloEsecutore, composto: ValoreContributo, extra: Partial<RigaMotivazione> = {}): RigaMotivazione {
  return { soggettoId: nome.toLowerCase(), denominazione: nome, ruolo, conteggiato: true, composto, note: [], ausiliarie: [], ...extra };
}

function misura(certo: number, incerto = 0): ValoreContributo {
  return { tipo: 'misura', certo, incerto };
}

function dati(extra: Partial<DatiMotivazione>): DatiMotivazione {
  return { regola: { tipo: 'ciascun_membro' }, stato: 'coperto', unita: undefined, soglia: 1, righe: [], misurazione: { soglia: 1, raggiunto: 1, massimo: 1, delta: 0, minimiRuolo: [] }, ...extra };
}

describe('componiMotivazione — ciascun membro', () => {
  it('dice che tutti lo possiedono', () => {
    expect(componiMotivazione(dati({ righe: [riga('Alfa', 'mandataria', POSSEDUTO), riga('Beta', 'mandante', POSSEDUTO)] })))
      .toBe('Richiesto a ciascun membro: tutti e 2 i membri lo possiedono.');
  });
  it('nomina tutti i membri a cui manca, con le note, non solo il primo', () => {
    const testo = componiMotivazione(dati({
      stato: 'scoperto',
      righe: [riga('Alfa', 'mandataria', POSSEDUTO), riga('Beta', 'mandante', ASSENTE, { note: ['scaduta il 30/04/2026'] }), riga('Gamma', 'mandante', ASSENTE, { note: ['nessuna certificazione nel fascicolo'] })],
    }));
    expect(testo).toBe('Richiesto a ciascun membro: manca a Beta (scaduta il 30/04/2026); Gamma (nessuna certificazione nel fascicolo).');
  });
  it('con misura nomina ogni membro sotto soglia con il suo delta', () => {
    const testo = componiMotivazione(dati({
      stato: 'scoperto', unita: EURO, soglia: 30_000_000,
      righe: [riga('Alfa', 'mandataria', misura(50_000_000)), riga('Beta', 'mandante', misura(20_000_000)), riga('Gamma', 'mandante', misura(10_000_000))],
    }));
    expect(testo).toBe('Richiesto a ciascun membro, con soglia 300.000 € per ciascuno: Alfa raggiunge 500.000 €; Beta 200.000 €, mancano 100.000 €; Gamma 100.000 €, mancano 200.000 €.');
  });
  it('chiude con il giudizio quando lo stato è da verificare', () => {
    const testo = componiMotivazione(dati({ stato: 'da_verificare', righe: [riga('Gamma', 'mandante', DA_VERIFICARE, { note: ['scope diverso'] })] }));
    expect(testo).toBe('Richiesto a ciascun membro: Gamma (scope diverso) lo possiede con riserva. Il confronto che manca è un giudizio semantico: decide una persona, non il motore.');
  });
});

describe('componiMotivazione — esecutore della prestazione', () => {
  const regola = { tipo: 'esecutore_prestazione', prestazioneId: 'p-1' } as const;

  it('nomina chi esegue con la quota, e chi possiede senza eseguire', () => {
    const testo = componiMotivazione(dati({
      regola, stato: 'scoperto', descrizionePrestazione: 'Manutenzione',
      righe: [
        riga('Beta', 'mandante', ASSENTE, { quota: 1, note: ['certificazione ISO 9001: scaduto il 30/04/2026'] }),
        riga('Gamma', 'mandante', POSSEDUTO, { conteggiato: false, quota: 0 }),
      ],
    }));
    expect(testo).toBe('Richiesto a chi esegue «Manutenzione», cioè Beta (100 %): manca a Beta (certificazione ISO 9001: scaduto il 30/04/2026). Gamma lo possiede ma non esegue la prestazione.');
  });
  it('senza esecutori lo dice', () => {
    expect(componiMotivazione(dati({ regola, stato: 'scoperto', descrizionePrestazione: 'Manutenzione', righe: [riga('Alfa', 'mandataria', POSSEDUTO, { conteggiato: false })] })))
      .toBe('Richiesto a chi esegue «Manutenzione»: nessun membro la esegue.');
  });
  it('nomina l’ausiliaria che integra l’esecutore', () => {
    const testo = componiMotivazione(dati({
      regola, descrizionePrestazione: 'Manutenzione',
      righe: [riga('Beta', 'mandante', POSSEDUTO, { quota: 0.5, ausiliarie: ['Delta'] })],
    }));
    expect(testo).toBe('Richiesto a chi esegue «Manutenzione», cioè Beta (con l\'ausiliaria Delta) (50 %): Beta (con l\'ausiliaria Delta) lo possiede.');
  });
});

describe('componiMotivazione — somma dei membri', () => {
  it('mostra somma, soglia, delta e i contributi di ciascuno', () => {
    const testo = componiMotivazione(dati({
      regola: { tipo: 'somma_membri' }, stato: 'scoperto', unita: EURO, soglia: 300_000_000,
      righe: [riga('Alfa', 'mandataria', misura(210_000_000)), riga('Beta', 'mandante', misura(60_000_000)), riga('Gamma', 'mandante', misura(20_000_000))],
      misurazione: { soglia: 300_000_000, raggiunto: 290_000_000, massimo: 290_000_000, delta: 10_000_000, minimiRuolo: [] },
    }));
    expect(testo).toBe('Somma dei contributi certi: 2.900.000 € su una soglia di 3.000.000 €: mancano 100.000 €. Contributi: Alfa 2.100.000 €; Beta 600.000 €; Gamma 200.000 €.');
  });
  it('spiega la parte da verificare e cosa succede se regge', () => {
    const testo = componiMotivazione(dati({
      regola: { tipo: 'somma_membri' }, stato: 'da_verificare', unita: CONTEGGIO_REFERENZE, soglia: 3,
      righe: [riga('Alfa', 'mandataria', misura(2)), riga('Beta', 'mandante', misura(0, 1, ), { note: ['CPV 50421000 diverso da quello di gara 33100000'] })],
      misurazione: { soglia: 3, raggiunto: 2, massimo: 3, delta: 1, minimiRuolo: [] },
    }));
    expect(testo).toBe('Somma dei contributi certi: 2 referenze su una soglia di 3 referenze: mancano 1 referenza. Altri 1 referenza dipendono da fatti da verificare: se reggono, la soglia è raggiunta. Contributi: Alfa 2 referenze; Beta 0 referenze più 1 referenza da verificare (CPV 50421000 diverso da quello di gara 33100000). Il confronto che manca è un giudizio semantico: decide una persona, non il motore.');
  });
  it('mostra il minimo della mandataria con il calcolo, senza arrotondamento quando è esatto', () => {
    const testo = componiMotivazione(dati({
      regola: { tipo: 'somma_membri', minimoMandataria: 0.4 }, stato: 'scoperto', unita: EURO, soglia: 300_000_000,
      righe: [riga('Alfa', 'mandataria', misura(100_000_000)), riga('Beta', 'mandante', misura(250_000_000))],
      misurazione: { soglia: 300_000_000, raggiunto: 350_000_000, massimo: 350_000_000, delta: 0, minimiRuolo: [{ soggettoId: 'alfa', ruolo: 'mandataria', richiesto: 120_000_000, raggiunto: 100_000_000, delta: 20_000_000 }] },
    }));
    expect(testo).toContain('Minimo della mandataria: 40 % di 3.000.000 € = 1.200.000 €; Alfa raggiunge 1.000.000 €, mancano 200.000 €.');
  });
  it('mostra frazione grezza, minimo arrotondato e l’assunzione dichiarata', () => {
    const testo = componiMotivazione(dati({
      regola: { tipo: 'somma_membri', minimoMandataria: 0.4, minimoMandante: 0.1 }, stato: 'scoperto', unita: CONTEGGIO_REFERENZE, soglia: 3,
      righe: [riga('Alfa', 'mandataria', misura(1)), riga('Beta', 'mandante', misura(2))],
      misurazione: { soglia: 3, raggiunto: 3, massimo: 3, delta: 0, minimiRuolo: [
        { soggettoId: 'alfa', ruolo: 'mandataria', richiesto: 2, raggiunto: 1, delta: 1 },
        { soggettoId: 'beta', ruolo: 'mandante', richiesto: 1, raggiunto: 2, delta: 0 },
      ] },
    }));
    expect(testo).toContain('Minimo della mandataria: 40 % di 3 referenze = 1,2 referenze, quindi almeno 2 referenze (arrotondato per eccesso); Alfa raggiunge 1 referenza, mancano 1 referenza.');
    expect(testo).toContain('Minimo di ciascuna mandante: 10 % di 3 referenze = 0,3 referenze, quindi almeno 1 referenza (arrotondato per eccesso); Beta raggiunge 2 referenze.');
  });
});

describe('componiMotivazione — almeno un membro', () => {
  const regola = { tipo: 'almeno_un_membro' } as const;

  it('nomina chi lo possiede', () => {
    expect(componiMotivazione(dati({ regola, righe: [riga('Alfa', 'mandataria', POSSEDUTO), riga('Beta', 'mandante', ASSENTE)] })))
      .toBe('Basta un membro: lo possiede Alfa.');
  });
  it('quando nessuno lo possiede riporta le note di tutti', () => {
    expect(componiMotivazione(dati({ regola, stato: 'scoperto', righe: [riga('Alfa', 'mandataria', ASSENTE, { note: ['nessuna'] }), riga('Beta', 'mandante', ASSENTE, { note: ['scaduta'] })] })))
      .toBe('Basta un membro: nessun membro lo possiede (Alfa (nessuna); Beta (scaduta)).');
  });
  it('con misura nomina il migliore e quanto gli manca', () => {
    const testo = componiMotivazione(dati({
      regola, stato: 'scoperto', unita: EURO, soglia: 50_000_000,
      righe: [riga('Alfa', 'mandataria', misura(30_000_000)), riga('Beta', 'mandante', misura(10_000_000))],
      misurazione: { soglia: 50_000_000, raggiunto: 30_000_000, massimo: 30_000_000, delta: 20_000_000, minimiRuolo: [] },
    }));
    expect(testo).toBe('Basta un membro con almeno 500.000 €: il migliore è Alfa con 300.000 €, mancano 200.000 €.');
  });
});
