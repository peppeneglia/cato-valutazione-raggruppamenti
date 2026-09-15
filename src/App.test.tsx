// @vitest-environment jsdom
//
// Test di comportamento della pagina: cosa fa, non come appare.
// Niente snapshot: fissano il markup e non dicono niente su cosa fa la pagina.
// I documenti sono quelli veri di public/documenti — la gara reale ASL Roma 6,
// monolotto — serviti da un server finto che legge i file.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { FILE_BANDO, FILE_FASCICOLI, scaricaDaiDocumenti, TESTI } from './documenti/documentiDiProva';

const TESTO_BANDO = TESTI[FILE_BANDO]!;

// Un percorso intero — scelta, caricamento da disco, esito — sono decine di passi utente:
// con gli altri file in parallelo supera i 5 secondi predefiniti senza che niente sia rotto.
vi.setConfig({ testTimeout: 15_000 });

beforeEach(() => {
  vi.stubGlobal('fetch', scaricaDaiDocumenti());
  // jsdom non implementa lo scorrimento della finestra.
  vi.stubGlobal('scrollTo', () => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  // L'indirizzo è stato della pagina (la vista del formato): un test non lo lascia al successivo.
  window.history.replaceState(null, '', '/');
});

const LENTO = { timeout: 4000 };

const FORNITURA = 'Fornitura di farmaci, parafarmaci, dispositivi medici e altro, da grossista con consegna veloce';
const FARMALAZIO = 'Farmadistribuzione Laziale S.p.A.';
const OSPEDALIA = 'Ospedalia Forniture S.r.l.';
const MEDIFARM = 'Medifarm Logistica S.r.l.';
const GROSSFARMA = 'Grossfarma Centro-Sud S.p.A.';
const TITOLO_SCELTA = 'Il raggruppamento può partecipare alla gara?';
const GARA_REALE = /^Fornitura di farmaci di fascia A e C/;

function inizia(nome: string): RegExp {
  return new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
}

type Utente = ReturnType<typeof userEvent.setup>;

/** La schermata iniziale, con i documenti caricati. */
async function apriScelta(): Promise<void> {
  render(<App />);
  await screen.findByRole('heading', { name: TITOLO_SCELTA }, LENTO);
}

async function scegli(user: Utente, imprese: string[], mandataria: string): Promise<void> {
  await user.click(screen.getByRole('radio', { name: GARA_REALE }));
  for (const nome of imprese) await user.click(screen.getByRole('checkbox', { name: inizia(nome) }));
  await user.click(screen.getByRole('radio', { name: `Mandataria: ${mandataria}` }));
}

/**
 * Lo scenario dei test sulla gara reale: la schermata iniziale, la gara, le
 * tre imprese che mostrano i comportamenti del motore, la prima mandataria.
 */
async function avvia(): Promise<void> {
  const user = userEvent.setup();
  await apriScelta();
  await scegli(user, [FARMALAZIO, OSPEDALIA, MEDIFARM], FARMALAZIO);
  await user.click(screen.getByRole('button', { name: 'Valuta il raggruppamento' }));
  await screen.findByRole('region', { name: 'Verdetto' }, LENTO);
}

function fileJson(nome: string, contenuto: string): File {
  return new File([contenuto], nome, { type: 'application/json' });
}

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
  it('mostra il verdetto del lotto unico e la data di riferimento proposta dall’indice', async () => {
    await avvia();
    expect(within(regione('Verdetto')).getByText('Ammissibile con riserva')).toBeTruthy();
    expect(screen.getByLabelText('Data di riferimento')).toHaveProperty('value', '2023-12-20');
  });
  it('elenca il lotto unico e dichiara la classifica in calcolo finché il motore non risponde', async () => {
    await avvia();
    const lotti = screen.getByRole('navigation', { name: 'Lotti' });
    expect(within(lotti).getAllByRole('button')).toHaveLength(1);
    expect(within(lotti).getAllByText('Calcolo in corso…').length).toBeGreaterThan(0);
    expect(await within(lotti).findByText('Ammissibile con riserva', undefined, LENTO)).toBeTruthy();
    expect(within(lotti).queryByText('Calcolo in corso…')).toBeNull();
  });
  it('cinque requisiti su sei sono da verificare e stanno in riga; l’unico coperto sta raccolto e chiuso', async () => {
    const user = userEvent.setup();
    await avvia();
    for (const id of ['requisiti-generali', 'registro-imprese', 'registri-di-settore', 'fatturato-globale', 'certificazione-qualita']) {
      expect(within(riga(id)).getByText('Da verificare')).toBeTruthy();
    }
    expect(document.getElementById('requisito-forniture-analoghe')).toBeNull();
    await apriCoperti(user);
    expect(within(riga('forniture-analoghe')).getByText('Coperto')).toBeTruthy();
  });
  it('in riga stanno il nome breve, quanto manca e una frase sola con l’azione', async () => {
    await avvia();
    const fatturato = riga('fatturato-globale');
    expect(within(fatturato).getByText('Fatturato globale')).toBeTruthy();
    expect(within(fatturato).getByText(/^Il bando dà tre valori: coperto con due, scoperto con uno./)).toBeTruthy();
    expect(within(fatturato).getByText('chiarimenti')).toBeTruthy();
    expect(within(fatturato).getByText(/^mancano fino a 35\.000.€$/)).toBeTruthy();
    expect(within(fatturato).queryByText(/maturato complessivamente nel triennio/)).toBeNull();
  });
});

