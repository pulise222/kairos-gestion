/*
  Datos de ejemplo del prototipo (Fase 0). Cuando exista el backend, estas funciones se
  reemplazan por llamadas a la API; las pantallas no cambian. Dinero: enteros en pesos.
*/
export const negocio = { nombre: 'Servicios Kairos', usuario: 'Juan', rol: 'DUENO' as const }

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
  ventas: 684500,
  ventasAyer: 612000,
  ganancia: 221300,
  gananciaAyer: 198000,
  tickets: 41,
  ticketsAyer: 38,
  metaDia: 800000,
  tendenciaGanancia: [170, 190, 165, 205, 188, 198, 221],
}

export const masVendidos = [
  { nombre: 'Pegante Fénix 1 L', unidades: 64 },
  { nombre: 'Agujas (paquete)', unidades: 51 },
  { nombre: 'Cono de hilo negro', unidades: 47 },
  { nombre: 'Thinner 1 L', unidades: 39 },
  { nombre: 'Sesgo (rollo)', unidades: 33 },
]

export const stockBajo = [
  { id: 3, nombre: 'Pegante Plus 750 ml', stock: 4, minimo: 6, proveedor: 'Químicos del Norte' },
  { id: 12, nombre: 'Aguja industrial #14', stock: 7, minimo: 15, proveedor: 'Hilos y Agujas Andina' },
  { id: 17, nombre: 'Contrafuerte (par)', stock: 2, minimo: 10, proveedor: 'Materiales para Calzado Aguilar' },
]

export const ultimasVentas = [
  { numero: 127, hora: '4:52 p. m.', items: 3, total: 11800, vendedor: 'María' },
  { numero: 126, hora: '4:40 p. m.', items: 5, total: 38400, vendedor: 'María' },
  { numero: 125, hora: '4:31 p. m.', items: 1, total: 4500, vendedor: 'Juan' },
  { numero: 124, hora: '4:18 p. m.', items: 8, total: 72300, vendedor: 'María' },
]
