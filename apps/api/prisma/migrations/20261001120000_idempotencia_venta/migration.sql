-- Clave de idempotencia de la venta: un mismo intento de venta (doble clic, reintento por red) nunca se registra dos veces.
ALTER TABLE "venta" ADD COLUMN "clave_idempotencia" TEXT;

CREATE UNIQUE INDEX "venta_clave_idempotencia_key" ON "venta"("clave_idempotencia");
