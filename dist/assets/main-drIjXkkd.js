/* empty css             */(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const a of r)if(a.type==="childList")for(const s of a.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&n(s)}).observe(document,{childList:!0,subtree:!0});function t(r){const a={};return r.integrity&&(a.integrity=r.integrity),r.referrerPolicy&&(a.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?a.credentials="include":r.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function n(r){if(r.ep)return;r.ep=!0;const a=t(r);fetch(r.href,a)}})();function h(o){const e=document.getElementById("app");e.innerHTML="",o==="all-cards"?e.innerHTML="<all-cards-screen></all-cards-screen>":o==="three-card-game"?e.innerHTML="<three-card-game-screen></three-card-game-screen>":o==="history"?e.innerHTML="<history-screen></history-screen>":e.innerHTML="<home-screen></home-screen>"}function v(){document.querySelectorAll("nav a").forEach(e=>{e.addEventListener("click",t=>{const n=e.getAttribute("href");if(n&&n.endsWith(".html"))return;t.preventDefault();const r=e.getAttribute("data-page");console.log("Navegando para:",r),h(r)})})}document.addEventListener("DOMContentLoaded",()=>{v(),h("home")});class b extends HTMLElement{connectedCallback(){this.innerHTML=`
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
        `,document.querySelector("header>h1").textContent="Aeon Fool"}}customElements.define("home-screen",b);const C="modulepreload",S=function(o){return"/"+o},f={},x=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){document.getElementsByTagName("link");const s=document.querySelector("meta[property=csp-nonce]"),i=(s==null?void 0:s.nonce)||(s==null?void 0:s.getAttribute("nonce"));r=Promise.allSettled(t.map(c=>{if(c=S(c),c in f)return;f[c]=!0;const l=c.endsWith(".css"),m=l?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${c}"]${m}`))return;const d=document.createElement("link");if(d.rel=l?"stylesheet":C,l||(d.as="script"),d.crossOrigin="",d.href=c,i&&d.setAttribute("nonce",i),document.head.appendChild(d),l)return new Promise((g,y)=>{d.addEventListener("load",g),d.addEventListener("error",()=>y(new Error(`Unable to preload CSS for ${c}`)))})}))}function a(s){const i=new Event("vite:preloadError",{cancelable:!0});if(i.payload=s,window.dispatchEvent(i),!i.defaultPrevented)throw s}return r.then(s=>{for(const i of s||[])i.status==="rejected"&&a(i.reason);return e().catch(a)})};let u=null;async function p(){if(u)return u;try{const e=await(await fetch("data/cards.json")).json();return u=e,e}catch(o){throw console.error("Erro ao carregar as cartas:",o),o}}x(()=>import("./TarotCard-DGDAberQ.js"),[]);class T extends HTMLElement{async connectedCallback(){this.innerHTML=`
            <section class="all-cards-screen">
                <div class="card-container" id="all-cards"></div>
                <button onclick="navigateTo('home')">Voltar</button>
            </section>
        `,document.querySelector("header>h1").textContent="Tarot de Thoth",await this.renderCards()}async renderCards(){try{const e=await p();e.sort((n,r)=>n.order-r.order);const t=this.querySelector("#all-cards");t.innerHTML=e.map(n=>`
                        <tarot-card data-card='${JSON.stringify(n)}'></tarot-card>
                    `).join("")}catch(e){console.error("Erro ao carregar as cartas:",e)}}}customElements.define("all-cards-screen",T);function q(o){console.log(o);const e=JSON.parse(localStorage.getItem("tarotHistory"))||[];e.push({date:new Date().toLocaleString(),cards:o}),localStorage.setItem("tarotHistory",JSON.stringify(e))}function w(){return JSON.parse(localStorage.getItem("tarotHistory"))||[]}class E extends HTMLElement{connectedCallback(){this.innerHTML=`
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
        `,document.querySelector("header>h1").textContent="Jogo das 3 Cartas",document.getElementById("drawCards").addEventListener("click",this.drawThreeCards.bind(this))}async drawThreeCards(){try{const t=(await p()).sort(()=>.5-Math.random()).slice(0,3),n=this.querySelector("#cards"),r=["Passado","Presente","Futuro"];n.innerHTML=t.map((a,s)=>`
                    <div  class="card-three">
                        <h3>${r[s]}</h3>
                        <tarot-card data-card='${JSON.stringify(a)}' show-back></tarot-card>
                    </div>
                    `).join(""),q({passado:t[0],presente:t[1],futuro:t[2]})}catch(e){console.error("Erro ao carregar as cartas:",e)}}}customElements.define("three-card-game-screen",E);class L extends HTMLElement{connectedCallback(){const e=w();this.innerHTML=`
            <section class="history-screen">
                <ul>
                    ${e.map(t=>{const n=Object.values(t.cards);return`
                                <li>${t.date}: ${n.map(r=>r.name).join(", ")}</li>
                            `}).join("")}
                </ul>
                <button onclick="navigateTo('home')">Voltar</button>
            </section>
        `,document.querySelector("header>h1").textContent="Histórico de Leituras"}}customElements.define("history-screen",L);class A extends HTMLElement{connectedCallback(){this.innerHTML=`
            <div class="tarot-card-info">
                <div class="info-content">
                    <h3 id="card-title"></h3>
                    <img id="card-image" src="assets/back.jpg" alt="Carta não revelada">
                    <p id="card-name"></p>
                    <p id="card-description"></p>
                    <div class="card-border">
                        <p>
                            <strong>Descrição Simbólica: </strong><br><spam id="card-symbolic-description"></spam>
                        </p>
                        <p>
                            <strong>Mensagem Esotérica: </strong><br><spam id="card-message-esoteric"></spam>
                        </p>
                    </div>
                    <div class="card-border">
                        <p >
                            <strong>Oitava Maior: </strong><spam id="card-maior"></spam>
                        </p>
                        <p >    
                            <strong>Oitava Menor: </strong><spam id="card-menor"></spam>
                        </p>                    
                    </div>
                    <div class="card-border non-wrap">
                        <p id="card-numero">
                            <strong>Número: </strong><spam></spam>
                        </p>
                        <p id="card-arcano">
                            <strong>Arcano: </strong><spam></spam>
                        </p>
                        <p id="card-suit">
                            <strong>Naipe: </strong><spam></spam>
                        </p>
                        <p id="card-element">
                            <strong>Elemento: </strong><spam></spam>
                        </p>
                        <p id="card-astrology">
                            <strong>Astrologia: </strong><spam></spam>
                        </p>
                    </div>
                    <div class="card-border">
                        <p><strong>Alquimia Interna: </strong><spam id="card-internal-alchemy"></spam></p>
                        <p><strong>Prática Mágica: </strong><spam id="card-magical-practice"></spam></p>
                    </div>
                    <div id="card-meditation-reflection"></div>
                    <div id="card-past-present-future"></div>
                    <button id="close-info">Fechar</button>
                </div>
            </div>
        `,this.querySelector("#close-info").addEventListener("click",()=>this.hideInfo())}showInfo(e){var a,s,i;let t="Não disponível";this.querySelector(".info-content").dataset.element=e.element,this.querySelector("#card-image").src=`cards/crowley-${e.order}.jpg`||"assets/back.jpg",this.querySelector("#card-image").alt=e.name||t,this.querySelector("#card-title").textContent=e.title||t,this.querySelector("#card-name").textContent=e.name||t,this.querySelector("#card-description").textContent=e.description||t,this.querySelector("#card-symbolic-description").textContent=e.description_symbolic||t,this.querySelector("#card-message-esoteric").textContent=e.message_esoteric||t,this.querySelector("#card-numero").lastChild.textContent=`${e.number}`||t,this.querySelector("#card-arcano").lastChild.textContent=e.isMajorArcana?"Maior":"Menor",this.querySelector("#card-suit").setAttribute("hidden",!1),this.querySelector("#card-suit").lastChild.textContent=e.suit?e.suit:this.querySelector("#card-suit").setAttribute("hidden",!0),this.querySelector("#card-element").lastChild.textContent=e.element?e.element:t,this.querySelector("#card-astrology").lastChild.textContent=e.astrology?e.astrology:"",this.querySelector("#card-maior").textContent=e.eighth_greater||t,this.querySelector("#card-menor").textContent=e.eighth_lesser||t,this.querySelector("#card-internal-alchemy").textContent=e.internal_alchemy||t,this.querySelector("#card-magical-practice").textContent=e.magical_practice||t;const n=this.querySelector("#card-meditation-reflection");if(n.innerHTML="<strong>Meditação e Reflexão:</strong>",e.meditation_reflection){const c=document.createElement("ul");e.meditation_reflection.forEach(l=>{const m=document.createElement("li");m.textContent=l,c.appendChild(m)}),n.appendChild(c)}else n.textContent+=" Não disponível.";const r=this.querySelector("#card-past-present-future");r.innerHTML=`
            <p><strong>Passado:</strong> <br> ${((a=e.past_present_future)==null?void 0:a.past)||"Não disponível."}</p>
            <p><strong>Presente:</strong> <br> ${((s=e.past_present_future)==null?void 0:s.present)||"Não disponível."}</p>
            <p><strong>Futuro:</strong> <br> ${((i=e.past_present_future)==null?void 0:i.future)||"Não disponível."}</p>
        `,this.removeAttribute("hidden")}hideInfo(){this.setAttribute("hidden",!0)}}customElements.define("tarot-card-info",A);window.navigateTo=h;
