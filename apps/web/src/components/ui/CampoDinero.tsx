import { Campo } from './Campo'

interface Props {
  etiqueta: string
  valor: number | undefined
  onCambiar: (v: number) => void
  error?: string
  /** Texto de ayuda bajo el campo. */
  ayuda?: string
  id?: string
}

/* Campo para dinero y cantidades enteras: solo deja escribir dígitos y los muestra con puntos de miles.
   El valor siempre es un número ENTERO de pesos (nunca decimales). */
export function CampoDinero({ etiqueta, valor, onCambiar, error, ayuda }: Props) {
  return (
    <div>
      <Campo
        etiqueta={etiqueta}
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        value={valor ? new Intl.NumberFormat('es-CO').format(valor) : ''}
        onChange={(e) => onCambiar(Number(e.target.value.replace(/\D/g, '')) || 0)}
        error={error}
        className="tabular"
      />
      {ayuda && !error && <p className="mt-1.5 text-xs text-muted">{ayuda}</p>}
    </div>
  )
}
