if(!self.define){let e,r={};const a=(a,i)=>(a=new URL(a+".js",i).href,r[a]||new Promise((r=>{if("document"in self){const e=document.createElement("script");e.src=a,e.onload=r,document.head.appendChild(e)}else e=a,importScripts(a),r()})).then((()=>{let e=r[a];if(!e)throw new Error(`Module ${a} didn’t register its module`);return e})));self.define=(i,o)=>{const n=e||("document"in self?document.currentScript.src:"")||location.href;if(r[n])return;let s={};const d=e=>a(e,n),t={module:{uri:n},exports:s,require:d};r[n]=Promise.all(i.map((e=>t[e]||d(e)))).then((e=>(o(...e),s)))}}define(["./workbox-5ffe50d4"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"~partytown/debug/partytown-atomics.js",revision:"caf1192dc999b5ab6071eccf96dc263a"},{url:"~partytown/debug/partytown-media.js",revision:"daa6b3c9b70363ba17320540005a8f19"},{url:"~partytown/debug/partytown-sandbox-sw.js",revision:"32a200ab0482a18e6bb6278a293969b7"},{url:"~partytown/debug/partytown-sw.js",revision:"c5d2e0bd2330eb14f52dd9a8d1aad960"},{url:"~partytown/debug/partytown-ww-atomics.js",revision:"d008e89109cf306131ce7aae5aa26bb7"},{url:"~partytown/debug/partytown-ww-sw.js",revision:"1ca089fe6c595b395d0213b1384f706e"},{url:"~partytown/debug/partytown.js",revision:"75d34fb2c681007dfbfb8b1a8a8f0aef"},{url:"~partytown/partytown-atomics.js",revision:"4a47a144c02e6b188ce2a8a4df50b91b"},{url:"~partytown/partytown-media.js",revision:"def973b7aba24bfb2c73b101d58af5ca"},{url:"~partytown/partytown-sw.js",revision:"16b1f0e03c0a4b4caf709777aa648de0"},{url:"~partytown/partytown.js",revision:"5cf74ff7b175d3d2152a4aebc3debc6f"},{url:"apple-touch-icon.png",revision:"c77d38204869b4debe8d46be36116970"},{url:"assets/main-CoXqQR9c.css",revision:null},{url:"assets/main-Dd8vA9fl.js",revision:null},{url:"assets/TarotCard-Bh-unjn7.js",revision:null},{url:"assets/TarotCardInfo-7sZO2UmR.js",revision:null},{url:"contato.html",revision:"f9b71e931fd52f5e230fbd8fba34b0d6"},{url:"favicon-16x16.png",revision:"72c9294be56951f1881ac3af01041a0f"},{url:"favicon-32x32.png",revision:"42be30d6e1f30d3738c01fea622e0450"},{url:"favicon.ico",revision:"6e36469ad8c2e4e6f8fc6e8031a0d496"},{url:"icons/android-chrome-192x192.png",revision:"d6281ad63e2d9975d75afee9d9c2507d"},{url:"icons/android-chrome-512x512.png",revision:"26aa0308e868f58c9893bb2e24bf2bb5"},{url:"images/logo.png",revision:"09a2e9a47744036bfd480d5e33fe1ff8"},{url:"images/preview.png",revision:"a8075fa63b84acaa0235546b34987cb4"},{url:"index.html",revision:"efd0e5df6480b6ec8899ce8e7233d149"},{url:"livro.html",revision:"00b81b4fd80ebee078569b2e2a8fb66b"},{url:"politica-privacidade.html",revision:"01a319e0445552a63f61b34ab301445d"},{url:"registerSW.js",revision:"1872c500de691dce40960bb85481de07"},{url:"sobre.html",revision:"10de7ebc727dd5fc00403bff354501c5"},{url:"favicon.ico",revision:"6e36469ad8c2e4e6f8fc6e8031a0d496"},{url:"robots.txt",revision:"67c16322eda3c64d2f5cb889a7937fa4"},{url:"icons/android-chrome-192x192.png",revision:"d6281ad63e2d9975d75afee9d9c2507d"},{url:"icons/android-chrome-512x512.png",revision:"26aa0308e868f58c9893bb2e24bf2bb5"},{url:"manifest.webmanifest",revision:"6ea2ffeb5ba3e573252fc0848cf78b24"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))}));
//# sourceMappingURL=sw.js.map
