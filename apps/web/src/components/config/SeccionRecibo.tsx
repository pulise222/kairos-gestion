import { useAjustes } from '../../ajustes/contexto'
import { pesos } from '../../lib/dinero'
import { Interruptor } from '../ui/Interruptor'
import { Bloque } from './Bloque'

const items = [
  { nombre: 'Gaseosa 1.5 L', cantidad: 2, precio: 4500 },
  { nombre: 'Galletas de sal', cantidad: 1, precio: 2800 },
]

export function SeccionRecibo() {
  const { ajustes, cambiar } = useAjustes()
  const r = ajustes.recibo
  const set = (parcial: Partial<typeof r>) => cambiar({ recibo: { ...r, ...parcial } })
  const total = items.reduce((s, i) => s + i.cantidad * i.precio, 0)

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Bloque titulo="Recibo" descripcion="Cómo se imprime el comprobante de cada venta. Los cambios se ven al instante en la vista previa.">
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">Mensaje de encabezado</span>
            <input value={r.encabezado} onChange={(e) => set({ encabezado: e.target.value })} maxLength={200} className="h-12 w-full rounded-xl border border-line bg-bg/70 px-4 outline-none focus:border-accent" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">Mensaje al pie</span>
            <input value={r.pie} onChange={(e) => set({ pie: e.target.value })} maxLength={200} className="h-12 w-full rounded-xl border border-line bg-bg/70 px-4 outline-none focus:border-accent" />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted">Ancho del papel de la impresora</span>
            <div className="grid max-w-xs grid-cols-2 gap-1 rounded-xl bg-tile p-1" role="radiogroup" aria-label="Ancho del papel">
              {([58, 80] as const).map((a) => (
                <button key={a} role="radio" aria-checked={r.ancho === a} onClick={() => set({ ancho: a })}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${r.ancho === a ? 'bg-panel shadow-sm' : 'text-muted hover:text-ink'}`}>{a} mm</button>
              ))}
            </div>
          </div>

          <Interruptor activo={r.mostrarNumero} onCambiar={(v) => set({ mostrarNumero: v })} etiqueta="Mostrar el número de venta" />
          <Interruptor activo={r.mostrarVendedor} onCambiar={(v) => set({ mostrarVendedor: v })} etiqueta="Mostrar quién atendió" />
          <Interruptor activo={r.avisoSinValidez} onCambiar={(v) => set({ avisoSinValidez: v })} etiqueta="Aviso «Documento sin validez fiscal»" descripcion="Recomendado: este sistema es de control interno y NO reemplaza la factura electrónica." />
        </div>
      </Bloque>

      {/* Vista previa con aspecto de papel térmico */}
      <div>
        <p className="mb-2 text-sm font-medium text-muted">Vista previa</p>
        <div className="mx-auto rounded-sm bg-white p-4 text-[13px] leading-snug text-[#1c1814] shadow-xl" style={{ width: r.ancho === 58 ? 232 : 312, transition: 'width .25s' }} aria-label="Vista previa del recibo">
          <div className="text-center">
            <p className="text-base font-bold">{ajustes.nombreNegocio}</p>
            {ajustes.nit && <p>NIT {ajustes.nit}</p>}
            {ajustes.direccion && <p>{ajustes.direccion}</p>}
            {ajustes.telefono && <p>Tel. {ajustes.telefono}</p>}
            {r.encabezado && <p className="mt-2">{r.encabezado}</p>}
          </div>
          <div className="my-2 border-t border-dashed border-[#999]" />
          {r.mostrarNumero && <p>Venta N.º 0128</p>}
          <p>30 sept 2026 · 4:52 p. m.</p>
          {r.mostrarVendedor && <p>Atendió: María</p>}
          <div className="my-2 border-t border-dashed border-[#999]" />
          {items.map((i) => (
            <div key={i.nombre} className="tabular flex justify-between gap-2"><span>{i.cantidad} × {i.nombre}</span><span>{pesos(i.cantidad * i.precio)}</span></div>
          ))}
          <div className="my-2 border-t border-dashed border-[#999]" />
          <div className="tabular flex justify-between text-base font-bold"><span>TOTAL</span><span>{pesos(total)}</span></div>
          <div className="tabular flex justify-between"><span>Pagó con</span><span>{pesos(20000)}</span></div>
          <div className="tabular flex justify-between"><span>Vueltas</span><span>{pesos(20000 - total)}</span></div>
          <div className="my-2 border-t border-dashed border-[#999]" />
          <div className="text-center">
            {r.pie && <p>{r.pie}</p>}
            {r.avisoSinValidez && <p className="mt-1 text-[11px] text-[#666]">Documento sin validez fiscal</p>}
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted">La impresión real se activa en la Fase 6.</p>
      </div>
    </div>
  )
}
