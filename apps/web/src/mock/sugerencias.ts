/* Categorías sugeridas en el asistente de primer arranque (en este proyecto: las secciones de Kairos). */
// Las siete secciones con las que Kairos organiza sus insumos (el cliente puede cambiarlas, quitarlas o agregar más).
export const CATEGORIAS_SUGERIDAS = [
  { nombre: 'Pegantes', color: '#b8892a' },
  { nombre: 'Soluciones', color: '#2f7fb8' },
  { nombre: 'Tintes y marroquinera', color: '#7c3a5a' },
  { nombre: 'Hilos', color: '#4d9a45' },
  { nombre: 'Agujas', color: '#2e9e8f' },
  { nombre: 'Sesgos y elásticos', color: '#c2543f' },
  { nombre: 'Materiales', color: '#7a6bb8' },
] as const

// Vienen marcadas todas, para que el primer arranque sea solo pulsar «Siguiente».
export const PREDETERMINADAS: string[] = CATEGORIAS_SUGERIDAS.map((c) => c.nombre)

// Colores para las categorías que el dueño escribe a mano (se reparten en orden).
export const COLORES_PROPIOS = ['#5b8a3a', '#a85a8a', '#3a6a9a', '#9a6a3a', '#6a5a9a', '#3a9a7a']
