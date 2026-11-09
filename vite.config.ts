import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
// BASE_PATH is set by the GitHub Pages workflow (the app is served from /img-cropper/).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [vue()],
})
