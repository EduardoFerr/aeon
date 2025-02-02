/* empty css             */(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const t of document.querySelectorAll('link[rel="modulepreload"]'))n(t);new MutationObserver(t=>{for(const s of t)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function a(t){const s={};return t.integrity&&(s.integrity=t.integrity),t.referrerPolicy&&(s.referrerPolicy=t.referrerPolicy),t.crossOrigin==="use-credentials"?s.credentials="include":t.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(t){if(t.ep)return;t.ep=!0;const s=a(t);fetch(t.href,s)}})();function f(r){const e=document.getElementById("app");e.innerHTML="",r==="all-cards"?e.innerHTML="<all-cards-screen></all-cards-screen>":r==="three-card-game"?e.innerHTML="<three-card-game-screen></three-card-game-screen>":r==="history"?e.innerHTML="<history-screen></history-screen>":e.innerHTML="<home-screen></home-screen>"}function b(){document.querySelectorAll("nav a").forEach(e=>{e.addEventListener("click",a=>{const n=e.getAttribute("href");if(n&&n.endsWith(".html"))return;a.preventDefault();const t=e.getAttribute("data-page");f(t)})})}document.addEventListener("DOMContentLoaded",()=>{b(),f("home")});class T extends HTMLElement{connectedCallback(){this.innerHTML=`
            <section class="home-screen">
                <div class="intro">
                    <h2>Bem-vindo ao Tarot de Thoth</h2>
                    <p>
                        O <strong>Tarot de Thoth</strong> é uma ferramenta esotérica que une o Hermetismo, a Cabala, a Astrologia e a Alquimia em um sistema de autoconhecimento profundo. Criado por <strong>Aleister Crowley</strong> e ilustrado por <strong>Lady Frieda Harris</strong>, cada carta foi meticulosamente projetada para representar os segredos do universo através de símbolos arquetípicos.
                    </p>
                    <p>
                        O baralho é inspirado no deus egípcio <strong>Thoth</strong>, patrono da sabedoria, escrita e magia, e na figura de <strong>Hermes Trismegisto</strong>, o mestre dos segredos ocultos, cuja filosofia hermética ensina que "o que está acima é como o que está abaixo". Esses princípios são interligados à Cabala e à astrologia, formando uma base sólida para o entendimento espiritual.
                    </p>
                </div>

                <div class="hermetic-knowledge">
                    <h3>Como o Hermetismo, a Cabala e a Astrologia se relacionam no Tarot de Thoth?</h3>
                    <p>
                        O <strong>Hermetismo</strong> fornece a base filosófica do tarot através de seus sete princípios universais, como a correspondência (“o que está acima é como o que está abaixo”), o ritmo e a vibração. Esses conceitos guiam a leitura das cartas, mostrando como as energias cósmicas afetam nossa vida.
                    </p>
                    <p>
                        A <strong>Cabala</strong> se manifesta no tarot através da <strong>Árvore da Vida</strong>, uma estrutura de 10 esferas (Sephirot) conectadas por 22 caminhos. Cada um desses caminhos está associado a uma carta dos <strong>Arcanos Maiores</strong>, representando etapas do crescimento espiritual. Assim, quando interpretamos uma carta, estamos lidando com energias específicas da criação divina.
                    </p>
                    <p>
                        Já a <strong>Astrologia</strong> fornece um mapa energético que conecta cada carta a um signo do zodíaco, planeta ou elemento.
                    </p>
                </div>
            </section>
        `,document.querySelector("header>h1").textContent="Aeon Fool"}}customElements.define("home-screen",T);const w="modulepreload",E=function(r){return"/"+r},h={},m=function(e,a,n){let t=Promise.resolve();if(a&&a.length>0){document.getElementsByTagName("link");const o=document.querySelector("meta[property=csp-nonce]"),i=(o==null?void 0:o.nonce)||(o==null?void 0:o.getAttribute("nonce"));t=Promise.allSettled(a.map(c=>{if(c=E(c),c in h)return;h[c]=!0;const l=c.endsWith(".css"),p=l?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${c}"]${p}`))return;const d=document.createElement("link");if(d.rel=l?"stylesheet":w,l||(d.as="script"),d.crossOrigin="",d.href=c,i&&d.setAttribute("nonce",i),document.head.appendChild(d),l)return new Promise((y,v)=>{d.addEventListener("load",y),d.addEventListener("error",()=>v(new Error(`Unable to preload CSS for ${c}`)))})}))}function s(o){const i=new Event("vite:preloadError",{cancelable:!0});if(i.payload=o,window.dispatchEvent(i),!i.defaultPrevented)throw o}return t.then(o=>{for(const i of o||[])i.status==="rejected"&&s(i.reason);return e().catch(s)})};let u=null;async function g(){if(u)return u;try{const e=await(await fetch("/data/cards.json")).json();return u=e,e}catch(r){throw console.error("Erro ao carregar as cartas:",r),r}}m(()=>import("./TarotCard-Bh-unjn7.js"),[]);m(()=>import("./TarotCardInfo-7sZO2UmR.js"),[]);class C extends HTMLElement{async connectedCallback(){this.innerHTML=`
            <section class="all-cards-screen">
                <div class="card-container" id="all-cards"></div>
                <button onclick="navigateTo('home')">Voltar</button>
            </section>
        `,document.querySelector("header>h1").textContent="Tarot de Thoth",await this.renderCards()}async renderCards(){try{const e=await g();e.sort((n,t)=>n.order-t.order);const a=this.querySelector("#all-cards");a.innerHTML=e.map(n=>`
                        <tarot-card data-card='${JSON.stringify(n)}'></tarot-card>
                    `).join("")}catch(e){console.error("Erro ao carregar as cartas:",e)}}}customElements.define("all-cards-screen",C);function L(r){const e=JSON.parse(localStorage.getItem("tarotHistory"))||[];e.push({date:new Date().toLocaleString(),cards:r}),localStorage.setItem("tarotHistory",JSON.stringify(e))}function x(){return JSON.parse(localStorage.getItem("tarotHistory"))||[]}m(()=>import("./TarotCardInfo-7sZO2UmR.js"),[]);class S extends HTMLElement{connectedCallback(){this.innerHTML=`
            <section class="three-card-game">

                <div class="card-container" id="cards">
                    <div class="card-three">
                        <h3>Passado</h3>
                        <tarot-card  show-back="">
                            <div class="tarot-card flipped arcano-maior">
                            
                            </div>
                        </tarot-card>
                    </div>
                    <div class="card-three">
                        <h3>Presente</h3>
                        <tarot-card  show-back="">
                            <div class="tarot-card flipped arcano-maior">
                            
                            </div>
                        </tarot-card>
                    </div>
                    <div class="card-three">
                        <h3>Futuro</h3>
                        <tarot-card  show-back="">
                            <div class="tarot-card flipped arcano-maior">
                            
                            </div>
                        </tarot-card>
                    </div>
                </div>

                <button class="nav-button" id="drawCards">
                    <svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 150 40" class="icon">
                        <!-- Primeira carta -->
                        <rect x="5" y="5" width="20" height="30" rx="2" ry="2" fill="#4A2C6F" stroke="#ffffff" stroke-width="1.5" />
                        <text x="12" y="25" font-size="7" fill="#ffffff" font-family="Arial">A</text>

                        <!-- Segunda carta ligeiramente deslocada -->
                        <rect x="15" y="10" width="20" height="30" rx="2" ry="2" fill="#6A3595" stroke="#ffffff" stroke-width="1.5" />
                        <text x="22" y="30" font-size="7" fill="#ffffff" font-family="Arial">K</text>

                        <!-- Terceira carta ligeiramente deslocada -->
                        <rect x="25" y="15" width="20" height="30" rx="2" ry="2" fill="#8E44AD" stroke="#ffffff" stroke-width="1.5" />
                        <text x="32" y="35" font-size="7" fill="#ffffff" font-family="Arial">Q</text>

                        <!-- Texto "Tirar Cartas" ao lado das cartas -->
                        <text x="55" y="25" font-size="12" fill="#ffffff" font-family="Arial" font-weight="bold">
                        Tirar Cartas
                        </text>
                    </svg>
                </button>

                <button onclick="navigateTo('home')">Voltar</button>
            </section>
        `,document.querySelector("header>h1").textContent="Jogo das 3 Cartas",document.getElementById("drawCards").addEventListener("click",this.drawThreeCards.bind(this))}async drawThreeCards(){try{const a=(await g()).sort(()=>.5-Math.random()).slice(0,3),n=this.querySelector("#cards"),t=["Passado","Presente","Futuro"];n.innerHTML=a.map((s,o)=>`
                    <div  class="card-three">
                        <h3>${t[o]}</h3>
                        <tarot-card data-card='${JSON.stringify(s)}' show-back></tarot-card>
                    </div>
                    `).join(""),L({passado:a[0],presente:a[1],futuro:a[2]})}catch(e){console.error("Erro ao carregar as cartas:",e)}}}customElements.define("three-card-game-screen",S);class H extends HTMLElement{connectedCallback(){const e=x();this.innerHTML=`
            <section class="history-screen">
                <ul>
                    ${e.map(a=>{const n=Object.values(a.cards);return`
                                <li>${a.date}: ${n.map(t=>t.name).join(", ")}</li>
                            `}).join("")}
                </ul>
                <button onclick="navigateTo('home')">Voltar</button>
            </section>
        `,document.querySelector("header>h1").textContent="Histórico de Leituras"}}customElements.define("history-screen",H);window.navigateTo=f;