describe('schermata iniziale', () => {
  it('all’apertura non c’è nessuna valutazione: c’è la domanda, cosa fa e cosa non fa', async () => {
    await apriScelta();
    expect(screen.queryByRole('region', { name: 'Verdetto' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Cosa fa' })).toBeTruthy();
    expect(within(screen.getByRole('main')).getByText(/^Non legge il documento di gara: riceve i requisiti già strutturati\./)).toBeTruthy();
    expect(screen.getByRole('radio', { name: GARA_REALE })).toHaveProperty('checked', false);
    expect(screen.getByRole('button', { name: 'Valuta il raggruppamento' })).toHaveProperty('disabled', true);
    expect(screen.getByText('Per valutare scegli la gara, almeno due imprese e la mandataria.')).toBeTruthy();
  });
  it('con una sola impresa il bottone resta spento e dice cosa manca', async () => {
    const user = userEvent.setup();
    await apriScelta();
    await scegli(user, [], FARMALAZIO);
    expect(screen.getByRole('checkbox', { name: inizia(FARMALAZIO) })).toHaveProperty('checked', true);
    expect(screen.getByRole('button', { name: 'Valuta il raggruppamento' })).toHaveProperty('disabled', true);
    expect(screen.getByText('Per valutare scegli almeno un’altra impresa.')).toBeTruthy();
  });
  it('le quote partono in parti uguali, con l’arrotondamento alla mandataria', async () => {
    await avvia();
    expect(quotaInput(FARMALAZIO, FORNITURA).value).toBe('34');
    expect(quotaInput(OSPEDALIA, FORNITURA).value).toBe('33');
    expect(quotaInput(MEDIFARM, FORNITURA).value).toBe('33');
  });
  it('dall’esito «Cambia gara» torna alla scelta senza ricaricare, e la scelta è ancora lì', async () => {
    const user = userEvent.setup();
    await avvia();
    await user.click(screen.getByRole('button', { name: 'Cambia gara' }));
    await screen.findByRole('heading', { name: TITOLO_SCELTA }, LENTO);
    expect(screen.queryByRole('region', { name: 'Verdetto' })).toBeNull();
    expect(screen.getByRole('radio', { name: GARA_REALE })).toHaveProperty('checked', true);
    expect(screen.getByRole('checkbox', { name: inizia(OSPEDALIA) })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: `Mandataria: ${FARMALAZIO}` })).toHaveProperty('checked', true);
    await user.click(screen.getByRole('button', { name: 'Valuta il raggruppamento' }));
    expect(await screen.findByRole('region', { name: 'Verdetto' }, LENTO)).toBeTruthy();
  });
  it('anche Indietro del browser torna alla scelta', async () => {
    await avvia();
    window.history.back();
    expect(await screen.findByRole('heading', { name: TITOLO_SCELTA }, LENTO)).toBeTruthy();
  });
  it('nel pannello composizione dice perché le quote non cambiano l’esito su questa gara', async () => {
    await avvia();
    expect(within(regione('Composizione del raggruppamento')).getByText(/^Qui le quote non cambiano chi copre cosa: la prestazione è indivisibile e nessun requisito di questo lotto guarda chi la esegue\./)).toBeTruthy();
  });
});

describe('schermata iniziale — caricamento da disco', () => {
  function bandoConOggetto(oggetto: string): string {
    const json = JSON.parse(TESTO_BANDO) as { bando: { id: string; oggetto: string } };
    json.bando.id = 'bando-dal-disco';
    json.bando.oggetto = oggetto;
    return JSON.stringify(json);
  }

  it('un bando valido si aggiunge all’elenco, già scelto, e si valuta', async () => {
    const user = userEvent.setup();
    await apriScelta();
    await user.upload(screen.getByLabelText('Scegli un file JSON'), fileJson('mio-bando.json', bandoConOggetto('Servizio di prova caricato dal disco')));
    expect(await screen.findByText('Bando caricato da mio-bando.json e scelto: «Servizio di prova caricato dal disco».', undefined, LENTO)).toBeTruthy();
    const gara = screen.getByRole('radio', { name: /^Servizio di prova caricato dal disco/ });
    expect(gara).toHaveProperty('checked', true);
    expect(screen.getByText(/dal tuo computer: mio-bando\.json/)).toBeTruthy();
    for (const nome of [FARMALAZIO, OSPEDALIA]) await user.click(screen.getByRole('checkbox', { name: inizia(nome) }));
    await user.click(screen.getByRole('radio', { name: `Mandataria: ${OSPEDALIA}` }));
    await user.click(screen.getByRole('button', { name: 'Valuta il raggruppamento' }));
    expect(await screen.findByRole('region', { name: 'Verdetto' }, LENTO)).toBeTruthy();
    expect(screen.getAllByText('Servizio di prova caricato dal disco').length).toBeGreaterThan(0);
  });
  it('un file scritto a mano con un campo sbagliato mostra subito dove, cosa ci voleva e cosa c’è', async () => {
    const user = userEvent.setup();
    await apriScelta();
    const json = JSON.parse(TESTO_BANDO) as { bando: { lotti: { requisiti: Record<string, unknown>[] }[] } };
    json.bando.lotti[0]!.requisiti[3]!.avvalibbile = true;
    await user.upload(screen.getByLabelText('Scegli un file JSON'), fileJson('scritto-a-mano.json', JSON.stringify(json)));
    const errori = await screen.findByRole('region', { name: 'Errori in scritto-a-mano.json' }, LENTO);
    expect(within(errori).getByText('bando › lotti › «lotto-unico» › requisiti › «fatturato-globale» › avvalibbile')).toBeTruthy();
    expect(within(errori).getByText(/forse «avvalibile»\?$/)).toBeTruthy();
    expect(within(errori).getByText('un campo «avvalibbile» che questo oggetto non prevede')).toBeTruthy();
    expect(screen.getAllByRole('radio', { name: /^Fornitura|^Servizio/ })).toHaveLength(1);
  });
  it('un file che non è JSON dice riga e colonna', async () => {
    const user = userEvent.setup();
    await apriScelta();
    await user.upload(screen.getByLabelText('Scegli un file JSON'), fileJson('rotto.json', '{\n  "formato": {\n    "nome": "requisiti-strutturati",\n  }\n}'));
    const errori = await screen.findByRole('region', { name: 'Errori in rotto.json' }, LENTO);
    expect(within(errori).getByText('Riga 4, colonna 3')).toBeTruthy();
  });
  it('dei fascicoli con un’impresa nuova la aggiungono; con un id già usato dicono di chi è', async () => {
    const user = userEvent.setup();
    await apriScelta();
    const nuovi = JSON.parse(TESTI[FILE_FASCICOLI]!) as { soggetti: { id: string; denominazione: string }[] };
    nuovi.soggetti = [{ ...nuovi.soggetti[0]!, id: 's-nuova', denominazione: 'Nuova Distribuzione S.r.l.' }];
    await user.upload(screen.getByLabelText('Scegli un file JSON'), fileJson('nuova.json', JSON.stringify(nuovi)));
    expect(await screen.findByText('Fascicoli caricati da nuova.json: 1 impresa aggiunta all\'elenco.', undefined, LENTO)).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: inizia('Nuova Distribuzione S.r.l.') })).toBeTruthy();

    await user.upload(screen.getByLabelText('Scegli un file JSON'), fileJson('doppione.json', TESTI[FILE_FASCICOLI]!));
    const errori = await screen.findByRole('region', { name: 'Errori in doppione.json' }, LENTO);
    expect(within(errori).getByText(`un id non ancora usato: «s-farmalazio» è già di ${FARMALAZIO}, in ${FILE_FASCICOLI}`)).toBeTruthy();
  });
});

