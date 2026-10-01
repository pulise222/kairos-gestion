import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { ImagePlus, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { Button } from '../ui/Button'
import { Campo } from '../ui/Campo'
import { CampoDinero } from '../ui/CampoDinero'
import { Interruptor } from '../ui/Interruptor'
import { PanelLateral } from '../ui/PanelLateral'
import { Selector } from '../ui/Selector'
import { useAviso } from '../ui/Avisos'
import { ErrorApi, mensajeDe } from '../../api/cliente'
import { useEnvioUnico } from '../../lib/envio'
import { useCatalogo } from '../../data/contexto'
import { margen } from '../../lib/busqueda'
import { problemaDeImagen, reducirImagen } from '../../lib/imagen'
import { COLORES_PROPIOS } from '../../mock/sugerencias'
import { Miniatura } from './Miniatura'
import { pesos } from '../../lib/dinero'
import type { Producto } from '../../mock/catalogo'

const MAX = 100_000_000

/* Mismas reglas que el backend (que vuelve a validar todo): el formulario solo ayuda a corregir rápido. */
const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre del producto').max(120, 'Máximo 120 caracteres'),
  // Vacío = el sistema asigna el siguiente número. Si se escribe, sin espacios (así el lector de barras siempre coincide).
  codigo: z.string().trim().max(40, 'Máximo 40 caracteres').regex(/^[\w.-]*$/, 'Solo letras, números, punto y guion (sin espacios)'),
  descripcion: z.string().trim().max(500, 'Máximo 500 caracteres'),
  categoriaId: z.string().min(1, 'Elige una categoría'),
  proveedorId: z.string(), // "" = sin proveedor
  costo: z.number().int().min(0).max(MAX, 'Valor demasiado grande'),
  precio: z.number().int().min(1, 'El precio debe ser mayor que 0').max(MAX, 'Valor demasiado grande'),
  stockInicial: z.number().int().min(0).max(100_000, 'Valor demasiado grande'),
  minimo: z.number().int().min(0).max(100_000, 'Valor demasiado grande'),
  activo: z.boolean(),
})
type Valores = z.infer<typeof esquema>

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** Si viene un producto, se edita; si no, se crea uno nuevo. */
  producto?: Producto
}

const vacio: Valores = { nombre: '', codigo: '', descripcion: '', categoriaId: '', proveedorId: '', costo: 0, precio: 0, stockInicial: 0, minimo: 0, activo: true }

