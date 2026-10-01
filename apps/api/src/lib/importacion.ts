import ExcelJS from 'exceljs'
import { normalizar } from './texto.js'

/*
  Importación de productos desde Excel (.xlsx) o CSV. Dos pasos con las mismas reglas:
    1. leerFilas()   → convierte el archivo en una tabla de texto (sin interpretar nada todavía);
    2. interpretar() → valida fila por fila y decide si cada una CREA un producto o ACTUALIZA uno existente.
  Nada se guarda aquí: lo guarda el módulo de rutas, en una sola transacción y solo si NO hay errores.
*/

export const MAX_FILAS = 2000

/* ───────────── 1. Leer el archivo ───────────── */

/** Un .xlsx es un zip: empieza con "PK". Cualquier otra cosa se trata como CSV. */
const esXlsx = (b: Buffer) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b

function textoDe(b: Buffer): string {
  const utf8 = b.toString('utf-8').replace(/^﻿/, '')
  // Un CSV guardado como "ANSI" (Windows-1252) trae tildes rotas al leerlo como UTF-8: se reintenta como latin1.
  return utf8.includes('�') ? b.toString('latin1') : utf8
}

/** CSV simple: comillas, comillas dobles escapadas, y separador «;» (Excel en español), «,» o tabulador. */
export function parsearCsv(texto: string): string[][] {
  const primera = texto.split(/\r?\n/, 1)[0] ?? ''
  const cuenta = (c: string) => primera.split(c).length - 1
  const sep = cuenta(';') >= cuenta(',') && cuenta(';') >= cuenta('\t') && cuenta(';') > 0 ? ';' : cuenta('\t') > cuenta(',') ? '\t' : ','
  const filas: string[][] = []
  let fila: string[] = []
  let celda = ''
  let entreComillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!
    if (entreComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { celda += '"'; i++ } else entreComillas = false
      } else celda += c
    } else if (c === '"') entreComillas = true
    else if (c === sep) { fila.push(celda); celda = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(celda); celda = ''
      filas.push(fila); fila = []
    } else celda += c
  }
  if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila) }
  return filas.filter((f) => f.some((c) => c.trim() !== ''))
}

function valorDeCelda(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    if ('result' in v) return valorDeCelda(v.result as ExcelJS.CellValue) // fórmula: se usa su resultado
    if ('richText' in v) return v.richText.map((r) => r.text).join('')
    if ('text' in v) return String(v.text)
    if (v instanceof Date) return v.toISOString()
  }
  return String(v)
}

export async function leerFilas(archivo: Buffer): Promise<string[][]> {
  if (!esXlsx(archivo)) return parsearCsv(textoDe(archivo))
  const libro = new ExcelJS.Workbook()
  try {
    await libro.xlsx.load(archivo as unknown as ArrayBuffer)
  } catch {
    throw new Error('No se pudo leer el archivo de Excel. Guárdalo de nuevo como .xlsx o como CSV.')
  }
  const hoja = libro.getWorksheet('Productos') ?? libro.worksheets[0]
  if (!hoja) throw new Error('El archivo no tiene hojas.')
  const filas: string[][] = []
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    const celdas: string[] = []
    for (let c = 1; c <= Math.max(fila.cellCount, 1); c++) celdas.push(valorDeCelda(fila.getCell(c).value).trim())
    if (celdas.some((c) => c !== '')) filas.push(celdas)
  })
  return filas
}

/* ───────────── 2. Interpretar ───────────── */

type Campo = 'codigo' | 'nombre' | 'descripcion' | 'categoria' | 'proveedor' | 'costo' | 'precio' | 'stock' | 'minimo'

const ALIAS: Record<Campo, string[]> = {
  codigo: ['codigo', 'cod', 'referencia', 'sku', 'codigo de barras'],
  nombre: ['nombre', 'producto', 'nombre del producto', 'articulo'],
  descripcion: ['descripcion', 'detalle'],
  categoria: ['categoria'],
  proveedor: ['proveedor'],
  costo: ['costo', 'costo unitario', 'precio de compra', 'costo compra'],
  precio: ['precio', 'precio venta', 'precio de venta', 'pvp'],
  stock: ['stock', 'stock inicial', 'existencias', 'cantidad', 'inventario'],
  minimo: ['minimo', 'stock minimo', 'stock min'],
}

const NOMBRES_CAMPO: Record<Campo, string> = { codigo: 'Código', nombre: 'Nombre', descripcion: 'Descripción', categoria: 'Categoría', proveedor: 'Proveedor', costo: 'Costo', precio: 'Precio', stock: 'Stock', minimo: 'Stock mínimo' }
export const ENCABEZADOS_PLANTILLA = Object.values(NOMBRES_CAMPO)

