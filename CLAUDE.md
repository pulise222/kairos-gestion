# Reglas de trabajo con Juan Sebastián (leer SIEMPRE antes de empezar)

Juan Sebastián Pulido Bojaca: tecnólogo SENA, excelente en HTML/CSS, con experiencia previa como *product owner*
(historias de usuario, dirección de equipos). Está construyendo su portafolio y buscando empleo. Quiere
**aprender de verdad** y poder **explicar todo en una entrevista**. El plan del proyecto está en `ARRANQUE_PROYECTO.md`.

## Cómo responder
- **Siempre en español**, tono cercano y didáctico. Explica el *porqué*, no solo el qué. Explica por partes los conceptos nuevos.
- **Comenta el código nuevo en español** explicando la intención (no lo obvio).
- Sé honesto: si algo no está bien, no es seguro o no se probó, dilo con claridad. No inventes datos ni resultados.

## Cómo trabajar
1. **Propón antes de cambiar.** Antes de crear o modificar archivos, instalar paquetes o ejecutar comandos que cambien algo,
   explica brevemente qué vas a hacer y por qué. Si es una duda de producto, pregunta.
2. **Avanza por secciones pequeñas**, una a la vez, mostrando el resultado antes de pasar a la siguiente.
3. **Verifica de verdad**: prueba en el navegador y con pruebas automáticas; no digas "listo" sin comprobarlo.
4. **No hagas commit ni push hasta que él lo pida** ("haz el commit"). Cuando lo pida, commits pequeños por tema, con mensaje
   claro en español. Nunca subir secretos, `.env` ni datos reales de clientes.
5. **Antes de tocar la base de datos**, avisa y haz respaldo. Si hay riesgo de perder datos, pregunta.
6. Si algo cambia las reglas de negocio o la API, explícalo y espera su visto bueno.
7. Cuando él lo apruebe, da un módulo por terminado y no lo toques más sin avisar.

## Estilo de producto
- Interfaz limpia, profesional e intuitiva, con **modo claro y oscuro**, pensada para uso diario rápido.
- Prefiere dar 2 o 3 opciones visuales (con ejemplo) cuando se trate de elegir colores o diseño; a él le gusta elegir.
- Accesible y usable en tablet y celular.

## Cosas que aprendimos en el proyecto anterior (Jardín Sullivan)
- Una sola fuente de verdad para las reglas de negocio (por ejemplo, el cálculo vive en el backend; el front solo muestra).
- Validar en el backend, no solo en el formulario.
- Evitar `alert/confirm/prompt` del navegador: usar avisos y diálogos propios.
- No guardar dinero en decimales flotantes.
- Una demo pública (solo front con datos simulados) es muy valiosa para el portafolio.


---
# Proyecto del cliente: Servicios Kairos (esta carpeta)
Esta carpeta es una copia **privada** del sistema base Nivel adaptada a un cliente real (insumos de calzado). Todo el trabajo del cliente se hace AQUÍ,
no en `control-tienda` ni en `nivel-gestion-negocio-demo` (son de portafolio y públicos). Antes de empezar lee `docs/CLIENTE_KAIROS.md`.
- Nunca subir `material-cliente/`, claves, `.env`, ni datos o fotos reales del negocio a repositorios públicos.
- Usuarios no técnicos (una persona mayor sin experiencia con computador): lo más simple posible, letra grande, mensajes claros, nada de jerga.
- El remoto `base` apunta al sistema base: se pueden traer mejoras con `git fetch base` y `git merge base/main`.
