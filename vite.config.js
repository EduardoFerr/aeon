import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import fs from "node:fs/promises";

export default defineConfig({
  // Obs.: um bloco "build.build" (base, outDir, minify terser, publicDir) existia
  // aqui aninhado no nivel errado e o Vite o ignorava. Foi removido sem mudar o
  // resultado: os valores efetivos sempre foram os padroes (base "/", outDir
  // "dist", minify esbuild, publicDir "public").
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        sobre: path.resolve(__dirname, "sobre.html"),
        contato: path.resolve(__dirname, "contato.html"),
        livro: path.resolve(__dirname, "livro.html"),
        "politica-privacidade": path.resolve(
          __dirname,
          "politica-privacidade.html"
        ),
      },
    },
    cssCodeSplit: true,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        sourcemap: true,
        // Dados do mapa astral (textos e lista de cidades) nao entram no precache: ficam fora do
        // globPatterns (so js, css, html e imagens). Depois da primeira leitura online, o service worker
        // guarda cada arquivo para o mapa funcionar sem rede.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              /^\/data\/(astro|locais)\/[^/]+\.json$/.test(url.pathname),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "aeon-astro-dados",
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      includeAssets: ["favicon.ico", "robots.txt", "icons/*.png"],
      manifest: {
        name: "Aeon Fool",
        short_name: "Aeon Fool",
        description:
          "Explorando o Tarot de Thoth, de Aleister Crowley, com leituras e sabedoria esotérica.",
        start_url: "/index.html",
        scope: "/",
        display: "standalone",
        theme_color: "#000000",
        background_color: "#000000",
        icons: [
          {
            src: "/icons/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // Alias para a pasta src
      "@public": path.resolve(__dirname, "public"), // Alias para public
    },
  },
});
