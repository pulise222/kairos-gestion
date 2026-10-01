-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DUENO', 'VENDEDOR');

-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('COMPLETADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('ENTRADA', 'VENTA', 'AJUSTE', 'ANULACION');

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "contrasena_hash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#b8502a',
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "correo" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "imagen" TEXT,
    "categoria_id" INTEGER NOT NULL,
    "proveedor_id" INTEGER,
    "costo" INTEGER NOT NULL,
    "precio" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta" (
    "id" SERIAL NOT NULL,
    "numero" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "pagado" INTEGER NOT NULL,
    "vueltas" INTEGER NOT NULL,
    "medio_pago" "MedioPago" NOT NULL DEFAULT 'EFECTIVO',
    "estado" "EstadoVenta" NOT NULL DEFAULT 'COMPLETADA',
    "motivo_anulacion" TEXT,
    "anulada_en" TIMESTAMPTZ,
    "anulada_por_id" INTEGER,
    "creada_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venta_item" (
    "id" SERIAL NOT NULL,
    "venta_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "nombre_producto" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" INTEGER NOT NULL,
    "costo_unitario" INTEGER NOT NULL,

    CONSTRAINT "venta_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compra" (
    "id" SERIAL NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "notas" TEXT,
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compra_item" (
    "id" SERIAL NOT NULL,
    "compra_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costo_unitario" INTEGER NOT NULL,

    CONSTRAINT "compra_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_stock" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "stock_resultante" INTEGER NOT NULL,
    "motivo" TEXT,
    "venta_id" INTEGER,
    "compra_id" INTEGER,
    "usuario_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_precio" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "costo_anterior" INTEGER NOT NULL,
    "costo_nuevo" INTEGER NOT NULL,
    "precio_anterior" INTEGER NOT NULL,
    "precio_nuevo" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_precio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "clave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_usuario_key" ON "usuario"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_nombre_key" ON "categoria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "producto_codigo_key" ON "producto"("codigo");

-- CreateIndex
CREATE INDEX "producto_categoria_id_idx" ON "producto"("categoria_id");

-- CreateIndex
CREATE INDEX "producto_proveedor_id_idx" ON "producto"("proveedor_id");

-- CreateIndex
CREATE INDEX "producto_nombre_idx" ON "producto"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "venta_numero_key" ON "venta"("numero");

-- CreateIndex
CREATE INDEX "venta_creada_en_idx" ON "venta"("creada_en");

-- CreateIndex
CREATE INDEX "venta_estado_creada_en_idx" ON "venta"("estado", "creada_en");

-- CreateIndex
CREATE INDEX "venta_item_venta_id_idx" ON "venta_item"("venta_id");

-- CreateIndex
CREATE INDEX "venta_item_producto_id_idx" ON "venta_item"("producto_id");

-- CreateIndex
CREATE INDEX "compra_proveedor_id_idx" ON "compra"("proveedor_id");

-- CreateIndex
CREATE INDEX "compra_fecha_idx" ON "compra"("fecha");

-- CreateIndex
CREATE INDEX "compra_item_compra_id_idx" ON "compra_item"("compra_id");

-- CreateIndex
CREATE INDEX "compra_item_producto_id_idx" ON "compra_item"("producto_id");

-- CreateIndex
CREATE INDEX "movimiento_stock_producto_id_creado_en_idx" ON "movimiento_stock"("producto_id", "creado_en");

-- CreateIndex
CREATE INDEX "movimiento_stock_venta_id_idx" ON "movimiento_stock"("venta_id");

-- CreateIndex
CREATE INDEX "movimiento_stock_compra_id_idx" ON "movimiento_stock"("compra_id");

-- CreateIndex
CREATE INDEX "historial_precio_producto_id_creado_en_idx" ON "historial_precio"("producto_id", "creado_en");

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta" ADD CONSTRAINT "venta_anulada_por_id_fkey" FOREIGN KEY ("anulada_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_item" ADD CONSTRAINT "venta_item_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venta_item" ADD CONSTRAINT "venta_item_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra" ADD CONSTRAINT "compra_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_item" ADD CONSTRAINT "compra_item_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compra_item" ADD CONSTRAINT "compra_item_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_precio" ADD CONSTRAINT "historial_precio_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_precio" ADD CONSTRAINT "historial_precio_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Restricciones de integridad (CHECK) agregadas a mano: Prisma no las expresa en el esquema.
-- Son la última línea de defensa: aunque un error en el código intentara guardar datos
-- imposibles, la base de datos los rechaza.
-- ─────────────────────────────────────────────────────────────────────────────

-- Dinero y mínimos nunca negativos. (El stock SÍ puede ser negativo: depende de la regla
-- configurable "permitir vender sin stock", así que no se restringe aquí.)
ALTER TABLE "producto"
  ADD CONSTRAINT "producto_costo_no_negativo" CHECK ("costo" >= 0),
  ADD CONSTRAINT "producto_precio_no_negativo" CHECK ("precio" >= 0),
  ADD CONSTRAINT "producto_minimo_no_negativo" CHECK ("stock_minimo" >= 0);

-- Una venta cuadra siempre: se pagó al menos el total y las vueltas son exactamente la diferencia.
ALTER TABLE "venta"
  ADD CONSTRAINT "venta_total_no_negativo" CHECK ("total" >= 0),
  ADD CONSTRAINT "venta_pago_suficiente" CHECK ("pagado" >= "total"),
  ADD CONSTRAINT "venta_vueltas_exactas" CHECK ("vueltas" = "pagado" - "total"),
  ADD CONSTRAINT "venta_anulacion_con_motivo" CHECK ("estado" <> 'ANULADA' OR "motivo_anulacion" IS NOT NULL);

ALTER TABLE "venta_item"
  ADD CONSTRAINT "venta_item_cantidad_positiva" CHECK ("cantidad" > 0),
  ADD CONSTRAINT "venta_item_precio_no_negativo" CHECK ("precio_unitario" >= 0),
  ADD CONSTRAINT "venta_item_costo_no_negativo" CHECK ("costo_unitario" >= 0);

ALTER TABLE "compra"
  ADD CONSTRAINT "compra_total_no_negativo" CHECK ("total" >= 0);

ALTER TABLE "compra_item"
  ADD CONSTRAINT "compra_item_cantidad_positiva" CHECK ("cantidad" > 0),
  ADD CONSTRAINT "compra_item_costo_no_negativo" CHECK ("costo_unitario" >= 0);

-- Un movimiento que no mueve nada no tiene sentido.
ALTER TABLE "movimiento_stock"
  ADD CONSTRAINT "movimiento_cantidad_distinta_de_cero" CHECK ("cantidad" <> 0);

-- El usuario se guarda en minúsculas para que "Juan" y "juan" no sean dos cuentas.
ALTER TABLE "usuario"
  ADD CONSTRAINT "usuario_en_minusculas" CHECK ("usuario" = lower("usuario"));
