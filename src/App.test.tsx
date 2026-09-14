// @vitest-environment jsdom
//
// Test di comportamento della pagina: cosa fa, non come appare.
// Niente snapshot: fissano il markup e non dicono niente su cosa fa la pagina.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from './App';

afterEach(cleanup);

const LENTO = { timeout: 4000 };

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
  it('mostra il verdetto del primo lotto e la data di riferimento della fixture', () => {
    render(<App />);
    expect(within(regione('Verdetto')).getByText('Non ammissibile')).toBeTruthy();
    expect(screen.getByLabelText('Data di riferimento')).toHaveProperty('value', '2026-09-14');
  });
  it('elenca i lotti e dichiara la classifica in calcolo finché il motore non risponde', async () => {
    render(<App />);
    const lotti = regione('Lotti');
    expect(within(lotti).getAllByRole('button')).toHaveLength(2);
    expect(within(lotti).getAllByText('Calcolo in corso…').length).toBeGreaterThan(0);
    expect(await within(lotti).findByText('Ammissibile', undefined, LENTO)).toBeTruthy();
    expect(within(lotti).queryByText('Calcolo in corso…')).toBeNull();
  });
  it('selezionare un lotto cambia il verdetto mostrato', async () => {
    render(<App />);
    await userEvent.setup().click(within(regione('Lotti')).getByRole('button', { name: /lotto-2/ }));
    expect(await within(regione('Verdetto')).findByText('Ammissibile', undefined, LENTO)).toBeTruthy();
  });
});

describe('pagina — quote', () => {
  it('azzerare la quota di chi esegue produce un’anomalia bloccante e la pagina resta in piedi', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = quotaInput('Beta Service S.r.l.', 'Manutenzione e assistenza tecnica');
    await user.clear(input);
    await user.type(input, '0');
    expect(within(regione('Anomalie nei dati')).getByText(/Nessun membro esegue la prestazione l1-manutenzione/)).toBeTruthy();
    expect(within(regione('Verdetto')).getByText(/1 anomalia bloccante/)).toBeTruthy();
    expect(within(regione('Percorso minimo')).queryByText(/Calcolo del percorso/)).toBeTruthy();
  });
  it('spostare la manutenzione su Alfa cambia lo stato della ISO 9001 da scoperto a da verificare', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(within(riga('l1-iso-9001-manutenzione')).getByText('Scoperto')).toBeTruthy();
    const beta = quotaInput('Beta Service S.r.l.', 'Manutenzione e assistenza tecnica');
    await user.clear(beta);
    await user.type(beta, '0');
    const alfa = quotaInput('Alfa Medical S.p.A.', 'Manutenzione e assistenza tecnica');
    await user.clear(alfa);
    await user.type(alfa, '100');
    expect(within(riga('l1-iso-9001-manutenzione')).getByText('Da verificare')).toBeTruthy();
    expect(within(regione('Anomalie nei dati')).queryByText(/Nessun membro esegue/)).toBeNull();
  });
  it('la bozza locale: un testo non numerico è segnalato, non inviato, e al blur torna il valore reale', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = quotaInput('Alfa Medical S.p.A.', 'Fornitura dispositivi elettromedicali');
    await user.clear(input);
    await user.type(input, 'abc');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(within(regione('Anomalie nei dati')).queryByText(/Nessun membro esegue/)).toBeNull();
    await user.tab();
    expect(input.value).toBe('100');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });
  it('mentre si digita "6" poi "0" la quota finisce a 60 per cento senza perdere la digitazione', async () => {
    const user = userEvent.setup();
    render(<App />);
    const input = quotaInput('Alfa Medical S.p.A.', 'Fornitura dispositivi elettromedicali');
    await user.clear(input);
    await user.type(input, '60');
    expect(input.value).toBe('60');
    expect(within(regione('Anomalie nei dati')).getByText(/totalizzano 60\s% invece del 100/)).toBeTruthy();
  });
});

