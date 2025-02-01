import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { partytownVite } from "@builder.io/partytown/utils";
import path from "node:path";
import fs from "node:fs/promises";

export default defineConfig({
  build: {
    base: "./",
    build: {
      outDir: "dist",  // Diretório final da build
    },
    publicDir: "public",
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
        sourcemap: true
      },
      includeAssets: ["favicon.ico", "robots.txt", "icons/*.png"],
      manifest: {
        name: "Aeon Fool",
        short_name: "Aeon Fool",
        description:
          "Explorando o Tarot de Thoth, de Aleister Crowley, com leituras e sabedoria esotérica.",
        start_url: "/index.html",
        scope: "./dist/",
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
});
