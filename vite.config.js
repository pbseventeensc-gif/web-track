import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/web-track/', // Nama repository GitHub Anda
  build: {
    chunkSizeWarningLimit: 1600, // Menghilangkan peringatan warna kuning >500kB
  }
})