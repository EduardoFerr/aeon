import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import fs from "node:fs/promises";

/**
 * No GitHub Pages, URL sem arquivo responde 404 com o 404.html. O servidor de preview (que serve o dist)
 * faz o mesmo (status 404 + a pagina), para a pagina de erro poder ser conferida antes do deploy.
 */
function pagina404() {
  const servir = (raiz) => (server) => () =>
    server.middlewares.use(async (req, res, next) => {
      if (req.method !== "GET" || !(req.headers.accept || "").includes("text/html")) return next();
      // Caminho que existe no dist (inclui "/" e as paginas .html): quem serve e o arquivo, nao o 404.
      const caminho = decodeURIComponent((req.url || "/").split("?")[0]);
      const base = raiz(server);
      const candidatos = caminho.endsWith("/") ? [path.join(base, caminho, "index.html")] : [path.join(base, caminho), path.join(base, caminho, "index.html")];
      for (const c of candidatos) {
        if (c.startsWith(base)) { try { if ((await fs.stat(c)).isFile()) return next(); } catch { /* segue */ } }
      }
      try {
        let html = await fs.readFile(path.join(raiz(server), "404.html"), "utf-8");
        if (server.transformIndexHtml) html = await server.transformIndexHtml("/404.html", html);
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
      } catch {
        next();
      }
    });
  return {
    name: "aeon-pagina-404",
    configurePreviewServer: servir((s) => path.resolve(s.config.root, s.config.build.outDir)),
  };
}

export default defineConfig({
  // Obs.: um bloco "build.build" (base, outDir, minify terser, publicDir) existia
  // aqui aninhado no nivel errado e o Vite o ignorava. Foi removido sem mudar o
  // resultado: os valores efetivos sempre foram os padroes (base "/", outDir
  // "dist", minify esbuild, publicDir "public").
  // O site e um conjunto de paginas HTML (nao ha rota de servidor): URL sem arquivo correspondente
  // responde 404 (e o 404.html no GitHub Pages), em vez de cair na Home.
  appType: "mpa",
  build: {
    manifest: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        sobre: path.resolve(__dirname, "sobre.html"),
        contato: path.resolve(__dirname, "contato.html"),
        livro: path.resolve(__dirname, "livro.html"),
        // pagina de erro do GitHub Pages: servida em dist/404.html para qualquer URL inexistente
        "404": path.resolve(__dirname, "404.html"),
        "politica-privacidade": path.resolve(
          __dirname,
          "politica-privacidade.html"
        ),
      },
    },
    cssCodeSplit: true,
  },
  plugins: [
    pagina404(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        // Sem fallback para a Home: URL inexistente vai a rede e recebe o 404.html. Os parametros de
        // consulta (/?profile, /?history...) sao ignorados ao procurar no precache, entao abrem o index.html offline.
        navigateFallback: null,
        ignoreURLParametersMatching: [/.*/],
        sourcemap: true,
        // Dados do mapa astral (textos e lista de cidades) nao entram no precache: ficam fora do
        // globPatterns (so js, css, html e imagens). Depois da primeira leitura online, o service worker
        // guarda cada arquivo para o mapa funcionar sem rede.
        runtimeCaching: [
          {
            // Os textos mudam a cada versao: rede primeiro (com o cache como reserva offline), para quem ja
            // visitou o site nunca ver uma tela nova com textos antigos faltando.
            urlPattern: ({ url }) => url.pathname === "/data/astro/textos.json",
            handler: "NetworkFirst",
            options: {
              cacheName: "aeon-astro-textos",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              /^\/data\/(astro|locais)\/[^/]+\.json$/.test(url.pathname) && url.pathname !== "/data/astro/textos.json",
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
