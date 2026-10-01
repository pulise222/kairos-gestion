# Primer mensaje para el chat nuevo

(Abre el chat nuevo **dentro de la carpeta `control-tienda`** y pega esto.)

---

Hola. Vamos a construir un sistema de control para tiendas y pequeños establecimientos. Antes de empezar, lee en este orden:

1. `CLAUDE.md` (cómo trabajamos)
2. `ARRANQUE_PROYECTO.md` (visión, historias de usuario, tecnologías, modelo de datos y fases)
3. `DISENO_Y_PANTALLAS.md` (diseño elegido, módulos, flujo de pantallas y la Fase 0)

Contexto resumido: es un sistema de ventas, inventario y panel de ganancias, con 6 módulos (Venta, Productos, Inventario, Proveedores, Panel y
Configuración). Se instala en el PC del cliente con Docker (funciona sin internet) y hace copias de seguridad automáticas. Stack: React +
TypeScript + Vite + Tailwind, Node.js + Express + Prisma, PostgreSQL. Primero lo hacemos genérico y adaptable a cualquier negocio; después se
personaliza para mi cliente (una tienda).

**Decisiones de diseño ya tomadas:** modo claro *H · Porcelana*; modo oscuro *E · Obsidiana y oro* (propuesto, lo confirmo contigo);
tipografía con serifa en las cifras; fondo generado con código (curvas de nivel) en lugar de fotos; anillos de stock en los productos.

**Lo primero, y NO desarrolles el sistema todavía:** haz la **Fase 0 (diseño y aprobación)**. Antes de escribir código,
cuéntame en pocas líneas tu plan para el prototipo navegable (estructura de carpetas, cómo organizarás los tokens de diseño y los componentes) y
espera mi visto bueno. Después construye el prototipo sin backend y con datos de ejemplo, por pantallas, mostrándome cada una:
Login, Primer arranque, Panel, **Venta (interactiva de punta a punta)**, Productos, Inventario y Configuración (Apariencia con el fondo generado),
en claro y oscuro y en escritorio, tablet y celular. Ofréceme 3 opciones de nombre y logo, y 2 o 3 variantes del fondo para elegir.

Yo evalúo el diseño y te pido ajustes hasta aprobarlo; solo entonces desarrollamos el backend y la funcionalidad, fase por fase.
Responde en español, explícame lo que hagas y no hagas commits hasta que yo lo pida.
