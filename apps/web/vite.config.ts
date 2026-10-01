import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En desarrollo, el front pide "/api/..." a su propio servidor y Vite lo reenvía a la API (puerto 3001).
// En producción hace lo mismo nginx. Así no hay CORS ni direcciones fijas en el código.
const destino = process.env.API_URL ?? 'http://localhost:3001'
const api = { '/api': { target: destino, changeOrigin: false }, '/uploads': { target: destino, changeOrigin: false }, '/personalizacion': { target: destino, changeOrigin: false } }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: api },
  preview: { proxy: api },
})
