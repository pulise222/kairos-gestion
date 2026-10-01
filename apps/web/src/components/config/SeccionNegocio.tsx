import { useState } from 'react'
import { useAjustes } from '../../ajustes/contexto'
import { Button } from '../ui/Button'
import { Campo } from '../ui/Campo'
import { CampoDinero } from '../ui/CampoDinero'
import { Interruptor } from '../ui/Interruptor'
import { useAviso } from '../ui/Avisos'
import { Bloque } from './Bloque'

export function SeccionNegocio() {
  const { ajustes, cambiar } = useAjustes()
  const avisar = useAviso()
  // Se trabaja sobre un borrador y solo se guarda al pulsar «Guardar»: así no se guarda un nombre a medio escribir.
  const [nombre, setNombre] = useState(ajustes.nombreNegocio)
  const [nit, setNit] = useState(ajustes.nit)
  const [direccion, setDireccion] = useState(ajustes.direccion)
  const [telefono, setTelefono] = useState(ajustes.telefono)
  const [error, setError] = useState<string>()

  const hayCambios = nombre !== ajustes.nombreNegocio || nit !== ajustes.nit || direccion !== ajustes.direccion || telefono !== ajustes.telefono

  const guardar = () => {
    if (!nombre.trim()) return setError('Escribe el nombre del negocio')
    setError(undefined)
    cambiar({ nombreNegocio: nombre.trim(), nit: nit.trim(), direccion: direccion.trim(), telefono: telefono.trim() })
    avisar('Datos del negocio guardados.', 'ok')
  }

  return (
    <div className="space-y-4">
      <Bloque titulo="Datos del negocio" descripcion="Aparecen en la pantalla de acceso, en el Panel y en el recibo.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Campo etiqueta="Nombre del negocio" value={nombre} onChange={(e) => setNombre(e.target.value)} error={error} maxLength={80} /></div>
          <Campo etiqueta="NIT o documento (opcional)" value={nit} onChange={(e) => setNit(e.target.value)} maxLength={30} />
          <Campo etiqueta="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} maxLength={30} inputMode="tel" />
          <div className="sm:col-span-2"><Campo etiqueta="Dirección (opcional)" value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={120} /></div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted">Moneda</span>
            <div className="flex h-12 items-center justify-between rounded-xl border border-line bg-tile px-4 text-sm">
              <span>Peso colombiano (COP)</span><span className="text-xs text-muted">Sin decimales</span>
            </div>
            <p className="mt-1.5 text-xs text-muted">El dinero se maneja en pesos enteros para evitar errores de redondeo.</p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={guardar} disabled={!hayCambios}>Guardar cambios</Button>
          {hayCambios && <button onClick={() => { setNombre(ajustes.nombreNegocio); setNit(ajustes.nit); setDireccion(ajustes.direccion); setTelefono(ajustes.telefono); setError(undefined) }} className="text-sm text-muted hover:text-ink">Descartar</button>}
        </div>
      </Bloque>

      <Bloque titulo="Reglas de venta" descripcion="Estas decisiones cambian cómo se comporta la pantalla de Venta. Se aplican al instante.">
        <div className="space-y-4">
          <Interruptor
            activo={ajustes.permitirVentaSinStock}
            onCambiar={(v) => cambiar({ permitirVentaSinStock: v })}
            etiqueta="Permitir vender con el stock en cero"
            descripcion="Útil si aún no cargas todo el inventario. El stock puede quedar en negativo y se nota en el historial."
          />
          <div className="max-w-xs">
            <CampoDinero etiqueta="Meta de ventas por día (opcional)" valor={ajustes.metaDiaria} onCambiar={(v) => cambiar({ metaDiaria: v })} ayuda="Alimenta el medidor del Panel. Pon 0 si no quieres usar meta; también puedes cambiarla desde el Panel." />
          </div>
        </div>
      </Bloque>
    </div>
  )
}
