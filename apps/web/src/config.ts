/*
  Dos modos de la MISMA aplicación:
    · real  (por defecto): habla con la API y la base de datos. Es el producto que se instala.
    · demo  (VITE_MODO=demo al compilar): datos de ejemplo en memoria, sin servidor. Es la demo pública de portafolio.
*/
export const MODO_DEMO = import.meta.env.VITE_MODO === 'demo'
