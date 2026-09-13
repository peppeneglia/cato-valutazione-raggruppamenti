/**
 * Chiude gli switch esaustivi sulle unioni discriminate.
 * Se una variante non è gestita, il parametro non è `never` e il progetto
 * non compila: l'unione cresce, il codice deve seguirla.
 */
export function assertNever(valore: never): never {
  throw new Error(`Variante non gestita: ${JSON.stringify(valore)}`);
}
