import { describe, expect, it } from 'vitest';
import { estratto, stampaCompatta } from './estratto';
import { FILE_BANDO, TESTI } from './documentiDiProva';
import { FORMA_BANDO } from './formato';

describe('estratto', () => {
  it('di ogni elenco di oggetti tiene quello con più note, e dice quanti ne restano', () => {
    const e = estratto({ elenco: [{ id: 'a' }, { id: 'b', note: { id: 'x', altro: 'y' } }, { id: 'c', note: { id: 'z' } }] });
    expect(e).toEqual({ elenco: [{ id: 'b', note: { id: 'x', altro: 'y' } }, '… altri 2 elementi nel file completo'] });
  });
  it('gli elenchi di valori semplici restano interi', () => {
    expect(estratto({ anni: [2020, 2021, 2022] })).toEqual({ anni: [2020, 2021, 2022] });
  });
  it('sul bando reale sceglie un requisito con le note', () => {
    const e = estratto(JSON.parse(TESTI[FILE_BANDO]!)) as { bando: { lotti: [{ requisiti: [{ id: string; note: object }, string] }] } };
    const [requisito, resto] = e.bando.lotti[0].requisiti;
    expect(Object.keys(requisito.note).length).toBeGreaterThan(1);
    expect(resto).toBe('… altri 5 elementi nel file completo');
  });
});

describe('la forma dei documenti nasce dai validatori', () => {
  it('descrive i campi del bando, con i facoltativi e le varianti delle unioni', () => {
    if (FORMA_BANDO.tipo !== 'oggetto') throw new Error('il documento è un oggetto');
    expect(FORMA_BANDO.campi.map((c) => c.nome)).toEqual(['formato', 'provenienza', 'bando']);
    const bando = FORMA_BANDO.campi[2]!.forma;
    if (bando.tipo !== 'oggetto') throw new Error('il bando è un oggetto');
    expect(bando.campi.find((c) => c.nome === 'dataPubblicazione')?.facoltativo).toBe(true);
    const lotti = bando.campi.find((c) => c.nome === 'lotti')!.forma;
    expect(lotti.tipo === 'elenco' && lotti.nonVuoto).toBe(true);
  });
});

describe('stampa compatta', () => {
  it('tiene su una riga gli oggetti brevi e resta JSON valido con lo stesso contenuto', () => {
    const documento = JSON.parse(TESTI[FILE_BANDO]!);
    const testo = stampaCompatta(documento);
    expect(JSON.parse(testo)).toEqual(documento);
    expect(testo).toContain('"fonte": { "documento": "Disciplinare di gara ASL Roma 6, gara n. 9445747", "riferimento": "frontespizio e art. 1", "pagina": 1 }');
    expect(testo.split('\n').length).toBeLessThan(JSON.stringify(documento, null, 2).split('\n').length);
  });
});