describe('quesiti aperti', () => {
  it('raccoglie in una card i quesiti per la stazione appaltante, con il termine, pronti da inviare', async () => {
    await avvia();
    const quesiti = await screen.findByRole('region', { name: 'Quesiti aperti' }, LENTO);
    expect(await within(quesiti).findByText('Sette quesiti da inviare alla stazione appaltante entro le 12:00 del 27/12/2023.', undefined, LENTO)).toBeTruthy();
    expect(within(quesiti).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Requisiti generali', 'Registro delle imprese', 'Registri di settore', 'Fatturato globale', 'Certificazione ISO',
    ]);
    expect(within(quesiti).getAllByRole('listitem')).toHaveLength(7);
    expect(within(quesiti).getByText(/^Quale valore di «valore stimato dell'appalto» vale per il requisito/)).toBeTruthy();
  });
  it('oltre il termine dice che andavano posti, e che le ambiguità restano a rischio del concorrente', async () => {
    const user = userEvent.setup();
    await avvia();
    const data = screen.getByLabelText('Data di riferimento');
    await user.clear(data);
    await user.type(data, '2024-01-08');
    const quesiti = regione('Quesiti aperti');
    expect(await within(quesiti).findByText(/^Sette quesiti che andavano posti entro le 12:00 del 27\/12\/2023: il termine è decorso/, undefined, LENTO)).toBeTruthy();
  });
});

describe('cornice: intestazione e piè di pagina', () => {
  /** L'intestazione, ridotta a ciò che contiene: deve essere la stessa in ogni schermata. */
  function contenutoIntestazione(): string[] {
    const intestazione = screen.getByRole('banner');
    return [intestazione.textContent ?? '', ...within(intestazione).getAllByRole('button').map((b) => b.textContent ?? '')];
  }

  it('l’intestazione è la stessa in ogni schermata: il nome e «Cambia gara», nessuna gara', async () => {
    const user = userEvent.setup();
    await apriScelta();
    const nellaScelta = contenutoIntestazione();
    expect(nellaScelta).toEqual(['Cato Valutazione RaggruppamentiCambia gara', 'Cambia gara']);

    await scegli(user, [FARMALAZIO, OSPEDALIA], FARMALAZIO);
    await user.click(screen.getByRole('button', { name: 'Valuta il raggruppamento' }));
    await screen.findByRole('region', { name: 'Verdetto' }, LENTO);
    expect(contenutoIntestazione()).toEqual(nellaScelta);
    // La gara sta intera nel titolo della pagina, non troncata nell'intestazione.
    expect(screen.getByRole('heading', { level: 1, name: GARA_REALE })).toBeTruthy();

    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Cambia gara' }));
    await screen.findByRole('heading', { name: TITOLO_SCELTA }, LENTO);
    await user.click(screen.getByRole('link', { name: /^Il formato che il motore si aspetta/ }));
    await screen.findByRole('heading', { name: 'Il formato dei requisiti strutturati' }, LENTO);
    expect(contenutoIntestazione()).toEqual(nellaScelta);
  });
  it('sulla scelta «Cambia gara» porta alla gara scelta, con il fuoco', async () => {
    const user = userEvent.setup();
    await apriScelta();
    await user.click(screen.getByRole('radio', { name: GARA_REALE }));
    await user.click(screen.getByRole('checkbox', { name: inizia(OSPEDALIA) }));
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Cambia gara' }));
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: GARA_REALE }));
  });
  it('il piè di pagina dichiara il perimetro dai documenti, quello della rete e il repository', async () => {
    await apriScelta();
    const pie = screen.getByRole('contentinfo');
    expect(within(pie).getByText('Il bando disponibile è reale: Disciplinare di gara ASL Roma 6, gara n. 9445747. Le imprese e i loro fascicoli sono di esempio, inventati.')).toBeTruthy();
    expect(within(pie).getByText(/^Nessun servizio esterno, nessun dato che lascia il browser: i documenti sono caricati dallo stesso server che serve la pagina/)).toBeTruthy();
    expect(within(pie).getByText(/^Non legge il documento di gara/)).toBeTruthy();
    expect(within(pie).getByRole('link', { name: 'Il codice sorgente su GitHub' }).getAttribute('href')).toBe('https://github.com/peppeneglia/cato-valutazione-raggruppamenti');
    expect(document.body.textContent).not.toMatch(/nessuna chiamata di rete/i);
  });
});

