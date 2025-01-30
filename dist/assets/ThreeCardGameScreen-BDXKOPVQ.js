import{s as d}from"./storage-CiteaeKf.js";import{l as c}from"./cardsUtil-H_foYc3n.js";class n extends HTMLElement{connectedCallback(){this.innerHTML=`
            <div class="three-card-game">
                <h1>Jogo das 3 Cartas</h1>
                <div class="card-container" id="cards"></div>
                <button id="drawCards">Sortear Cartas</button>
                <button onclick="navigateTo('home')">Voltar</button>
            </div>
        `,document.querySelector("header>h1").textContent="Jogo das 3 Cartas",document.getElementById("drawCards").addEventListener("click",this.drawThreeCards.bind(this))}async drawThreeCards(){try{const a=(await c()).sort(()=>.5-Math.random()).slice(0,3),e=this.querySelector("#cards"),t=["Passado","Presente","Futuro"];e.innerHTML=a.map((s,o)=>`
                    <div  class="card-three">
                        <h3>${t[o]}</h3>
                        <tarot-card data-card='${JSON.stringify(s)}' show-back></tarot-card>
                    </div>
                    `).join(""),d({passado:a[0],presente:a[1],futuro:a[2]})}catch(r){console.error("Erro ao carregar as cartas:",r)}}}customElements.define("three-card-game-screen",n);export{n as ThreeCardGameScreen};
