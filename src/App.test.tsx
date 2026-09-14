// @vitest-environment jsdom
//
// Test di comportamento della pagina: cosa fa, non come appare.
// Niente snapshot: fissano il markup e non dicono niente su cosa fa la pagina.
// La fixture è la gara reale ASL Roma 6, monolotto.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

afterEach(cleanup);

const LENTO = { timeout: 4000 };
const FORNITURA = 'Fornitura di farmaci, parafarmaci, dispositivi medici e altro, da grossista con consegna veloce';
const FARMALAZIO = 'Farmadistribuzione Laziale S.p.A.';
const OSPEDALIA = 'Ospedalia Forniture S.r.l.';
const GROSSFARMA = 'Grossfarma Centro-Sud S.p.A.';

function riga(requisitoId: string): HTMLElement {
  const el = document.getElementById(`requisito-${requisitoId}`);
  if (!el) throw new Error(`Riga ${requisitoId} non trovata`);
  return el;
}

function regione(nome: string): HTMLElement {
  return screen.getByRole('region', { name: nome });
}

function quotaInput(soggetto: string, prestazione: string): HTMLInputElement {
  return screen.getByLabelText(`Quota di ${soggetto} su ${prestazione}`);
}

describe('pagina — avvio', () => {
  it('mostra il verdetto del lotto unico e la data di riferimento della fixture', () => {
    render(<App />);
    expect(within(regione('Verdetto')).getByText('Ammissibile con riserva')).toBeTruthy();
    expect(screen.getByLabelText('Data di riferimento')).toHaveProperty('value', '2024-01-08');
  });
  it('elenca il lotto unico e dichiara la classifica in calcolo finché il motore non risponde', async () => {
    render(<App />);
    const lotti = regione('Lotti');
    expect(within(lotti).getAllByRole('button')).toHaveLength(1);
    expect(within(lotti).getAllByText('Calcolo in corso…').length).toBeGreaterThan(0);
    expect(await within(lotti).findByText('Ammissibile con riserva', undefined, LENTO)).toBeTruthy();
    expect(within(lotti).queryByText('Calcolo in corso…')).toBeNull();
  });
  it('quattro requisiti su sei sono da verificare, le forniture analoghe coperte', () => {
    render(<App />);
    for (const id of ['requisiti-generali', 'registro-imprese', 'registri-di-settore', 'fatturato-globale', 'certificazione-qualita']) {
      expect(within(riga(id)).getByText('Da verificare')).toBeTruthy();
    }
    expect(within(riga('forniture-analoghe')).getByText('Coperto')).toBeTruthy();
  });
});

describe('pagina — quote', () => {
  it('azzerare la quota di un membro lascia le quote a 75 %: anomalia bloccante, e la pagina resta in piedi', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = quotaInput(OSPEDALIA, FORNITURA);
    await user.clear(input);
    await user.type(input, '0');
    expect(within(regione('Anomalie nei dati')).getByText(/totalizzano 75\s% invece del 100/)).toBeTruthy();
    expect(within(regione('Verdetto')).getByText(/1 anomalia bloccante/)).toBeTruthy();
    expect(within(regione('Percorso minimo')).queryByText(/Calcolo del percorso/)).toBeTruthy();
  });
  it('la bozza locale: un testo non numerico è segnalato, non inviato, e al blur torna il valore reale', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = quotaInput(FARMALAZIO, FORNITURA);
    await user.clear(input);
    await user.type(input, 'abc');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(within(regione('Anomalie nei dati')).queryByText(/totalizzano/)).toBeNull();
    await user.tab();
    expect(input.value).toBe('60');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });
  it('mentre si digita "6" poi "0" la quota finisce a 60 per cento senza perdere la digitazione', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = quotaInput(OSPEDALIA, FORNITURA);
    await user.clear(input);
    await user.type(input, '60');
    expect(input.value).toBe('60');
    expect(within(regione('Anomalie nei dati')).getByText(/totalizzano 135\s% invece del 100/)).toBeTruthy();
  });
});

