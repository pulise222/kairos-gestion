import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, Plus, UserCheck, UserX } from 'lucide-react'
import { ErrorApi, mensajeDe } from '../../api/cliente'
import { useEnvioUnico } from '../../lib/envio'
import { useAjustes } from '../../ajustes/contexto'
import type { UsuarioSistema } from '../../ajustes/contexto'
import { contrasena, iniciales, motivoParaNoDesactivar, nombreUsuario } from '../../lib/usuarios'
import { Button } from '../ui/Button'
import { Campo } from '../ui/Campo'
import { Dialogo } from '../ui/Dialogo'
import { PanelLateral } from '../ui/PanelLateral'
import { Selector } from '../ui/Selector'
import { useSesion } from '../../sesion/contexto'
import { useAviso } from '../ui/Avisos'
import { Bloque } from './Bloque'

const esquema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre').max(80),
  usuario: nombreUsuario,
  contrasena,
  rol: z.enum(['DUENO', 'VENDEDOR']),
})
type Valores = z.infer<typeof esquema>

export function SeccionUsuarios() {
  const { usuarios, crearUsuario, editarUsuario, restablecerContrasena } = useAjustes()
  const { usuario: yo } = useSesion()
  const YO = yo?.id ?? 0
  const avisar = useAviso()
  const [nuevo, setNuevo] = useState(false)
  const [clave, setClave] = useState<{ usuario: UsuarioSistema; texto: string; error?: string } | null>(null)
  const [desactivar, setDesactivar] = useState<UsuarioSistema | null>(null)

  const { enviando, ejecutar } = useEnvioUnico()

  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<Valores>({
    resolver: zodResolver(esquema),
    defaultValues: { nombre: '', usuario: '', contrasena: '', rol: 'VENDEDOR' },
  })

  const abrirNuevo = () => { reset({ nombre: '', usuario: '', contrasena: '', rol: 'VENDEDOR' }); setNuevo(true) }

  const crear = handleSubmit((v) => ejecutar(async () => {
    if (usuarios.some((u) => u.usuario === v.usuario)) return setError('usuario', { message: 'Ese nombre de usuario ya está en uso' })
    try {
      await crearUsuario({ nombre: v.nombre, usuario: v.usuario, rol: v.rol, contrasena: v.contrasena })
      avisar(`Usuario «${v.usuario}» creado.`, 'ok')
      setNuevo(false)
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === 'USUARIO_EXISTE') setError('usuario', { message: e.message })
      else avisar(mensajeDe(e), 'alerta')
    }
  }))

  const pedirDesactivar = (u: UsuarioSistema) => {
    const motivo = motivoParaNoDesactivar(usuarios, u.id, YO)
    if (motivo) return avisar(motivo, 'alerta')
    setDesactivar(u)
  }

  const guardarClave = async () => {
    if (!clave) return
    const r = contrasena.safeParse(clave.texto)
    if (!r.success) return setClave({ ...clave, error: r.error.issues[0]?.message })
    try {
      await restablecerContrasena(clave.usuario.id, clave.texto)
      avisar(`Contraseña de «${clave.usuario.usuario}» restablecida. Debe usarla en su próximo ingreso.`, 'ok')
      setClave(null)
    } catch (e) {
      setClave({ ...clave, error: mensajeDe(e) })
    }
  }

  const cambiarActivo = async (u: UsuarioSistema, activo: boolean) => {
    try {
      await editarUsuario(u.id, { activo })
      avisar(activo ? `«${u.usuario}» vuelve a tener acceso.` : `«${u.usuario}» desactivado.`, 'ok')
      return true
    } catch (e) {
      avisar(mensajeDe(e), 'alerta') // p. ej. "Debe quedar al menos un dueño activo"
      return false
    }
  }

  return (
    <Bloque
      titulo="Usuarios"
      descripcion="Quién puede entrar al sistema. El vendedor solo ve Venta, Productos (sin costos) e Inventario en modo consulta."
      acciones={<Button onClick={abrirNuevo}><Plus className="size-4" /> Nuevo usuario</Button>}
    >
      <ul className="divide-y divide-line">
        {usuarios.map((u) => (
          <li key={u.id} className={`flex flex-wrap items-center gap-3 py-3 ${u.activo ? '' : 'opacity-60'}`}>
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/15 text-sm font-bold text-accent" aria-hidden="true">{iniciales(u.nombre)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{u.nombre} {u.id === YO && <span className="text-xs font-normal text-muted">(tú)</span>}</p>
              <p className="truncate text-xs text-muted">@{u.usuario}</p>
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.rol === 'DUENO' ? 'bg-accent/15 text-accent' : 'bg-tile text-muted'}`}>{u.rol === 'DUENO' ? 'Dueño' : 'Vendedor'}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.activo ? 'bg-ok/12 text-ok' : 'bg-tile text-muted'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
            <div className="flex gap-1">
              <button onClick={() => setClave({ usuario: u, texto: '' })} className="grid size-9 place-items-center rounded-full text-muted hover:bg-tile hover:text-ink" title="Restablecer contraseña" aria-label={`Restablecer contraseña de ${u.nombre}`}>
                <KeyRound className="size-4" />
              </button>
              {u.activo ? (
                <button onClick={() => pedirDesactivar(u)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-tile hover:text-bad" title="Desactivar" aria-label={`Desactivar a ${u.nombre}`}><UserX className="size-4" /></button>
              ) : (
                <button onClick={() => void cambiarActivo(u, true)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-tile hover:text-ok" title="Reactivar" aria-label={`Reactivar a ${u.nombre}`}><UserCheck className="size-4" /></button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <PanelLateral
        abierto={nuevo}
        onCerrar={() => setNuevo(false)}
        titulo="Nuevo usuario"
        subtitulo="Entrega la contraseña en persona; podrá cambiarla luego."
        pie={<div className="flex gap-2"><Button variante="secundario" className="flex-1" onClick={() => setNuevo(false)}>Cancelar</Button><Button type="submit" form="form-usuario" className="flex-1" disabled={enviando}>{enviando ? 'Creando…' : 'Crear usuario'}</Button></div>}
      >
        <form id="form-usuario" onSubmit={crear} noValidate className="space-y-4">
          <Campo etiqueta="Nombre completo" autoFocus error={errors.nombre?.message} {...register('nombre')} />
          <Campo etiqueta="Usuario para entrar" autoComplete="off" placeholder="ej. maria" error={errors.usuario?.message} {...register('usuario')} />
          <Campo etiqueta="Contraseña inicial" type="text" autoComplete="off" error={errors.contrasena?.message} {...register('contrasena')} />
          <Selector etiqueta="Rol" {...register('rol')}>
            <option value="VENDEDOR">Vendedor: registra ventas y consulta</option>
            <option value="DUENO">Dueño: administra todo</option>
          </Selector>
        </form>
      </PanelLateral>

      <Dialogo abierto={!!clave} onCerrar={() => setClave(null)}>
        {clave && (
          <>
            <h2 className="display text-3xl">Nueva contraseña</h2>
            <p className="mt-1 text-sm text-muted">Para <b className="text-ink">{clave.usuario.nombre}</b> (@{clave.usuario.usuario}).</p>
            <div className="mt-4">
              <Campo etiqueta="Contraseña nueva" type="text" autoFocus autoComplete="off" value={clave.texto} error={clave.error} onChange={(e) => setClave({ ...clave, texto: e.target.value, error: undefined })} />
            </div>
            <div className="mt-6 flex gap-2"><Button variante="secundario" className="flex-1" onClick={() => setClave(null)}>Cancelar</Button><Button className="flex-1" onClick={() => void guardarClave()}>Restablecer</Button></div>
          </>
        )}
      </Dialogo>

      <Dialogo abierto={!!desactivar} onCerrar={() => setDesactivar(null)}>
        {desactivar && (
          <>
            <h2 className="display text-3xl">¿Desactivar a {desactivar.nombre.split(' ')[0]}?</h2>
            <p className="mt-2 text-sm text-muted">Pierde el acceso al instante, incluso si tiene la sesión abierta. Sus ventas anteriores se conservan y puedes reactivarlo cuando quieras.</p>
            <div className="mt-6 flex gap-2">
              <Button variante="secundario" className="flex-1" onClick={() => setDesactivar(null)}>Cancelar</Button>
              <Button variante="peligro" className="flex-1" onClick={async () => { await cambiarActivo(desactivar, false); setDesactivar(null) }}>Desactivar</Button>
            </div>
          </>
        )}
      </Dialogo>
    </Bloque>
  )
}
