-- Descripción opcional del producto (ej. "Botella plástica de 600 ml").
ALTER TABLE "producto" ADD COLUMN "descripcion" TEXT;

-- El código es único SIN importar mayúsculas: "APEQ1" y "apeq1" son el mismo código.
-- (Antes solo se comparaba exacto; el dueño ahora puede escribir códigos propios con letras.)
CREATE UNIQUE INDEX "producto_codigo_minusculas_key" ON "producto" (lower("codigo"));
