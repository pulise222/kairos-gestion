-- El nombre de una categoría es único SIN importar mayúsculas ("Bebidas" = "bebidas").
CREATE UNIQUE INDEX "categoria_nombre_minusculas_key" ON "categoria" (lower("nombre"));
