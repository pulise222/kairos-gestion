import { Boxes, LayoutDashboard, Lock, Package, Receipt, ShoppingCart, Truck, Users, Wallet } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAjustes } from '../../ajustes/contexto'
import { Interruptor } from '../ui/Interruptor'
import { Bloque } from './Bloque'

interface Modulo { nombre: string; descripcion: string; Icono: LucideIcon }

const base: Modulo[] = [
  { nombre: 'Venta', descripcion: 'La caja: buscar, carrito, cobro y vueltas.', Icono: ShoppingCart },
  { nombre: 'Productos', descripcion: 'Catálogo, categorías, costos y precios.', Icono: Package },
  { nombre: 'Inventario', descripcion: 'Estado del stock, entradas, ajustes y movimientos.', Icono: Boxes },
  { nombre: 'Panel', descripcion: 'Ventas, ganancias y reportes del dueño.', Icono: LayoutDashboard },
]
const futuros: Modulo[] = [
  { nombre: 'Caja (cierre del día)', descripcion: 'Arqueo y cierre diario de la caja.', Icono: Receipt },
  { nombre: 'Clientes y fiado', descripcion: 'Ventas a crédito y saldos por cliente.', Icono: Users },
  { nombre: 'Gastos', descripcion: 'Arriendo, servicios y otros gastos del negocio.', Icono: Wallet },
]

export function SeccionModulos() {
  const { ajustes, cambiar } = useAjustes()
  return (
    <div className="space-y-4">
      <Bloque titulo="Módulos activos" descripcion="Activa solo lo que tu negocio usa: lo que apagues deja de aparecer en el menú. Así el mismo sistema se adapta a cada negocio sin cambiar código.">
        <div className="space-y-3">
          {base.map(({ nombre, descripcion, Icono }) => (
            <div key={nombre} className="flex items-center gap-4 rounded-xl border border-line bg-bg/50 px-4 py-3">
              <Icono className="size-5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{nombre}</p><p className="text-xs text-muted">{descripcion}</p></div>
              <span className="flex items-center gap-1 text-xs text-muted"><Lock className="size-3.5" /> Siempre activo</span>
            </div>
          ))}
          <div className="flex items-center gap-4">
            <Truck className="ml-4 size-5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <Interruptor activo={ajustes.proveedoresActivo} onCambiar={(v) => cambiar({ proveedoresActivo: v })} etiqueta="Proveedores" descripcion="Directorio de proveedores y compras a cada uno. Si no lo usas, apágalo." />
            </div>
          </div>
        </div>
      </Bloque>

      <Bloque titulo="Próximamente (versión 2)" descripcion="Módulos opcionales que se podrán activar cuando estén listos.">
        <div className="space-y-3">
          {futuros.map(({ nombre, descripcion, Icono }) => (
            <div key={nombre} className="flex items-center gap-4 rounded-xl border border-dashed border-line px-4 py-3 opacity-70">
              <Icono className="size-5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{nombre}</p><p className="text-xs text-muted">{descripcion}</p></div>
              <span className="rounded-full bg-tile px-2.5 py-0.5 text-xs font-semibold text-muted">Próximamente</span>
            </div>
          ))}
        </div>
      </Bloque>
    </div>
  )
}
