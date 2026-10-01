# Personalizar Nivel para un cliente (sin tocar código)

1. Copia esta carpeta y renómbrala a **`personalizacion`** (junto al archivo `.env`, en `apps/api`).
2. Cambia **`logo.svg`** por el logo del cliente. Sirve `logo.svg`, `logo.png`, `logo.webp` o `logo.jpg` (cuadrado o casi, fondo transparente si puede ser).
3. Edita **`marca.json`**. Todo es opcional; lo que no pongas queda con los colores de Nivel:

```json
{
  "lema": "Frase corta que sale en la pantalla de acceso (máx. 80 letras)",
  "claro":  { "bg": "#e3e8dc", "panel": "#f8faf4", "tile": "#d6dccd", "line": "#bcc7ae", "accent": "#2f6f4f" },
  "oscuro": { "accent": "#7fd1a0" }
}
```

Colores que se pueden cambiar (en `claro` y en `oscuro`): `bg` (fondo), `panel` (tarjetas), `tile` (cajas internas), `line` (bordes),
`text` (texto), `muted` (texto gris), `accent` (color principal), `on-accent` (texto sobre el color principal), `ok`, `warn`, `bad`.
Siempre en formato `#RRGGBB`. Si te equivocas en un color, el archivo se ignora y en la ventana del servidor aparece el motivo.

4. Reinicia el sistema (cierra y abre «Nivel») o recarga la página.

**Prioridad del color principal:** si el dueño eligió un color en *Configuración → Apariencia* (o en el asistente de primer arranque),
ese color gana. Para usar el de este archivo, en esa pantalla pulsa **Restablecer**.

**Nombre del negocio:** no va aquí; se escribe en el asistente o en *Configuración → Negocio*.