describe('tornare alla scelta non butta il lavoro', () => {
  async function tornaAllaScelta(user: Utente): Promise<void> {
    await user.click(screen.getByRole('button', { name: 'Cambia gara' }));
    await screen.findByRole('heading', { name: TITOLO_SCELTA }, LENTO);
  }
  async function rientra(user: Utente): Promise<void> {
    await user.click(screen.getByRole('button', { name: 'Valuta il raggruppamento' }));
    await screen.findByRole('region', { name: 'Verdetto' }, LENTO);
  }

  it('stessa gara e stesse imprese: quote e prove restano come erano', async () => {
    const user = userEvent.setup();
    await avvia();
    const input = quotaInput(OSPEDALIA, FORNITURA);
    await user.clear(input);
    await user.type(input, '20');
    await user.tab();
    const passi = within(regione('Modifiche')).getAllByRole('listitem').length;
    await tornaAllaScelta(user);
    await rientra(user);
    expect(quotaInput(OSPEDALIA, FORNITURA).value).toBe('20');
    expect(within(regione('Modifiche')).getAllByRole('listitem')).toHaveLength(passi);
  });
  it('un’impresa in più: chi c’era tiene le quote, la nuova entra a zero, e la storia lo dice', async () => {
    const user = userEvent.setup();
    await avvia();
    await tornaAllaScelta(user);
    await user.click(screen.getByRole('checkbox', { name: inizia(GROSSFARMA) }));
    await rientra(user);
    expect(quotaInput(FARMALAZIO, FORNITURA).value).toBe('34');
    expect(quotaInput(GROSSFARMA, FORNITURA).value).toBe('0');
    expect(within(regione('Modifiche')).getByText(`Dalla scelta delle imprese: entra ${GROSSFARMA} a quota zero.`)).toBeTruthy();
  });
  it('un’impresa in meno: la sua quota passa a chi resta, in proporzione, e la storia lo dice', async () => {
    const user = userEvent.setup();
    await avvia();
    await tornaAllaScelta(user);
    await user.click(screen.getByRole('checkbox', { name: inizia(MEDIFARM) }));
    await rientra(user);
    // 33 % di Medifarm diviso 34:33 → 16,75 e 16,25: a punti interi 16 e 16, e il punto che avanza alla mandataria.
    expect(quotaInput(FARMALAZIO, FORNITURA).value).toBe('51');
    expect(quotaInput(OSPEDALIA, FORNITURA).value).toBe('49');
    expect(within(regione('Modifiche')).getByText(/^Dalla scelta delle imprese: esce Medifarm Logistica S\.r\.l\., e la quota \(33\s%\) passa a/)).toBeTruthy();
  });
  it('un’altra gara: si riparte da capo', async () => {
    const user = userEvent.setup();
    await avvia();
    const input = quotaInput(OSPEDALIA, FORNITURA);
    await user.clear(input);
    await user.type(input, '20');
    await user.tab();
    await tornaAllaScelta(user);
    const altro = JSON.parse(TESTO_BANDO) as { bando: { id: string; oggetto: string } };
    altro.bando.oggetto = 'Un altro bando';
    await user.upload(screen.getByLabelText('Scegli un file JSON'), fileJson('altro.json', JSON.stringify(altro)));
    await screen.findByText(/^Bando caricato da altro\.json/, undefined, LENTO);
    await rientra(user);
    expect(quotaInput(OSPEDALIA, FORNITURA).value).toBe('33');
    expect(within(regione('Modifiche')).getByText(/Nessuna modifica/)).toBeTruthy();
  });
});