/** Entero en pesos: acepta 1500, "1.500", "$ 1,500", "1500 " … y rechaza decimales y letras. */
export function aEntero(t: string): number | null {
  const limpio = t.replace(/[$\s]/g, '')
  if (limpio === '') return null
  // Miles con punto o coma («1.500», «12,500,000»). Un punto/coma seguido de 1-2 dígitos al final es decimal → inválido.
  if (/^\d{1,3}([.,]\d{3})+$/.test(limpio)) return Number(limpio.replace(/[.,]/g, ''))
  if (/^\d+$/.test(limpio)) return Number(limpio)
  return null
}

export interface ContextoImportacion {
  /** Productos existentes: código en minúsculas → datos mínimos (para decidir crear o actualizar). */
  existentes: Map<string, { id: number; nombre: string }>
  categorias: Set<string> // nombres normalizados
  proveedores: Set<string>
}

export interface FilaImportada {
  /** Número de fila en el archivo (la 1 es el encabezado). */
  fila: number
  accion: 'crear' | 'actualizar'
  codigo: string | null
  nombre: string
  descripcion: string | null
  categoria: string
  proveedor: string | null
  costo: number
  precio: number
  stock: number
  minimo: number | null
  productoId?: number
  avisos: string[]
}

export interface ResultadoInterpretacion {
  filas: FilaImportada[]
  errores: { fila: number; campo: string; mensaje: string }[]
  categoriasNuevas: string[]
  proveedoresNuevos: string[]
}

export function interpretar(tabla: string[][], ctx: ContextoImportacion): ResultadoInterpretacion {
  const errores: ResultadoInterpretacion['errores'] = []
  const vacio = { filas: [], errores, categoriasNuevas: [], proveedoresNuevos: [] }
  if (tabla.length === 0) { errores.push({ fila: 1, campo: 'Archivo', mensaje: 'El archivo está vacío.' }); return vacio }

  // Qué columna es cuál, por el nombre del encabezado (sin importar tildes, mayúsculas ni el orden).
  const encabezado = tabla[0]!.map((h) => normalizar(h).replace(/[*]/g, '').trim())
  const col = {} as Record<Campo, number>
  for (const campo of Object.keys(ALIAS) as Campo[]) col[campo] = encabezado.findIndex((h) => ALIAS[campo].includes(h))
  const faltan = (['nombre', 'categoria', 'costo', 'precio'] as Campo[]).filter((c) => col[c] < 0)
  if (faltan.length) {
    errores.push({ fila: 1, campo: 'Encabezado', mensaje: `Faltan las columnas: ${faltan.map((c) => NOMBRES_CAMPO[c]).join(', ')}. Usa la plantilla para no equivocarte.` })
    return vacio
  }
  const datos = tabla.slice(1)
  if (datos.length === 0) { errores.push({ fila: 2, campo: 'Archivo', mensaje: 'No hay productos debajo del encabezado.' }); return vacio }
  if (datos.length > MAX_FILAS) { errores.push({ fila: 1, campo: 'Archivo', mensaje: `Máximo ${MAX_FILAS} productos por archivo (trae ${datos.length}). Divídelo en partes.` }); return vacio }

  const filas: FilaImportada[] = []
  const codigosVistos = new Map<string, number>() // código → fila donde apareció
  const catNuevas = new Map<string, string>() // normalizado → nombre original
  const provNuevos = new Map<string, string>()
  const celda = (f: string[], c: Campo) => (col[c] >= 0 ? (f[col[c]] ?? '').trim() : '')

  datos.forEach((f, i) => {
    const fila = i + 2 // +1 por el encabezado, +1 porque Excel cuenta desde 1
    const malos: string[] = []
    const err = (campo: Campo, mensaje: string) => { errores.push({ fila, campo: NOMBRES_CAMPO[campo], mensaje }); malos.push(campo) }
    const avisos: string[] = []

    const nombre = celda(f, 'nombre')
    if (!nombre) err('nombre', 'Falta el nombre del producto.')
    else if (nombre.length > 120) err('nombre', 'El nombre pasa de 120 caracteres.')

    const codigoTxt = celda(f, 'codigo')
    let codigo: string | null = null
    if (codigoTxt) {
      if (codigoTxt.length > 40) err('codigo', 'El código pasa de 40 caracteres.')
      else if (!/^[\w.-]+$/.test(codigoTxt)) err('codigo', 'El código solo puede tener letras, números, punto y guion (sin espacios).')
      else {
        codigo = codigoTxt
        const clave = codigo.toLowerCase()
        if (codigosVistos.has(clave)) err('codigo', `El código ${codigo} ya aparece en la fila ${codigosVistos.get(clave)}.`)
        else codigosVistos.set(clave, fila)
      }
    }

    const descripcion = celda(f, 'descripcion') || null
    if (descripcion && descripcion.length > 500) err('descripcion', 'La descripción pasa de 500 caracteres.')

    const categoria = celda(f, 'categoria')
    if (!categoria) err('categoria', 'Falta la categoría.')
    else if (categoria.length > 60) err('categoria', 'La categoría pasa de 60 caracteres.')
    else if (!ctx.categorias.has(normalizar(categoria)) && !catNuevas.has(normalizar(categoria))) catNuevas.set(normalizar(categoria), categoria)

    const proveedor = celda(f, 'proveedor') || null
    if (proveedor) {
      if (proveedor.length > 100) err('proveedor', 'El proveedor pasa de 100 caracteres.')
      else if (!ctx.proveedores.has(normalizar(proveedor)) && !provNuevos.has(normalizar(proveedor))) provNuevos.set(normalizar(proveedor), proveedor)
    }

    const numero = (c: Campo, obligatorio: boolean, min: number): number | null => {
      const t = celda(f, c)
      if (t === '') { if (obligatorio) err(c, `Falta el ${NOMBRES_CAMPO[c].toLowerCase()}.`); return null }
      const n = aEntero(t)
      if (n === null) { err(c, `«${t}» no es un número entero válido (sin decimales ni letras).`); return null }
      if (n < min) { err(c, min > 0 ? `El ${NOMBRES_CAMPO[c].toLowerCase()} debe ser mayor que 0.` : `El ${NOMBRES_CAMPO[c].toLowerCase()} no puede ser negativo.`); return null }
      if (n > 100_000_000) { err(c, 'El valor es demasiado grande.'); return null }
      return n
    }
    const costo = numero('costo', true, 0)
    const precio = numero('precio', true, 1)
    const stock = numero('stock', false, 0)
    const minimo = numero('minimo', false, 0)
    if (costo !== null && precio !== null && precio < costo) avisos.push('Se vende por debajo del costo.')

    const existente = codigo ? ctx.existentes.get(codigo.toLowerCase()) : undefined
    if (existente && stock !== null) avisos.push('El stock de un producto que ya existe no se cambia aquí (usa «Conteo físico» en Inventario).')

    if (malos.length === 0) {
      filas.push({
        fila, accion: existente ? 'actualizar' : 'crear', codigo, nombre, descripcion, categoria, proveedor,
        costo: costo!, precio: precio!, stock: existente ? 0 : stock ?? 0, minimo, productoId: existente?.id, avisos,
      })
    }
  })

  return { filas, errores, categoriasNuevas: [...catNuevas.values()], proveedoresNuevos: [...provNuevos.values()] }
}

