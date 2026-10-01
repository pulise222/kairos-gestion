import { useState } from 'react'
import { Cookie, CupSoda, Milk, Package, SprayCan, Wheat } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Categoria } from '../../mock/catalogo'

// Sin foto, un ícono por categoría hace de imagen (sin depender de internet ni de derechos de autor).
const iconos: Record<string, LucideIcon> = { bebidas: CupSoda, aseo: SprayCan, abarrotes: Wheat, lacteos: Milk, snacks: Cookie }

interface Props {
  categoriaId: string
  categoria?: Categoria
  /** Foto del producto, si tiene. */
  imagen?: string | null
  /** Clases de tamaño del contenedor, por ejemplo "size-10 rounded-xl". */
  className?: string
  iconoClase?: string
}

/** La foto del producto; si no tiene (o no carga), un cuadro teñido con el color de la categoría y su ícono. */
export function Miniatura({ categoriaId, categoria, imagen, className = 'size-10 rounded-xl', iconoClase = 'size-5' }: Props) {
  // Si la dirección de la foto falla (archivo borrado), se vuelve al ícono en vez de mostrar una imagen rota.
  const [fallo, setFallo] = useState<string | null>(null)
  if (imagen && fallo !== imagen) {
    return <img src={imagen} alt="" loading="lazy" onError={() => setFallo(imagen)} className={`shrink-0 bg-tile object-cover ${className}`} />
  }
  const Icono = iconos[categoriaId] ?? Package
  const color = categoria?.color ?? 'var(--accent)'
  return (
    <span className={`grid shrink-0 place-items-center ${className}`} style={{ background: `color-mix(in srgb, ${color} 14%, var(--tile))`, color }} aria-hidden="true">
      <Icono className={iconoClase} strokeWidth={1.7} />
    </span>
  )
}
