import{_ as s}from"./index-BO0WYuw9.js";import{l as c}from"./cardsUtil-H_foYc3n.js";s(()=>import("./TarotCard-BhMfcB2C.js"),[]);class o extends HTMLElement{async connectedCallback(){this.innerHTML=`
            <div class="all-cards-screen">
                <div class="card-container" id="all-cards"></div>
                <button onclick="navigateTo('home')">Voltar</button>
            </div>
        `,await this.renderCards()}async renderCards(){try{const r=await c();r.sort((a,t)=>a.order-t.order);const e=this.querySelector("#all-cards");e.innerHTML=r.map(a=>`
                        <tarot-card data-card='${JSON.stringify(a)}'></tarot-card>
                    `).join("")}catch(r){console.error("Erro ao carregar as cartas:",r)}}}customElements.define("all-cards-screen",o);export{o as AllCardsScreen};