describe('pagina — prove e annullamento', () => {
  it('provare una mossa del percorso la applica come modifica annullabile', async () => {
    const user = userEvent.setup();
    render(<App />);
    const percorso = regione('Percorso minimo');
    const prove = await within(percorso).findAllByRole('button', { name: 'Prova' }, LENTO);
    await user.click(prove[0] as HTMLElement);

    const composizione = regione('Composizione del raggruppamento');
    expect(within(composizione).getByRole('rowheader', { name: 'Delta Tecnica S.r.l.' })).toBeTruthy();
    expect(within(regione('Modifiche')).getByText(/^Prova: Ingresso di Delta Tecnica/)).toBeTruthy();
    expect(within(riga('l1-iso-9001-manutenzione')).getByText('Coperto')).toBeTruthy();
    expect(within(riga('l1-fatturato')).getByText('Coperto')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Annulla ultima modifica' }));
    expect(within(composizione).queryByRole('rowheader', { name: 'Delta Tecnica S.r.l.' })).toBeNull();
    expect(within(riga('l1-iso-9001-manutenzione')).getByText('Scoperto')).toBeTruthy();
    expect(within(regione('Modifiche')).getByText(/Nessuna modifica/)).toBeTruthy();
  });
  it('dopo una prova compare il confronto con la composizione precedente', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByRole('region', { name: /Conviene di più/ })).toBeNull();
    const prove = await within(regione('Percorso minimo')).findAllByRole('button', { name: 'Prova' }, LENTO);
    await user.click(prove[0] as HTMLElement);
    const confronto = await screen.findByRole('region', { name: /Conviene di più/ });
    expect(await within(confronto).findByText('Composizione attuale', undefined, LENTO)).toBeTruthy();
    expect(within(confronto).getByText("Prima dell'ultima prova")).toBeTruthy();
  });
  it('il percorso minimo del lotto 1 mostra due mosse nominate e il residuo', async () => {
    render(<App />);
    const percorso = regione('Percorso minimo');
    expect(within(percorso).getByRole('status').textContent).toContain('Calcolo del percorso minimo in corso');
    expect(await within(percorso).findByText(/2 mosse portano a/, undefined, LENTO)).toBeTruthy();
    expect(within(percorso).getByText(/Ingresso di Delta Tecnica S.r.l./)).toBeTruthy();
    expect(within(percorso).getByText(/Avvalimento di Epsilon Hospital Supply S.r.l./)).toBeTruthy();
    expect(within(percorso).getByText(/Restano da risolvere fuori dallo strumento/)).toBeTruthy();
  });
});

describe('pagina — data di riferimento', () => {
  it('spostare la data prima della scadenza della ISO 9001 di Beta la rende coperta, e dopo la scopre', async () => {
    const user = userEvent.setup();
    render(<App />);
    const data = screen.getByLabelText('Data di riferimento');
    await user.clear(data);
    await user.type(data, '2026-04-30');
    expect(within(riga('l1-iso-9001-manutenzione')).getByText('Coperto')).toBeTruthy();
    await user.clear(data);
    await user.type(data, '2026-05-01');
    expect(within(riga('l1-iso-9001-manutenzione')).getByText('Scoperto')).toBeTruthy();
  });
});

describe('pagina — membri e ausiliarie', () => {
  it('aggiungere un membro lo mostra a quote zero con la segnalazione del motore', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Aggiungi al raggruppamento' }));
    expect(within(regione('Composizione del raggruppamento')).getByRole('rowheader', { name: 'Delta Tecnica S.r.l.' })).toBeTruthy();
    expect(within(regione('Anomalie nei dati')).getByText(/s-delta non esegue prestazioni nel lotto lotto-1/)).toBeTruthy();
  });
  it('un’ausiliaria aggiunta a mano per le referenze copre il requisito; i non avvalibili sono disabilitati con la ragione', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(within(riga('l1-referenze')).getByText('Scoperto')).toBeTruthy();
    const modulo = screen.getByRole('heading', { name: "Aggiungi un'ausiliaria in avvalimento" }).closest('form');
    if (!modulo) throw new Error('modulo ausiliaria non trovato');
    await user.selectOptions(within(modulo).getByLabelText('Ausiliaria'), 's-epsilon');
    const nonAvvalibile = within(modulo).getByLabelText(/ISO 13485 per chi esegue la fornitura/);
    expect(nonAvvalibile).toHaveProperty('disabled', true);
    expect(within(modulo).getAllByText(/non avvalibile: il disciplinare non lo ammette/).length).toBeGreaterThan(0);
    await user.click(within(modulo).getByLabelText(/Tre forniture analoghe/));
    await user.click(within(modulo).getByRole('button', { name: 'Aggiungi ausiliaria' }));
    expect(within(riga('l1-referenze')).getByText('Coperto')).toBeTruthy();
    expect(within(regione('Composizione del raggruppamento')).getByText(/A favore di Alfa Medical S.p.A. per: Tre forniture analoghe/)).toBeTruthy();
  });
  it('rimuovere la mandataria produce l’anomalia bloccante senza rompere la pagina', async () => {
    const user = userEvent.setup();
    render(<App />);
    const rigaAlfa = document.getElementById('membro-s-alfa');
    if (!rigaAlfa) throw new Error('riga Alfa non trovata');
    await user.click(within(rigaAlfa).getByRole('button', { name: 'Rimuovi' }));
    expect(within(regione('Anomalie nei dati')).getByText(/non ha una mandataria/)).toBeTruthy();
    await waitFor(() => expect(within(regione('Percorso minimo')).getByText(/Il percorso non si calcola finché ci sono anomalie bloccanti/)).toBeTruthy(), LENTO);
  });
});
