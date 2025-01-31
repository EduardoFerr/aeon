import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

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
          // Evite adicionar hash em arquivos críticos como manifestos ou ícones
          if (name === 'manifest.json' || name === 'favicon.ico') {
            return '[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    cssCodeSplit: true, // Certifique-se de que o CSS seja separado em arquivos
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'ads.txt', // Arquivo de origem
          dest: '.' // Copia para a raiz do diretório de saída
        }
      ]
    })
  ]
});
