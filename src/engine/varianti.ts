// Le varianti di un requisito: il prodotto delle sue letture per i
// candidati di ogni valore del bando a cui la lettura rinvia. Una lettura
// sola con soglie numeriche dà una variante sola: il motore cicla
// comunque, senza un ramo speciale per il caso singolo.
//
// Caso reale (ASL Roma 6): il fatturato rinvia al "valore stimato
// dell'appalto", che il documento scrive in due modi (art. 3.2 p. 10):
// una lettura × tre candidati = tre varianti. Le forniture analoghe
// ammettono due letture (contratto singolo o somma) con un candidato:
// due varianti.

import { assertNever } from '../assertNever';
import type { Bando, Criterio, CriterioRisolto, Dato, DettaglioAnomalia, Importo, Requisito, RequisitoId } from '../domain';
import { formattaEuro } from '../formato';

export type CandidatoScelto = { nome: string; indice: number; valore: Dato<number> };

export type Variante = {
  /** Indice della lettura in `requisito.letture`. */
  lettura: number;
  testoLettura?: string;
  /** Un candidato scelto per ogni valore del bando a cui la lettura rinvia. */
  candidati: CandidatoScelto[];
  criterio: CriterioRisolto;
  /** Leggibile: lettura e candidati, solo dove c'è una scelta da dichiarare. */
  etichetta: string;
  /**
   * Chiave del memo dei contributi per membro: requisito, lettura e minimo
   * unitario risolto. La soglia NON entra: conta solo in composizione, e il
   * contributo di un fascicolo non cambia con la soglia.
   */
  chiaveMemo: string;
};

export type RisoluzioneVarianti = { varianti: Variante[]; anomalie: DettaglioAnomalia[] };

export type MemoVarianti = Map<RequisitoId, RisoluzioneVarianti>;

// ─── Rinvii ──────────────────────────────────────────────────

function eRinvio(importo: Importo | undefined): importo is { rinvio: string } {
  return importo !== undefined && typeof importo !== 'number';
}

/** I nomi dei valori del bando a cui il criterio rinvia, senza ripetizioni. */
export function rinviiDi(criterio: Criterio): string[] {
  const nomi: string[] = [];
  const raccogli = (importo: Importo | undefined) => {
    if (eRinvio(importo) && !nomi.includes(importo.rinvio)) nomi.push(importo.rinvio);
  };
  switch (criterio.tipo) {
    case 'fatturato':
      raccogli(criterio.soglia);
      break;
    case 'servizi':
      raccogli(criterio.importoMinimoUnitario);
      break;
    case 'servizi_importo':
      raccogli(criterio.importoMinimoUnitario);
      raccogli(criterio.soglia);
      break;
    case 'dichiarazione':
    case 'certificazione':
    case 'iscrizione':
    case 'non_determinato':
      break;
    default:
      assertNever(criterio);
  }
  return nomi;
}

/** Vero se il criterio ancora una finestra alla data di pubblicazione. */
function ancoraAllaPubblicazione(criterio: Criterio): boolean {
  switch (criterio.tipo) {
    case 'fatturato':
      return criterio.periodo.tipo === 'a_ritroso' && criterio.periodo.ancoraggio === 'pubblicazione';
    case 'servizi':
    case 'servizi_importo':
      return criterio.ancoraggio === 'pubblicazione';
    case 'dichiarazione':
    case 'certificazione':
    case 'iscrizione':
    case 'non_determinato':
      return false;
    default:
      return assertNever(criterio);
  }
}

/** Il criterio con ogni rinvio sostituito dal candidato scelto. */
function risolvi(criterio: Criterio, scelte: ReadonlyMap<string, number>): CriterioRisolto {
  const numero = (importo: Importo): number => (typeof importo === 'number' ? importo : (scelte.get(importo.rinvio) ?? Number.NaN));
  switch (criterio.tipo) {
    case 'fatturato':
      return { ...criterio, soglia: numero(criterio.soglia) };
    case 'servizi': {
      const { importoMinimoUnitario, ...resto } = criterio;
      return importoMinimoUnitario === undefined ? resto : { ...resto, importoMinimoUnitario: numero(importoMinimoUnitario) };
    }
    case 'servizi_importo': {
      const { importoMinimoUnitario, ...resto } = criterio;
      const base = { ...resto, soglia: numero(criterio.soglia) };
      return importoMinimoUnitario === undefined ? base : { ...base, importoMinimoUnitario: numero(importoMinimoUnitario) };
    }
    case 'dichiarazione':
    case 'certificazione':
    case 'iscrizione':
    case 'non_determinato':
      return criterio;
    default:
      return assertNever(criterio);
  }
}

