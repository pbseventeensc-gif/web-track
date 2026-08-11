import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/web-track/', // <-- WAJIB ADA (sesuai nama repository GitHub Anda)
})