describe('pagina — prove e annullamento', () => {
  it('provare un rimedio della riga del fatturato lo applica come modifica annullabile', async () => {
    const user = userEvent.setup();
    render(<App />);
    const fatturato = riga('fatturato-globale');
    const prove = await within(fatturato).findAllByRole('button', { name: 'Prova' }, LENTO);
    // L'ultima mossa applicabile è l'avvalimento di Grossfarma a favore della mandataria.
    await user.click(prove[prove.length - 1] as HTMLElement);

    const composizione = regione('Composizione del raggruppamento');
    expect(within(composizione).getByRole('rowheader', { name: GROSSFARMA })).toBeTruthy();
    expect(within(regione('Modifiche')).getByText(/^Prova: Avvalimento di Grossfarma/)).toBeTruthy();
    expect(within(riga('fatturato-globale')).getByText('Coperto')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Annulla ultima modifica' }));
    expect(within(composizione).queryByRole('rowheader', { name: GROSSFARMA })).toBeNull();
    expect(within(riga('fatturato-globale')).getByText('Da verificare')).toBeTruthy();
    expect(within(regione('Modifiche')).getByText(/Nessuna modifica/)).toBeTruthy();
  });
  it('dopo una prova compare il confronto con la composizione precedente', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByRole('region', { name: /Conviene di più/ })).toBeNull();
    const prove = await within(riga('fatturato-globale')).findAllByRole('button', { name: 'Prova' }, LENTO);
    await user.click(prove[prove.length - 1] as HTMLElement);
    const confronto = await screen.findByRole('region', { name: /Conviene di più/ });
    expect(await within(confronto).findByText('Composizione attuale', undefined, LENTO)).toBeTruthy();
    expect(within(confronto).getByText("Prima dell'ultima prova")).toBeTruthy();
  });
  it('il percorso minimo dice che il massimo raggiungibile è già raggiunto e nomina i residui', async () => {
    render(<App />);
    const percorso = regione('Percorso minimo');
    expect(within(percorso).getByRole('status').textContent).toContain('Calcolo del percorso minimo in corso');
    expect(await within(percorso).findByText(/Nessuna mossa necessaria/, undefined, LENTO)).toBeTruthy();
    expect(within(percorso).getByText(/Restano da risolvere fuori dallo strumento/)).toBeTruthy();
  });
});

describe('pagina — data di riferimento', () => {
  it('prima del 27/12/2023 i chiarimenti si possono ancora chiedere; dopo, il termine è decorso', async () => {
    const user = userEvent.setup();
    render(<App />);
    // I rimedi arrivano dal canale differito: si aspettano.
    expect(await within(riga('certificazione-qualita')).findByText(/Il termine per i chiarimenti .* è decorso/, undefined, LENTO)).toBeTruthy();
    const data = screen.getByLabelText('Data di riferimento');
    await user.clear(data);
    await user.type(data, '2023-12-20');
    expect(await within(riga('certificazione-qualita')).findByText(/Chiedi chiarimenti alla stazione appaltante entro le 12:00 del 27\/12\/2023/, undefined, LENTO)).toBeTruthy();
  });
  it('la ISO 9001 di Farmadistribuzione è un avviso di scadenza solo entro l’orizzonte', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(within(regione('Avvisi di scadenza')).getByText(/certificazione UNI EN ISO 9001:2015/)).toBeTruthy();
    const data = screen.getByLabelText('Data di riferimento');
    await user.clear(data);
    await user.type(data, '2023-10-01');
    expect(within(regione('Avvisi di scadenza')).getByText(/Nessun documento usato scade/)).toBeTruthy();
  });
});

describe('pagina — membri e ausiliarie', () => {
  it('aggiungere un membro lo mostra a quote zero con la segnalazione del motore', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Aggiungi al raggruppamento' }));
    expect(within(regione('Composizione del raggruppamento')).getByRole('rowheader', { name: GROSSFARMA })).toBeTruthy();
    expect(within(regione('Anomalie nei dati')).getByText(/s-grossfarma non esegue prestazioni nel lotto lotto-unico/)).toBeTruthy();
  });
  it('un’ausiliaria aggiunta a mano sul fatturato lo copre sotto ogni lettura; i non avvalibili sono disabilitati con la ragione', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(within(riga('fatturato-globale')).getByText('Da verificare')).toBeTruthy();
    const modulo = screen.getByRole('heading', { name: "Aggiungi un'ausiliaria in avvalimento" }).closest('form');
    if (!modulo) throw new Error('modulo ausiliaria non trovato');
    await user.selectOptions(within(modulo).getByLabelText('Ausiliaria'), 's-grossfarma');
    const nonAvvalibile = within(modulo).getByLabelText(/Requisiti di ordine generale/);
    expect(nonAvvalibile).toHaveProperty('disabled', true);
    expect(within(modulo).getAllByText(/non avvalibile: il disciplinare non lo ammette/).length).toBeGreaterThan(0);
    await user.click(within(modulo).getByLabelText(/Fatturato globale/));
    await user.click(within(modulo).getByRole('button', { name: 'Aggiungi ausiliaria' }));
    expect(within(riga('fatturato-globale')).getByText('Coperto')).toBeTruthy();
    expect(within(regione('Composizione del raggruppamento')).getByText(/A favore di Farmadistribuzione Laziale S.p.A. per: Fatturato globale/)).toBeTruthy();
  });
  it('rimuovere la mandataria produce l’anomalia bloccante senza rompere la pagina', async () => {
    const user = userEvent.setup();
    render(<App />);
    const rigaMandataria = document.getElementById('membro-s-farmalazio');
    if (!rigaMandataria) throw new Error('riga della mandataria non trovata');
    await user.click(within(rigaMandataria).getByRole('button', { name: 'Rimuovi' }));
    expect(within(regione('Anomalie nei dati')).getByText(/non ha una mandataria/)).toBeTruthy();
    await waitFor(() => expect(within(regione('Percorso minimo')).getByText(/Il percorso non si calcola finché ci sono anomalie bloccanti/)).toBeTruthy(), LENTO);
  });
});