function minimoUnitarioDi(criterio: CriterioRisolto): number | undefined {
  switch (criterio.tipo) {
    case 'servizi':
    case 'servizi_importo':
      return criterio.importoMinimoUnitario;
    case 'fatturato':
    case 'dichiarazione':
    case 'certificazione':
    case 'iscrizione':
    case 'non_determinato':
      return undefined;
    default:
      return assertNever(criterio);
  }
}

// ─── Etichette ───────────────────────────────────────────────

/** "valore stimato = 966.144,50 € (art. 3.2, p. 10)"; senza nome quando il nome è già detto accanto. */
export function descriviCandidato(candidato: CandidatoScelto, conNome = true): string {
  const { fonte } = candidato.valore;
  const dove = fonte.pagina === undefined ? fonte.riferimento : `${fonte.riferimento}, p. ${fonte.pagina}`;
  const valore = `${formattaEuro(candidato.valore.valore)} (${dove})`;
  return conNome ? `${candidato.nome} = ${valore}` : valore;
}

function etichettaDi(requisito: Requisito, lettura: number, candidati: CandidatoScelto[], bando: Bando): string {
  const parti: string[] = [];
  if (requisito.letture.length > 1) parti.push(requisito.letture[lettura]?.testo ?? `lettura ${lettura + 1}`);
  for (const c of candidati) {
    const valore = bando.valori.find((v) => v.nome === c.nome);
    if (valore && valore.candidati.length > 1) parti.push(descriviCandidato(c));
  }
  return parti.join(' · ');
}

// ─── Risoluzione ─────────────────────────────────────────────

function senzaDuplicati(anomalie: DettaglioAnomalia[]): DettaglioAnomalia[] {
  const viste = new Set<string>();
  return anomalie.filter((a) => {
    const chiave = JSON.stringify(a);
    if (viste.has(chiave)) return false;
    viste.add(chiave);
    return true;
  });
}

/**
 * Tutte le varianti del requisito, oppure le anomalie che impediscono di
 * costruirle: rinvio a un valore che il bando non nomina, valore senza
 * candidati, ancoraggio alla pubblicazione senza data, nessuna lettura.
 * Con anomalie la lista delle varianti è vuota: il requisito non si valuta.
 */
export function varianti(requisito: Requisito, bando: Bando): RisoluzioneVarianti {
  const anomalie: DettaglioAnomalia[] = [];
  if (requisito.letture.length === 0) {
    return { varianti: [], anomalie: [{ codice: 'requisito_senza_letture', requisitoId: requisito.id }] };
  }
  const valori = new Map(bando.valori.map((v) => [v.nome, v]));

  requisito.letture.forEach((lettura) => {
    for (const nome of rinviiDi(lettura.criterio)) {
      const valore = valori.get(nome);
      if (!valore) anomalie.push({ codice: 'rinvio_a_valore_inesistente', requisitoId: requisito.id, nome });
      else if (valore.candidati.length === 0) anomalie.push({ codice: 'valore_bando_senza_candidati', nome });
    }
    if (ancoraAllaPubblicazione(lettura.criterio) && bando.dataPubblicazione === undefined) {
      anomalie.push({ codice: 'ancoraggio_a_pubblicazione_senza_data', requisitoId: requisito.id });
    }
  });
  if (anomalie.length > 0) return { varianti: [], anomalie: senzaDuplicati(anomalie) };

  const risultato: Variante[] = [];
  requisito.letture.forEach((lettura, indiceLettura) => {
    const nomi = rinviiDi(lettura.criterio);
    // Prodotto cartesiano dei candidati, nell'ordine del documento.
    let combinazioni: CandidatoScelto[][] = [[]];
    for (const nome of nomi) {
      const candidati = valori.get(nome)?.candidati ?? [];
      combinazioni = combinazioni.flatMap((parziale) => candidati.map((valore, indice) => [...parziale, { nome, indice, valore }]));
    }
    for (const candidati of combinazioni) {
      const scelte = new Map(candidati.map((c) => [c.nome, c.valore.valore]));
      const criterio = risolvi(lettura.criterio, scelte);
      const minimo = minimoUnitarioDi(criterio);
      risultato.push({
        lettura: indiceLettura,
        testoLettura: lettura.testo,
        candidati,
        criterio,
        etichetta: etichettaDi(requisito, indiceLettura, candidati, bando),
        chiaveMemo: `${requisito.id}#${indiceLettura}${minimo === undefined ? '' : `#min=${minimo}`}`,
      });
    }
  });
  return { varianti: risultato, anomalie: [] };
}

/** Le varianti non dipendono dal raggruppamento: la ricerca dei rimedi le calcola una volta sola. */
export function variantiDi(requisito: Requisito, bando: Bando, memo?: MemoVarianti): RisoluzioneVarianti {
  const memorizzate = memo?.get(requisito.id);
  if (memorizzate) return memorizzate;
  const risolte = varianti(requisito, bando);
  memo?.set(requisito.id, risolte);
  return risolte;
}
