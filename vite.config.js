import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Voxel-Verse/',
  plugins: [react()],
})