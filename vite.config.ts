import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/events-lite': {
        target: 'https://api.hel.fi',
        changeOrigin: true,
        rewrite: (path) => '/linkedevents/v1/event/?page_size=200',
      },
    },
  },
})