export function ProductoFormulario({ abierto, onCerrar, producto }: Props) {
  const { categorias, proveedores, crearProducto, editarProducto, codigoEnUso, subirImagenProducto, quitarImagenProducto, crearCategoria } = useCatalogo()
  const avisar = useAviso()
  const editando = !!producto

  const { enviando, ejecutar } = useEnvioUnico()

  // Foto: undefined = sin cambios, Blob = foto nueva elegida (ya reducida), null = quitar la que tiene.
  const [foto, setFoto] = useState<Blob | null | undefined>(undefined)
  const [vistaFoto, setVistaFoto] = useState<string | null>(null)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const entradaFoto = useRef<HTMLInputElement>(null)

  // Categoría nueva sin salir del formulario (null = cerrado).
  const [nuevaCat, setNuevaCat] = useState<string | null>(null)
  const [errorCat, setErrorCat] = useState<string | null>(null)

  const { register, control, handleSubmit, reset, setValue, setError, watch, formState: { errors } } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: vacio,
  })

  // Cada vez que se abre el panel, el formulario parte de los datos del producto (o vacío si es nuevo).
  useEffect(() => {
    if (!abierto) return
    setFoto(undefined); setVistaFoto(null); setErrorFoto(null); setNuevaCat(null); setErrorCat(null)
    reset(producto
      ? { nombre: producto.nombre, codigo: producto.codigo, descripcion: producto.descripcion ?? '', categoriaId: producto.categoriaId, proveedorId: producto.proveedorId ? String(producto.proveedorId) : '', costo: producto.costo, precio: producto.precio, stockInicial: 0, minimo: producto.minimo, activo: producto.activo }
      : vacio)
  }, [abierto, producto, reset])

  // ¿Hay una foto que mostrar? (la recién elegida, o la guardada si no la van a quitar)
  const tieneFoto = !!vistaFoto || (!!producto?.imagen && foto !== null)
  const costo = watch('costo')
  const precio = watch('precio')
  const m = margen(precio || 0, costo || 0)
  const aPerdida = precio > 0 && precio < costo

  // La vista previa de una foto nueva usa una dirección temporal que hay que liberar.
  useEffect(() => () => { if (vistaFoto) URL.revokeObjectURL(vistaFoto) }, [vistaFoto])

  async function elegirFoto(archivo: File | undefined) {
    if (!archivo) return
    const problema = problemaDeImagen(archivo)
    if (problema) { setErrorFoto(problema); return }
    setErrorFoto(null)
    setProcesando(true)
    try {
      const reducida = await reducirImagen(archivo)
      setFoto(reducida)
      setVistaFoto(URL.createObjectURL(reducida))
    } catch (e) {
      setErrorFoto(e instanceof Error ? e.message : 'No se pudo preparar la foto.')
    } finally {
      setProcesando(false)
      if (entradaFoto.current) entradaFoto.current.value = '' // permite elegir otra vez la misma foto
    }
  }

  // Quitar: descarta la foto recién elegida y, si el producto ya tenía una guardada, marca que se borre al guardar.
  function quitarFoto() {
    setVistaFoto(null)
    setFoto(producto?.imagen ? null : undefined)
  }

  async function agregarCategoria() {
    const nombre = (nuevaCat ?? '').trim()
    if (!nombre) { setErrorCat('Escribe el nombre de la categoría'); return }
    try {
      const c = await crearCategoria(nombre, COLORES_PROPIOS[categorias.length % COLORES_PROPIOS.length]!)
      setValue('categoriaId', c.id, { shouldValidate: true })
      setNuevaCat(null); setErrorCat(null)
    } catch (e) {
      setErrorCat(mensajeDe(e))
    }
  }

  const guardar = handleSubmit((v) => ejecutar(async () => {
    if (v.codigo && codigoEnUso(v.codigo, producto?.id)) {
      setError('codigo', { message: 'Ya existe un producto con ese código' })
      return
    }
    const datos = {
      nombre: v.nombre, codigo: v.codigo, descripcion: v.descripcion, categoriaId: v.categoriaId, proveedorId: v.proveedorId ? Number(v.proveedorId) : null,
      costo: v.costo, precio: v.precio, minimo: v.minimo, activo: v.activo,
    }
    try {
      let id: number
      if (producto) {
        // En edición, si dejan el código vacío se conserva el que ya tenía.
        await editarProducto(producto.id, { ...datos, codigo: v.codigo || producto.codigo })
        id = producto.id
      } else {
        id = (await crearProducto(datos, v.stockInicial)).id
      }
      // La foto va después: si falla, el producto ya quedó guardado y se avisa qué pasó (no se pierde el trabajo).
      let avisoFoto = ''
      try {
        if (foto) await subirImagenProducto(id, foto)
        else if (foto === null && producto?.imagen) await quitarImagenProducto(id)
      } catch (e) {
        avisoFoto = ` Pero la foto no se pudo guardar: ${mensajeDe(e)} Puedes intentarlo de nuevo con «Editar».`
      }
      avisar(`«${v.nombre}» ${editando ? 'actualizado' : 'creado'}.${avisoFoto}`, avisoFoto ? 'alerta' : 'ok')
      onCerrar()
    } catch (e) {
      // El servidor es la última palabra: si el código ya existía (otro dispositivo lo creó hace un instante), se marca en el campo.
      if (e instanceof ErrorApi && e.codigo === 'CODIGO_EXISTE') setError('codigo', { message: e.message })
      else avisar(mensajeDe(e), 'alerta')
    }
  }))

  return (
    <PanelLateral
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={editando ? 'Editar producto' : 'Nuevo producto'}
      subtitulo={editando ? `Código ${producto.codigo}` : 'Llena lo básico; lo demás puedes ajustarlo después.'}
      pie={
        <div className="flex gap-2">
          <Button variante="secundario" className="flex-1" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" form="form-producto" className="flex-1" disabled={enviando}>{enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear producto'}</Button>
        </div>
      }
    >
      <form id="form-producto" onSubmit={guardar} noValidate className="space-y-4">
        <Campo etiqueta="Nombre del producto" autoFocus placeholder="Ej. Gaseosa 1.5 L" error={errors.nombre?.message} {...register('nombre')} />

        <div>
          <Campo
            etiqueta="Código (opcional)"
            placeholder="Ej. APEQ1 · o escanea el código de barras"
            error={errors.codigo?.message}
            className="tabular"
            {...register('codigo')}
          />
          {!errors.codigo && <p className="mt-1.5 text-xs text-muted">{editando ? 'Puedes cambiarlo; no puede repetirse.' : 'Si lo dejas vacío, el sistema le pone el siguiente número (0001, 0002…). Con el lector, escanea aquí.'}</p>}
        </div>

        <div>
          <label htmlFor="descripcion-producto" className="mb-1.5 block text-sm font-medium text-muted">Descripción (opcional)</label>
          <textarea id="descripcion-producto" rows={2} maxLength={500} placeholder="Ej. Botella plástica de 600 ml, sin gas" {...register('descripcion')}
            className={`w-full resize-y rounded-xl border bg-bg/70 px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted/60 focus:border-accent ${errors.descripcion ? 'border-bad' : 'border-line'}`} />
          {errors.descripcion && <p className="mt-1.5 text-sm text-bad">{errors.descripcion.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Selector etiqueta="Categoría" error={errors.categoriaId?.message} {...register('categoriaId')}>
              <option value="">Elige…</option>
              {categorias.filter((c) => c.activa !== false || c.id === producto?.categoriaId).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Selector>
            {nuevaCat === null ? (
              <button type="button" onClick={() => setNuevaCat('')} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-accent hover:underline"><Plus className="size-3.5" /> Nueva categoría</button>
            ) : (
              <div className="mt-2 flex gap-2">
                <input autoFocus value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} maxLength={60} placeholder="Nombre de la categoría" aria-label="Nombre de la nueva categoría"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void agregarCategoria() } }}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-bg/70 px-3 text-sm outline-none focus:border-accent" />
                <Button type="button" onClick={() => void agregarCategoria()} className="h-10">Crear</Button>
              </div>
            )}
            {errorCat && <p className="mt-1 text-sm text-bad">{errorCat}</p>}
          </div>
          <Selector etiqueta="Proveedor (opcional)" {...register('proveedorId')}>
            <option value="">Sin proveedor</option>
            {proveedores.filter((p) => p.activo || p.id === producto?.proveedorId).map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.activo ? '' : ' (inactivo)'}</option>)}
          </Selector>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller name="costo" control={control} render={({ field }) => <CampoDinero etiqueta="Costo (lo que te cuesta)" valor={field.value} onCambiar={field.onChange} error={errors.costo?.message} />} />
          <Controller name="precio" control={control} render={({ field }) => <CampoDinero etiqueta="Precio de venta" valor={field.value} onCambiar={field.onChange} error={errors.precio?.message} />} />
        </div>

        {/* Margen calculado en vivo: avisa si se vende a pérdida */}
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${aPerdida ? 'bg-bad/10 text-bad' : 'bg-tile'}`} aria-live="polite">
          {aPerdida ? <TrendingDown className="size-5 shrink-0" /> : <TrendingUp className="size-5 shrink-0 text-ok" />}
          <span>
            {precio > 0 ? (
              aPerdida ? <>Vendes <b className="tabular">{pesos(-m.pesos)}</b> por debajo del costo en cada unidad.</>
              : <>Ganas <b className="tabular">{pesos(m.pesos)}</b> por unidad · margen <b className="tabular">{m.porcentaje} %</b></>
            ) : 'Escribe el costo y el precio para ver cuánto ganas.'}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {editando ? (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-muted">Stock actual</span>
              <div className="flex h-12 items-center justify-between rounded-xl border border-line bg-tile px-4">
                <b className="tabular text-lg">{producto.stock}</b>
                <Link to="/inventario" className="text-xs font-medium text-accent hover:underline">Cambiar en Inventario</Link>
              </div>
            </div>
          ) : (
            <Controller name="stockInicial" control={control} render={({ field }) => <CampoDinero etiqueta="Stock inicial" valor={field.value} onCambiar={field.onChange} error={errors.stockInicial?.message} />} />
          )}
          <Controller name="minimo" control={control} render={({ field }) => <CampoDinero etiqueta="Stock mínimo" valor={field.value} onCambiar={field.onChange} error={errors.minimo?.message} ayuda="Te avisamos cuando baje de aquí." />} />
        </div>
        {editando && <p className="-mt-2 text-xs text-muted">El stock solo cambia con ventas, entradas y ajustes, para que siempre quede registro del porqué.</p>}

        <div>
          <span className="mb-1.5 block text-sm font-medium text-muted">Foto (opcional)</span>
          <div className="flex items-center gap-4 rounded-xl border border-dashed border-line p-3">
            {vistaFoto ? (
              <img src={vistaFoto} alt="Vista previa de la foto" className="size-20 shrink-0 rounded-xl bg-tile object-cover" />
            ) : (
              <Miniatura imagen={foto === null ? null : producto?.imagen} categoriaId={watch('categoriaId')} categoria={categorias.find((c) => c.id === watch('categoriaId'))} className="size-20 rounded-xl" iconoClase="size-8" />
            )}
            <div className="min-w-0 flex-1">
              <input ref={entradaFoto} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void elegirFoto(e.target.files?.[0])} aria-label="Elegir foto del producto" />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variante="secundario" onClick={() => entradaFoto.current?.click()} disabled={procesando}>
                  <ImagePlus className="size-4" /> {procesando ? 'Preparando…' : tieneFoto ? 'Cambiar foto' : 'Elegir foto'}
                </Button>
                {tieneFoto && (
                  <Button type="button" variante="secundario" onClick={quitarFoto}><Trash2 className="size-4" /> Quitar</Button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted">PNG, JPG o WebP. La reducimos sola para que no pese. Sin foto se usa el ícono de la categoría.</p>
              {errorFoto && <p className="mt-1 text-sm text-bad" role="alert">{errorFoto}</p>}
            </div>
          </div>
        </div>

        <Controller name="activo" control={control} render={({ field }) => (
          <Interruptor activo={field.value} onCambiar={field.onChange} etiqueta="Producto activo" descripcion="Si lo desactivas, deja de aparecer en Venta (el historial se conserva)." />
        )} />
      </form>
    </PanelLateral>
  )
}
