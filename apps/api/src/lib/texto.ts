/** Minúsculas y sin tildes: "JABÓN " → "jabon". Misma regla que usa el front para buscar. */
export const normalizar = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