/** La plantilla que descarga el dueño: encabezados, ejemplos y una hoja de instrucciones. */
export async function plantillaExcel(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook()
  const hoja = libro.addWorksheet('Productos')
  hoja.columns = ENCABEZADOS_PLANTILLA.map((h, i) => ({ header: i < 1 ? h : h, key: h, width: h === 'Descripción' ? 34 : h === 'Nombre' ? 30 : 16 }))
  const fila = hoja.getRow(1)
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB0481F' } }
  hoja.views = [{ state: 'frozen', ySplit: 1 }]
  hoja.addRow(['APEQ1', 'Agua 600 ml', 'Botella plástica sin gas', 'Bebidas', 'Distribuciones Andina', 800, 1500, 24, 6])
  hoja.addRow(['', 'Cuaderno rayado 100 hojas', '', 'Papelería', '', 2800, 4500, 10, 3])

  const ayuda = libro.addWorksheet('Instrucciones')
  ayuda.getColumn(1).width = 110
  for (const l of [
    'CÓMO LLENAR LA PLANTILLA',
    '1. Una fila por producto. No cambies los nombres de las columnas (el orden sí puede cambiar).',
    '2. Obligatorios: Nombre, Categoría, Costo y Precio. El resto es opcional.',
    '3. Código: si lo dejas vacío, el sistema le pone el siguiente número. Si ya existe un producto con ese código, se ACTUALIZA (nombre, descripción, categoría, proveedor, costo, precio y mínimo).',
    '4. Costo y Precio: pesos enteros, sin decimales (ej. 1500 o 1.500).',
    '5. Stock: la cantidad inicial de los productos NUEVOS. El stock de los que ya existen no se cambia aquí; para eso usa «Conteo físico» en Inventario.',
    '6. Si la categoría o el proveedor no existen, se crean solos.',
    '7. Antes de guardar nada verás una vista previa con los errores marcados. Si hay errores, no se guarda nada.',
    '8. Borra las 2 filas de ejemplo antes de subir el archivo.',
  ]) ayuda.addRow([l])
  ayuda.getRow(1).font = { bold: true }
  return Buffer.from(await libro.xlsx.writeBuffer())
}
