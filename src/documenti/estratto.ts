// L'estratto di un documento vero, per mostrarne la forma a colpo d'occhio:
// di ogni elenco di oggetti resta un elemento solo — quello con più note,
// perché le note sono la parte che spiega — e al suo posto per gli altri
// una riga che dice quanti ne mancano. Gli elenchi di valori semplici
// (anni, norme) restano interi: sono già brevi.

function numeroNote(valore: unknown): number {
  if (typeof valore !== 'object' || valore === null) return 0;
  const proprie = 'note' in valore && typeof valore.note === 'object' && valore.note !== null ? Object.keys(valore.note).length : 0;
  return proprie + Object.values(valore).reduce<number>((n, v) => n + (typeof v === 'object' ? numeroNote(v) : 0), 0);
}

export function estratto(valore: unknown): unknown {
  if (Array.isArray(valore)) {
    const oggetti = valore.every((v) => typeof v === 'object' && v !== null && !Array.isArray(v));
    if (!oggetti || valore.length <= 1) return valore.map(estratto);
    const scelto = valore.reduce((migliore, v) => (numeroNote(v) > numeroNote(migliore) ? v : migliore), valore[0]);
    const altri = valore.length - 1;
    return [estratto(scelto), `… ${altri === 1 ? 'un altro elemento' : `altri ${altri} elementi`} nel file completo`];
  }
  if (typeof valore === 'object' && valore !== null) {
    return Object.fromEntries(Object.entries(valore).map(([k, v]) => [k, estratto(v)]));
  }
  return valore;
}

const RIGA_MASSIMA = 140;

/** Su una riga, con gli spazi dopo i due punti e le virgole: costruita dalla struttura, senza mai toccare i testi. */
function inLinea(valore: unknown): string {
  if (Array.isArray(valore)) return `[${valore.map(inLinea).join(', ')}]`;
  if (typeof valore === 'object' && valore !== null) {
    const voci = Object.entries(valore).map(([k, v]) => `${JSON.stringify(k)}: ${inLinea(v)}`);
    return voci.length === 0 ? '{}' : `{ ${voci.join(', ')} }`;
  }
  return JSON.stringify(valore);
}

/**
 * JSON rientrato come lo si scrive a mano: un oggetto o un elenco che sta in
 * una riga breve resta su una riga (una fonte, un intervallo di anni), il
 * resto va a capo. Stesso contenuto di JSON.stringify, meno righe.
 */
export function stampaCompatta(valore: unknown, rientro = ''): string {
  const riga = inLinea(valore);
  if (typeof valore !== 'object' || valore === null || riga.length + rientro.length <= RIGA_MASSIMA) return riga;
  const dentro = `${rientro}  `;
  if (Array.isArray(valore)) {
    return `[\n${valore.map((v) => `${dentro}${stampaCompatta(v, dentro)}`).join(',\n')}\n${rientro}]`;
  }
  return `{\n${Object.entries(valore).map(([k, v]) => `${dentro}${JSON.stringify(k)}: ${stampaCompatta(v, dentro)}`).join(',\n')}\n${rientro}}`;
}
