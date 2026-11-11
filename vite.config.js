import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";

const pacote = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));
// Versao do app: package.json + data e hora do build. Aparece em Perfil, aba Dados, e em /versao.json.
const APP_VERSAO = pacote.version;
const APP_BUILD = new Date().toISOString();

/**
 * Publica /versao.json ({ versao, build }). Serve para o botao "Buscar atualizacao" quando o navegador nao tem
 * service worker (a verificacao normal e a do proprio service worker). Fica fora do precache e do cache de dados:
 * e sempre lido da rede.
 */
function versaoJson() {
  return {
    name: "aeon-versao-json",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "versao.json",
        source: JSON.stringify({ versao: APP_VERSAO, build: APP_BUILD }),
      });
    },
  };
}

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
  define: {
    __APP_VERSAO__: JSON.stringify(APP_VERSAO),
    __APP_BUILD__: JSON.stringify(APP_BUILD),
  },
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
        "guia-mapa-astral": path.resolve(__dirname, "guia-mapa-astral.html"),
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
    versaoJson(),
    VitePWA({
      // "prompt": a versao nova instala em segundo plano e espera. Quem decide quando trocar e a pessoa (aviso
      // "Atualizar agora"), assim a pagina nunca recarrega sozinha no meio de uma anotacao.
      registerType: "prompt",
      // O registro e manual (src/utils/atualizacao.js, via virtual:pwa-register), para checar versao nova ao abrir,
      // ao voltar para a aba e a cada 30 minutos, e mostrar o aviso.
      injectRegister: false,
      workbox: {
        // Sem skipWaiting (o aviso decide), mas com clientsClaim: na primeira visita o service worker ja
        // controla a pagina, e o app abre sem internet logo na segunda abertura.
        skipWaiting: false,
        clientsClaim: true,
        // Apaga os caches de precache de versoes antigas quando a nova ativa.
        cleanupOutdatedCaches: true,
        // Transicao unica: quem ainda tem o service worker antigo (autoUpdate) nao sabe pedir a troca. Este
        // arquivo faz a PRIMEIRA versao "prompt" assumir na hora, como o antigo fazia. Dai em diante vale o aviso.
        importScripts: ["sw-transicao.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        globIgnores: ["sw-transicao.js"],
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
              fetchOptions: { cache: "no-cache" }, // revalida (304) em vez de aceitar o cache HTTP de ate 10 min do Pages
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Cartas, glossario e "Entenda o baralho" tambem mudam a cada versao: rede primeiro, cache so como reserva
            // offline, para nunca aparecer tela nova com dado antigo.
            urlPattern: ({ url }) => ["/data/cards.json", "/data/glossario.json", "/data/entenda-baralho.json"].includes(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "aeon-dados-base",
              networkTimeoutSeconds: 4,
              fetchOptions: { cache: "no-cache" },
              expiration: { maxEntries: 6, maxAgeSeconds: 60 * 60 * 24 * 90 },
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
