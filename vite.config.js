import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  server: {
    open: true,
    host: '127.0.0.1',
    port: 3000,
  },
  build: {
    manifest: true,
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
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'assets/favicon/apple-touch-icon.png', dest: '.' },
        { src: 'assets/favicon/favicon-32x32.png', dest: '.' },
        { src: 'assets/favicon/favicon-16x16.png', dest: '.' },
        { src: 'assets/favicon/site.webmanifest', dest: '.' },
        {
          src: 'ads.txt', // Arquivo de origem
          dest: '.' // Copia para a raiz do diretório de saída
        }
      ]
    })
  ]
});
