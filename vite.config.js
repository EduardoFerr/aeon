import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    open: true,
    host: '127.0.0.1',
    port: 3000,
  },
  build: {
    base: '/',
    manifest: true,
    rollupOptions: {
      output: {
        assetFileNames: ({ name }) => {
          if (name && name.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]';
          }
          if (name === 'manifest.json' || name === 'favicon.ico') {
            return '[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    cssCodeSplit: true,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: {
        name: 'Aeon Fool',
        short_name: 'Aeon Fool',
        description: 'Explorando o Tarot de Thoth, de Aleister Crowley, com leituras e sabedoria esotérica.',
        start_url: '/index.html',
        scope: '/',
        display: 'standalone',
        theme_color: '#000000',
        background_color: '#000000',
        icons: [
          {
            src: '/icons/android-chrome-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});
