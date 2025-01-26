import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true,
    host: '127.0.0.1',
    port: 3000,
  },
  build: {
    rollupOptions: {
      output: {
        assetFileNames: ({ name }) => {
          if (name && name.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]'; // Adiciona hash nos arquivos CSS
          }
          return 'assets/[name]-[hash][extname]'; // Para outros assets
        },
      },
    },
    cssCodeSplit: true, // Certifique-se de que o CSS seja separado em arquivos
  },
});