describe('la data di riferimento si dichiara', () => {
  it('con la data proposta dall’indice ne dice il motivo, finché non la si cambia', async () => {
    const user = userEvent.setup();
    await avvia();
    expect(screen.getByText('La valutazione parte dal 20/12/2023: prima del termine per i chiarimenti (27/12/2023), così i quesiti sono ancora azionabili; spostandola oltre si vede il termine decorso.')).toBeTruthy();
    const data = screen.getByLabelText('Data di riferimento');
    await user.clear(data);
    await user.type(data, '2024-01-08');
    expect(screen.queryByText(/^La valutazione parte dal 20\/12\/2023/)).toBeNull();
  });
  it('per un bando caricato dal disco dice che, in mancanza di indicazione, si parte da oggi', async () => {
    const user = userEvent.setup();
    await apriScelta();
    const altro = JSON.parse(TESTO_BANDO) as { bando: { oggetto: string } };
    altro.bando.oggetto = 'Bando senza data proposta';
    await user.upload(screen.getByLabelText('Scegli un file JSON'), fileJson('senza-data.json', JSON.stringify(altro)));
    await screen.findByText(/^Bando caricato da senza-data\.json/, undefined, LENTO);
    expect(screen.getAllByText(/^In mancanza di indicazione, la valutazione parte da oggi \(\d{2}\/\d{2}\/\d{4}\)\.$/)).toHaveLength(1);
    for (const nome of [FARMALAZIO, OSPEDALIA]) await user.click(screen.getByRole('checkbox', { name: inizia(nome) }));
    await user.click(screen.getByRole('radio', { name: `Mandataria: ${FARMALAZIO}` }));
    await user.click(screen.getByRole('button', { name: 'Valuta il raggruppamento' }));
    await screen.findByRole('region', { name: 'Verdetto' }, LENTO);
    expect(screen.getByText(/^In mancanza di indicazione, la valutazione parte da oggi/)).toBeTruthy();
  });
});

