import{s as o}from"./storage-CiteaeKf.js";import{l as c}from"./cardsUtil-H_foYc3n.js";class n extends HTMLElement{connectedCallback(){this.innerHTML=`
            <div class="three-card-game">
                <div class="card-container" id="cards"></div>
                <button id="drawCards">Sortear Cartas</button>
                <button onclick="navigateTo('home')">Voltar</button>
            </div>
        `,document.getElementById("drawCards").addEventListener("click",this.drawThreeCards.bind(this))}async drawThreeCards(){try{const r=(await c()).sort(()=>.5-Math.random()).slice(0,3),e=this.querySelector("#cards"),t=["Passado","Presente","Futuro"];e.innerHTML=r.map((s,d)=>`
                    <div  class="card-three">
                        <h3>${t[d]}</h3>
                        <tarot-card data-card='${JSON.stringify(s)}' show-back></tarot-card>
                    </div>
                    `).join(""),o({passado:r[0],presente:r[1],futuro:r[2]})}catch(a){console.error("Erro ao carregar as cartas:",a)}}}customElements.define("three-card-game-screen",n);export{n as ThreeCardGameScreen};
