// Confronto tra stringhe del disciplinare e del fascicolo: spazi ai bordi,
// spazi interni multipli e maiuscole non contano. Nient'altro: qualunque
// equivalenza più profonda è un giudizio semantico e produce "da verificare".

export function normalizza(testo: string): string {
  return testo.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function coincidono(a: string, b: string): boolean {
  return normalizza(a) === normalizza(b);
}

/** Comparatore per l'ordinamento: restituisce 0 sugli uguali, come il contratto di `sort` richiede. */
export function confrontaTesto(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
