/* Categorías sugeridas en el asistente de primer arranque. Las primeras cinco son las de la tienda piloto. */
export const CATEGORIAS_SUGERIDAS = [
  { nombre: 'Bebidas', color: '#2f7fb8' },
  { nombre: 'Aseo', color: '#2e9e8f' },
  { nombre: 'Abarrotes', color: '#b8892a' },
  { nombre: 'Lácteos', color: '#7a6bb8' },
  { nombre: 'Snacks', color: '#c2543f' },
  { nombre: 'Carnes y embutidos', color: '#a8443c' },
  { nombre: 'Frutas y verduras', color: '#4d9a45' },
  { nombre: 'Panadería', color: '#c08a4a' },
  { nombre: 'Licores', color: '#7c3a5a' },
  { nombre: 'Papelería', color: '#4a6fa5' },
  { nombre: 'Mascotas', color: '#8a7a3a' },
  { nombre: 'Droguería', color: '#3a8a8a' },
] as const

export const PREDETERMINADAS = ['Bebidas', 'Aseo', 'Abarrotes', 'Lácteos', 'Snacks']

// Colores para las categorías que el dueño escribe a mano (se reparten en orden).
export const COLORES_PROPIOS = ['#5b8a3a', '#a85a8a', '#3a6a9a', '#9a6a3a', '#6a5a9a', '#3a9a7a']
