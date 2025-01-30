import{_ as o}from"./index-D_NjZ1G0.js";import{l as s}from"./cardsUtil-H_foYc3n.js";o(()=>import("./TarotCard-BhMfcB2C.js"),[]);class c extends HTMLElement{async connectedCallback(){this.innerHTML=`
            <div class="all-cards-screen">
                <div class="card-container" id="all-cards"></div>
                <button onclick="navigateTo('home')">Voltar</button>
            </div>
        `,document.querySelector("header>h1").textContent="Todas as Cartas",await this.renderCards()}async renderCards(){try{const r=await s();r.sort((a,t)=>a.order-t.order);const e=this.querySelector("#all-cards");e.innerHTML=r.map(a=>`
                        <tarot-card data-card='${JSON.stringify(a)}'></tarot-card>
                    `).join("")}catch(r){console.error("Erro ao carregar as cartas:",r)}}}customElements.define("all-cards-screen",c);export{c as AllCardsScreen};
