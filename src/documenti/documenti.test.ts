import { describe, expect, it } from 'vitest';
import { leggiBando, leggiDocumento, leggiFascicoli, leggiJson, type Caricato } from './carica';
import { documentoBando, documentoFascicoli, FILE_BANDO, FILE_FASCICOLI, indice, TESTI } from './documentiDiProva';
import { descriviErroreDocumento, type MessaggioErrore } from './messaggi';

function errori(caricato: Caricato<unknown>): MessaggioErrore[] {
  if (caricato.stato === 'valido') throw new Error('il documento doveva essere non valido');
  return caricato.errori.map(descriviErroreDocumento);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Il documento vero, modificato in un punto: il resto resta valido e non deve produrre rumore. */
function bandoModificato(modifica: (documento: Json) => void): MessaggioErrore[] {
  const json: Json = JSON.parse(TESTI[FILE_BANDO]!);
  modifica(json);
  return errori(leggiBando('bando.json', JSON.stringify(json)));
}

describe('documenti veri', () => {
  it('bando, fascicoli e indice sono validi', () => {
    expect(documentoBando.bando.lotti[0]?.requisiti).toHaveLength(6);
    expect(documentoFascicoli.soggetti.map((s) => s.id)).toEqual(['s-farmalazio', 's-ospedalia', 's-medifarm', 's-grossfarma']);
    expect(indice.bandi.map((b) => b.dataRiferimentoProposta)).toEqual(['2023-12-20']);
  });
  it('le note restano nel file e non arrivano al motore', () => {
    expect(TESTI[FILE_BANDO]).toContain('"note"');
    expect(JSON.stringify(documentoBando)).not.toContain('"note"');
    expect(JSON.stringify(documentoFascicoli)).not.toContain('"note"');
  });
  it('la provenienza la dichiara il documento', () => {
    expect(documentoBando.provenienza).toEqual({ natura: 'reale', documento: 'Disciplinare di gara ASL Roma 6, gara n. 9445747' });
    expect(documentoFascicoli.provenienza.natura).toBe('esempio');
  });
});

describe('errori di struttura: dove, atteso, trovato', () => {
  it('un campo obbligatorio che manca', () => {
    expect(bandoModificato((d) => { delete d.bando.lotti[0].requisiti[3].vincolante; })).toEqual([
      { dove: 'bando › lotti › «lotto-unico» › requisiti › «fatturato-globale» › vincolante', atteso: 'un valore: il campo è obbligatorio', trovato: 'il campo non c\'è' },
    ]);
  });
  it('un valore non ammesso in un’unione, con il suggerimento del nome vicino', () => {
    expect(bandoModificato((d) => { d.bando.lotti[0].requisiti[0].regola.tipo = 'non_dichiarato'; })).toEqual([
      {
        dove: 'bando › lotti › «lotto-unico» › requisiti › «requisiti-generali» › regola › tipo',
        atteso: 'uno tra «ciascun_membro», «somma_membri», «esecutore_prestazione», «almeno_un_membro», «non_dichiarata»; forse «non_dichiarata»?',
        trovato: 'il testo «non_dichiarato»',
      },
    ]);
  });
  it('un numero scritto come testo, con le cifre all’italiana', () => {
    expect(bandoModificato((d) => { d.bando.baseAsta = '750.000'; })).toEqual([
      { dove: 'bando › baseAsta', atteso: 'un numero, senza virgolette né separatori delle migliaia (per esempio 750000 o 966144.5)', trovato: 'il testo «750.000»' },
    ]);
  });
  it('una soglia che non è né un numero né un rinvio', () => {
    const [e] = bandoModificato((d) => { d.bando.lotti[0].requisiti[3].letture[0].criterio.soglia = true; });
    expect(e?.dove).toBe('bando › lotti › «lotto-unico» › requisiti › «fatturato-globale» › letture › elemento n. 1 › criterio › soglia');
    expect(e?.atteso).toMatch(/^un numero, oppure un rinvio a un valore del bando/);
    expect(e?.trovato).toBe('il valore true');
  });
  it('un campo in più è quasi sempre un nome scritto male', () => {
    expect(bandoModificato((d) => { d.bando.lotti[0].requisiti[3].avvalibbile = true; })).toEqual([
      {
        dove: 'bando › lotti › «lotto-unico» › requisiti › «fatturato-globale» › avvalibbile',
        atteso: 'solo i campi «id», «famiglia», «descrizione», «nomeBreve», «letture», «regola», «avvalibile», «vincolante», «fonte»; forse «avvalibile»?',
        trovato: 'un campo «avvalibbile» che questo oggetto non prevede',
      },
    ]);
  });
  it('una nota su un campo che l’oggetto non ha', () => {
    expect(bandoModificato((d) => { d.bando.lotti[0].requisiti[3].note.regolo = 'refuso'; })).toEqual([
      {
        dove: 'bando › lotti › «lotto-unico» › requisiti › «fatturato-globale» › note › regolo',
        atteso: 'il nome di un campo di questo oggetto: «id», «famiglia», «descrizione», «nomeBreve», «letture», «regola», «avvalibile», «vincolante», «fonte»; forse «regola»?',
        trovato: 'una nota su «regolo», che non è un campo di questo oggetto',
      },
    ]);
  });
  it('raccoglie tutti gli errori, non solo il primo', () => {
    const tutti = bandoModificato((d) => {
      d.bando.stazioneAppaltante = 6;
      d.bando.lotti[0].importo = 'tanto';
      delete d.provenienza;
    });
    expect(tutti.map((e) => e.dove)).toEqual(['provenienza', 'bando › stazioneAppaltante', 'bando › lotti › «lotto-unico» › importo']);
  });
  it('una versione del formato che l’applicazione non legge', () => {
    expect(bandoModificato((d) => { d.formato.versione = 2; })).toEqual([{ dove: 'formato › versione', atteso: '«1»', trovato: 'il numero 2' }]);
  });
  it('dei fascicoli con una voce di tipo sconosciuto', () => {
    const json: Json = JSON.parse(TESTI[FILE_FASCICOLI]!);
    json.soggetti[2].fascicolo[5].tipo = 'contratto';
    expect(errori(leggiFascicoli('f.json', JSON.stringify(json)))).toEqual([
      { dove: 'soggetti › «s-medifarm» › fascicolo › elemento n. 6 › tipo', atteso: 'uno tra «fatturato», «certificazione», «servizio», «iscrizione», «dichiarazione»', trovato: 'il testo «contratto»' },
    ]);
  });
});

describe('errori di lettura', () => {
  it('JSON non valido: riga e colonna dalla posizione', () => {
    const r = leggiJson('{\n  "a": 1,\n}');
    expect(r.ok).toBe(false);
    expect(!r.ok && descriviErroreDocumento(r.errore).dove).toBe('Riga 3, colonna 1');
  });
  it('un file vuoto', () => {
    expect(errori(leggiBando('vuoto.json', '  \n'))).toEqual([{ dove: 'Il file', trovato: 'il file è vuoto' }]);
  });
  it('un file scelto dall’utente si riconosce dall’intestazione, non dal nome', () => {
    expect(leggiDocumento('qualunque.json', TESTI[FILE_BANDO]!).genere).toBe('bando');
    expect(leggiDocumento('bando.json', TESTI[FILE_FASCICOLI]!).genere).toBe('fascicoli');
  });
  it('senza un formato riconoscibile lo dice, con il suggerimento', () => {
    const letto = leggiDocumento('x.json', JSON.stringify({ formato: { nome: 'requisiti-strutturato' } }));
    expect(letto.genere).toBe('sconosciuto');
    expect(errori(letto.caricato)).toEqual([
      { dove: 'formato › nome', atteso: '«requisiti-strutturati» per un bando, oppure «fascicoli-imprese» per i fascicoli delle imprese; forse «requisiti-strutturati»?', trovato: 'il testo «requisiti-strutturato»' },
    ]);
    expect(errori(leggiDocumento('x.json', '[1, 2]').caricato)[0]?.trovato).toBe('il campo non c\'è: il documento non dichiara cosa contiene');
  });
});
