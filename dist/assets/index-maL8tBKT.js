(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))a(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const o of s.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&a(o)}).observe(document,{childList:!0,subtree:!0});function t(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function a(r){if(r.ep)return;r.ep=!0;const s=t(r);fetch(r.href,s)}})();function h(n){const e=document.getElementById("app");e.innerHTML="",n==="all-cards"?e.innerHTML="<all-cards-screen></all-cards-screen>":n==="three-card-game"?e.innerHTML="<three-card-game-screen></three-card-game-screen>":n==="history"?e.innerHTML="<history-screen></history-screen>":e.innerHTML="<home-screen></home-screen>"}function v(){document.querySelectorAll("nav a").forEach(e=>{e.addEventListener("click",t=>{const a=e.getAttribute("href");if(a&&a.endsWith(".html"))return;t.preventDefault();const r=e.getAttribute("data-page");console.log("Navegando para:",r),h(r)})})}document.addEventListener("DOMContentLoaded",()=>{v(),h("home")});class C extends HTMLElement{connectedCallback(){this.innerHTML=`
            <div class="home-screen">
                <button onclick="navigateTo('all-cards')">Ver Todas as Cartas</button>
                <button onclick="navigateTo('three-card-game')">Jogo das 3 Cartas</button>
                <button onclick="navigateTo('history')">Ver Histórico</button>
            </div>
        `,document.querySelector("header>h1").textContent="Tarot de Thoth"}}customElements.define("home-screen",C);const b="modulepreload",S=function(n){return"/"+n},p={},T=function(e,t,a){let r=Promise.resolve();if(t&&t.length>0){document.getElementsByTagName("link");const o=document.querySelector("meta[property=csp-nonce]"),i=(o==null?void 0:o.nonce)||(o==null?void 0:o.getAttribute("nonce"));r=Promise.allSettled(t.map(c=>{if(c=S(c),c in p)return;p[c]=!0;const l=c.endsWith(".css"),u=l?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${c}"]${u}`))return;const d=document.createElement("link");if(d.rel=l?"stylesheet":b,l||(d.as="script"),d.crossOrigin="",d.href=c,i&&d.setAttribute("nonce",i),document.head.appendChild(d),l)return new Promise((f,y)=>{d.addEventListener("load",f),d.addEventListener("error",()=>y(new Error(`Unable to preload CSS for ${c}`)))})}))}function s(o){const i=new Event("vite:preloadError",{cancelable:!0});if(i.payload=o,window.dispatchEvent(i),!i.defaultPrevented)throw o}return r.then(o=>{for(const i of o||[])i.status==="rejected"&&s(i.reason);return e().catch(s)})};let m=null;async function g(){if(m)return m;try{const e=await(await fetch("assets/data/cards.json")).json();return m=e,e}catch(n){throw console.error("Erro ao carregar as cartas:",n),n}}T(()=>import("./TarotCard-BhMfcB2C.js"),[]);class E extends HTMLElement{async connectedCallback(){this.innerHTML=`
            <div class="all-cards-screen">
                <div class="card-container" id="all-cards"></div>
                <button onclick="navigateTo('home')">Voltar</button>
            </div>
        `,document.querySelector("header>h1").textContent="Todas as Cartas",await this.renderCards()}async renderCards(){try{const e=await g();e.sort((a,r)=>a.order-r.order);const t=this.querySelector("#all-cards");t.innerHTML=e.map(a=>`
                        <tarot-card data-card='${JSON.stringify(a)}'></tarot-card>
                    `).join("")}catch(e){console.error("Erro ao carregar as cartas:",e)}}}customElements.define("all-cards-screen",E);function L(n){console.log(n);const e=JSON.parse(localStorage.getItem("tarotHistory"))||[];e.push({date:new Date().toLocaleString(),cards:n}),localStorage.setItem("tarotHistory",JSON.stringify(e))}function q(){return JSON.parse(localStorage.getItem("tarotHistory"))||[]}class H extends HTMLElement{connectedCallback(){this.innerHTML=`
            <div class="three-card-game">
                <h1>Jogo das 3 Cartas</h1>
                <div class="card-container" id="cards"></div>
                <button id="drawCards">Sortear Cartas</button>
                <button onclick="navigateTo('home')">Voltar</button>
            </div>
        `,document.querySelector("header>h1").textContent="Jogo das 3 Cartas",document.getElementById("drawCards").addEventListener("click",this.drawThreeCards.bind(this))}async drawThreeCards(){try{const t=(await g()).sort(()=>.5-Math.random()).slice(0,3),a=this.querySelector("#cards"),r=["Passado","Presente","Futuro"];a.innerHTML=t.map((s,o)=>`
                    <div  class="card-three">
                        <h3>${r[o]}</h3>
                        <tarot-card data-card='${JSON.stringify(s)}' show-back></tarot-card>
                    </div>
                    `).join(""),L({passado:t[0],presente:t[1],futuro:t[2]})}catch(e){console.error("Erro ao carregar as cartas:",e)}}}customElements.define("three-card-game-screen",H);class M extends HTMLElement{connectedCallback(){const e=q();this.innerHTML=`
            <div class="history-screen">
                <ul>
                    ${e.map(t=>{const a=Object.values(t.cards);return`
                                <li>${t.date}: ${a.map(r=>r.name).join(", ")}</li>
                            `}).join("")}
                </ul>
                <button onclick="navigateTo('home')">Voltar</button>
            </div>
        `,document.querySelector("header>h1").textContent="Histórico de Leituras"}}customElements.define("history-screen",M);class x extends HTMLElement{connectedCallback(){this.innerHTML=`
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
        `,this.querySelector("#close-info").addEventListener("click",()=>this.hideInfo())}showInfo(e){var s,o,i;let t="Não disponível";this.querySelector(".info-content").dataset.element=e.element,this.querySelector("#card-image").src=`assets/cards/crowley-${e.order}.jpg`||"assets/back.jpg",this.querySelector("#card-image").alt=e.name||t,this.querySelector("#card-title").textContent=e.title||t,this.querySelector("#card-name").textContent=e.name||t,this.querySelector("#card-description").textContent=e.description||t,this.querySelector("#card-symbolic-description").textContent=e.description_symbolic||t,this.querySelector("#card-message-esoteric").textContent=e.message_esoteric||t,this.querySelector("#card-numero").lastChild.textContent=`${e.number}`||t,this.querySelector("#card-arcano").lastChild.textContent=e.isMajorArcana?"Maior":"Menor",this.querySelector("#card-suit").setAttribute("hidden",!1),this.querySelector("#card-suit").lastChild.textContent=e.suit?e.suit:this.querySelector("#card-suit").setAttribute("hidden",!0),this.querySelector("#card-element").lastChild.textContent=e.element?e.element:t,this.querySelector("#card-astrology").lastChild.textContent=e.astrology?e.astrology:"",this.querySelector("#card-maior").textContent=e.eighth_greater||t,this.querySelector("#card-menor").textContent=e.eighth_lesser||t,this.querySelector("#card-internal-alchemy").textContent=e.internal_alchemy||t,this.querySelector("#card-magical-practice").textContent=e.magical_practice||t;const a=this.querySelector("#card-meditation-reflection");if(a.innerHTML="<strong>Meditação e Reflexão:</strong>",e.meditation_reflection){const c=document.createElement("ul");e.meditation_reflection.forEach(l=>{const u=document.createElement("li");u.textContent=l,c.appendChild(u)}),a.appendChild(c)}else a.textContent+=" Não disponível.";const r=this.querySelector("#card-past-present-future");r.innerHTML=`
            <p><strong>Passado:</strong> <br> ${((s=e.past_present_future)==null?void 0:s.past)||"Não disponível."}</p>
            <p><strong>Presente:</strong> <br> ${((o=e.past_present_future)==null?void 0:o.present)||"Não disponível."}</p>
            <p><strong>Futuro:</strong> <br> ${((i=e.past_present_future)==null?void 0:i.future)||"Não disponível."}</p>
        `,this.removeAttribute("hidden")}hideInfo(){this.setAttribute("hidden",!0)}}customElements.define("tarot-card-info",x);window.navigateTo=h;
