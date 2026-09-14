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

function regione(nome: string | RegExp): HTMLElement {
  return screen.getByRole('region', { name: nome });
}

function quotaInput(soggetto: string, prestazione: string): HTMLInputElement {
  return screen.getByLabelText(`Quota di ${soggetto} su ${prestazione}`);
}

/** Tutto ciò che documenta una riga sta nell'espansione: si apre con Dettagli. */
async function apri(user: ReturnType<typeof userEvent.setup>, requisitoId: string): Promise<HTMLElement> {
  await user.click(within(riga(requisitoId)).getByRole('button', { name: 'Dettagli' }));
  const dettagli = document.getElementById(`dettagli-${requisitoId}`);
  if (!dettagli) throw new Error(`Espansione ${requisitoId} non trovata`);
  return dettagli;
}

/** I requisiti coperti stanno raccolti e chiusi: chi guarda cerca i problemi. */
async function apriCoperti(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole('button', { name: /^\d+ requisit[oi] copert[oi]$/ }));
}

describe('pagina — avvio', () => {
  it('mostra il verdetto del lotto unico e la data di riferimento della fixture', () => {
    render(<App />);
    expect(within(regione('Verdetto')).getByText('Ammissibile con riserva')).toBeTruthy();
    expect(screen.getByLabelText('Data di riferimento')).toHaveProperty('value', '2023-12-20');
  });
  it('elenca il lotto unico e dichiara la classifica in calcolo finché il motore non risponde', async () => {
    render(<App />);
    const lotti = screen.getByRole('navigation', { name: 'Lotti' });
    expect(within(lotti).getAllByRole('button')).toHaveLength(1);
    expect(within(lotti).getAllByText('Calcolo in corso…').length).toBeGreaterThan(0);
    expect(await within(lotti).findByText('Ammissibile con riserva', undefined, LENTO)).toBeTruthy();
    expect(within(lotti).queryByText('Calcolo in corso…')).toBeNull();
  });
  it('cinque requisiti su sei sono da verificare e stanno in riga; l’unico coperto sta raccolto e chiuso', async () => {
    const user = userEvent.setup();
    render(<App />);
    for (const id of ['requisiti-generali', 'registro-imprese', 'registri-di-settore', 'fatturato-globale', 'certificazione-qualita']) {
      expect(within(riga(id)).getByText('Da verificare')).toBeTruthy();
    }
    expect(document.getElementById('requisito-forniture-analoghe')).toBeNull();
    await apriCoperti(user);
    expect(within(riga('forniture-analoghe')).getByText('Coperto')).toBeTruthy();
  });
  it('in riga stanno il nome breve, quanto manca e una frase sola con l’azione', () => {
    render(<App />);
    const fatturato = riga('fatturato-globale');
    expect(within(fatturato).getByText('Fatturato globale')).toBeTruthy();
    expect(within(fatturato).getByText(/^Il bando dà tre valori: coperto con due, scoperto con uno./)).toBeTruthy();
    expect(within(fatturato).getByText('chiarimenti')).toBeTruthy();
    expect(within(fatturato).getByText(/^mancano fino a 35\.000.€$/)).toBeTruthy();
    expect(within(fatturato).queryByText(/maturato complessivamente nel triennio/)).toBeNull();
  });
});

