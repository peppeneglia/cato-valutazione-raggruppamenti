// Per i test: i documenti veri di `public/documenti`, letti come testo e
// fatti passare dal caricatore come li legge l'applicazione. Nessuna copia
// dei dati nel codice: se il file cambia, i test lo vedono.
//
// Il raggruppamento dei test è una scelta dei test, dichiarata: le tre
// imprese che mostrano i comportamenti del motore sulla gara reale, in parti
// uguali come le propone la pagina. Sulla gara ASL Roma 6 la ripartizione
// delle quote non cambia l'esito: la prestazione è indivisibile e nessun
// requisito lega un minimo a chi la esegue.

import type { Raggruppamento } from '../domain';
import { raggruppamentoInPartiUguali } from '../lavoro';
import { FILE_INDICE, leggiBando, leggiFascicoli, leggiIndice, type Caricato, type Scarica } from './carica';
import testoIndice from '../../public/documenti/indice.json?raw';
import testoBando from '../../public/documenti/bandi/asl-roma-6-9445747.json?raw';
import testoFascicoli from '../../public/documenti/fascicoli/grossisti-farmaceutici-esempio.json?raw';

export const FILE_BANDO = 'bandi/asl-roma-6-9445747.json';
export const FILE_FASCICOLI = 'fascicoli/grossisti-farmaceutici-esempio.json';

export const TESTI: Record<string, string> = {
  [FILE_INDICE]: testoIndice,
  [FILE_BANDO]: testoBando,
  [FILE_FASCICOLI]: testoFascicoli,
};

function valido<T>(caricato: Caricato<T>): T {
  if (caricato.stato !== 'valido') throw new Error(`${caricato.file} non è valido: ${JSON.stringify(caricato.errori)}`);
  return caricato.documento;
}

export const documentoBando = valido(leggiBando(FILE_BANDO, testoBando));
export const documentoFascicoli = valido(leggiFascicoli(FILE_FASCICOLI, testoFascicoli));
export const indice = valido(leggiIndice(FILE_INDICE, testoIndice));

export const bando = documentoBando.bando;
export const soggetti = documentoFascicoli.soggetti;
export const DATA_RIFERIMENTO = indice.bandi.find((b) => b.file === FILE_BANDO)!.dataRiferimentoProposta;

export const raggruppamento: Raggruppamento = raggruppamentoInPartiUguali(bando, ['s-farmalazio', 's-ospedalia', 's-medifarm'], 's-farmalazio');

/** Un server finto che risponde con i file veri; `sostituzioni` simula un file mancante o rotto. */
export function scaricaDaiDocumenti(sostituzioni: Record<string, string | 404> = {}): Scarica {
  return async (url) => {
    const file = Object.keys({ ...TESTI, ...sostituzioni }).find((f) => url.endsWith(`/${f}`) || url === f);
    const contenuto = file === undefined ? 404 : (sostituzioni[file] ?? TESTI[file]!);
    if (contenuto === 404) return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, text: async () => contenuto };
  };
}