describe('il formato dei requisiti strutturati', () => {
  it('dalla card del caricamento si apre la pagina del formato: la forma, un estratto vero, il file completo', async () => {
    const user = userEvent.setup();
    await apriScelta();
    const link = screen.getByRole('link', { name: /^Il formato che il motore si aspetta/ });
    expect(link.getAttribute('href')).toBe('?vista=formato');
    await user.click(link);
    expect(await screen.findByRole('heading', { name: 'Il formato dei requisiti strutturati' }, LENTO)).toBeTruthy();
    expect(window.location.search).toBe('?vista=formato');
    const forma = regione('La forma di un bando');
    expect(within(forma).getByText('requisiti')).toBeTruthy();
    expect(within(forma).getAllByText('tipo: «somma_membri»').length).toBeGreaterThan(0);
    expect(within(forma).getAllByText('uno tra «generale», «economico», «certificazione», «referenza», «iscrizione»')).toHaveLength(1);
    const estratto = await screen.findByLabelText('Estratto del documento', undefined, LENTO);
    expect(estratto.textContent).toContain('"note"');
    expect(estratto.textContent).toContain('… altri 5 elementi nel file completo');
    expect(screen.getByText(/^Il file completo, \d+ righe$/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '← Torna alla scelta' }));
    expect(await screen.findByRole('heading', { name: TITOLO_SCELTA }, LENTO)).toBeTruthy();
  });
  it('l’indirizzo del formato apre direttamente la pagina, e «Torna alla scelta» funziona anche così', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?vista=formato');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Il formato dei requisiti strutturati' }, LENTO)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '← Torna alla scelta' }));
    expect(await screen.findByRole('heading', { name: TITOLO_SCELTA }, LENTO)).toBeTruthy();
    expect(window.location.search).toBe('');
  });
});

describe('schermata iniziale — documenti del server', () => {
  async function apriErrori(file: string): Promise<HTMLElement> {
    const user = userEvent.setup();
    const elenco = await screen.findByRole('list', { name: 'Documenti non utilizzabili' }, LENTO);
    await user.click(within(elenco).getByText(/non è utilizzabile/, { selector: 'summary' }));
    return within(elenco).getByRole('region', { name: `Errori in ${file}` });
  }

  it('finché i documenti non arrivano lo dice', async () => {
    render(<App />);
    expect(screen.getByRole('status').textContent).toBe('Caricamento dei documenti…');
    await screen.findByRole('heading', { name: TITOLO_SCELTA }, LENTO);
  });
  it('un bando del server che non è JSON valido non rompe la pagina: resta il caricamento da disco', async () => {
    vi.stubGlobal('fetch', scaricaDaiDocumenti({ [FILE_BANDO]: '{\n  "formato": {\n    "nome": "requisiti-strutturati",\n  }\n}' }));
    render(<App />);
    const errori = await apriErrori(FILE_BANDO);
    expect(within(errori).getByText('Riga 4, colonna 3')).toBeTruthy();
    expect(screen.getByText('Nessuna gara disponibile: caricane una dal tuo computer.')).toBeTruthy();
    expect(screen.getByLabelText('Scegli un file JSON')).toBeTruthy();
  });
  it('un bando del server con un campo sbagliato dice il percorso, cosa si aspettava e cosa ha trovato', async () => {
    const rotto = JSON.parse(TESTO_BANDO) as { bando: { lotti: { requisiti: { regola: { tipo: string } }[] }[] } };
    rotto.bando.lotti[0]!.requisiti[3]!.regola.tipo = 'somma';
    vi.stubGlobal('fetch', scaricaDaiDocumenti({ [FILE_BANDO]: JSON.stringify(rotto) }));
    render(<App />);
    const errori = await apriErrori(FILE_BANDO);
    expect(within(errori).getByText('bando › lotti › «lotto-unico» › requisiti › «fatturato-globale» › regola › tipo')).toBeTruthy();
    expect(within(errori).getByText(/^uno tra «ciascun_membro», «somma_membri»/)).toBeTruthy();
    expect(within(errori).getByText('il testo «somma»')).toBeTruthy();
  });
  it('un indice mancante dice che il file non esiste sul server', async () => {
    vi.stubGlobal('fetch', scaricaDaiDocumenti({ 'indice.json': 404 }));
    render(<App />);
    const errori = await apriErrori('indice.json');
    expect(within(errori).getByText('il file non esiste sul server (404)')).toBeTruthy();
  });
});

