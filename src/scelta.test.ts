import { describe, expect, it } from 'vitest';
import { leggiFascicoli } from './documenti/carica';
import { documentoBando, documentoFascicoli, FILE_BANDO, FILE_FASCICOLI, TESTI } from './documenti/documentiDiProva';
import { descriviErroreDocumento } from './documenti/messaggi';
import { effettoDelleQuote } from './descrizioni';
import { quoteRilevanti } from './engine/rimedi';
import type { Lotto } from './domain';
import {
  controllaConflitti,
  cosaManca,
  impreseDisponibili,
  includiImpresa,
  scegliMandataria,
  SCELTA_VUOTA,
  sceltaPronta,
  type VoceBando,
  type VoceFascicoli,
} from './scelta';

const bandi: VoceBando[] = [{ chiave: 'server:b', origine: 'server', caricato: { file: FILE_BANDO, stato: 'valido', documento: documentoBando } }];
const fascicoli: VoceFascicoli[] = [{ chiave: 'server:f', origine: 'server', caricato: { file: FILE_FASCICOLI, stato: 'valido', documento: documentoFascicoli } }];
const imprese = impreseDisponibili(fascicoli);

describe('scelta — imprese e mandataria', () => {
  it('togliere la mandataria dalle imprese toglie anche la scelta della mandataria', () => {
    const s = scegliMandataria(includiImpresa(SCELTA_VUOTA, 's-ospedalia', true), 's-farmalazio');
    expect(s).toEqual({ imprese: ['s-ospedalia', 's-farmalazio'], mandataria: 's-farmalazio' });
    expect(includiImpresa(s, 's-farmalazio', false)).toEqual({ imprese: ['s-ospedalia'], mandataria: undefined });
  });
  it('scegliere la mandataria la include tra le imprese', () => {
    expect(scegliMandataria(SCELTA_VUOTA, 's-medifarm')).toEqual({ imprese: ['s-medifarm'], mandataria: 's-medifarm' });
  });
  it('le imprese pronte seguono l’ordine dell’elenco, non quello dei clic', () => {
    const s = scegliMandataria({ bando: 'server:b', imprese: ['s-medifarm', 's-farmalazio'] }, 's-medifarm');
    expect(sceltaPronta(s, bandi, imprese)?.imprese).toEqual(['s-farmalazio', 's-medifarm']);
  });
});

describe('scelta — cosa manca', () => {
  it('all’inizio manca tutto, detto in una frase', () => {
    expect(cosaManca(SCELTA_VUOTA, bandi, imprese)).toBe('Per valutare scegli la gara, almeno due imprese e la mandataria.');
  });
  it('con un’impresa sola ne chiede un’altra', () => {
    expect(cosaManca(scegliMandataria({ bando: 'server:b', imprese: [] }, 's-farmalazio'), bandi, imprese)).toBe('Per valutare scegli almeno un’altra impresa.');
  });
  it('senza mandataria lo dice', () => {
    expect(cosaManca({ bando: 'server:b', imprese: ['s-farmalazio', 's-ospedalia'] }, bandi, imprese)).toBe('Per valutare scegli la mandataria.');
  });
  it('una gara non valida non conta come scelta', () => {
    const rotti: VoceBando[] = [{ chiave: 'server:b', origine: 'server', caricato: { file: FILE_BANDO, stato: 'non_valido', errori: [] } }];
    expect(cosaManca(scegliMandataria({ bando: 'server:b', imprese: ['s-ospedalia'] }, 's-farmalazio'), rotti, imprese)).toBe('Per valutare scegli la gara.');
  });
});

describe('scelta — fascicoli caricati dal disco', () => {
  it('un id già usato non entra, e l’errore dice di chi è', () => {
    const caricato = controllaConflitti(leggiFascicoli('miei.json', TESTI[FILE_FASCICOLI]!), imprese);
    expect(caricato.stato).toBe('non_valido');
    const primo = caricato.stato === 'non_valido' ? descriviErroreDocumento(caricato.errori[0]!) : undefined;
    expect(primo).toEqual({
      dove: 'soggetti › «s-farmalazio» › id',
      atteso: `un id non ancora usato: «s-farmalazio» è già di Farmadistribuzione Laziale S.p.A., in ${FILE_FASCICOLI}`,
      trovato: 'il testo «s-farmalazio»',
    });
  });
});

describe('quote — perché non cambiano l’esito', () => {
  const lotto = documentoBando.bando.lotti[0]!;
  it('sulla gara reale la prestazione è indivisibile e nessun requisito guarda chi la esegue', () => {
    expect(quoteRilevanti(lotto)).toBe(false);
    expect(effettoDelleQuote(lotto, quoteRilevanti(lotto))).toBe(
      'Qui le quote non cambiano chi copre cosa: la prestazione è indivisibile e nessun requisito di questo lotto guarda chi la esegue. Contano per i totali, che devono fare 100 %, e chi è a zero non esegue niente.',
    );
  });
  it('se un requisito guarda chi esegue, la frase non c’è', () => {
    const conEsecutore: Lotto = { ...lotto, requisiti: [{ ...lotto.requisiti[0]!, regola: { tipo: 'esecutore_prestazione', prestazioneId: 'fornitura' } }] };
    expect(effettoDelleQuote(conEsecutore, quoteRilevanti(conEsecutore))).toBeUndefined();
  });
  it('con più prestazioni divisibili il perché cambia', () => {
    const divisibile: Lotto = { ...lotto, prestazioni: [{ ...lotto.prestazioni[0]!, natura: 'principale' }, { ...lotto.prestazioni[0]!, id: 'trasporto', natura: 'scorporabile' }] };
    expect(effettoDelleQuote(divisibile, false)).toMatch(/^Qui le quote non cambiano chi copre cosa: nessun requisito di questo lotto guarda chi esegue le prestazioni\./);
  });
});
