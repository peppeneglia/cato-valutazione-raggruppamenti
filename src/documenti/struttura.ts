// Il controllo di struttura di un documento: se il JSON ha la forma che il
// motore si aspetta. Non giudica la coerenza (quote che non tornano, rinvii
// a valori inesistenti): quella resta al motore, come anomalie.
//
// Ogni errore dice dove, cosa si aspettava e cosa ha trovato, e li raccoglie
// tutti invece di fermarsi al primo: chi corregge un file vuole la lista.
//
// I validatori sono tipizzati contro il modello: `oggetto<Requisito>` non
// compila se manca un campo del tipo o se il validatore di un campo produce
// il tipo sbagliato. Il modello e il controllo non possono divergere in
// silenzio.

export type Segmento =
  | { tipo: 'campo'; nome: string }
  /** `indice` parte da zero; `id` c'è quando l'elemento ne dichiara uno, ed è ciò che un umano riconosce. */
  | { tipo: 'elemento'; indice: number; id?: string };

export type ErroreStruttura = {
  percorso: Segmento[];
  atteso: string;
  trovato: string;
};

export type EsitoControllo<T> = { ok: true; valore: T } | { ok: false; errori: ErroreStruttura[] };

/**
 * La forma che un validatore controlla, descritta come dato: la pagina del
 * formato la mostra, e siccome nasce dagli stessi validatori non può dire
 * una cosa diversa da quella che il controllo pretende.
 */
export type Forma =
  | { tipo: 'testo' }
  | { tipo: 'numero' }
  | { tipo: 'booleano' }
  | { tipo: 'letterale'; valori: (string | number | boolean)[] }
  | { tipo: 'elenco'; di: Forma; nonVuoto: boolean }
  | { tipo: 'oggetto'; campi: { nome: string; facoltativo: boolean; forma: Forma }[] }
  | { tipo: 'unione'; chiave: string; varianti: { valore: string; forma: Forma }[] }
  | { tipo: 'alternativa'; opzioni: Forma[] };

export type Validatore<T> = ((valore: unknown, percorso: Segmento[]) => EsitoControllo<T>) & { readonly forma?: Forma };

export function conForma<T>(validatore: (valore: unknown, percorso: Segmento[]) => EsitoControllo<T>, forma: Forma): Validatore<T> {
  return Object.assign(validatore, { forma });
}

export function formaDi(validatore: Validatore<unknown>): Forma {
  if (!validatore.forma) throw new Error('Un validatore senza forma: la pagina del formato non potrebbe descriverlo.');
  return validatore.forma;
}

type Facoltativo<T> = { readonly facoltativo: Validatore<T> };
type CampoDi<V> = undefined extends V ? Facoltativo<Exclude<V, undefined>> : Validatore<V>;
/** Un validatore per ogni campo del tipo, nessuno escluso: i facoltativi lo dichiarano. */
export type Campi<T> = { [K in keyof T]-?: CampoDi<T[K]> };

/** Il campo che ogni oggetto può avere e che il motore non legge: le note di chi ha strutturato il documento. */
export const CAMPO_NOTE = 'note';

// ─── Descrizioni ─────────────────────────────────────────────

const MAX_TESTO = 60;

export function descriviValore(valore: unknown): string {
  if (valore === undefined) return 'nessun valore';
  if (valore === null) return 'null';
  if (typeof valore === 'string') {
    const breve = valore.length > MAX_TESTO ? `${valore.slice(0, MAX_TESTO)}…` : valore;
    return valore === '' ? 'un testo vuoto' : `il testo «${breve}»`;
  }
  if (typeof valore === 'number') return `il numero ${valore}`;
  if (typeof valore === 'boolean') return `il valore ${valore}`;
  if (Array.isArray(valore)) return valore.length === 0 ? 'un elenco vuoto' : `un elenco di ${valore.length} elementi`;
  return 'un oggetto';
}

export function formattaPercorso(percorso: Segmento[]): string {
  if (percorso.length === 0) return 'il documento';
  return percorso
    .map((s) => (s.tipo === 'campo' ? s.nome : s.id !== undefined ? `«${s.id}»` : `elemento n. ${s.indice + 1}`))
    .join(' › ');
}

/** Distanza di modifica, per suggerire il nome giusto quando uno è scritto male. */
function distanza(a: string, b: string): number {
  const riga = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonale = riga[0]!;
    riga[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const sopra = riga[j]!;
      riga[j] = Math.min(sopra + 1, riga[j - 1]! + 1, diagonale + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonale = sopra;
    }
  }
  return riga[b.length]!;
}

