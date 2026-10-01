import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { AjustesProvider } from './ajustes/AjustesProvider'
import { AvisosProvider } from './components/ui/Avisos'
import { CatalogoProvider } from './data/CatalogoProvider'
import { SesionProvider } from './sesion/SesionProvider'
import { ThemeProvider } from './theme/ThemeProvider'

// Orden de los proveedores (cada uno puede usar los de arriba):
// tema → avisos → sesión (quién es el usuario) → ajustes (necesita la sesión) → catálogo (necesita la sesión).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AvisosProvider>
        <SesionProvider>
          <AjustesProvider>
            <CatalogoProvider>
              <App />
            </CatalogoProvider>
          </AjustesProvider>
        </SesionProvider>
      </AvisosProvider>
    </ThemeProvider>
  </StrictMode>,
)