describe('pagina — il documento che non decide', () => {
  it('dichiara che il bando è vero e le imprese no, e mostra i tre modi in cui il bando scrive il valore stimato', () => {
    render(<App />);
    expect(screen.getByText(/Bando reale: ASL Roma 6, gara n\. 9445747/)).toBeTruthy();
    expect(within(regione(/Fornitura di farmaci di fascia A e C/)).getByText(/il documento lo scrive in 3 modi/)).toBeTruthy();
    expect(screen.getByText(/Termine per i chiarimenti/)).toBeTruthy();
  });
  it('sulla riga della ISO convivono le due famiglie: in riga la ragione e la parola, nell’espansione tutto', async () => {
    const user = userEvent.setup();
    render(<App />);
    const iso = riga('certificazione-qualita');
    expect(within(iso).getByText(/^Il disciplinare non dice chi debba possederlo nel raggruppamento\./)).toBeTruthy();
    expect(within(iso).getByText('chiarimenti')).toBeTruthy();
    const dettagli = await apri(user, 'certificazione-qualita');
    expect(within(dettagli).getByText(/^Per Ospedalia Forniture S\.r\.l\. si chiede alla stazione appaltante/)).toBeTruthy();
    expect(within(dettagli).getByText(/Certificazione del sistema di gestione della qualità UNI EN ISO 9001:2015/)).toBeTruthy();
    expect(within(dettagli).getByRole('rowheader', { name: OSPEDALIA })).toBeTruthy();
  });
  it('l’espansione del fatturato mostra le tre letture con il loro esito', async () => {
    const user = userEvent.setup();
    render(<App />);
    const dettagli = await apri(user, 'fatturato-globale');
    expect(within(dettagli).getByText(/Il bando scrive «valore stimato dell'appalto» in più modi/)).toBeTruthy();
    expect(within(dettagli).getAllByText(/^valore stimato dell'appalto = /)).toHaveLength(3);
  });
  it('la mossa proposta nel blocco del verdetto si prova da lì, e copre il fatturato', async () => {
    const user = userEvent.setup();
    render(<App />);
    const verdetto = regione('Verdetto');
    expect(await within(verdetto).findByText(/toglierebbero anche l'incertezza su «Fatturato globale»/, undefined, LENTO)).toBeTruthy();
    const prove = within(verdetto).getAllByRole('button', { name: 'Prova' });
    await user.click(prove[prove.length - 1] as HTMLElement);
    await apriCoperti(user);
    expect(within(riga('fatturato-globale')).getByText('Coperto')).toBeTruthy();
    expect(within(regione('Modifiche')).getByText(/^Prova: Avvalimento di Grossfarma/)).toBeTruthy();
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
    expect(within(regione('Verdetto')).getByText(/Prima sistema i dati: 1 anomalia bloccante/)).toBeTruthy();
    expect(within(regione('Verdetto')).getByText(/totalizzano 75\s% invece del 100/)).toBeTruthy();
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
  it('provare un rimedio dall’espansione del fatturato lo applica come modifica annullabile', async () => {
    const user = userEvent.setup();
    render(<App />);
    const dettagli = await apri(user, 'fatturato-globale');
    const prove = await within(dettagli).findAllByRole('button', { name: 'Prova' }, LENTO);
    // L'ultima mossa applicabile è l'avvalimento di Grossfarma a favore della mandataria.
    await user.click(prove[prove.length - 1] as HTMLElement);

    const composizione = regione('Composizione del raggruppamento');
    expect(within(composizione).getByRole('rowheader', { name: GROSSFARMA })).toBeTruthy();
    expect(within(regione('Modifiche')).getByText(/^Prova: Avvalimento di Grossfarma/)).toBeTruthy();
    // Coperto, la riga passa nel gruppo chiuso dei coperti.
    expect(document.getElementById('requisito-fatturato-globale')).toBeNull();
    await apriCoperti(user);
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
    const dettagli = await apri(user, 'fatturato-globale');
    const prove = await within(dettagli).findAllByRole('button', { name: 'Prova' }, LENTO);
    await user.click(prove[prove.length - 1] as HTMLElement);
    const confronto = await screen.findByRole('region', { name: /Conviene di più/ });
    expect(await within(confronto).findByText('Composizione attuale', undefined, LENTO)).toBeTruthy();
    expect(within(confronto).getByText("Prima dell'ultima prova")).toBeTruthy();
  });
  it('il blocco del verdetto dice la situazione in parole, la scadenza dei chiarimenti, e poi la mossa che toglie un’incertezza', async () => {
    render(<App />);
    const verdetto = regione('Verdetto');
    expect(within(verdetto).getByText('Ammissibile con riserva')).toBeTruthy();
    expect(within(verdetto).getByText('Cinque requisiti su sei restano da verificare: su tre il disciplinare non dice chi debba possederli nel raggruppamento, su uno il documento ammette più letture, su uno serve un giudizio.')).toBeTruthy();
    expect(within(verdetto).getByText('Hai tempo fino alle 12:00 del 27/12/2023 per chiedere chiarimenti su cinque requisiti.')).toBeTruthy();
    expect(within(verdetto).getByRole('status').textContent).toContain('Calcolo del percorso minimo in corso');
    expect(await within(verdetto).findByText('Due mosse toglierebbero anche l\'incertezza su «Fatturato globale»:', undefined, LENTO)).toBeTruthy();
    // Su una prestazione indivisibile ogni ripartizione lascia qualcuno a zero: la mossa è "far entrare", le quote le decide chi usa lo strumento.
    expect(within(verdetto).getByText('Far entrare Grossfarma Centro-Sud senza quote di esecuzione')).toBeTruthy();
    expect(within(verdetto).getByText('L\'avvalimento di Grossfarma Centro-Sud a favore di Farmadistribuzione Laziale su «Fatturato globale»')).toBeTruthy();
  });
  it('oltre il termine dei chiarimenti il blocco lo dice, in rosso e non come lapide', async () => {
    const user = userEvent.setup();
    render(<App />);
    const data = screen.getByLabelText('Data di riferimento');
    await user.clear(data);
    await user.type(data, '2024-01-08');
    expect(within(regione('Verdetto')).getByText('Il termine per i chiarimenti è decorso il 27/12/2023: le ambiguità restano a rischio del concorrente.')).toBeTruthy();
  });
});

describe('pagina — data di riferimento', () => {
  it('alla data iniziale i chiarimenti si possono chiedere entro il 27/12/2023; spostando la data oltre, il termine è decorso', async () => {
    const user = userEvent.setup();
    render(<App />);
    const dettagli = await apri(user, 'certificazione-qualita');
    // I rimedi arrivano dal canale differito: si aspettano.
    expect(await within(dettagli).findByText(/Chiedi chiarimenti alla stazione appaltante entro le 12:00 del 27\/12\/2023/, undefined, LENTO)).toBeTruthy();
    const data = screen.getByLabelText('Data di riferimento');
    await user.clear(data);
    await user.type(data, '2024-01-08');
    // Mentre si digita la data passa per valori malformati e le righe si rimontano: l'espansione si ritrova per id.
    await waitFor(() => expect(within(document.getElementById('dettagli-certificazione-qualita') as HTMLElement).getByText(/Il termine per i chiarimenti .* è decorso/)).toBeTruthy(), LENTO);
  });
  it('la ISO 9001 di Farmadistribuzione diventa un avviso di scadenza quando entra nell’orizzonte', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(within(regione('Avvisi di scadenza')).getByText(/Nessun documento usato scade/)).toBeTruthy();
    const data = screen.getByLabelText('Data di riferimento');
    await user.clear(data);
    await user.type(data, '2024-01-08');
    expect(within(regione('Avvisi di scadenza')).getByText(/certificazione UNI EN ISO 9001:2015/)).toBeTruthy();
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
    await apriCoperti(user);
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
    expect(within(regione('Verdetto')).getByText('Non ammissibile')).toBeTruthy();
    // Senza mandataria le quote non totalizzano più il 100 %: due anomalie bloccanti, non una.
    await waitFor(() => expect(within(regione('Verdetto')).getByText(/Prima sistema i dati: 2 anomalie bloccanti/)).toBeTruthy(), LENTO);
  });
});