export function suggerimento(scritto: string, ammessi: readonly string[]): string {
  const vicino = ammessi
    .map((a) => ({ a, d: distanza(scritto.toLowerCase(), a.toLowerCase()) }))
    .filter((x) => x.d > 0 && x.d <= Math.max(1, Math.floor(x.a.length / 4)))
    .sort((x, y) => x.d - y.d)[0];
  return vicino ? `; forse «${vicino.a}»?` : '';
}

function elencoAmmessi(valori: readonly (string | number | boolean)[]): string {
  return valori.map((v) => `«${String(v)}»`).join(', ');
}

// ─── Primitivi ───────────────────────────────────────────────

function errore<T>(percorso: Segmento[], atteso: string, valore: unknown): EsitoControllo<T> {
  return { ok: false, errori: [{ percorso, atteso, trovato: descriviValore(valore) }] };
}

export const testo: Validatore<string> = conForma((v, p) => (typeof v === 'string' ? { ok: true, valore: v } : errore(p, 'un testo', v)), { tipo: 'testo' });

export const numero: Validatore<number> = conForma((v, p) => {
  if (typeof v === 'number' && Number.isFinite(v)) return { ok: true, valore: v };
  if (typeof v === 'string' && /\d/.test(v)) return errore(p, 'un numero, senza virgolette né separatori delle migliaia (per esempio 750000 o 966144.5)', v);
  return errore(p, 'un numero', v);
}, { tipo: 'numero' });

export const booleano: Validatore<boolean> = conForma((v, p) => (typeof v === 'boolean' ? { ok: true, valore: v } : errore(p, 'true oppure false', v)), { tipo: 'booleano' });

export function letterale<const L extends readonly (string | number | boolean)[]>(...ammessi: L): Validatore<L[number]> {
  return conForma((v, p) => {
    if (ammessi.includes(v as L[number])) return { ok: true, valore: v as L[number] };
    const atteso = ammessi.length === 1 ? elencoAmmessi(ammessi) : `uno tra ${elencoAmmessi(ammessi)}`;
    const aiuto = typeof v === 'string' ? suggerimento(v, ammessi.map(String)) : '';
    return errore(p, `${atteso}${aiuto}`, v);
  }, { tipo: 'letterale', valori: [...ammessi] });
}

export function facoltativo<T>(validatore: Validatore<T>): Facoltativo<T> {
  return { facoltativo: validatore };
}

// ─── Composti ────────────────────────────────────────────────

function eOggetto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function elenco<T>(validatore: Validatore<T>, opzioni: { nonVuoto?: boolean } = {}): Validatore<T[]> {
  return conForma((v, p) => {
    if (!Array.isArray(v)) return errore(p, 'un elenco tra parentesi quadre', v);
    if (opzioni.nonVuoto && v.length === 0) return errore(p, 'un elenco con almeno un elemento', v);
    const valori: T[] = [];
    const errori: ErroreStruttura[] = [];
    v.forEach((elemento, indice) => {
      const id = eOggetto(elemento) && typeof elemento.id === 'string' && elemento.id !== '' ? elemento.id : undefined;
      const r = validatore(elemento, [...p, { tipo: 'elemento', indice, ...(id !== undefined ? { id } : {}) }]);
      if (r.ok) valori.push(r.valore);
      else errori.push(...r.errori);
    });
    return errori.length > 0 ? { ok: false, errori } : { ok: true, valore: valori };
  }, { tipo: 'elenco', di: formaDi(validatore), nonVuoto: opzioni.nonVuoto ?? false });
}

/**
 * Un oggetto con esattamente questi campi. Un campo in più è un errore: è
 * quasi sempre un nome scritto male, e ignorarlo lascerebbe il valore giusto
 * fuori dal motore senza dirlo. Unica eccezione le `note`, le cui chiavi
 * devono essere campi di questo stesso oggetto.
 */
