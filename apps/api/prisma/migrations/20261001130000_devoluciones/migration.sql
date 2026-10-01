

-- CreateEnum
CREATE TYPE "MotivoDevolucionProveedor" AS ENUM ('SOBRANTE', 'DANADO', 'EQUIVOCADO', 'VENCIDO', 'OTRO');

-- CreateEnum
CREATE TYPE "ResolucionProveedor" AS ENUM ('PENDIENTE', 'NOTA_CREDITO', 'REEMBOLSO', 'REPOSICION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoMovimiento" ADD VALUE 'DEVOLUCION_CLIENTE';
ALTER TYPE "TipoMovimiento" ADD VALUE 'DEVOLUCION_PROVEEDOR';

-- AlterTable
ALTER TABLE "movimiento_stock" ADD COLUMN     "devolucion_id" INTEGER,
ADD COLUMN     "devolucion_proveedor_id" INTEGER;

-- CreateTable
CREATE TABLE "devolucion" (
    "id" SERIAL NOT NULL,
    "venta_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "medio_reembolso" "MedioPago" NOT NULL DEFAULT 'EFECTIVO',
    "clave_idempotencia" TEXT,
    "creada_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devolucion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devolucion_item" (
    "id" SERIAL NOT NULL,
    "devolucion_id" INTEGER NOT NULL,
    "venta_item_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "nombre_producto" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "precio_unitario" INTEGER NOT NULL,
    "costo_unitario" INTEGER NOT NULL,
    "reingresa_stock" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "devolucion_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devolucion_proveedor" (
    "id" SERIAL NOT NULL,
    "proveedor_id" INTEGER NOT NULL,
    "compra_id" INTEGER,
    "usuario_id" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "motivo" "MotivoDevolucionProveedor" NOT NULL,
    "nota" TEXT,
    "resolucion" "ResolucionProveedor" NOT NULL DEFAULT 'PENDIENTE',
    "clave_idempotencia" TEXT,
    "fecha" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devolucion_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devolucion_proveedor_item" (
    "id" SERIAL NOT NULL,
    "devolucion_proveedor_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costo_unitario" INTEGER NOT NULL,

    CONSTRAINT "devolucion_proveedor_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devolucion_clave_idempotencia_key" ON "devolucion"("clave_idempotencia");

-- CreateIndex
CREATE INDEX "devolucion_venta_id_idx" ON "devolucion"("venta_id");

-- CreateIndex
CREATE INDEX "devolucion_creada_en_idx" ON "devolucion"("creada_en");

-- CreateIndex
CREATE INDEX "devolucion_item_devolucion_id_idx" ON "devolucion_item"("devolucion_id");

-- CreateIndex
CREATE INDEX "devolucion_item_venta_item_id_idx" ON "devolucion_item"("venta_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "devolucion_proveedor_clave_idempotencia_key" ON "devolucion_proveedor"("clave_idempotencia");

-- CreateIndex
CREATE INDEX "devolucion_proveedor_proveedor_id_fecha_idx" ON "devolucion_proveedor"("proveedor_id", "fecha");

-- CreateIndex
CREATE INDEX "devolucion_proveedor_compra_id_idx" ON "devolucion_proveedor"("compra_id");

-- CreateIndex
CREATE INDEX "devolucion_proveedor_item_devolucion_proveedor_id_idx" ON "devolucion_proveedor_item"("devolucion_proveedor_id");

-- CreateIndex
CREATE INDEX "devolucion_proveedor_item_producto_id_idx" ON "devolucion_proveedor_item"("producto_id");

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_devolucion_id_fkey" FOREIGN KEY ("devolucion_id") REFERENCES "devolucion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_stock" ADD CONSTRAINT "movimiento_stock_devolucion_proveedor_id_fkey" FOREIGN KEY ("devolucion_proveedor_id") REFERENCES "devolucion_proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion" ADD CONSTRAINT "devolucion_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "venta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion" ADD CONSTRAINT "devolucion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_item" ADD CONSTRAINT "devolucion_item_devolucion_id_fkey" FOREIGN KEY ("devolucion_id") REFERENCES "devolucion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_item" ADD CONSTRAINT "devolucion_item_venta_item_id_fkey" FOREIGN KEY ("venta_item_id") REFERENCES "venta_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_item" ADD CONSTRAINT "devolucion_item_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_proveedor" ADD CONSTRAINT "devolucion_proveedor_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_proveedor" ADD CONSTRAINT "devolucion_proveedor_compra_id_fkey" FOREIGN KEY ("compra_id") REFERENCES "compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_proveedor" ADD CONSTRAINT "devolucion_proveedor_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_proveedor_item" ADD CONSTRAINT "devolucion_proveedor_item_devolucion_proveedor_id_fkey" FOREIGN KEY ("devolucion_proveedor_id") REFERENCES "devolucion_proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devolucion_proveedor_item" ADD CONSTRAINT "devolucion_proveedor_item_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Restricciones de integridad de las devoluciones (última línea de defensa).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "devolucion"
  ADD CONSTRAINT "devolucion_total_no_negativo" CHECK ("total" >= 0),
  ADD CONSTRAINT "devolucion_con_motivo" CHECK (length(btrim("motivo")) > 0);

ALTER TABLE "devolucion_item"
  ADD CONSTRAINT "devolucion_item_cantidad_positiva" CHECK ("cantidad" > 0),
  ADD CONSTRAINT "devolucion_item_precio_no_negativo" CHECK ("precio_unitario" >= 0),
  ADD CONSTRAINT "devolucion_item_costo_no_negativo" CHECK ("costo_unitario" >= 0);

ALTER TABLE "devolucion_proveedor"
  ADD CONSTRAINT "devolucion_proveedor_total_no_negativo" CHECK ("total" >= 0);

ALTER TABLE "devolucion_proveedor_item"
  ADD CONSTRAINT "devolucion_proveedor_item_cantidad_positiva" CHECK ("cantidad" > 0),
  ADD CONSTRAINT "devolucion_proveedor_item_costo_no_negativo" CHECK ("costo_unitario" >= 0);
