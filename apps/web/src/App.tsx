import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { CierrePagina } from './pages/Cierre'
import { Configuracion } from './pages/Configuracion'
import { Inventario } from './pages/Inventario'
import { Login } from './pages/Login'
import { Panel } from './pages/Panel'
import { PrimerArranque } from './pages/PrimerArranque'
import { Productos } from './pages/Productos'
import { Proveedores } from './pages/Proveedores'
import { Venta } from './pages/Venta'
import { Ventas } from './pages/Ventas'
import { RutaProtegida } from './sesion/RutaProtegida'

// HashRouter (#/panel): funciona igual al instalarlo en el PC del cliente y en GitHub Pages (demo), sin configurar el servidor.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/inicio" element={<PrimerArranque />} />

        {/* Todo lo de adentro exige haber iniciado sesión */}
        <Route element={<RutaProtegida />}>
          <Route element={<AppLayout />}>
            <Route path="/venta" element={<Venta />} />
            <Route path="/ventas" element={<Ventas />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/inventario" element={<Inventario />} />
            {/* Estas son solo del dueño: un vendedor que escriba la dirección rebota a Venta */}
            <Route element={<RutaProtegida soloDueno />}>
              <Route path="/cierre" element={<CierrePagina />} />
              <Route path="/panel" element={<Panel />} />
              <Route path="/proveedores" element={<Proveedores />} />
              <Route path="/configuracion" element={<Configuracion />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