export function oggetto<T>(campi: Campi<T>): Validatore<T> {
  const nomi = Object.keys(campi);
  const voci = Object.entries(campi as Record<string, Validatore<unknown> | Facoltativo<unknown>>);
  const forma: Forma = {
    tipo: 'oggetto',
    campi: voci.map(([nome, c]) => (typeof c === 'function' ? { nome, facoltativo: false, forma: formaDi(c) } : { nome, facoltativo: true, forma: formaDi(c.facoltativo) })),
  };
  return conForma((v, p) => {
    if (!eOggetto(v)) return errore(p, 'un oggetto tra parentesi graffe', v);
    const risultato: Record<string, unknown> = {};
    const errori: ErroreStruttura[] = [];
    for (const nome of nomi) {
      const campo = (campi as Record<string, Validatore<unknown> | Facoltativo<unknown>>)[nome]!;
      const qui: Segmento[] = [...p, { tipo: 'campo', nome }];
      const presente = nome in v && v[nome] !== undefined;
      if (typeof campo !== 'function') {
        if (!presente) continue;
        const r = campo.facoltativo(v[nome], qui);
        if (r.ok) risultato[nome] = r.valore;
        else errori.push(...r.errori);
        continue;
      }
      if (!presente) {
        errori.push({ percorso: qui, atteso: 'un valore: il campo è obbligatorio', trovato: 'il campo non c\'è' });
        continue;
      }
      const r = campo(v[nome], qui);
      if (r.ok) risultato[nome] = r.valore;
      else errori.push(...r.errori);
    }
    for (const chiave of Object.keys(v)) {
      if (nomi.includes(chiave)) continue;
      const qui: Segmento[] = [...p, { tipo: 'campo', nome: chiave }];
      if (chiave === CAMPO_NOTE) {
        errori.push(...controllaNote(v[chiave], qui, nomi));
        continue;
      }
      errori.push({
        percorso: qui,
        atteso: `solo i campi ${elencoAmmessi(nomi)}${suggerimento(chiave, nomi)}`,
        trovato: `un campo «${chiave}» che questo oggetto non prevede`,
      });
    }
    return errori.length > 0 ? { ok: false, errori } : { ok: true, valore: risultato as T };
  }, forma);
}

function controllaNote(note: unknown, percorso: Segmento[], nomi: readonly string[]): ErroreStruttura[] {
  if (!eOggetto(note)) return [{ percorso, atteso: 'un oggetto che associa a un campo il suo testo, per esempio { "regola": "…" }', trovato: descriviValore(note) }];
  const errori: ErroreStruttura[] = [];
  for (const [chiave, testoNota] of Object.entries(note)) {
    const qui: Segmento[] = [...percorso, { tipo: 'campo', nome: chiave }];
    if (!nomi.includes(chiave)) {
      errori.push({
        percorso: qui,
        atteso: `il nome di un campo di questo oggetto: ${elencoAmmessi(nomi)}${suggerimento(chiave, nomi)}`,
        trovato: `una nota su «${chiave}», che non è un campo di questo oggetto`,
      });
    } else if (typeof testoNota !== 'string') {
      errori.push({ percorso: qui, atteso: 'il testo della nota', trovato: descriviValore(testoNota) });
    }
  }
  return errori;
}

/**
 * Un'unione discriminata: il campo `chiave` sceglie la forma. Se manca o non
 * è tra i valori ammessi, l'errore è su quel campo e non su tutti gli altri,
 * che senza la forma non si possono giudicare.
 */
export function unione<T extends Record<C, string>, C extends string>(
  chiave: C,
  campiDelleVarianti: { [K in T[C]]: Campi<Extract<T, Record<C, K>>> },
): Validatore<T> {
  const ammessi = Object.keys(campiDelleVarianti);
  const varianti = Object.fromEntries(
    Object.entries(campiDelleVarianti).map(([nome, campi]) => [nome, oggetto(campi as Campi<T>)]),
  );
  return conForma((v, p) => {
    if (!eOggetto(v)) return errore(p, `un oggetto tra parentesi graffe con il campo «${chiave}»`, v);
    const qui: Segmento[] = [...p, { tipo: 'campo', nome: chiave }];
    const valore = v[chiave];
    if (typeof valore !== 'string' || !ammessi.includes(valore)) {
      const aiuto = typeof valore === 'string' ? suggerimento(valore, ammessi) : '';
      return {
        ok: false,
        errori: [{
          percorso: qui,
          atteso: valore === undefined ? `il campo «${chiave}», uno tra ${elencoAmmessi(ammessi)}` : `uno tra ${elencoAmmessi(ammessi)}${aiuto}`,
          trovato: valore === undefined ? 'il campo non c\'è' : descriviValore(valore),
        }],
      };
    }
    return (varianti as Record<string, Validatore<T>>)[valore]!(v, p);
  }, { tipo: 'unione', chiave, varianti: Object.entries(varianti).map(([valore, v]) => ({ valore, forma: formaDi(v) })) });
}
