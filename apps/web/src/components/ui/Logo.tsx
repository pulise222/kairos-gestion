import { useMarcaCliente } from '../../design/personalizacion'

/* Logo "Nivel": curvas de nivel concéntricas (nivel de stock + el patrón del fondo).
   Usa currentColor, así toma el acento del tema o del cliente. */
export function Logo({ className = 'size-9' }: { className?: string }) {
  // Si el cliente dejó su propio logo en la carpeta de personalización, se usa en lugar del de Nivel.
  const { logo } = useMarcaCliente()
  if (logo) return <img src={logo} alt="" aria-hidden="true" className={`${className} object-contain`} />
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
