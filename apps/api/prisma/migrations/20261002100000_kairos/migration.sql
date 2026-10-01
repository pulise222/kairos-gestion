-- Kairos: productos sin control de inventario, venta por monto por sección, cierre del día y comentarios.
-- AlterTable
ALTER TABLE "producto" ADD COLUMN     "controla_stock" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "es_sistema" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "precio_libre" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "cierre_caja" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "fondo_inicial" INTEGER NOT NULL DEFAULT 0,
    "efectivo_esperado" INTEGER NOT NULL,
    "efectivo_contado" INTEGER NOT NULL,
    "diferencia" INTEGER NOT NULL,
    "total_ventas" INTEGER NOT NULL,
    "tickets" INTEGER NOT NULL,
    "nota" TEXT,
    "usuario_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cierre_caja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentario" (
    "id" SERIAL NOT NULL,
    "texto" TEXT NOT NULL,
    "pantalla" TEXT,
    "usuario_id" INTEGER NOT NULL,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cierre_caja_fecha_key" ON "cierre_caja"("fecha");

-- CreateIndex
CREATE INDEX "comentario_creado_en_idx" ON "comentario"("creado_en");

-- AddForeignKey
ALTER TABLE "cierre_caja" ADD CONSTRAINT "cierre_caja_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentario" ADD CONSTRAINT "comentario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Restricciones de integridad (a mano: Prisma no las expresa)
ALTER TABLE "cierre_caja"
  ADD CONSTRAINT "cierre_fondo_no_negativo" CHECK ("fondo_inicial" >= 0),
  ADD CONSTRAINT "cierre_contado_no_negativo" CHECK ("efectivo_contado" >= 0),
  ADD CONSTRAINT "cierre_diferencia_coherente" CHECK ("diferencia" = "efectivo_contado" - "efectivo_esperado");
-- El precio libre (monto escrito al vender) solo existe en los productos internos de «venta por monto».
ALTER TABLE "producto" ADD CONSTRAINT "producto_precio_libre_solo_sistema" CHECK (NOT "precio_libre" OR "es_sistema");