describe('pagina — il documento che non decide', () => {
  it('dichiara che il bando è vero e le imprese no, e mostra i tre modi in cui il bando scrive il valore stimato', async () => {
    await avvia();
    expect(screen.getByText('Bando reale: Disciplinare di gara ASL Roma 6, gara n. 9445747. Le imprese e i loro fascicoli sono di esempio, inventati.')).toBeTruthy();
    expect(within(regione(/Fornitura di farmaci di fascia A e C/)).getByText(/il documento lo scrive in 3 modi/)).toBeTruthy();
    expect(screen.getByText(/Termine per i chiarimenti/)).toBeTruthy();
  });
  it('sulla riga della ISO convivono le due famiglie: in riga la ragione e la parola, nell’espansione tutto', async () => {
    const user = userEvent.setup();
    await avvia();
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
    await avvia();
    const dettagli = await apri(user, 'fatturato-globale');
    expect(within(dettagli).getByText(/Il bando scrive «valore stimato dell'appalto» in più modi/)).toBeTruthy();
    expect(within(dettagli).getAllByText(/^valore stimato dell'appalto = /)).toHaveLength(3);
  });
  it('la mossa proposta nel blocco del verdetto si prova da lì, e copre il fatturato', async () => {
    const user = userEvent.setup();
    await avvia();
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
  it('azzerare la quota di un membro lascia le quote a 67 %: anomalia bloccante, e la pagina resta in piedi', async () => {
    const user = userEvent.setup();
    await avvia();
    const input = quotaInput(OSPEDALIA, FORNITURA);
    await user.clear(input);
    await user.type(input, '0');
    expect(within(regione('Verdetto')).getByText(/Prima sistema i dati: 1 anomalia bloccante/)).toBeTruthy();
    expect(within(regione('Verdetto')).getByText(/totalizzano 67\s% invece del 100/)).toBeTruthy();
  });
  it('la bozza locale: un testo non numerico è segnalato, non inviato, e al blur torna il valore reale', async () => {
    const user = userEvent.setup();
    await avvia();
    const input = quotaInput(FARMALAZIO, FORNITURA);
    await user.clear(input);
    await user.type(input, 'abc');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByText(/totalizzano/)).toBeNull();
    await user.tab();
    // Tre imprese in parti uguali: l'arrotondamento va alla mandataria.
    expect(input.value).toBe('34');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });
  it('mentre si digita "6" poi "0" la quota finisce a 60 per cento senza perdere la digitazione', async () => {
    const user = userEvent.setup();
    await avvia();
    const input = quotaInput(OSPEDALIA, FORNITURA);
    await user.clear(input);
    await user.type(input, '60');
    expect(input.value).toBe('60');
    expect(within(regione('Verdetto')).getByText(/totalizzano 127\s% invece del 100/)).toBeTruthy();
  });
});

describe('pagina — prove e annullamento', () => {
  it('provare un rimedio dall’espansione del fatturato lo applica come modifica annullabile', async () => {
    const user = userEvent.setup();
    await avvia();
    const dettagli = await apri(user, 'fatturato-globale');
    const prove = await within(dettagli).findAllByRole('button', { name: 'Prova' }, LENTO);
    // L'ultima mossa applicabile è l'avvalimento di Grossfarma a favore della mandataria.
    await user.click(prove[prove.length - 1] as HTMLElement);

    const composizione = regione('Composizione del raggruppamento');
    expect(within(composizione).getByRole('heading', { name: GROSSFARMA })).toBeTruthy();
    expect(within(regione('Modifiche')).getByText(/^Prova: Avvalimento di Grossfarma/)).toBeTruthy();
    // Coperto, la riga passa nel gruppo chiuso dei coperti.
    expect(document.getElementById('requisito-fatturato-globale')).toBeNull();
    await apriCoperti(user);
    expect(within(riga('fatturato-globale')).getByText('Coperto')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: "Annulla l'ultima modifica" }));
    expect(within(composizione).queryByRole('heading', { name: GROSSFARMA })).toBeNull();
    expect(within(riga('fatturato-globale')).getByText('Da verificare')).toBeTruthy();
    expect(within(regione('Modifiche')).getByText(/Nessuna modifica/)).toBeTruthy();
  });
  it('dopo una prova compare il confronto con la composizione precedente', async () => {
    const user = userEvent.setup();
    await avvia();
    expect(screen.queryByRole('region', { name: /Conviene di più/ })).toBeNull();
    const dettagli = await apri(user, 'fatturato-globale');
    const prove = await within(dettagli).findAllByRole('button', { name: 'Prova' }, LENTO);
    await user.click(prove[prove.length - 1] as HTMLElement);
    const confronto = await screen.findByRole('region', { name: /Conviene di più/ });
    expect(await within(confronto).findByText('Composizione attuale', undefined, LENTO)).toBeTruthy();
    expect(within(confronto).getByText("Prima dell'ultima prova")).toBeTruthy();
  });
  it('il blocco del verdetto dice la situazione in parole, la scadenza dei chiarimenti, e poi la mossa che toglie un’incertezza', async () => {
    await avvia();
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
    await avvia();
    const data = screen.getByLabelText('Data di riferimento');
    await user.clear(data);
    await user.type(data, '2024-01-08');
    expect(within(regione('Verdetto')).getByText('Il termine per i chiarimenti è decorso il 27/12/2023: le ambiguità restano a rischio del concorrente.')).toBeTruthy();
  });
});

describe('pagina — data di riferimento', () => {
  it('alla data iniziale i chiarimenti si possono chiedere entro il 27/12/2023; spostando la data oltre, il termine è decorso', async () => {
    const user = userEvent.setup();
    await avvia();
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
    await avvia();
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
    await avvia();
    // I moduli di aggiunta stanno chiusi: si aprono quando servono.
    await user.click(screen.getByText('Aggiungi un membro'));
    await user.click(screen.getByRole('button', { name: 'Aggiungi al raggruppamento' }));
    expect(within(regione('Composizione del raggruppamento')).getByRole('heading', { name: GROSSFARMA })).toBeTruthy();
    // Una segnalazione: sta nelle note del motore, con il nome e senza identificativi.
    const segnalazioni = regione('Segnalazioni nei dati');
    expect(within(segnalazioni).getByText('Grossfarma Centro-Sud S.p.A. non esegue niente nel lotto unico: tutte le sue quote sono a zero.')).toBeTruthy();
    expect(screen.getByText(/^Note del motore — 1 segnalazione/)).toBeTruthy();
  });
  it('un’ausiliaria aggiunta a mano sul fatturato lo copre sotto ogni lettura; i non avvalibili sono disabilitati con la ragione', async () => {
    const user = userEvent.setup();
    await avvia();
    expect(within(riga('fatturato-globale')).getByText('Da verificare')).toBeTruthy();
    await user.click(screen.getByText("Aggiungi un'ausiliaria"));
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
    await avvia();
    const rigaMandataria = document.getElementById('membro-s-farmalazio');
    if (!rigaMandataria) throw new Error('riga della mandataria non trovata');
    await user.click(within(rigaMandataria).getByRole('button', { name: 'Rimuovi' }));
    expect(within(regione('Verdetto')).getByText('Il raggruppamento non ha una mandataria.')).toBeTruthy();
    expect(within(regione('Verdetto')).getByText('Non ammissibile')).toBeTruthy();
    // Senza mandataria le quote non totalizzano più il 100 %: due anomalie bloccanti, non una.
    await waitFor(() => expect(within(regione('Verdetto')).getByText(/Prima sistema i dati: 2 anomalie bloccanti/)).toBeTruthy(), LENTO);
  });
});
