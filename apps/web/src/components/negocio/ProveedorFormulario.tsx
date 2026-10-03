import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../ui/Button'
import { Campo } from '../ui/Campo'
import { Interruptor } from '../ui/Interruptor'
import { PanelLateral } from '../ui/PanelLateral'
import { useAviso } from '../ui/Avisos'
import { ErrorApi, mensajeDe } from '../../api/cliente'
import { useEnvioUnico } from '../../lib/envio'
import { useCatalogo } from '../../data/contexto'
import type { Proveedor } from '../../mock/catalogo'

// Mismas reglas que el backend (que vuelve a validar todo).
const esquema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre del proveedor').max(100, 'Máximo 100 caracteres'),
  telefono: z.string().trim().max(30, 'Máximo 30 caracteres'),
  correo: z.union([z.literal(''), z.string().trim().email('Correo inválido').max(120)]),
  notas: z.string().trim().max(500, 'Máximo 500 caracteres'),
  activo: z.boolean(),
})
type Valores = z.infer<typeof esquema>

const vacio: Valores = { nombre: '', telefono: '', correo: '', notas: '', activo: true }

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** Si viene un proveedor, se edita; si no, se crea uno nuevo. */
  proveedor?: Proveedor
}

export function ProveedorFormulario({ abierto, onCerrar, proveedor }: Props) {
  const { proveedores, crearProveedor, editarProveedor } = useCatalogo()
  const avisar = useAviso()
  const editando = !!proveedor

  const { enviando, ejecutar } = useEnvioUnico()

  const { register, control, handleSubmit, reset, setError, formState: { errors } } = useForm<Valores>({ resolver: zodResolver(esquema), defaultValues: vacio })

  useEffect(() => {
    if (!abierto) return
    reset(proveedor ? { nombre: proveedor.nombre, telefono: proveedor.telefono, correo: proveedor.correo, notas: proveedor.notas, activo: proveedor.activo } : vacio)
  }, [abierto, proveedor, reset])

  const guardar = handleSubmit((v) => ejecutar(async () => {
    const repetido = proveedores.some((p) => p.id !== proveedor?.id && p.nombre.trim().toLowerCase() === v.nombre.toLowerCase())
    if (repetido) return setError('nombre', { message: 'Ya tienes un proveedor con ese nombre' })
    try {
      if (proveedor) {
        await editarProveedor(proveedor.id, v)
        avisar(`«${v.nombre}» actualizado.`, 'ok')
      } else {
        await crearProveedor({ nombre: v.nombre, telefono: v.telefono, correo: v.correo, notas: v.notas })
        avisar(`«${v.nombre}» agregado a tus proveedores.`, 'ok')
      }
      onCerrar()
    } catch (e) {
      if (e instanceof ErrorApi && e.estado === 400) setError('nombre', { message: e.message })
      else avisar(mensajeDe(e), 'alerta')
    }
  }))

  return (
    <PanelLateral
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={editando ? 'Editar proveedor' : 'Nuevo proveedor'}
      subtitulo="Con quién compras la mercancía."
      pie={<div className="flex gap-2"><Button variante="secundario" className="flex-1" onClick={onCerrar}>Cancelar</Button><Button type="submit" form="form-proveedor" className="flex-1" disabled={enviando}>{enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar proveedor'}</Button></div>}
    >
      <form id="form-proveedor" onSubmit={guardar} noValidate className="space-y-4">
        <Campo etiqueta="Nombre" autoFocus placeholder="Ej. Químicos del Norte" error={errors.nombre?.message} {...register('nombre')} />
        <Campo etiqueta="Teléfono / WhatsApp" inputMode="tel" placeholder="300 123 4567" error={errors.telefono?.message} {...register('telefono')} />
        <Campo etiqueta="Correo (opcional)" type="email" inputMode="email" placeholder="pedidos@proveedor.co" error={errors.correo?.message} {...register('correo')} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-muted">Notas (opcional)</span>
          <textarea rows={3} maxLength={500} placeholder="Días de visita, pedido mínimo, forma de pago…" {...register('notas')} className="w-full rounded-xl border border-line bg-bg/70 px-4 py-3 outline-none focus:border-accent" />
          {errors.notas && <p className="mt-1.5 text-sm text-bad">{errors.notas.message}</p>}
        </label>
        {editando && (
          <Controller name="activo" control={control} render={({ field }) => (
            <Interruptor activo={field.value} onCambiar={field.onChange} etiqueta="Proveedor activo" descripcion="Si lo desactivas, ya no aparece al registrar compras. Su historial se conserva." />
          )} />
        )}
      </form>
    </PanelLateral>
  )
}
