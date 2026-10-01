/*
  Datos de ejemplo del prototipo (Fase 0). Cuando exista el backend, estas funciones se
  reemplazan por llamadas a la API; las pantallas no cambian. Dinero: enteros en pesos.
*/
export const negocio = { nombre: 'Tienda Don Pepe', usuario: 'Juan', rol: 'DUENO' as const }

export const ventasSemana = [
  { dia: 'Mié', total: 842000 },
  { dia: 'Jue', total: 910500 },
  { dia: 'Vie', total: 1320000 },
  { dia: 'Sáb', total: 1685000 },
  { dia: 'Dom', total: 1105000 },
  { dia: 'Lun', total: 1148000 },
  { dia: 'Hoy', total: 1284500 },
]

export const resumenHoy = {
  ventas: 1284500,
  ventasAyer: 1148000,
  ganancia: 412300,
  gananciaAyer: 381000,
  tickets: 48,
  ticketsAyer: 43,
  metaDia: 1800000,
  tendenciaGanancia: [310, 340, 290, 380, 360, 381, 412],
}

export const masVendidos = [
  { nombre: 'Gaseosa 1.5 L', unidades: 64 },
  { nombre: 'Pan tajado', unidades: 51 },
  { nombre: 'Leche 1 L', unidades: 47 },
  { nombre: 'Huevos x12', unidades: 39 },
  { nombre: 'Arroz 1 kg', unidades: 33 },
]

export const stockBajo = [
  { id: 1, nombre: 'Gaseosa 1.5 L', stock: 3, minimo: 12, proveedor: 'Distribuciones Andina' },
  { id: 2, nombre: 'Galletas de sal', stock: 8, minimo: 10, proveedor: 'Alimentos del Valle' },
  { id: 3, nombre: 'Detergente 1 kg', stock: 2, minimo: 6, proveedor: 'Aseo Total' },
]

export const ultimasVentas = [
  { numero: 127, hora: '4:52 p. m.', items: 3, total: 11800, vendedor: 'María' },
  { numero: 126, hora: '4:40 p. m.', items: 5, total: 38400, vendedor: 'María' },
  { numero: 125, hora: '4:31 p. m.', items: 1, total: 4500, vendedor: 'Juan' },
  { numero: 124, hora: '4:18 p. m.', items: 8, total: 72300, vendedor: 'María' },
]
