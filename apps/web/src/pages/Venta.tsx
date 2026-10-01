import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, ChevronDown, Minus, Plus, Receipt, Search, ShoppingBag, Trash2, X } from 'lucide-react'
import { CifraAnimada } from '../components/negocio/CifraAnimada'
import { ProductoTarjeta } from '../components/negocio/ProductoTarjeta'
import { Button } from '../components/ui/Button'
import { useAviso } from '../components/ui/Avisos'
import { Dialogo } from '../components/ui/Dialogo'
import { ErrorApi, mensajeDe } from '../api/cliente'
import { claveParaIntento, useEnvioUnico } from '../lib/envio'
import type { IntentoVenta } from '../lib/envio'
import { pesos } from '../lib/dinero'
import { buscar } from '../lib/busqueda'
import { faltante, puedeConfirmar, subtotal, totalVenta, unidades, vueltas } from '../lib/venta'
import type { LineaCarrito } from '../lib/venta'
import { useAjustes } from '../ajustes/contexto'
import { useCatalogo } from '../data/contexto'
import type { ResultadoVenta } from '../data/contexto'
import { configVenta } from '../mock/catalogo'
import type { Producto } from '../mock/catalogo'


export function Venta() {
  const avisar = useAviso()
  const { ajustes } = useAjustes()
  const permitirSinStock = ajustes.permitirVentaSinStock
  // Catálogo compartido con Productos e Inventario: al vender, el stock baja en todas las pantallas.
  const { productos: todos, categorias, registrarVenta } = useCatalogo()
  const productos = useMemo(() => todos.filter((p) => p.activo), [todos]) // los desactivados no se venden
  const [lineasBase, setLineas] = useState<LineaCarrito[]>([])
  const [consulta, setConsulta] = useState('')
  const [categoria, setCategoria] = useState<string>('todas')
  const [seleccion, setSeleccion] = useState(0)
  const [pagado, setPagado] = useState(0)
  const { enviando, ejecutar } = useEnvioUnico() // bloqueo inmediato: un doble clic no puede registrar dos ventas
  const intento = useRef<IntentoVenta | null>(null) // clave del intento en curso (ver lib/envio.ts)
  const [ultimoAgregado, setUltimoAgregado] = useState<{ id: number; n: number } | null>(null)
  const [resumen, setResumen] = useState<ResultadoVenta | null>(null)
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false)
  const [hojaAbierta, setHojaAbierta] = useState(false) // carrito como hoja inferior en celular

  const buscador = useRef<HTMLInputElement>(null)
  const campoPago = useRef<HTMLInputElement>(null)

  // El carrito guarda solo qué producto y cuánto; precio y stock se leen SIEMPRE del catálogo actual
  // (así, si el servidor rechazó una venta por stock, las cantidades máximas ya reflejan lo que de verdad hay).
  const lineas = useMemo(() => lineasBase.map((l) => ({ ...l, producto: todos.find((p) => p.id === l.producto.id) ?? l.producto })), [lineasBase, todos])

  const total = totalVenta(lineas)
  const cambio = vueltas(total, pagado)
  const falta = faltante(total, pagado)
  const puede = puedeConfirmar(total, pagado, lineas.length > 0)

  // Resultados: filtro por categoría + búsqueda por nombre o código.
  const resultados = useMemo(
    () => buscar(productos.filter((p) => categoria === 'todas' || p.categoriaId === categoria), consulta),
    [productos, categoria, consulta],
  )
  const bloqueado = (p: Producto) => p.stock <= 0 && !permitirSinStock

  const enCarrito = (id: number) => lineas.find((l) => l.producto.id === id)?.cantidad ?? 0

  const agregar = (p: Producto) => {
    if (bloqueado(p)) return avisar(`"${p.nombre}" está agotado.`, 'alerta')
    if (enCarrito(p.id) + 1 > p.stock && !permitirSinStock) {
      return avisar(`Solo hay ${p.stock} unidades de "${p.nombre}".`, 'alerta')
    }
    setLineas((ls) =>
      ls.some((l) => l.producto.id === p.id)
        ? ls.map((l) => (l.producto.id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l))
        : [...ls, { producto: p, cantidad: 1 }],
    )
    setUltimoAgregado((u) => ({ id: p.id, n: (u?.n ?? 0) + 1 })) // dispara el destello de la fila
  }

  const cambiarCantidad = (p: Producto, delta: number) => {
    const nueva = enCarrito(p.id) + delta
    if (nueva <= 0) return setLineas((ls) => ls.filter((l) => l.producto.id !== p.id))
    if (nueva > p.stock && !permitirSinStock) return avisar(`Solo hay ${p.stock} unidades de "${p.nombre}".`, 'alerta')
    setLineas((ls) => ls.map((l) => (l.producto.id === p.id ? { ...l, cantidad: nueva } : l)))
  }

  const quitar = (id: number) => setLineas((ls) => ls.filter((l) => l.producto.id !== id))

  // Teclado del buscador: flechas para moverse, Enter agrega, Esc limpia.
  const alTeclear = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      setSeleccion((i) => Math.min(i + 1, resultados.length - 1))
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      setSeleccion((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Un lector de código de barras "teclea" el código y pulsa Enter: el código exacto manda sobre la selección.
      const exacto = productos.find((p) => p.codigo === consulta.trim())
      const elegido = exacto ?? resultados[seleccion]
      if (elegido) {
        agregar(elegido)
        setConsulta('')
        setSeleccion(0)
      } else if (consulta.trim()) {
        avisar(`No encontré "${consulta}".`, 'alerta')
      }
    } else if (e.key === 'Escape') {
      setConsulta('')
      setSeleccion(0)
    }
  }

  // F2 lleva directo al cobro.
  useEffect(() => {
    const f2 = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        setHojaAbierta(true)
        setTimeout(() => campoPago.current?.focus(), 50)
      }
    }
    window.addEventListener('keydown', f2)
    return () => window.removeEventListener('keydown', f2)
  }, [])

  const confirmar = async () => {
    if (!puede) return
    await ejecutar(async () => {
      const envio = lineas.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad }))
      // Cada intento lleva su clave: si la red se corta justo al enviar y el cajero reintenta, el servidor reconoce la venta y no la duplica.
      intento.current = claveParaIntento(intento.current, JSON.stringify([envio, pagado]))
      try {
        // El servidor calcula todo con SUS precios y descuenta el stock en una transacción: lo que responde es la verdad.
        setResumen(await registrarVenta(envio, { pagado, clave: intento.current.clave }))
        intento.current = null
      } catch (e) {
        // Sin conexión no sabemos si la venta llegó a registrarse: se conserva la clave para el reintento exacto.
        if (intento.current) intento.current.ambiguo = e instanceof ErrorApi && e.estado === 0
        avisar(mensajeDe(e), 'alerta') // p. ej. "No hay stock suficiente de «Gaseosa»": el carrito se conserva para corregirlo
      }
    })
  }

  const nuevaVenta = () => {
    setResumen(null)
    intento.current = null
    setLineas([])
    setPagado(0)
    setConsulta('')
    setHojaAbierta(false)
    setTimeout(() => buscador.current?.focus(), 50)
  }

  const cancelarVenta = () => {
    setConfirmandoCancelar(false)
    setLineas([])
    setPagado(0)
    setHojaAbierta(false)
    buscador.current?.focus()
  }

  const leerPago = (texto: string) => setPagado(Number(texto.replace(/\D/g, '')) || 0)

  return (
    <div className="grid gap-4 pb-24 lg:grid-cols-[minmax(0,1fr)_26rem] lg:pb-0">
      {/* ───────── Izquierda: buscar y elegir ───────── */}
      <section className="min-w-0 space-y-4">
        <div className="glass flex h-14 items-center gap-3 rounded-full px-5 focus-within:ring-2 focus-within:ring-accent/60">
          <Search className="size-5 text-muted" />
          <input
            ref={buscador}
            autoFocus
            value={consulta}
            onChange={(e) => { setConsulta(e.target.value); setSeleccion(0) }}
            onKeyDown={alTeclear}
            placeholder="Buscar por nombre o código…"
            aria-label="Buscar producto por nombre o código de barras"
            className="h-full min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted/70"
          />
          {consulta && (
            <button onClick={() => { setConsulta(''); buscador.current?.focus() }} className="grid size-8 place-items-center rounded-full text-muted hover:text-ink" aria-label="Limpiar búsqueda">
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Categorías">
          {[{ id: 'todas', nombre: 'Todas' }, ...categorias].map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={categoria === c.id}
              onClick={() => { setCategoria(c.id); setSeleccion(0) }}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                categoria === c.id ? 'border-accent bg-accent text-on-accent' : 'border-line bg-panel text-muted hover:text-ink'
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>

        {resultados.length === 0 ? (
          <div className="grid place-items-center rounded-[var(--radius-card)] border border-dashed border-line py-16 text-center text-muted">
            <p className="display text-2xl text-ink">Sin resultados</p>
            <p className="mt-1 text-sm">Prueba con otra parte del nombre o escanea el código.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {resultados.map((p, i) => (
              <ProductoTarjeta
                key={p.id}
                producto={p}
                categoria={categorias.find((c) => c.id === p.categoriaId)}
                seleccionado={!!consulta && i === seleccion}
                bloqueado={bloqueado(p)}
                onAgregar={() => agregar(p)}
              />
            ))}
          </div>
        )}
        <p className="hidden text-xs text-muted lg:block">
          <kbd className="rounded border border-line px-1">↑↓←→</kbd> moverse · <kbd className="rounded border border-line px-1">Enter</kbd> agregar ·{' '}
          <kbd className="rounded border border-line px-1">F2</kbd> cobrar · <kbd className="rounded border border-line px-1">Esc</kbd> limpiar
        </p>
      </section>

      {/* ───────── Barra resumen en celular (el total siempre visible) ───────── */}
      {!hojaAbierta && (
        <button
          onClick={() => setHojaAbierta(true)}
          className="glass fixed inset-x-3 bottom-[5.25rem] z-30 flex items-center justify-between rounded-full py-2 pl-5 pr-2 lg:hidden"
          aria-label="Abrir carrito"
        >
          <span className="flex items-center gap-2 text-sm">
            <ShoppingBag className="size-5 text-accent" /> {unidades(lineas)} {unidades(lineas) === 1 ? 'producto' : 'productos'}
          </span>
          <span className="display tabular rounded-full bg-accent px-5 py-1.5 text-xl text-on-accent">{pesos(total)}</span>
        </button>
      )}

      {/* ───────── Derecha: carrito y cobro (hoja inferior en celular) ───────── */}
      <aside
        className={`${hojaAbierta ? 'flex' : 'hidden'} fixed inset-x-3 bottom-[5.25rem] z-30 max-h-[78dvh] flex-col rounded-3xl border border-line bg-panel p-5 shadow-2xl lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100dvh-7.5rem)] lg:self-start lg:shadow-none`}
        aria-label="Carrito y cobro"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Nueva venta</h2>
          <div className="flex items-center gap-2 text-xs text-muted">
            Caja 1
            <button onClick={() => setHojaAbierta(false)} className="grid size-8 place-items-center rounded-full hover:bg-tile lg:hidden" aria-label="Cerrar carrito">
              <ChevronDown className="size-5" />
            </button>
          </div>
        </div>

        <div className="min-h-24 flex-1 overflow-y-auto">
          {lineas.length === 0 ? (
            <div className="grid h-full min-h-32 place-items-center text-center text-sm text-muted">
              <div>
                <ShoppingBag className="mx-auto mb-2 size-8 opacity-40" />
                Busca o escanea un producto<br />para empezar la venta.
              </div>
            </div>
          ) : (
            <ul>
              {lineas.map((l) => (
                <li
                  key={`${l.producto.id}-${ultimoAgregado?.id === l.producto.id ? ultimoAgregado.n : 0}`}
                  className={`flex items-center gap-2 rounded-xl border-b border-line py-2.5 last:border-0 ${ultimoAgregado?.id === l.producto.id ? 'destello' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.producto.nombre}</p>
                    <p className="tabular text-xs text-muted">{pesos(l.producto.precio)} c/u</p>
                  </div>
                  <div className="flex items-center rounded-full border border-line">
                    <button onClick={() => cambiarCantidad(l.producto, -1)} className="grid size-9 place-items-center rounded-full hover:bg-tile" aria-label={`Menos ${l.producto.nombre}`}>
                      <Minus className="size-4" />
                    </button>
                    <span className="tabular w-7 text-center text-sm font-semibold" aria-live="polite">{l.cantidad}</span>
                    <button onClick={() => cambiarCantidad(l.producto, 1)} className="grid size-9 place-items-center rounded-full hover:bg-tile" aria-label={`Más ${l.producto.nombre}`}>
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <span className="tabular w-[5.2rem] text-right text-sm font-semibold">{pesos(subtotal(l))}</span>
                  <button onClick={() => quitar(l.producto.id)} className="grid size-8 place-items-center rounded-full text-muted hover:text-bad" aria-label={`Quitar ${l.producto.nombre}`}>
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 border-t border-line pt-4">
          <div className="flex items-end justify-between">
            <span className="text-sm text-muted">Total</span>
            <span className="display text-5xl leading-none"><CifraAnimada valor={total} /></span>
          </div>

          <label htmlFor="paga-con" className="mb-1.5 mt-4 block text-sm font-medium text-muted">Paga con</label>
          <input
            id="paga-con"
            ref={campoPago}
            inputMode="numeric"
            autoComplete="off"
            value={pagado ? new Intl.NumberFormat('es-CO').format(pagado) : ''}
            onChange={(e) => leerPago(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void confirmar()}
            placeholder="0"
            className="tabular h-12 w-full rounded-xl border border-line bg-bg/70 px-4 text-xl outline-none focus:border-accent"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button onClick={() => setPagado(total)} disabled={!total} className="rounded-full border border-accent px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent hover:text-on-accent disabled:pointer-events-none disabled:opacity-40">
              Exacto
            </button>
            {configVenta.billetes.map((b) => (
              <button key={b} onClick={() => setPagado(b)} className="tabular rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent hover:text-ink">
                {new Intl.NumberFormat('es-CO').format(b)}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-tile px-4 py-3" aria-live="polite">
            <span className="text-sm text-muted">{pagado > 0 && falta > 0 ? 'Falta' : 'Vueltas'}</span>
            <span className={`display tabular text-3xl ${pagado > 0 && falta > 0 ? 'text-bad' : cambio > 0 ? 'text-ok' : ''}`}>
              {pagado > 0 && falta > 0 ? pesos(falta) : pesos(cambio)}
            </span>
          </div>

          <Button grande className="mt-4 w-full" disabled={!puede || enviando} onClick={confirmar}>
            <Check className="size-5" /> {enviando ? 'Registrando…' : 'Confirmar venta'}
          </Button>
          <Button variante="fantasma" className="mt-1 w-full" disabled={lineas.length === 0} onClick={() => setConfirmandoCancelar(true)}>
            Cancelar venta
          </Button>
        </div>
      </aside>

      {/* ───────── Confirmación de cancelar (diálogo propio) ───────── */}
      <Dialogo abierto={confirmandoCancelar} onCerrar={() => setConfirmandoCancelar(false)}>
        <h2 className="display text-3xl">¿Cancelar la venta?</h2>
        <p className="mt-2 text-sm text-muted">Se vaciará el carrito y no se guardará nada. El stock no cambia.</p>
        <div className="mt-6 flex gap-2">
          <Button variante="secundario" className="flex-1" onClick={() => setConfirmandoCancelar(false)}>Seguir vendiendo</Button>
          <Button variante="peligro" className="flex-1" onClick={cancelarVenta}>Sí, cancelar</Button>
        </div>
      </Dialogo>

      {/* ───────── Venta registrada ───────── */}
      <Dialogo abierto={!!resumen} onCerrar={nuevaVenta} descartable={false}>
        {resumen && (
          <div className="text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-ok/15 text-ok"><Check className="size-8" /></div>
            <h2 className="display mt-4 text-3xl">Venta registrada</h2>
            <p className="text-sm text-muted">#{String(resumen.numero).padStart(4, '0')} · {resumen.items} {resumen.items === 1 ? 'producto' : 'productos'}</p>
            <dl className="mt-5 space-y-2 rounded-2xl bg-tile p-4 text-left">
              <div className="flex justify-between text-sm"><dt className="text-muted">Total</dt><dd className="tabular font-semibold">{pesos(resumen.total)}</dd></div>
              <div className="flex justify-between text-sm"><dt className="text-muted">Pagó con</dt><dd className="tabular">{pesos(resumen.pagado)}</dd></div>
              <div className="flex items-end justify-between border-t border-line pt-2"><dt className="text-sm text-muted">Vueltas</dt><dd className="display tabular text-4xl text-ok">{pesos(resumen.vueltas)}</dd></div>
            </dl>
            <div className="mt-6 flex gap-2">
              <Button variante="secundario" className="flex-1" onClick={() => avisar('La impresión de recibos se activa en la Fase 6.', 'info')}>
                <Receipt className="size-4" /> Recibo
              </Button>
              <Button className="flex-1" autoFocus onClick={nuevaVenta}>Nueva venta</Button>
            </div>
          </div>
        )}
      </Dialogo>
    </div>
  )
}
