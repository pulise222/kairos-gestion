import { useMarcaCliente } from '../../design/personalizacion'
import { useTema } from '../../theme/ThemeProvider'

/* Logo "Nivel": curvas de nivel concéntricas (nivel de stock + el patrón del fondo).
   Usa currentColor, así toma el acento del tema o del cliente.
   Si el cliente dejó su propio logo en la carpeta de personalización, se usa ese:
     · variante «icono» (barra lateral, carga): el logo cuadrado, o el completo si no hay;
     · variante «completo» (pantalla de acceso): el logo completo.
   En modo oscuro se usa la versión clara del logo si existe. */
export function Logo({ className = 'size-9', variante = 'icono', enRiel = false }: { className?: string; variante?: 'icono' | 'completo'; /** La barra lateral es oscura en los dos modos: allí siempre va la versión clara del logo. */ enRiel?: boolean }) {
  const m = useMarcaCliente()
  const { tema } = useTema()
  const oscuro = tema === 'dark' || enRiel
  const completo = (oscuro && m.logoOscuro) || m.logo
  const icono = (oscuro && m.logoIconoOscuro) || m.logoIcono
  const propio = variante === 'completo' ? completo : icono ?? completo
  if (propio) return <img src={propio} alt="" aria-hidden="true" className={`${className} object-contain`} />
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M32 6c14 0 26 10 26 24 0 16-12 28-27 28C17 58 6 47 6 33 6 17 18 6 32 6z" />
      <path d="M32 17c9 0 17 7 17 16 0 11-8 19-18 19-9 0-16-7-16-16 0-11 7-19 17-19z" />
      <circle cx="32" cy="33" r="5" fill="currentColor" stroke="none" />
    </svg>
  )
}
