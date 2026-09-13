// Confronto tra stringhe del disciplinare e del fascicolo: spazi ai bordi,
// spazi interni multipli e maiuscole non contano. Nient'altro: qualunque
// equivalenza più profonda è un giudizio semantico e produce "da verificare".

export function normalizza(testo: string): string {
  return testo.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function coincidono(a: string, b: string): boolean {
  return normalizza(a) === normalizza(b);
}
