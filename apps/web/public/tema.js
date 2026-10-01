// Aplica el tema guardado ANTES de pintar, para evitar el destello de tema equivocado.
// Está en un archivo aparte (y no «en línea» dentro del HTML) porque la política de seguridad del servidor
// (Content-Security-Policy: script-src 'self') solo permite scripts que vengan de un archivo propio.
try {
  var t = localStorage.getItem('nivel-tema')
  if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = t
} catch (e) {}
